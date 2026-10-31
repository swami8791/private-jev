import test from 'node:test';
import assert from 'node:assert/strict';
import { createJev } from '../src/service.ts';
import { input, provider } from './fixtures.mjs';
const config = { apiKey: 'mock-secret-never-real', ownerId: 'site-owner' };
const dependencies = (fetch) => ({fetch, now:()=>new Date('2026-10-25T12:00:00Z'), requestId:()=> 'local-request-id'});
const response = () => new Response(JSON.stringify(provider()));
const forbidden = () => { throw new Error('NETWORK MUST NOT BE USED'); };
test('status reports only configured state and the callers own identity without provider request', () => {
  const result = createJev(config, 'someone-else', dependencies(forbidden)).status({});
  assert.deepEqual(result, { api_key_configured:true,owner_configured:true,caller_is_owner:false,caller_site_user_id:'someone-else',requested_model:'jev-1.14.0',disclaimer:'Model judgment on supplied content; not independent fact verification.' });
  assert.ok(!JSON.stringify(result).includes(config.apiKey));assert.ok(!JSON.stringify(result).includes(config.ownerId));
});
test('unconfigured status is truthful and rejects unknown status arguments', () => {
  const service=createJev({},null,dependencies(forbidden));
  assert.equal(service.status({}).api_key_configured,false);
  assert.equal(service.status({}).caller_site_user_id,null);
  assert.throws(()=>service.status({ key:'no' }),/INVALID_INPUT/);
});
for (const [name,settings,caller,code] of [
 ['missing identity',config,null,'UNAUTHORIZED'],['wrong owner',config,'other','FORBIDDEN'],
 ['missing owner',{apiKey:config.apiKey},'site-owner','NOT_CONFIGURED'],
 ['missing key',{ownerId:config.ownerId},'site-owner','NOT_CONFIGURED'],
 ['blank owner',{...config,ownerId:' '},'site-owner','NOT_CONFIGURED'],
]) test(`evaluation fails closed: ${name}`, async () => {
 let calls=0; const service=createJev(settings,caller,dependencies(()=>{calls++;return response();}));
 await assert.rejects(service.evaluate(input()),new RegExp(code));assert.equal(calls,0);
});
test('one fixed HTTPS POST preserves provider shapes, strips sources and adds safe metadata', async () => {
 let calls=0;
 const service=createJev(config,'site-owner',dependencies(async (url, options)=>{
  calls++;assert.equal(url,'https://api.typesafe.ai/v1/systemone');assert.equal(options.method,'POST');
  assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');
  assert.deepEqual(options.headers,{'Authorization':'Bearer mock-secret-never-real','Content-Type':'application/json'});
  const expected=input();delete expected.sources;assert.deepEqual(JSON.parse(options.body),{model:'jev-1.14.0',...expected});
  assert.ok(options.signal instanceof AbortSignal);return response();
 }));
 const result=await service.evaluate(input());assert.equal(calls,1);
 assert.equal(result.answers.severity.score_100,75);assert.equal(result.answers.refund.confidence,null);
 assert.equal(result.needs_review,true);assert.equal(result.provider,'TypeSafe');
 assert.equal(result.requested_model,'jev-1.14.0');assert.equal(result.returned_model,'jev-1.14.0');
 assert.equal(result.evaluated_at,'2026-10-25T12:00:00.000Z');assert.equal(result.request_id,'local-request-id');
 assert.equal(result.verification_status,'not_fact_checked');
 assert.deepEqual(result.usage,{input_tokens:100,output_tokens:20});
 assert.deepEqual(result.sources,[{...input().sources[0],verification_status:'unverified'}]);
 assert.ok(!JSON.stringify(result).includes(config.apiKey));
});
for(const [status,code] of [[400,'PROVIDER_INVALID_REQUEST'],[422,'PROVIDER_INVALID_REQUEST'],[401,'PROVIDER_AUTH'],[403,'PROVIDER_AUTH'],[429,'PROVIDER_BUSY'],[529,'PROVIDER_BUSY'],[500,'PROVIDER_ERROR'],[302,'PROVIDER_ERROR']]) test(`sanitizes HTTP ${status} with no retry`,async()=>{
 let calls=0;
 const service=createJev(config,'site-owner',dependencies(async()=>{calls++;return new Response('leaked-secret',{status});}));
 await assert.rejects(service.evaluate(input()),error=>error.message===code && !JSON.stringify(error).includes('leaked-secret'));
 assert.equal(calls,1);
});
test('sanitizes network errors and malformed JSON',async()=>{
 for(const fetch of [async()=>{throw Error(config.apiKey);},async()=>new Response('not-json')]) {
  await assert.rejects(createJev(config,'site-owner',dependencies(fetch)).evaluate(input()),error=>['PROVIDER_UNAVAILABLE','MALFORMED_RESPONSE'].includes(error.message));
 }
});
test('invalid inputs never reach provider',async()=>{
 let calls=0;const service=createJev(config,'site-owner',dependencies(async()=>{calls++;return response();}));
 await assert.rejects(service.evaluate({...input(),state:''}),/INVALID_INPUT/);assert.equal(calls,0);
});
test('caps streamed responses at 128KiB and cancels reader',async()=>{
 let cancelled=false;
 const body=new ReadableStream({pull(controller){controller.enqueue(new Uint8Array(65537));},cancel(){cancelled=true;}});
 const service=createJev(config,'site-owner',dependencies(async()=>new Response(body)));
 await assert.rejects(service.evaluate(input()),/RESPONSE_TOO_LARGE/);assert.equal(cancelled,true);
});
for(const phase of ['headers','body']) test(`20 second deadline covers ${phase}, aborts and does not retry`,async t=>{
 t.mock.timers.enable({apis:['setTimeout']});let signal;let calls=0;let cancelled=false;
 const service=createJev(config,'site-owner',dependencies(async (_url,options)=>{
  calls++;signal=options.signal;
  if(phase==='headers')return new Promise(()=>{});
  return new Response(new ReadableStream({cancel(){cancelled=true;}}));
 }));
 const promise=service.evaluate(input());const rejection=assert.rejects(promise,/TIMEOUT/);
 // Let fetch and stream-reader microtasks run before advancing the deadline.
 for(let i=0;i<8;i++)await Promise.resolve();
 t.mock.timers.tick(19999);assert.equal(signal.aborted,false);
 t.mock.timers.tick(1);await rejection;assert.equal(signal.aborted,true);assert.equal(calls,1);
 if(phase==='body')assert.equal(cancelled,true);
});
