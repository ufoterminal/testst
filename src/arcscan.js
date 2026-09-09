import {ARCSCAN_API} from './config.js';
async function get(path){const r=await fetch(ARCSCAN_API+path,{signal:AbortSignal.timeout(12000),headers:{accept:'application/json'}});if(!r.ok)throw Error(`Arcscan ${r.status}`);return r.json()}
export async function holderCount(address){try{const j=await get(`/v1/tokens/${address}/concentration`);const d=j.data||j;for(const k of ['holder_count','total_holders']){const v=d?.[k];if(v!=null&&Number.isInteger(Number(v))&&Number(v)>=0)return Number(v)}}catch{}return null}
export async function tokenCreation(address){try{const j=await get(`/api?module=contract&action=getcontractcreation&contractaddresses=${address}`);const x=Array.isArray(j.result)?j.result[0]:null;return x?.blockNumber?Number(x.blockNumber):null}catch{return null}}
