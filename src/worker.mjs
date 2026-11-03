import {ENDPOINTS,createClient,buildDocsArgs,unwrap} from './mcp.mjs';
import {validateRequest,parseDocsEvidence,decodeOnChain,compose} from './core.mjs';
import {HTML} from './page.mjs';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,
 headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
async function run(raw,fetcher=fetch){
 const request=validateRequest(raw),trace=[];
 let docs,chain;
 try{
  docs=await createClient(ENDPOINTS.docs,'Developer Docs',fetcher);
  trace.push({step:1,component:'Developer Docs MCP',operation:'initialize',
   serverInfo:docs.serverInfo,endpoint:ENDPOINTS.docs});
  const tools=await docs.list();
  const q=tools.find(x=>x.name==='askQuestion')||tools.find(x=>x.name==='searchDocumentation');
  if(!q)throw Error('Developer Docs MCP has no allowed read-only search/question tool');
  let reply=await docs.call(q.name,buildDocsArgs(q,request.question));
  let found;
  try{found=parseDocsEvidence(reply,request.signature)}catch(err){
   const fallback=tools.find(x=>x.name==='searchDocumentation'&&x.name!==q.name);
   if(!fallback)throw err;
   reply=await docs.call(fallback.name,buildDocsArgs(fallback,request.question));
   found=parseDocsEvidence(reply,request.signature);
  }
  trace.push({step:2,component:'Developer Docs MCP',operation:q.name,
   query:request.question,explanation:found.explanation,sources:found.sources,
   functionSignature:found.functionSignature});
  // Crucial gate: Chain MCP is NEVER invoked without a sourced Docs MCP explanation
  chain=await createClient(ENDPOINTS.chain,'Chain',fetcher);
  trace.push({step:3,component:'Chain MCP',operation:'initialize',
   serverInfo:chain.serverInfo,endpoint:ENDPOINTS.chain});
  const allowed=await chain.list();
  for(const name of ['get_chain_info','get_code','eth_call'])
   if(!allowed.some(t=>t.name===name))throw Error('Chain MCP missing '+name);
  const chainInfo=unwrap(await chain.call('get_chain_info',{}),'get_chain_info');
  if(chainInfo.chainId!==1672||chainInfo.chainIdMatches!==true)
   throw Error('Chain MCP expected Pharos Mainnet chain ID 1672');
  const block=String(chainInfo.latestBlock);
  trace.push({step:4,component:'Chain MCP',operation:'get_chain_info',result:chainInfo});
  const code=unwrap(await chain.call('get_code',{address:request.contract,block}),'get_code');
  if(!/^0x[0-9a-fA-F]+$/.test(String(code.code))||code.code==='0x')
   throw Error('Target ERC-20 contract code not found on Pharos Mainnet');
  trace.push({step:5,component:'Chain MCP',operation:'get_code',
   arguments:{address:request.contract,block},codePresent:true,
   codeBytes:(code.code.length-2)/2});
  const arg={transaction:{to:request.contract,data:request.calldata},block};
  const output=unwrap(await chain.call('eth_call',arg),'eth_call');
  const view=decodeOnChain(request,code,output,chainInfo);
  trace.push({step:6,component:'Chain MCP',operation:'eth_call',
   arguments:arg,result:output,decoded:view.rawUint256,functionSignature:request.signature});
  trace.push({step:7,component:'Agent interpreter',operation:'explain-and-interpret',
   dependsOn:[2,4,5,6],explanationFromDocs:found.functionSignature,
   result:view.interpretation});
  return compose(request,found,chainInfo,code,view,trace);
 }catch(e){
  const err=Error(String(e.message||e).slice(0,450));err.trace=trace;throw err;
 }finally{
  if(chain)await chain.close();
  if(docs)await docs.close();
 }
}
export {run};
export default{
 async fetch(req){
  const url=new URL(req.url);
  if(req.method==='GET'&&url.pathname==='/')return new Response(HTML,{
   headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(req.method==='GET'&&url.pathname==='/api/health')
   return json({ok:true,service:'docs-mcp-chain-mcp-agent',network:'Pharos Mainnet',
    chainId:1672,docsEndpoint:ENDPOINTS.docs,chainEndpoint:ENDPOINTS.chain,
    note:'Health checks local Worker; does not guarantee external MCP health',readOnly:true});
  if(req.method!=='POST'||url.pathname!=='/api/run')return json({ok:false,error:'Not found'},404);
  try{
   if(Number(req.headers.get('content-length')||0)>2000)throw Error('Body too large');
   const raw=await req.text();
   if(raw.length>2000)throw Error('Body too large');
   return json(await run(JSON.parse(raw)));
  }catch(e){return json({ok:false,decision:'ERROR_NO_EXECUTION',error:String(e.message||e).slice(0,400),
   trace:e.trace||[],transactionBroadcast:false},502)}
 }
};
