import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=(process.env.DOCS_CHAIN_URL||'https://docs-mcp-chain-mcp-agent.trantanlong2411.workers.dev').replace(/\/$/,'');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,data){
 const r=await fetch(base+path,{method:data?'POST':'GET',
  headers:data?{'content-type':'application/json'}:{},
  body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(110000)});
 const s=await r.text();let val;
 try{val=JSON.parse(s)}catch{throw Error('Non JSON HTTP '+r.status+' '+s.slice(0,150))}
 if(!r.ok||!val.ok)throw Error('HTTP '+r.status+' '+JSON.stringify(val).slice(0,550));
 return val;
}
let health;
for(let i=0;i<18;i++){
 try{health=await api('/api/health');if(health.service==='docs-mcp-chain-mcp-agent')break}
 catch(e){console.log('Worker health retry',i+1,String(e.message).slice(0,140))}
 await pause(5000);
}
assert.equal(health?.chainId,1672,'Worker not yet ready');
const result=[];
for(const functionName of ['latestAnswer','latestTimestamp']){
 let flow,error;
 for(let tries=0;tries<3;tries++){
  try{flow=await api('/api/run',{functionName});break}
  catch(e){error=e;console.log('LIVE TWO-MCP FLOW RETRY',functionName,tries+1,e.message);
   if(tries<2)await pause(16000)}
 }
 if(!flow)throw Error('Docs & Chain MCP '+functionName+' unavailable: '+error?.message);
 assert.equal(flow.task,'DOCS_MCP_TO_CHAIN_MCP_AGENT');
 assert.equal(flow.signature,flow.docs.functionSignature);
 assert.equal(flow.signature,flow.call.signature);
 assert.equal(flow.sourceCrossCheck.sameFunction,true);
 assert.equal(flow.sourceCrossCheck.contractBytecodeVerified,true);
 assert.ok(flow.docs.explanation.includes(functionName));
 assert.equal(flow.docs.provenance,'DEVELOPER_DOCS_MCP_GETPAGE');
 assert.equal(flow.docs.sourceVerifiedByMcpFetch,true);
 assert.ok(flow.docs.sources.length>=1);
 assert.ok(flow.docs.sources.every(x=>new URL(x).hostname==='docs.pharos.xyz'));
 assert.equal(flow.docs.sources[0],'https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe');
 assert.equal(flow.call.chainId,1672);
 assert.match(flow.call.rawValue,/^-?[0-9]+$/);
 assert.ok(BigInt(flow.call.blockNumber)>0n);
 assert.equal(flow.call.pair,'PROS/USD');
 assert.equal(flow.call.transactionBroadcast,false);
 assert.equal(flow.transactionBroadcast,false);
 assert.equal(flow.steps,7);
 assert.deepEqual(flow.trace.slice(0,7).map(x=>x.component),[
  'Developer Docs MCP','Developer Docs MCP','Chain MCP','Chain MCP',
  'Chain MCP','Chain MCP','Agent interpreter'
 ]);
 assert.equal(flow.trace[5].arguments.transaction.data.length===10,true);
 assert.equal(flow.trace[1].functionSignature,flow.trace[5].functionSignature);
 result.push(flow);
 console.log('REAL DOCUMENTATION TO CONTRACT EXECUTION VERIFIED',JSON.stringify({
  functionName,mainnetBlock:flow.call.blockNumber,raw:flow.call.rawValue,
  docsSourceCount:flow.docs.sources.length,sourceUrls:flow.docs.sources,
  toolOrder:flow.trace.map(x=>x.operation),broadcast:false}));
 await pause(2500);
}
await mkdir('proof',{recursive:true});
await writeFile('proof/ci-live-proof.json',JSON.stringify({
 schema:'pharos-docs-chain-composition-v1',testedAt:new Date().toISOString(),
 website:base,scope:'Real Developer Docs MCP sources and real Pharos Chain MCP mainnet eth_call; no transactions',
 flows:result},null,2)+'\n');
console.log('ALL LIVE TWO-MCP COMPOSITION PROOFS PASS — two distinct documented oracle functions');
