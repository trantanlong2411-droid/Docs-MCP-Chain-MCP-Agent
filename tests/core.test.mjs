import test from 'node:test';
import assert from 'node:assert/strict';
import {OPTIONS,validateRequest,parseDocsEvidence,decodeOnChain,compose} from '../src/core.mjs';
const W='0x74B2c2E4E4B771F0C75dcE44f40787468E323f79';
const docs=n=>({content:[{type:'text',text:'Official notes: ERC20 '+n+
 ' reads a token contract view. Related Pharos documentation: https://docs.pharos.xyz/tooling-and-infrastructure/mcp'}]});
const chain={chainId:1672,chainIdMatches:true,latestBlock:'21994114'};
const code={code:'0x6080604052'};
test('two independent ERC-20 contract functions are supported',()=>{
 assert.deepEqual(Object.keys(OPTIONS),['balanceOf','totalSupply']);
 assert.equal(validateRequest({functionName:'balanceOf',wallet:W}).calldata,
  '0x70a08231'+'000000000000000000000000'+W.slice(2).toLowerCase());
 assert.equal(validateRequest({functionName:'totalSupply'}).calldata,'0x18160ddd');
});
test('invalid function, wallet and raw arbitrary calls are rejected',()=>{
 assert.throws(()=>validateRequest({functionName:'transfer'}),/Unsupported/);
 assert.throws(()=>validateRequest({wallet:'x'}),/20-byte/);
});
test('Docs MCP answer must mention function and contain real docs.pharos.xyz URL',()=>{
 const doc=parseDocsEvidence(docs('balanceOf'),'balanceOf(address)');
 assert.equal(doc.sources.length,1);
 assert.match(doc.explanation,/balanceOf/);
 assert.throws(()=>parseDocsEvidence(docs('other'),'totalSupply()'),/sourced/);
 assert.throws(()=>parseDocsEvidence({content:[{text:'balanceOf but no URL'}]},'balanceOf(address)'),/sourced/);
});
test('Chain MCP decodes exact read-only uint256 output',()=>{
 const req=validateRequest({functionName:'totalSupply'});
 const out=decodeOnChain(req,code,{result:'0x'+'0'.repeat(63)+'1'},chain);
 assert.equal(out.rawUint256,'1');assert.equal(out.transactionBroadcast,false);
 assert.equal(out.signature,'totalSupply()');
});
test('Chain MCP rejects wrong network, absent code, malformed result',()=>{
 const req=validateRequest({});
 assert.throws(()=>decodeOnChain(req,code,{result:'0x'+'0'.repeat(64)},{...chain,chainId:688689}),/unexpected network/);
 assert.throws(()=>decodeOnChain(req,{code:'0x'},{result:'0x'+'0'.repeat(64)},chain),/bytecode/);
 assert.throws(()=>decodeOnChain(req,code,{result:'0x00'},chain),/uint256/);
});
test('composition rejects unrelated Docs and Chain function',()=>{
 const req=validateRequest({functionName:'totalSupply'});
 const chainOut=decodeOnChain(req,code,{result:'0x'+'0'.repeat(64)},chain);
 const good=parseDocsEvidence(docs('totalSupply'),'totalSupply()');
 assert.equal(compose(req,good,chain,code,chainOut,[]).sourceCrossCheck.sameFunction,true);
 assert.throws(()=>compose(req,{...good,functionSignature:'balanceOf(address)'},chain,code,chainOut,[]),/mismatch/);
});
