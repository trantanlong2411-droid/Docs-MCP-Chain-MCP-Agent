// ERC-20 function calls are strictly read-only. No user-provided raw calldata.
export const NETWORK={name:'Pharos Pacific Mainnet',chainId:1672,symbol:'PROS'};
export const TOKENS={
 WPROS:{name:'Wrapped PROS',address:'0x52c48d4213107b20bc583832b0d951fb9ca8f0b0'}
};
export const DEFAULT_WALLET='0x74B2c2E4E4B771F0C75dcE44f40787468E323f79';
export const OPTIONS={
 balanceOf:{
  signature:'balanceOf(address)',selector:'0x70a08231',
  param:'owner (address)',returns:'uint256',
  question:'In a Pharos EVM ERC-20 smart contract, explain the balanceOf(address) function: what does the owner address parameter mean, what unit is returned, and how is it called read-only with eth_call? Please cite official docs.pharos.xyz source URLs.'
 },
 totalSupply:{
  signature:'totalSupply()',selector:'0x18160ddd',
  param:'no parameters',returns:'uint256',
  question:'In a Pharos EVM ERC-20 smart contract, explain the totalSupply() function: what does it return, what are base units, and how is it called read-only with eth_call? Please cite official docs.pharos.xyz source URLs.'
 }
};
export function validateRequest(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Expected request object');
 const functionName=String(raw.functionName||'balanceOf');
 if(!Object.hasOwn(OPTIONS,functionName))throw Error('Unsupported contract function');
 const wallet=String(raw.wallet||DEFAULT_WALLET);
 if(!/^0x[0-9a-fA-F]{40}$/.test(wallet))throw Error('Wallet must be a 20-byte EVM address');
 const contract=TOKENS.WPROS.address;
 const fn=OPTIONS[functionName];
 const data=fn.selector+(functionName==='balanceOf'?wallet.slice(2).toLowerCase().padStart(64,'0'):'');
 return {functionName,wallet,contract,signature:fn.signature,question:fn.question,
  selector:fn.selector,calldata:data};
}
const trimErr=(e)=>String(e?.message||e||'Unknown error').slice(0,320);
export function decodeOnChain(req,code,call,chain,observedAt=new Date().toISOString()){
 if(!chain||chain.chainId!==NETWORK.chainId||chain.chainIdMatches!==true)
  throw Error('Chain MCP returned unexpected network (not Pharos Mainnet 1672)');
 if(!/^[0-9]+$/.test(String(chain.latestBlock)))throw Error('Missing verified Pharos block');
 if(!code||!/^0x[0-9a-fA-F]+$/.test(String(code.code))||code.code==='0x')
  throw Error('Contract bytecode not present at requested address');
 const raw=call?.result;
 if(typeof raw!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(raw))
  throw Error('eth_call returned unexpected uint256 shape');
 const value=BigInt(raw);
 return {functionName:req.functionName,signature:req.signature,
  contract:req.contract,addressParameter:req.functionName==='balanceOf'?req.wallet:null,
  rawHex:raw,rawUint256:value.toString(),blockNumber:String(chain.latestBlock),
  network:'Pharos Mainnet',chainId:1672,observedAt,
  interpretation:req.functionName==='balanceOf'?
   'The ERC-20 contract reported '+value+' smallest token units for the given address. Divide by contract decimals to calculate display tokens; this demo does not assume decimals.':
   'The ERC-20 contract reported '+value+' smallest token units as its totalSupply. This is an on-chain view at the recorded block, not a token price.',
  execution:'READ_ONLY_ETH_CALL',transactionBroadcast:false};
}
export function parseDocsEvidence(result,signature){
 if(!result||result.isError)throw Error('Docs MCP did not return a successful answer');
 const pieces=[];
 const collect=(v,depth=0)=>{
  if(depth>6||v==null)return;
  if(typeof v==='string'){pieces.push(v);return}
  if(Array.isArray(v)){v.forEach(x=>collect(x,depth+1));return}
  if(typeof v==='object'){Object.entries(v).forEach(([k,x])=>{if(k!=='type')collect(x,depth+1)})}
 };
 collect(result.structuredContent);collect(result.content);
 const response=pieces.join('\n').slice(0,18000);
 const urls=[...new Set((response.match(/https?:\/\/[^\s<>"'\])}]+/g)||[])
  .map(x=>x.replace(/[.,;:]+$/,''))
  .filter(x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.hostname==='docs.pharos.xyz'}catch{return false}}))].slice(0,8);
 const target=signature.split('(')[0];
 // Reject unrelated source answers. Don't fabricate docs links or descriptions.
 if(!response||!urls.length||!new RegExp('\\b'+target+'\\b','i').test(response))
  throw Error('Docs MCP did not provide a sourced explanation mentioning '+signature+'; no chain call will run.');
 return {functionSignature:signature,explanation:response.slice(0,3000),sources:urls,
  provenance:'PHAROS_DEVELOPER_DOCS_MCP',sourceCount:urls.length};
}
export function compose(req,doc,chain,code,onchain,toolAudit){
 if(doc.functionSignature!==req.signature||onchain.functionName!==req.functionName)
  throw Error('Docs explanation and called function mismatch');
 return {ok:true,task:'DOCS_MCP_TO_CHAIN_MCP_AGENT',
  functionName:req.functionName,signature:req.signature,
  docs:doc,call:onchain,trace:toolAudit,
  steps:toolAudit.length,
  interpretation:'Docs MCP describes '+req.signature+'. Chain MCP then executes exactly that encoded view selector ('+req.selector+') on '+req.contract+'. Result: '+onchain.interpretation,
  sourceCrossCheck:{documentationFunction:doc.functionSignature,chainFunction:onchain.signature,
   sameFunction:true,contractBytecodeVerified:true},
  readOnly:true,transactionBroadcast:false};
}
export const errorMessage=trimErr;
