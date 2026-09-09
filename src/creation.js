import {client,exactBlockAt} from './chain.js';
import {q} from './db.js';
import {tokenCreation} from './arcscan.js';
const exists=code=>typeof code==='string'&&code.length>2;
export async function verifyTokenBirths(head){const rows=await q("SELECT address FROM tokens WHERE creation_at IS NULL LIMIT 5");for(const row of rows){try{
    const indexed=await tokenCreation(row.address);
    if(indexed!=null&&indexed>=0&&indexed<=head){const at=await exactBlockAt(indexed);await q('UPDATE tokens SET creation_block=$1,creation_at=$2 WHERE address=$3 AND creation_at IS NULL',[indexed,at,row.address]);continue}
    let lo=0,hi=head;if(!exists(await client.getCode({address:row.address,blockTag:BigInt(head)})))continue;
    while(lo<hi){const mid=Math.floor((lo+hi)/2),code=await client.getCode({address:row.address,blockTag:BigInt(mid)});if(exists(code))hi=mid;else lo=mid+1}
    const at=await exactBlockAt(lo);await q('UPDATE tokens SET creation_block=$1,creation_at=$2 WHERE address=$3 AND creation_at IS NULL',[lo,at,row.address])
  }catch(e){console.log('[birth]',row.address,e.message)}}}
