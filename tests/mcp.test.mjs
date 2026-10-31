import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp } from '../src/mcp.ts';
import { input, provider } from './fixtures.mjs';
const env = { TYPESAFE_API_KEY:'fake-key', JEV_OWNER_SITE_USER_ID:'owner' };
function request(method, params, caller='owner') {
 return new Request('https://private.example/mcp',{method:'POST',headers:{'content-type':'application/json',...(caller?{'oai-authenticated-user-id':caller}:{})},body:JSON.stringify({jsonrpc:'2.0',id:1,method,...(params?{params}:{})})});
}
const never=async()=>{throw Error('Unexpected provider request');};
test('discovery and tool list use documented MCP contract and strict schemas',async()=>{
 const discovery=await handleMcp(request('server/discover'),{}, {fetch:never});
 assert.equal(discovery.headers.get('cache-control'),'no-store');
 assert.deepEqual(await discovery.json(),{jsonrpc:'2.0',id:1,result:{supportedVersions:['2026-07-28'],capabilities:{tools:{}}}});
 const listed=await (await handleMcp(request('tools/list'),{}, {fetch:never})).json();
 assert.deepEqual(listed.result.tools.map(tool=>tool.name),['jev_status','jev_evaluate']);
 for(const tool of listed.result.tools)assert.equal(tool.inputSchema.additionalProperties,false);
 assert.deepEqual(listed.result.tools[1].inputSchema.required,['state','questions']);
});
test('status call returns caller identity and no secrets in MCP content',async()=>{
 const res=await handleMcp(request('tools/call',{name:'jev_status',arguments:{}},'other'),env,{fetch:never});
 const result=await res.json();assert.equal(result.result.isError,false);
 const status=JSON.parse(result.result.content[0].text);assert.equal(status.caller_site_user_id,'other');
 assert.equal(status.caller_is_owner,false);assert.ok(!JSON.stringify(result).includes('fake-key'));
});
test('synthetic three-question tool call works end-to-end with injected provider',async()=>{
 let calls=0;const res=await handleMcp(request('tools/call',{name:'jev_evaluate',arguments:input()}),env,{fetch:async()=>{calls++;return new Response(JSON.stringify(provider()));}});
 const message=await res.json();assert.equal(message.result.isError,false);assert.equal(calls,1);
 const result=JSON.parse(message.result.content[0].text);assert.equal(result.answers.severity.score_100,75);assert.equal(result.verification_status,'not_fact_checked');
});
test('service bypass headers do not supply visitor identity',async()=>{
 const req=request('tools/call',{name:'jev_evaluate',arguments:input()},null);req.headers.set('OAI-Sites-Authorization','Bearer fake-bypass');
 const result=await (await handleMcp(req,env,{fetch:never})).json();
 assert.equal(result.result.isError,true);assert.deepEqual(JSON.parse(result.result.content[0].text),{error:'UNAUTHORIZED'});
});
test('nonowner cannot evaluate via transport',async()=>{
 const result=await(await handleMcp(request('tools/call',{name:'jev_evaluate',arguments:input()},'other'),env,{fetch:never})).json();
 assert.equal(JSON.parse(result.result.content[0].text).error,'FORBIDDEN');
});
for(const [name,body,code] of [
 ['broken JSON','{',-32700],['unknown method',JSON.stringify({jsonrpc:'2.0',id:1,method:'run'}),-32601],
 ['unknown envelope field',JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',secret:'x'}),-32600],
 ['missing id',JSON.stringify({jsonrpc:'2.0',method:'tools/call',params:{name:'jev_evaluate',arguments:input()}}),-32600],
 ['unknown tool',JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'other',arguments:{}}}),-32602],
 ['batch',JSON.stringify([{jsonrpc:'2.0',id:1,method:'tools/list'}]),-32600],
])test(`rejects ${name} with safe RPC error`,async()=>{
 const res=await handleMcp(new Request('https://private.example/mcp',{method:'POST',headers:{'content-type':'application/json'},body}),env,{fetch:never});
 assert.equal(res.headers.get('cache-control'),'no-store');assert.equal((await res.json()).error.code,code);
});
test('bounds HTTP bytes including whitespace and multibyte content',async()=>{
 const res=await handleMcp(new Request('https://private.example/mcp',{method:'POST',headers:{'content-type':'application/json'},body:' '.repeat(32769)}),env,{fetch:never});
 assert.equal(res.status,413);assert.equal(res.headers.get('cache-control'),'no-store');
});
test('rejects unsupported method and media type without provider calls',async()=>{
 for(const [req,status] of [[new Request('https://private.example/mcp'),405],[new Request('https://private.example/mcp',{method:'POST',body:'x'}),415]]){
  const res=await handleMcp(req,env,{fetch:never});assert.equal(res.status,status);assert.equal(res.headers.get('cache-control'),'no-store');
 }
});
test('rejects unknown tool argument fields without leaking their values',async()=>{
 const res=await handleMcp(request('tools/call',{name:'jev_evaluate',arguments:{...input(),secret:'do-not-echo'}}),env,{fetch:never});
 const text=await res.text();assert.ok(text.includes('INVALID_INPUT'));assert.ok(!text.includes('do-not-echo'));
});

