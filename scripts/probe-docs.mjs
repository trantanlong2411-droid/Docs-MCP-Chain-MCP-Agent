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
