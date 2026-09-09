import {directDetail,number} from './direct.js';
import {q} from './db.js';
function n(x){return x==null?null:Number(x)}
export async function screener(){const rows=await q(`WITH pool_stats AS (
  SELECT token,MIN(created_at) pool_created_at,SUM(liquidity) liquidity FROM pools GROUP BY token
), swap_24 AS (
  SELECT p.token,SUM(s.usd_volume) volume24h,COUNT(*) txns24h,SUM(CASE WHEN s.buy THEN 1 ELSE 0 END) buys24h
  FROM swaps s JOIN pools p ON p.address=s.pool WHERE s.at >= $1-86400 GROUP BY p.token
), latest AS (
  SELECT token,price FROM (SELECT p.token,s.price,ROW_NUMBER() OVER(PARTITION BY p.token ORDER BY s.at DESC,s.block DESC,s.log_index DESC) rn
    FROM swaps s JOIN pools p ON p.address=s.pool WHERE s.price IS NOT NULL) x WHERE rn=1
)
SELECT t.address,t.name,t.symbol,t.decimals,t.total_supply,t.creation_at,t.holder_count,t.metadata,l.launchpad_id,l.factory,
 ps.pool_created_at,la.price,sw.volume24h,sw.txns24h,sw.buys24h,ps.liquidity
 FROM tokens t LEFT JOIN launches l ON l.token=t.address LEFT JOIN pool_stats ps ON ps.token=t.address
 LEFT JOIN swap_24 sw ON sw.token=t.address LEFT JOIN latest la ON la.token=t.address
 WHERE t.metadata->>'source' IN ('radardex','tolly','sharc') AND (COALESCE((t.metadata->>'volume24h')::numeric,0)>0 OR COALESCE((t.metadata->>'last_trade_at')::bigint,0)>$1-86400)
 ORDER BY (t.metadata->>'volume24h')::numeric DESC NULLS LAST LIMIT 500`,[Math.floor(Date.now()/1000)]);
 return rows.map(presentMarket);}
export async function searchTokens(term){
 const like=`%${String(term||'').trim().toLowerCase()}%`;if(like.length<3)return [];
 const rows=await q(`WITH pool_stats AS (SELECT token,MIN(created_at) pool_created_at,SUM(liquidity) liquidity FROM pools GROUP BY token), latest AS (SELECT token,price FROM (SELECT p.token,s.price,ROW_NUMBER() OVER(PARTITION BY p.token ORDER BY s.at DESC,s.block DESC,s.log_index DESC) rn FROM swaps s JOIN pools p ON p.address=s.pool WHERE s.price IS NOT NULL) x WHERE rn=1), swap_24 AS (SELECT p.token,SUM(s.usd_volume) volume24h,COUNT(*) txns24h FROM swaps s JOIN pools p ON p.address=s.pool WHERE s.at >= $2-86400 GROUP BY p.token)
 SELECT t.address,t.name,t.symbol,t.decimals,t.total_supply,t.creation_at,t.holder_count,t.metadata,l.launchpad_id,l.factory,ps.pool_created_at,la.price,sw.volume24h,sw.txns24h,ps.liquidity
 FROM tokens t LEFT JOIN launches l ON l.token=t.address LEFT JOIN pool_stats ps ON ps.token=t.address LEFT JOIN latest la ON la.token=t.address LEFT JOIN swap_24 sw ON sw.token=t.address
 WHERE LOWER(t.address) LIKE $1 OR LOWER(t.name) LIKE $1 OR LOWER(t.symbol) LIKE $1 ORDER BY ps.pool_created_at DESC NULLS LAST LIMIT 50`,[like,Math.floor(Date.now()/1000)]);
 return rows.map(presentMarket);
}
export async function candles(address,tf){const seconds={ '1m':60,'5m':300,'15m':900,'1h':3600,'4h':14400,'1d':86400}[tf]||300;const rows=await q(`SELECT (at/$2)*$2 bucket,MIN(price) low,MAX(price) high,(array_agg(price ORDER BY at,block,log_index))[1] open,(array_agg(price ORDER BY at DESC,block DESC,log_index DESC))[1] close,SUM(usd_volume) volume,COUNT(*) trades FROM swaps s JOIN pools p ON p.address=s.pool WHERE p.token=$1 AND price IS NOT NULL GROUP BY bucket ORDER BY bucket DESC LIMIT 500`,[address.toLowerCase(),seconds]);return {timeframe:tf,candles:rows.reverse().map(x=>({...x,bucket:Number(x.bucket),open:Number(x.open),high:Number(x.high),low:Number(x.low),close:Number(x.close),volume:Number(x.volume),trades:Number(x.trades)}))}}
export async function tokenDetail(address){const a=address.toLowerCase();const token=(await q('SELECT * FROM tokens WHERE address=$1',[a]))[0];if(!token)return null;const pools=await q('SELECT * FROM pools WHERE token=$1 ORDER BY created_at DESC',[a]);const trades=await q('SELECT s.* FROM swaps s JOIN pools p ON p.address=s.pool WHERE p.token=$1 ORDER BY s.at DESC,s.block DESC,s.log_index DESC LIMIT 200',[a]);const launch=(await q('SELECT * FROM launches WHERE token=$1',[a]))[0]||null;return {token,pools,trades,launch,age:{token_at:token.creation_at,pool_at:pools[0]?.created_at,first_trade_at:trades.at(-1)?.at||null}}}
export async function marketBundle(address,tf){
 const local=await tokenDetail(address);if(!local)return null;
 const source=local.token.metadata?.source||local.launch?.launchpad_id;
 const remote=await directDetail(source,address.toLowerCase(),tf);
 return {...local,source,timeframe:tf,candles:remote?.candles||[],trades:remote?.trades||local.trades,
   price:number(remote?.detail?.price)??number(local.token.metadata?.price),
   created_at:local.token.creation_at??number(local.token.metadata?.token_created_at),
   chart_available:!!remote,updated_at:local.token.metadata?.provider_updated_at};
}
export function presentMarket(r){
 const md=r.metadata||{},fresh=Number(md.provider_updated_at)>Date.now()/1000-180;
 const provider=md.source&&md.provider_updated_at!=null;
 const value=(key,fallback)=>provider?number(md[key]):number(fallback);
 const created=r.creation_at??number(md.token_created_at);
 return {...r,creation_at:created,holders:value('holders',r.holder_count),price:value('price',r.price),
   market_cap:value('mcap',null),liquidity:value('liquidity',r.liquidity),
   volume24h:value('volume24h',r.volume24h),txns24h:value('txns24h',r.txns24h),
   traders24h:value('traders24h',null),changes:md.changes||{},change:number(md.changes?.['24h']),
   data_quality:{source:md.source||'local',stale:!fresh,age:r.creation_at?'onchain_contract_creation':created?'provider_creation':'unknown'}};
}
