import test from 'node:test';
import assert from 'node:assert/strict';
import {ORACLE,DOC_PAGE,OPTIONS,validateRequest,parseDocsEvidence,decodeOnChain,compose} from '../src/core.mjs';
const docsPage='# Chainlink Push Engine Feeds\nEach price pair has a dedicated proxy contract that exposes the standard Chainlink Data Feeds interface, allowing any on-chain consumer to read the latest price via latestAnswer().\n| Decimals | 18 |\n## Pacific Mainnet\n| PROS/USD | 0x123 | '+ORACLE.contract+' |\n## Contract Interface\nfunction latestAnswer() external view returns (int256);\nfunction latestTimestamp() external view returns (uint256);';
const fromMcp={content:[{type:'text',text:docsPage}]};
const chain={chainId:1672,chainIdMatches:true,latestBlock:'21994300'};
const code={code:'0x6080604052'};
test('two distinct documented oracle contract functions and real selectors',()=>{
 assert.deepEqual(Object.keys(OPTIONS),['latestAnswer','latestTimestamp']);
 const a=validateRequest({functionName:'latestAnswer'});
 const b=validateRequest({functionName:'latestTimestamp'});
 assert.equal(a.selector,'0x50d25bcd');
 assert.match(b.selector,/^0x[0-9a-f]{8}$/);
 assert.notEqual(a.selector,b.selector);
 assert.equal(a.contract.toLowerCase(),ORACLE.contract.toLowerCase());
});
test('unsupported and mutating calls are rejected',()=>{
 assert.throws(()=>validateRequest({functionName:'setPrice'}),/Unsupported/);
 assert.throws(()=>validateRequest({functionName:'transfer'}),/Unsupported/);
});
test('Docs MCP must fetch a page actually documenting selected function and contract',()=>{
 for(const functionName of Object.keys(OPTIONS)){
  const req=validateRequest({functionName});
  const e=parseDocsEvidence(fromMcp,req);
  assert.deepEqual(e.sources,[DOC_PAGE]);
  assert.ok(e.quotedDocs.includes(req.signature));
 }
 assert.throws(()=>parseDocsEvidence({isError:true},validateRequest({})),/getPage failed/);
 assert.throws(()=>parseDocsEvidence({content:[{type:'text',text:'Unrelated'}]},validateRequest({})),/lacks documented/);
});
test('Chain MCP parses signed latestAnswer and human-readable precision',()=>{
 const r=decodeOnChain(validateRequest({functionName:'latestAnswer'}),code,
  {result:'0x'+(1500000000000000000n).toString(16).padStart(64,'0')},chain);
 assert.equal(r.rawValue,'1500000000000000000');
 assert.match(r.interpretation,/1.5 USD/);
 const minus=decodeOnChain(validateRequest({functionName:'latestAnswer'}),code,
  {result:'0x'+((1n<<256n)-1n).toString(16)},chain);
 assert.equal(minus.rawValue,'-1');
});
test('latestTimestamp returns readable Unix time and is distinct from latestAnswer',()=>{
 const r=decodeOnChain(validateRequest({functionName:'latestTimestamp'}),code,
  {result:'0x'+(1700000000n).toString(16).padStart(64,'0')},chain);
 assert.equal(r.rawValue,'1700000000');assert.match(r.interpretation,/2023-11-14/);
});
test('no false success on wrong chain, missing code or malformed output',()=>{
 const req=validateRequest({});
 const output={result:'0x'+'0'.repeat(64)};
 assert.throws(()=>decodeOnChain(req,code,output,{...chain,chainId:688689}),/Wrong/);
 assert.throws(()=>decodeOnChain(req,{code:'0x'},output,chain),/no deployed code/);
 assert.throws(()=>decodeOnChain(req,code,{result:'0x1234'},chain),/32-byte/);
});
test('proof refuses mismatched Docs and Chain function',()=>{
 const a=validateRequest({functionName:'latestAnswer'});
 const doc=parseDocsEvidence(fromMcp,a);
 const val=decodeOnChain(a,code,{result:'0x'+'0'.repeat(64)},chain);
 assert.equal(compose(a,doc,val,[]).sourceCrossCheck.sameFunction,true);
 assert.throws(()=>compose(a,{...doc,functionSignature:'latestTimestamp()'},val,[]),/mismatch/);
});
