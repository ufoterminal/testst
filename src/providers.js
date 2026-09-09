import {cachedJson,feeds,normalizeDirect,ownList} from './direct.js';
import {q} from './db.js';
import {ADDR} from './config.js';
const lower=x=>String(x||'').toLowerCase();
const addr=x=>ADDR.test(String(x||''))?lower(x):null;
const pick=(o,...keys)=>{for(const k of keys)if(o?.[k]!==undefined&&o?.[k]!==null&&o?.[k]!=='')return o[k];return null};
const finite=x=>x==null||x===''||!Number.isFinite(Number(x))?null:Number(x);
const unix=x=>{if(x==null)return null;const n=typeof x==='string'&&!/^\d+$/.test(x)?Date.parse(x):Number(x);return Number.isFinite(n)?(n>1e12?Math.floor(n/1000):Math.floor(n)):null};
const safeUrl=x=>{try{const u=new URL(String(x));return ['http:','https:'].includes(u.protocol)?u.href:null}catch{return null}};
async function get(url){const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{accept:'application/json'}});if(!r.ok)throw Error(`${r.status} ${url}`);return r.json()}
export function normalizeRadar(launchJson,marketJson,now=Math.floor(Date.now()/1000)){
 const launches=Array.isArray(launchJson?.launches)?launchJson.launches:Array.isArray(launchJson?.data)?launchJson.data:[];
 const markets=Array.isArray(marketJson?.tokens)?marketJson.tokens:Array.isArray(marketJson?.data)?marketJson.data:Array.isArray(marketJson?.items)?marketJson.items:[];
 const by=new Map(markets.map(x=>[addr(pick(x,'address','token','tokenAddress','contractAddress')),x]).filter(x=>x[0]));
 return launches.map(l=>{const token=addr(pick(l,'token','address','tokenAddress','contractAddress'));if(!token)return null;const m=by.get(token);if(!m||m.launched!==true||(m.launchpad&&!['radar','radardex'].includes(m.launchpad)))return null;
  const price=pick(m,'price','priceUsd','price_usd','usdPrice','p'),mcap=pick(m,'mcap','marketCap','market_cap','mc'),liq=pick(m,'liquidityUsdc','liquidityUsd','liquidity_usd','liquidity','l'),vol=pick(m,'volume24','volume24h','volume_24h','v24h'),txns=pick(m,'txns24','txns24h','transactions24h'),holders=pick(m,'holderCount','holders','holder_count');
  return {address:token,name:String(pick(l,'name')||pick(m,'name')||''),symbol:String(pick(l,'symbol')||pick(m,'symbol','ticker')||''),decimals:finite(pick(m,'decimals')),total_supply:null,creation_at:unix(pick(m,'deployTs','createdAt')||pick(l,'createdAt')),launchpad_id:'radardex',factory:addr(pick(l,'factory')),metadata:{source:'radardex',token_created_at:unix(m.deployTs),last_trade_at:unix(m.lastSwap),traders24h:finite(m.traders24),spark:m.spark,logo:safeUrl(pick(m,'icon','logo','image')||pick(l,'icon','logo')),website:safeUrl(pick(m,'website')||pick(l,'website')),twitter:safeUrl(pick(m,'twitter','x')||pick(l,'twitter','x')),telegram:safeUrl(pick(m,'telegram')||pick(l,'telegram')),price:finite(price),mcap:finite(mcap),liquidity:finite(liq),volume24h:finite(vol),txns24h:finite(txns),holders:finite(holders),changes:{'5m':finite(pick(m,'change5m','change_5m','pc5m')),'1h':finite(pick(m,'change1h','change_1h','pc1h')),'6h':finite(pick(m,'change6h','change_6h','pc6h')),'24h':finite(pick(m,'change24','change24h','change_24h','pc24h'))},provider_updated_at:now}}}).filter(Boolean);
}
export function normalizeRadarArchive(launchJson){
 const launches=Array.isArray(launchJson?.launches)?launchJson.launches:Array.isArray(launchJson?.data)?launchJson.data:[];
 return launches.map(l=>{const address=addr(pick(l,'token','address','tokenAddress','contractAddress'));if(!address)return null;return {address,name:String(pick(l,'name')||''),symbol:String(pick(l,'symbol')||''),decimals:null,total_supply:null,creation_at:null,launchpad_id:'radardex',factory:addr(pick(l,'factory')),metadata:{archive_source:'radardex',archived:true}}}).filter(Boolean);
}
export function normalizeDyor(json,now=Math.floor(Date.now()/1000)){
 if(Number(json?.chainId)!==5042||String(json?.chain||'arc').toLowerCase()!=='arc')throw Error('DYOR response is not Arc 5042');
 return (Array.isArray(json.items)?json.items:Array.isArray(json.data)?json.data:[]).map(x=>{const address=addr(pick(x,'token','address','tokenAddress'));if(!address)return null;return {address,name:String(x.name||''),symbol:String(x.symbol||''),decimals:null,total_supply:null,creation_at:unix(x.created_at),launchpad_id:'dyor',factory:addr(x.factory),metadata:{logo:safeUrl(x.image),website:safeUrl(x.website),twitter:safeUrl(x.x),telegram:safeUrl(x.telegram),description:String(x.description||'').slice(0,2000),provider_updated_at:null}}}).filter(Boolean);
}
export async function syncExternal(){
 const now=Math.floor(Date.now()/1000);const out=[];let status=[];
 try{const [l,m]=await Promise.all([cachedJson('https://api.radardex.pro/launches?limit=all',900000),cachedJson(feeds.radardex)]);const rows=normalizeRadar(l,m,now);out.push(...rows,...normalizeRadarArchive(l));status.push({id:'radardex',ok:true,count:rows.length,archive_count:normalizeRadarArchive(l).length,market_page:(m.tokens||m.data||m.items||[]).length,total_markets:m.count||null,updated_at:now})}catch(e){status.push({id:'radardex',ok:false,error:e.message,updated_at:now})}
 try{const d=await get('https://arc-api-production-ef9c.up.railway.app/api/arc/v1/tokens?limit=100');const rows=normalizeDyor(d,now);out.push(...rows);status.push({id:'dyor',ok:true,count:rows.length,updated_at:now})}catch(e){status.push({id:'dyor',ok:false,error:e.message,updated_at:now})}
 for(const id of ['tolly','sharc']){try{const rows=normalizeDirect(id,await ownList(id),now);out.push(...rows);status.push({id,ok:true,count:rows.length})}catch(e){status.push({id,ok:false,error:e.message})}}
 for(const r of out){await q(`INSERT INTO tokens(address,name,symbol,decimals,total_supply,creation_at,metadata) VALUES($1,$2,$3,$4,$5,NULL,$6) ON CONFLICT(address) DO UPDATE SET name=CASE WHEN excluded.name<>'' THEN excluded.name ELSE tokens.name END,symbol=CASE WHEN excluded.symbol<>'' THEN excluded.symbol ELSE tokens.symbol END,decimals=COALESCE(excluded.decimals,tokens.decimals),metadata=tokens.metadata||excluded.metadata`,[r.address,r.name,r.symbol,r.decimals,r.total_supply,JSON.stringify(r.metadata)]);if(r.launchpad_id)await q(`INSERT INTO launches(token,launchpad_id,factory,at,confidence) VALUES($1,$2,$3,$4,'metadata') ON CONFLICT(token) DO UPDATE SET launchpad_id=excluded.launchpad_id,factory=COALESCE(excluded.factory,launches.factory)`,[r.address,r.launchpad_id,r.factory,r.creation_at])}
 return status;
}
