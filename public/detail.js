const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=x=>x==null?'—':'$'+Number(x).toLocaleString('en-US',{maximumSignificantDigits:7});
const address=location.pathname.split('/').pop();let tf='1h',busy=false;
function chart(cs){
 if(!cs.length)return '<p class="muted">This source has no candle data for this token.</p>';
 const candles=cs.slice(-160),min=Math.min(...candles.map(c=>c.low)),max=Math.max(...candles.map(c=>c.high)),span=max-min||max*.01||1;
 const y=p=>20+(max-p)/span*290,w=900/candles.length;
 return '<svg role="img" aria-label="Price candlestick chart" viewBox="0 0 1000 370" style="width:100%;height:370px">'+candles.map((c,i)=>{const x=10+i*w,up=c.close>=c.open,color=up?'#39d7a0':'#ff6c83';return '<g><title>'+esc(new Date(c.bucket*1000).toISOString()+' O '+fmt(c.open)+' H '+fmt(c.high)+' L '+fmt(c.low)+' C '+fmt(c.close))+'</title><line x1="'+x+'" x2="'+x+'" y1="'+y(c.high)+'" y2="'+y(c.low)+'" stroke="'+color+'"/><rect x="'+(x-w*.3)+'" y="'+Math.min(y(c.open),y(c.close))+'" width="'+Math.max(1,w*.6)+'" height="'+Math.max(1,Math.abs(y(c.open)-y(c.close)))+'" fill="'+color+'"/></g>';}).join('')+'<text x="915" y="25" fill="#c8d8ea">'+fmt(max)+'</text><text x="915" y="310" fill="#c8d8ea">'+fmt(min)+'</text></svg>';
}
async function load(){
 if(busy)return;busy=true;
 try{
  const r=await fetch('/api/market/'+encodeURIComponent(address)+'?tf='+tf);const d=await r.json();if(!r.ok)throw Error(d.error||'HTTP '+r.status);
  const t=d.token,md=t.metadata||{};document.title=(t.symbol||'Token')+' · ARC Radar';
  document.getElementById('app').innerHTML='<div class="top"><h1>'+esc(t.symbol)+'</h1><span>'+esc(t.name)+'</span></div><p class="muted">'+esc(address)+'</p><div class="stats"><div class="stat"><small>Price</small><b>'+fmt(d.price)+'</b></div><div class="stat"><small>Created · '+esc(d.source)+'</small><b>'+(d.created_at?esc(new Date(d.created_at*1000).toLocaleString()):'—')+'</b></div><div class="stat"><small>Market cap</small><b>'+fmt(md.mcap)+'</b></div><div class="stat"><small>Liquidity</small><b>'+fmt(md.liquidity)+'</b></div></div><div>'+['1m','5m','15m','1h','4h','1d'].map(v=>'<button data-tf="'+v+'" style="margin:4px;padding:8px;background:'+(v===tf?'#234668':'#0d2136')+';color:white;border:1px solid #234668">'+v+'</button>').join('')+'</div><div class="panel">'+chart(d.candles)+'</div><div class="panel"><h3>Recent transactions</h3><table><tr><th>Time</th><th>Side</th><th>USD</th><th>Price</th><th>Transaction</th></tr>'+d.trades.map(s=>'<tr><td>'+esc(new Date(Number(s.at)*1000).toLocaleString())+'</td><td>'+(s.buy?'Buy':'Sell')+'</td><td>'+fmt(s.usd_volume)+'</td><td>'+fmt(s.price)+'</td><td>'+esc(s.tx)+'</td></tr>').join('')+'</table></div><p class="muted">Data source: '+esc(d.source||'Unavailable')+'</p>';
  document.querySelectorAll('[data-tf]').forEach(b=>b.onclick=()=>{tf=b.dataset.tf;load();});
 }catch(e){document.getElementById('app').textContent='Could not load token: '+e.message;}finally{busy=false;}
}
load();setInterval(()=>{if(!document.hidden)load();},15000);
