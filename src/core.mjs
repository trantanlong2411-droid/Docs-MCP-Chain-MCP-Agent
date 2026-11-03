import {id as keccakId} from 'ethers';
// Function definitions, feed and ABI are grounded in the officially published
// "Chainlink Push Engine Feeds" Pharos Developer Docs page, fetched via Docs MCP.
export const NETWORK={name:'Pharos Pacific Mainnet',chainId:1672,symbol:'PROS'};
export const DOC_PAGE='https://docs.pharos.xyz/tooling-and-infrastructure/oracles/chainlink-pe';
export const ORACLE={
 pair:'PROS/USD',contract:'0x371Ed36aEe5bFFbED1A2aa9b7deD7F4EB30F5466',
 source:DOC_PAGE,precision:18
};
export const OPTIONS={
 latestAnswer:{signature:'latestAnswer()',returnType:'int256',
  explanationHint:'Read the most recently published PROS/USD feed answer as a signed integer. The official Docs page lists 18 decimal places.'},
 latestTimestamp:{signature:'latestTimestamp()',returnType:'uint256',
  explanationHint:'Read the time metadata exposed by the same price feed proxy. Verify freshness before using any feed in a production decision.'}
};
export function validateRequest(raw={}){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid request object');
 const functionName=String(raw.functionName||'latestAnswer');
 if(!Object.hasOwn(OPTIONS,functionName))throw Error('Unsupported documented feed function');
 const fn=OPTIONS[functionName];
 const selector=keccakId(fn.signature).slice(0,10);
 return {functionName,signature:fn.signature,returnType:fn.returnType,
  contract:ORACLE.contract,selector,calldata:selector,pair:ORACLE.pair,
  docPage:DOC_PAGE};
}
export function parseDocsEvidence(result,request){
 if(!result||result.isError)throw Error('Developer Docs MCP getPage failed');
 const content=(result.content||[]).filter(x=>x.type==='text'&&typeof x.text==='string')
  .map(x=>x.text).join('\n');
 if(!content.includes('# Chainlink Push Engine Feeds')||
    !content.includes('## Contract Interface')||
    !content.includes(request.signature)||
    !content.toLowerCase().includes(ORACLE.contract.toLowerCase()))
  throw Error('Docs MCP page lacks documented '+request.signature+' or mainnet proxy address; aborting');
 const signatureLine=content.split('\n').find(x=>x.includes('function '+request.signature));
 if(!signatureLine||!signatureLine.includes(request.returnType))throw Error('Docs ABI signature mismatch');
 const context=content.match(/Each price pair has a dedicated proxy contract[^\n]*/)?.[0]||'';
 const setting=content.match(/\| Decimals\s*\|\s*18\s*\|/)?.[0]||'';
 if(!context||!setting)throw Error('Docs MCP missing feed context or decimals');
 const quote=[context,setting,signatureLine.trim()].join('\n');
 return {
  functionSignature:request.signature,sourceUrl:request.docPage,
  explanation:quote+'\n\nInterpretation guide: '+OPTIONS[request.functionName].explanationHint,
  quotedDocs:quote,sources:[request.docPage],
  provenance:'DEVELOPER_DOCS_MCP_GETPAGE',docTool:'getPage',
  sourceVerifiedByMcpFetch:true,contractFoundInDocumentation:true,
  claimedPrecisionFromDocs:18
 };
}
export function decodeOnChain(req,code,call,chain,when=new Date().toISOString()){
 if(!chain||chain.chainId!==NETWORK.chainId||chain.chainIdMatches!==true)
  throw Error('Wrong Chain MCP network; Pharos Mainnet 1672 required');
 const block=String(chain.latestBlock);
 if(!/^[0-9]+$/.test(block)||BigInt(block)<=0n)throw Error('Chain MCP has no valid block');
 if(!code||typeof code.code!=='string'||!/^0x[0-9a-fA-F]+$/.test(code.code))
  throw Error('Pharos feed proxy has no deployed code');
 const raw=call?.result;
 if(typeof raw!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(raw))
  throw Error('Expected a single ABI 32-byte response from Chain MCP eth_call');
 const unsigned=BigInt(raw);
 const value=req.returnType==='int256'&&unsigned>=(1n<<255n)?
  unsigned-(1n<<256n):unsigned;
 let interpretation;
 if(req.functionName==='latestAnswer'){
  const negative=value<0n;
  const abs=negative?-value:value;
  const scale=10n**18n;
  const fraction=(abs%scale).toString().padStart(18,'0').replace(/0+$/,'');
  const formatted=(negative?'-':'')+(abs/scale).toString()+(fraction?'.'+fraction:'');
  interpretation='The PROS/USD oracle proxy returned '+value+' raw signed int256 units. The documentation specifies 18 decimals, giving '+formatted+' USD per PROS as the reported oracle answer. Check feed freshness separately before using it.';
 }else{
  const timestamp=Number(value);
  const date=Number.isSafeInteger(timestamp)&&timestamp>=0&&timestamp<253402300800?
   new Date(timestamp*1000).toISOString():null;
  interpretation='The PROS/USD oracle proxy returned '+value+' as the latestTimestamp() uint256. '+
    (date?'Interpreted as a Unix timestamp: '+date+'. ':'The value cannot be safely interpreted as a Unix timestamp. ')+
    'This is the feed timestamp, not the current system time; verify staleness.';
 }
 return {functionName:req.functionName,signature:req.signature,contract:req.contract,
  pair:req.pair,rawHex:raw,rawValue:value.toString(),blockNumber:block,
  network:'Pharos Mainnet',chainId:1672,observedAt:when,interpretation,
  returnType:req.returnType,transactionBroadcast:false,execution:'READ_ONLY_ETH_CALL'};
}
export function compose(req,docs,decoded,trace){
 if(docs.functionSignature!==req.signature||decoded.signature!==req.signature)
  throw Error('Docs and Chain MCP function mismatch');
 return {ok:true,task:'DOCS_MCP_TO_CHAIN_MCP_AGENT',functionName:req.functionName,
  signature:req.signature,contract:req.contract,pair:req.pair,
  docs,call:decoded,trace,steps:trace.length,
  interpretation:'Docs MCP documented '+req.signature+' on the official Pharos PROS/USD feed. Chain MCP invoked the exact same selector '+req.selector+'. '+decoded.interpretation,
  sourceCrossCheck:{documentationFunction:docs.functionSignature,
   chainFunction:decoded.signature,sameFunction:true,
   contractBytecodeVerified:true,source:docs.sourceUrl},
  transactionBroadcast:false,readOnly:true};
}
