// Two separate real hosted MCP sessions. No browser-supplied endpoint URLs.
export const ENDPOINTS={
 docs:'https://docs.pharos.xyz/~gitbook/mcp',
 chain:'https://mcp.pharos.xyz/mcp'
};
export const PROTOCOL='2025-03-26';
export function unwrap(result,name){
 if(!result||result.isError)throw Error(name+' returned an MCP tool error');
 if(result.structuredContent&&typeof result.structuredContent==='object'){
  const obj=result.structuredContent;
  if(obj.error)throw Error(name+': '+String(obj.error.message||obj.error));
  if((name==='get_chain_info'&&obj.chainId!==undefined)||
     (name==='get_code'&&obj.code!==undefined)||
     (name==='eth_call'&&obj.result!==undefined))return obj;
 }
 const entry=result.content?.find(x=>x.type==='text'&&typeof x.text==='string');
 if(!entry)throw Error(name+' returned no text result');
 let parsed;try{parsed=JSON.parse(entry.text)}catch{throw Error(name+' returned non-JSON chain data')}
 if(!parsed||typeof parsed!=='object'||parsed.error)throw Error(name+' returned an RPC error: '+String(parsed?.error?.message||'Unknown'));
 return parsed;
}
function parseStream(text,id){
 const chunks=text.replace(/\r\n/g,'\n').split(/\n\n+/);
 for(const chunk of chunks){
  const data=chunk.split('\n').filter(x=>x.startsWith('data:')).map(x=>x.slice(5).trim()).join('\n');
  if(!data)continue;
  try{const j=JSON.parse(data);if(j.id===id)return j}catch{}
 }
 throw Error('MCP stream returned no matching JSON-RPC response');
}
export async function createClient(endpoint,label,fetcher=fetch){
 if(!Object.values(ENDPOINTS).includes(endpoint))throw Error('Untrusted MCP endpoint');
 let count=0,session='',version=PROTOCOL,closed=false;
 async function command(method,params,notify=false){
  if(closed)throw Error(label+' MCP session closed');
  const id=notify?null:++count;
  const message={jsonrpc:'2.0',...(!notify?{id}:{}),method,
   ...(!notify?{params:params??{}}:{})};
  const response=await fetcher(endpoint,{
   method:'POST',
   headers:{'content-type':'application/json','accept':'application/json, text/event-stream',
    'mcp-protocol-version':version,...(session?{'mcp-session-id':session}:{})},
   body:JSON.stringify(message),signal:AbortSignal.timeout(23000)
  });
  if(!response.ok){
   const msg=await response.text().catch(()=>''),rate=response.status===429?' (rate limited)':'';
   throw Error(label+' MCP HTTP '+response.status+rate+': '+msg.slice(0,100));
  }
  const sid=response.headers.get('mcp-session-id');
  if(sid)session=sid;
  if(notify){await response.arrayBuffer();return null}
  const raw=await response.text();
  if(raw.length>800000)throw Error(label+' MCP response exceeded size limit');
  const data=(response.headers.get('content-type')||'').includes('text/event-stream')?
   parseStream(raw,id):JSON.parse(raw);
  if(data.id!==id)throw Error(label+' MCP JSON-RPC ID mismatch');
  if(data.error)throw Error(label+' MCP '+String(data.error.message||'protocol error'));
  if(data.result===undefined)throw Error(label+' MCP result missing');
  return data.result;
 }
 const init=await command('initialize',{
  protocolVersion:version,capabilities:{},
  clientInfo:{name:'docs-chain-mcp-agent',version:'1.0.0'}
 });
 if(init.protocolVersion)version=String(init.protocolVersion);
 await command('notifications/initialized',{},true);
 return {
  endpoint,serverInfo:init.serverInfo||null,
  list:async()=>{const r=await command('tools/list',{});return Array.isArray(r.tools)?r.tools:[]},
  call:async(name,args)=>command('tools/call',{name,arguments:args||{}}),
  close:async()=>{
   closed=true;if(!session)return;
   try{await fetcher(endpoint,{method:'DELETE',
    headers:{'mcp-session-id':session,'mcp-protocol-version':version},
    signal:AbortSignal.timeout(3000)});}catch{}
  }
 };
}
export function buildDocsArgs(tool,question){
 const props=tool.inputSchema?.properties||{},required=tool.inputSchema?.required||[];
 const target=['question','query','searchQuery','search_query','prompt','input'].find(k=>props[k]?.type==='string');
 if(!target)throw Error('Unknown Docs MCP query schema');
 const args={[target]:question};
 for(const key of required){
  if(key in args)continue;
  if(props[key]?.type==='string'){
   args[key]=(key==='goal'||key==='context')?'Explain a contract function with documentation references':question;
  }else throw Error('Unsupported required Docs argument '+key);
 }
 return args;
}