for (const [scheme, accepted] of [
 ['https', true], ['HTTPS', true], ['hTtPs', true],
 ['http', false], ['HTTP', false], ['ftp', false],
]) test(`source URL scheme ${scheme} agrees between advertised schema and runtime`, async () => {
 const listed = await (await handleMcp(request('tools/list'), {}, {fetch:never})).json();
 const schema = listed.result.tools.find(tool => tool.name === 'jev_evaluate').inputSchema.properties.sources.items.properties.url;
 const url = `${scheme}://example.com/evidence`;
 assert.equal(new RegExp(schema.pattern).test(url), accepted);
 const args = input(); args.sources[0].url = url;
 let calls = 0;
 const response = await handleMcp(request('tools/call', {name:'jev_evaluate', arguments:args}), env, {
  fetch: async (destination, options) => {
   calls++;
   assert.equal(destination, 'https://api.typesafe.ai/v1/systemone');
   assert.equal(Object.hasOwn(JSON.parse(options.body), 'sources'), false);
   return Response.json(provider());
  },
 });
 const message = await response.json();
 assert.equal(message.result.isError, !accepted);
 const result = JSON.parse(message.result.content[0].text);
 if (accepted) {
  assert.equal(result.sources[0].url, url);
  assert.equal(result.sources[0].verification_status, 'unverified');
  assert.equal(calls, 1);
 } else {
  assert.equal(result.error, 'INVALID_INPUT');
  assert.equal(calls, 0);
 }
});

// Official MCP 2026-07-28 CallToolRequestParams envelope. Client identity in
// metadata is self-reported; only the Sites gateway header authorizes callers.
const protocolMeta = {
 'io.modelcontextprotocol/protocolVersion': '2026-07-28',
 'io.modelcontextprotocol/clientInfo': {name:'Synthetic MCP client',version:'1.0.0'},
 'io.modelcontextprotocol/clientCapabilities': {},
 progressToken: 'synthetic-progress',
};
for (const withArguments of [true, false]) test(`standard MCP metadata supports status with arguments ${withArguments}`, async () => {
 const params = {name:'jev_status',_meta:protocolMeta,...(withArguments?{arguments:{}}:{})};
 const response = await handleMcp(request('tools/call',params,'site-caller'),{}, {fetch:never});
 const message = await response.json();
 assert.equal(message.error,undefined);
 assert.equal(message.result.isError,false);
 const status=JSON.parse(message.result.content[0].text);
 assert.equal(status.api_key_configured,false);
 assert.equal(status.owner_configured,false);
 assert.equal(status.caller_site_user_id,'site-caller');
 assert.equal(JSON.stringify(message).includes('synthetic-progress'),false);
});
test('omitted status arguments work without optional compatibility metadata', async () => {
 const response=await handleMcp(request('tools/call',{name:'jev_status'}),{}, {fetch:never});
 assert.equal((await response.json()).result.isError,false);
});
test('metadata is never forwarded to provider or used as authorization', async () => {
 let calls=0;
 const deps={fetch:async(_url,options)=>{
  calls++;const body=JSON.parse(options.body);
  assert.deepEqual(Object.keys(body).sort(),['model','questions','state']);
  assert.equal(JSON.stringify(body).includes('metadata-marker'),false);
  return Response.json(provider());
 }};
 const params={name:'jev_evaluate',arguments:input(),_meta:{...protocolMeta,'oai-authenticated-user-id':'owner',ownerId:'owner',marker:'metadata-marker'}};
 for(const [caller,expected] of [[null,'UNAUTHORIZED'],['intruder','FORBIDDEN']]) {
  const message=await(await handleMcp(request('tools/call',params,caller),env,deps)).json();
  assert.equal(JSON.parse(message.result.content[0].text).error,expected);
 }
 assert.equal(calls,0);
 const success=await(await handleMcp(request('tools/call',params),env,deps)).json();
 assert.equal(success.result.isError,false);assert.equal(calls,1);
});
for(const invalid of [null,[], 'metadata']) test(`rejects malformed metadata ${JSON.stringify(invalid)}`,async()=>{
 const response=await handleMcp(request('tools/call',{name:'jev_status',arguments:{},_meta:invalid}),{}, {fetch:never});
 assert.equal((await response.json()).error.code,-32602);
});
test('metadata does not relax tool argument strictness',async()=>{
 const response=await handleMcp(request('tools/call',{name:'jev_status',arguments:{ownerId:'owner'},_meta:protocolMeta}),env,{fetch:never});
 const message=await response.json();assert.equal(message.result.isError,true);
 assert.equal(JSON.parse(message.result.content[0].text).error,'INVALID_INPUT');
});
