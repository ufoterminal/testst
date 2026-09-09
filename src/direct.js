// Public, read-only endpoints verified against each pad's own frontend.
export const feeds = {
  radardex: 'https://api.radardex.pro/tokens?launchpad=radar&sort=volume24&dir=desc&window=24h&limit=500',
  tolly: 'https://api.tollylabs.com/tokens?scope=ours&sort=volume&dir=desc&limit=500&offset=0',
  sharc: 'https://sharc.fun/api/tokens'
};
const cache=new Map(),pending=new Map();
export async function cachedJson(url,ttl=30000){
  const hit=cache.get(url);if(hit&&hit.until>Date.now())return hit.value;
  if(pending.has(url))return pending.get(url);
  const work=(async()=>{const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});
    if(!r.ok)throw Error('Provider HTTP '+r.status);
    const value=await r.json();if(cache.size>=300)cache.delete(cache.keys().next().value);
    cache.set(url,{value,until:Date.now()+ttl});return value;
  })().finally(()=>pending.delete(url));pending.set(url,work);return work;
}
export const number=x=>x==null||x===''||!Number.isFinite(Number(x))?null:Number(x);
export async function ownList(id){
 if(id!=='tolly')return cachedJson(feeds[id],60000);
 const first=await cachedJson(feeds.tolly,60000);
 const tokens=[...(first.tokens||[])],pageSize=tokens.length;
 if(!pageSize)return first;
 // Bound the number of requests even if an upstream count is corrupt.
 for(let offset=pageSize;offset<Math.min(Number(first.total)||0,1000);offset+=pageSize){
  const page=await cachedJson('https://api.tollylabs.com/tokens?scope=ours&sort=volume&dir=desc&limit=200&offset='+offset,300000);
  if(!page.tokens?.length)break;tokens.push(...page.tokens);
 }
 return {...first,tokens:[...new Map(tokens.map(t=>[t.address,t])).values()]};
}
const scaled=(x,d)=>number(x)==null?null:Number(x)/10**d;
export function normalizeDirect(id,json,now=Math.floor(Date.now()/1000)){
  const items=id==='sharc'?json:json.tokens;
  if(!Array.isArray(items))throw Error(id+' unexpected token list');
  return items.filter(t=>/^0x[0-9a-f]{40}$/i.test(t.address)&&(id!=='tolly'||t.tolly===true)&&(id!=='sharc'||t.chainKey==='arc')).map(t=>{
    const sh=id==='sharc',price=sh?scaled(t.priceE18,18):number(t.price);
    const liquidity=sh?null:number(t.liquidity);
    return {address:t.address.toLowerCase(),name:String(t.name||''),symbol:String(t.symbol||''),decimals:null,total_supply:null,creation_at:null,launchpad_id:id,factory:null,
      metadata:{source:id,logo:sh?t.metadata?.image:t.image_uri,price,mcap:sh?scaled(t.marketCap,6):number(t.marketCap),liquidity,
        volume24h:sh?scaled(t.volume24h,6):number(t.volume24h),txns24h:sh?null:number(t.txns24h),
        traders24h:sh?null:number(t.traders24h),holders:sh?number(t.holdersCount):null,
        token_created_at:number(sh?t.createdAt:t.created_ts),pool:sh?t.pair:t.pool,
        last_trade_at:number(sh?t.lastActivity:t.lastTradeTs),provider_updated_at:now,
        spark:sh?t.spark:t.sparkline,changes:{'5m':null,'1h':sh?scaled(t.change1hBps,2):number(t.change1h),'6h':sh?scaled(t.change6hBps,2):number(t.change6h),'24h':sh?scaled(t.change24hBps,2):number(t.change24h)},
        website:sh?t.metadata?.links?.website:t.website,twitter:sh?t.metadata?.links?.x:t.twitter}};
  });
}
export async function directDetail(source,address,tf='1h'){
  const seconds={'1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400}[tf];
  if(!seconds)throw Error('Unsupported timeframe');
  let chart,swaps,detail;
  if(source==='radardex'){
    const base='https://api.radardex.pro/token/'+address;
    [detail,chart,swaps]=await Promise.all([cachedJson(base),cachedJson(base+'/chart?tf='+seconds+'&limit=500'),cachedJson(base+'/swaps?limit=60')]);
    if(detail.launched!==true || (detail.launchpad && !['radar','radardex'].includes(detail.launchpad)))throw Error('Token is not a RadarDEX launch');
    swaps=(swaps.swaps||[]).map(s=>({at:s.time,buy:s.side==='buy',usd_volume:s.usdc,price:s.price,trader:s.trader,tx:s.txHash}));
    chart=chart.candles||[];
  }else if(source==='tolly'){
    const base='https://api.tollylabs.com';
    [detail,chart,swaps]=await Promise.all([cachedJson(base+'/token/'+address),cachedJson(base+'/candles?token='+address+'&tf='+tf+'&limit=500'),cachedJson(base+'/swaps?token='+address+'&limit=60')]);
    swaps=(swaps.swaps||[]).map(s=>({at:s.ts,buy:s.side==='buy',usd_volume:s.usd,price:s.price,trader:s.trader,tx:s.tx}));
    chart=chart.candles||[];
  }else if(source==='sharc'){
    const base='https://sharc.fun/api/tokens/'+address;
    [chart,swaps]=await Promise.all([cachedJson(base+'/candles?interval='+seconds),cachedJson(base+'/trades?limit=60')]);
    swaps=(swaps.trades||[]).map(s=>({at:Number(s.timestamp),buy:s.isBuy,usd_volume:scaled(s.usdcAmount,6),price:scaled(s.priceE18,18),trader:s.trader,tx:s.txHash}));
  }else return null;
  const normalized=chart.map(c=>({bucket:Number(c.bucket??c.time),open:number(c.open),high:number(c.high),low:number(c.low),close:number(c.close),volume:number(c.volume??c.vol)}))
    .filter(c=>c.bucket>0&&[c.open,c.high,c.low,c.close].every(n=>n!=null&&n>0)).sort((a,b)=>a.bucket-b.bucket).slice(-500);
  return {source,detail,candles:normalized,trades:swaps};
}
