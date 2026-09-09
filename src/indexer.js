import {q,metaGet,metaSet} from './db.js';
import {client,findUsdcPools,exactBlockAt,tokenInfo,tokenBalance,swapEvent} from './chain.js';
import {USDC,HISTORY_DAYS} from './config.js';
import {verifyTokenBirths} from './creation.js';
import {holderCount} from './arcscan.js';
let running=false;
export const state={head:0,lastError:null,lastIndexedAt:null};
function abs(x){return x<0n?-x:x}
function priceFromSqrt(sqrt,tokenIsToken0,decimals){if(typeof sqrt!=='bigint'||sqrt<=0n)return null;const raw=Number(sqrt*sqrt)/Number(1n<<192n);if(!Number.isFinite(raw)||raw<=0)return null;const d=Number(decimals);return tokenIsToken0?raw*10**(d-6):1/raw*10**(6-d)}
async function indexSwaps(from,to){const pools=await q('SELECT * FROM pools');if(!pools.length)return;const by=new Map(pools.map(p=>[p.address.toLowerCase(),p]));let logs=[];try{logs=await client.getLogs({address:pools.map(p=>p.address),events:[swapEvent],fromBlock:BigInt(from),toBlock:BigInt(to)})}catch(e){console.log('[chain] swap scan',e.message);return}const times=new Map();for(const log of logs){const p=by.get(String(log.address).toLowerCase()),a=log.args;if(!p||!a)continue;const block=Number(log.blockNumber);if(!times.has(block))times.set(block,await exactBlockAt(block));const t=(await q('SELECT decimals FROM tokens WHERE address=$1',[p.token]))[0]?.decimals;if(t==null)continue;const amount0=BigInt(a.amount0),amount1=BigInt(a.amount1),usdcRaw=p.token_is_token0?amount1:amount0,tokenRaw=p.token_is_token0?amount0:amount1;await q(`INSERT INTO swaps(pool,block,log_index,at,tx,trader,price,usd_volume,buy,token_amount) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(pool,block,log_index) DO NOTHING`,[p.address,block,Number(log.logIndex),times.get(block),log.transactionHash,String(a.recipient).toLowerCase(),priceFromSqrt(a.sqrtPriceX96,p.token_is_token0,t),Number(abs(usdcRaw))/1e6,p.token_is_token0?amount1>0n:amount0>0n,Number(abs(tokenRaw))/10**Number(t)])}}
async function refreshLiquidity(){
  const pools=await q(`SELECT p.*,t.decimals FROM pools p JOIN tokens t ON t.address=p.token
    WHERE p.liquidity_at IS NULL OR p.liquidity_at < $1 ORDER BY p.liquidity_at NULLS FIRST LIMIT 40`,[Math.floor(Date.now()/1000)-60]);
  for(const p of pools){try{
    const [usdcRaw,tokenRaw,last]=await Promise.all([
      tokenBalance(USDC,p.address), tokenBalance(p.token,p.address),
      q('SELECT price FROM swaps WHERE pool=$1 AND price IS NOT NULL ORDER BY at DESC LIMIT 1',[p.address])
    ]);
    const price=last[0]?.price==null?null:Number(last[0].price);
    if(price==null||!Number.isFinite(price))continue;
    const usdc=Number(usdcRaw)/1e6, token=Number(tokenRaw)/10**Number(p.decimals);
    const liquidity=usdc+token*price;
    if(!Number.isFinite(liquidity)||liquidity<0)continue;
    await q('UPDATE pools SET liquidity=$1,liquidity_at=$2 WHERE address=$3',[liquidity,Math.floor(Date.now()/1000),p.address]);
  }catch(e){console.log('[liquidity]',p.address,e.message)}}
}
async function refreshHolders(){
  const rows=await q(`SELECT address FROM tokens WHERE holder_at IS NULL OR holder_at < $1 ORDER BY holder_at NULLS FIRST LIMIT 8`,[Math.floor(Date.now()/1000)-300]);
  for(const r of rows){const count=await holderCount(r.address);if(count!=null)await q('UPDATE tokens SET holder_count=$1,holder_at=$2 WHERE address=$3',[count,Math.floor(Date.now()/1000),r.address])}
}
export async function indexOnce(){if(running)return;running=true;try{const tip=Number(await client.getBlockNumber());state.head=tip;let cursor=Number(await metaGet('pool_cursor')||Math.max(0,tip-Math.floor(HISTORY_DAYS*86400/0.5)));const to=Math.min(tip,cursor+5000);if(to<cursor)return;const logs=await findUsdcPools(cursor,to);for(const log of logs){const a=log.args;const token0=String(a.token0).toLowerCase(),token1=String(a.token1).toLowerCase(),token=token0===USDC?token1:token1===USDC?token0:null;if(!token)continue;const at=await exactBlockAt(Number(log.blockNumber)),info=await tokenInfo(token);await q(`INSERT INTO tokens(address,name,symbol,decimals,total_supply,creation_at,metadata) VALUES($1,$2,$3,$4,$5,NULL,'{}') ON CONFLICT(address) DO UPDATE SET name=CASE WHEN tokens.name='' THEN excluded.name ELSE tokens.name END,symbol=CASE WHEN tokens.symbol='' THEN excluded.symbol ELSE tokens.symbol END,decimals=COALESCE(tokens.decimals,excluded.decimals),total_supply=COALESCE(tokens.total_supply,excluded.total_supply)`,[token,info.name,info.symbol,info.decimals,info.total_supply]);await q(`INSERT INTO pools(address,token,quote,token_is_token0,dex,factory,version,created_block,created_at) VALUES($1,$2,$3,$4,'Uniswap V3',$5,3,$6,$7) ON CONFLICT(address) DO NOTHING`,[String(a.pool).toLowerCase(),token,USDC,token0!==USDC,String(log.address).toLowerCase(),Number(log.blockNumber),at])}await indexSwaps(cursor,to);await verifyTokenBirths(tip);await metaSet('pool_cursor',to+1);state.lastIndexedAt=Math.floor(Date.now()/1000);state.lastError=null}catch(e){state.lastError=e.message;console.log('[indexer]',e.message)}finally{running=false}}
export function startIndexer(){indexOnce();setInterval(indexOnce,10000).unref();setInterval(refreshLiquidity,30000).unref();setInterval(refreshHolders,60000).unref()}
