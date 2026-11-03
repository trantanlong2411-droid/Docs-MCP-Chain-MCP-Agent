import {createClient,ENDPOINTS,buildDocsArgs} from '../src/mcp.mjs';
const client=await createClient(ENDPOINTS.docs,'Developer Docs');
try{
 const tools=await client.list();
 console.log('Docs MCP tools:',JSON.stringify(tools.map(x=>({name:x.name,inputSchema:x.inputSchema}))).slice(0,7000));
 for(const name of ['getPage','askQuestion','searchDocumentation']){
  const tool=tools.find(x=>x.name===name);if(!tool)continue;
  for(const question of [
   'balanceOf(address) ERC20 contract Pharos',
   'How to call an ERC20 smart contract view function with eth_call on Pharos?'
  ]){
   const args=name==='getPage'?{url:'https://docs.pharos.xyz/developer-guide/hardhat/write-your-first-dapp'}:buildDocsArgs(tool,question);
   try{
    const r=await client.call(name,args);
    console.log('DOCS DIAGNOSTIC',name,question,JSON.stringify(r).slice(0,4500));
   }catch(e){console.log('DOCS DIAGNOSTIC FAILURE',name,question,String(e.message).slice(0,400))}
  }
 }
}finally{await client.close()}


// Public GitBook index diagnostic, not used as a substitute for Docs MCP in the agent.
for(const url of ['https://docs.pharos.xyz/llms.txt','https://docs.pharos.xyz/llms-full.txt']){
 try{
  const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  const content=(await response.text()).slice(0,1200000);
  const lines=content.split('\n').filter(x=>/\berc.?20\b|balanceOf|totalSupply|token standard|contract|smart contract/i.test(x));
  console.log('DOCS INDEX DIAGNOSTIC',url,'http',response.status,'textSize',content.length,
   'relevantLinks',JSON.stringify(lines.slice(0,70)).slice(0,10500));
 }catch(e){console.log('DOCS INDEX DIAGNOSTIC ERROR',url,e.message)}
}

try{
 const text=(await (await fetch('https://docs.pharos.xyz/llms.txt',{signal:AbortSignal.timeout(12000)})).text());
 console.log('OFFICIAL DOCS ORACLE INDEX LINKS',JSON.stringify(text.split('\n').filter(x=>/chainlink|oracle|price feed|data feed|token registry/i.test(x))).slice(0,10500));
 const full=(await (await fetch('https://docs.pharos.xyz/llms-full.txt',{signal:AbortSignal.timeout(16000)})).text());
 for(const term of ['latestAnswer()', 'Each price pair has a dedicated proxy contract', '## Pacific Mainnet Contracts']){
  const i=full.indexOf(term);console.log('OFFICIAL DOCS CONTEXT '+term,full.slice(Math.max(0,i-1900),i+3400).slice(0,5700));
 }
}catch(e){console.log('OFFICIAL DOCS CONTEXT ERROR',e.message)}
