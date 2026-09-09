const $=id=>document.getElementById(id);
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const price=x=>x==null?'—':'$'+Number(x).toLocaleString('en-US',{maximumSignificantDigits:7});
const money=x=>x==null?'—':'$'+Number(x).toLocaleString('en-US',{maximumFractionDigits:2,notation:Math.abs(x)>=10000?'compact':'standard'});
const number=x=>x==null?'—':Number(x).toLocaleString('en-US');
const age=t=>{if(!t)return '—';const s=Math.max(0,Date.now()/1000-Number(t));return s<3600?Math.floor(s/60)+'m':s<86400?Math.floor(s/3600)+'h':Math.floor(s/86400)+'d';};
const pct=x=>x==null?'—':(x>0?'+':'')+Number(x).toFixed(2)+'%';
let rows=[],sort='volume24h',sequence=0,timer,controller;
function render(){
 const searching=$('search').value.trim().length>0;
 const selected=searching?rows:rows.filter(t=>(!$('pad').value||t.launchpad_id===$('pad').value)&&(!$('age').value||Number($('age').value)===0||(t.creation_at&&Date.now()/1000-t.creation_at<Number($('age').value)))&&(!Number($('minliq').value)||t.liquidity>=Number($('minliq').value))&&(!Number($('minvol').value)||t.volume24h>=Number($('minvol').value)));
 selected.sort((a,b)=>Number(b[sort]??-Infinity)-Number(a[sort]??-Infinity));
 $('rows').innerHTML=selected.map(t=>'<tr><td><div class="token"><div class="logo">'+escapeHTML((t.symbol||'?').slice(0,2))+'</div><div><a style="color:#c8d8ea;text-decoration:none" href="/token/'+escapeHTML(t.address)+'"><b>'+escapeHTML(t.symbol)+'</b></a><span class="sub">'+escapeHTML(t.name)+' · '+escapeHTML(t.launchpad_id||'Unknown')+'</span></div></div></td><td>—</td><td>'+money(t.market_cap)+'</td><td>'+price(t.price)+'</td><td>'+age(t.creation_at)+'</td><td>'+number(t.txns24h)+'</td><td>'+money(t.volume24h)+'</td><td>'+number(t.traders24h)+'</td><td>'+number(t.holders)+'</td>'+['5m','1h','6h','24h'].map(w=>'<td class="'+(t.changes?.[w]>=0?'up':'down')+'">'+pct(t.changes?.[w])+'</td>').join('')+'<td>'+money(t.liquidity)+'</td></tr>').join('')||'<tr><td colspan="14">No matching tokens.</td></tr>';
 $('notice').textContent=selected.length+(searching?' search results · includes archived tokens':' markets · each launchpad supplies its own data');
}
async function load(){
 const seq=++sequence,q=$('search').value.trim();controller?.abort();controller=new AbortController();
 try{
  const r=await fetch(q?'/api/search?q='+encodeURIComponent(q):'/api/screener',{signal:controller.signal});
  if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(seq!==sequence)return;
  rows=j.rows||[];render();
  if(!q){const selected=$('pad').value;$('pad').innerHTML='<option value="">All launchpads</option>'+[...new Set(rows.map(t=>t.launchpad_id).filter(Boolean))].map(id=>'<option value="'+escapeHTML(id)+'">'+escapeHTML(id)+'</option>').join('');$('pad').value=selected;
   $('tokens').textContent=number(rows.length);
   for(const [id,key] of [['volume','volume24h'],['liq','liquidity'],['txns','txns24h']]){const values=rows.map(t=>t[key]).filter(x=>x!=null);$(id).textContent=values.length?(id==='txns'?number:money)(values.reduce((a,x)=>a+Number(x),0)):'—';}
   $('ticker').textContent=rows.slice(0,8).map(t=>t.symbol+' '+price(t.price)).join(' · ');}
 }catch(e){if(e.name!=='AbortError'){$('notice').textContent='Could not refresh data: '+e.message;if(!rows.length)$('rows').textContent='Data unavailable. Retrying…';}}
}
$('search').oninput=()=>{++sequence;controller?.abort();clearTimeout(timer);timer=setTimeout(load,250);};
for(const id of ['pad','age','minliq','minvol'])$(id).oninput=render;
document.querySelectorAll('[data-sort]').forEach(b=>b.onclick=()=>{sort=b.dataset.sort;document.querySelectorAll('[data-sort]').forEach(c=>c.classList.toggle('active',c===b));render();});
load();setInterval(()=>{if(!document.hidden&&!$('search').value.trim())load();},15000);
