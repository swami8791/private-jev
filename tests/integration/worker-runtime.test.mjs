import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { Miniflare, Response as MockResponse } from 'miniflare';
import { input, provider } from '../fixtures.mjs';

// Exercise the real build in workerd. Every outbound fetch is intercepted;
// no environment files, real credentials, origin requests, or fallback network.
async function runWithMock(status = 200) {
 let intercepted = 0;
 const worker = new Miniflare({
  modules: readdirSync('dist/server', {recursive:true})
   .filter(name=>name.endsWith('.js'))
   .sort((first, second)=>first==='index.js'?-1:second==='index.js'?1:0)
   .map(name=>({type:'ESModule',path:path.resolve('dist/server',name)})),
  modulesRoot: path.resolve('dist/server'),
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  bindings: {TYPESAFE_API_KEY:'synthetic-key-only',JEV_OWNER_SITE_USER_ID:'synthetic-owner'},
  outboundService: async request => {
   intercepted++;
   assert.equal(request.url,'https://api.typesafe.ai/v1/systemone');
   assert.equal(request.method,'POST');
   if (status !== 200) return new MockResponse(null, {status,headers:{location:'https://redirect-must-not-be-followed.invalid/'}});
   return new MockResponse(JSON.stringify(provider()),{headers:{'content-type':'application/json'}});
  },
 });
 try {
  const response=await worker.dispatchFetch('https://offline.invalid/mcp',{
   method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':'synthetic-owner'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'jev_evaluate',arguments:input()}}),
  });
  return {message:await response.json(),intercepted};
 } finally {await worker.dispose();}
}
test('deployed Worker can construct the provider fetch and complete a mocked evaluation',async()=>{
 const {message,intercepted}=await runWithMock();
 assert.equal(message.result.isError,false);
 assert.equal(intercepted,1);
 assert.equal(JSON.parse(message.result.content[0].text).answers.severity.score_100,75);
});
for (const status of [301,302,307,308]) test(`deployed Worker rejects redirect ${status} without following or retrying`,async()=>{
 const {message,intercepted}=await runWithMock(status);
 assert.equal(message.result.isError,true);
 assert.equal(JSON.parse(message.result.content[0].text).error,'PROVIDER_ERROR');
 assert.equal(intercepted,1);
});
