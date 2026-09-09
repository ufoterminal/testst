import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function environment(payload){
 const elements=new Map();
 const get=id=>{if(!elements.has(id))elements.set(id,{value:'',innerHTML:'',textContent:''});return elements.get(id)};
 const context={document:{getElementById:get,querySelectorAll:()=>[],hidden:false},location:{pathname:'/token/0x'+'a'.repeat(40)},fetch:async()=>({ok:true,json:async()=>payload}),AbortController,Date,setTimeout,clearTimeout,setInterval:()=>0,console};
 return {elements,get,context};
}
test('screener script loads API rows, escapes token text and preserves sub-cent prices',async()=>{
 const e=environment({rows:[{address:'0x'+'a'.repeat(40),symbol:'<img>',name:'Test',price:0.000002,volume24h:12,launchpad_id:'sharc'}]});
 vm.runInNewContext(fs.readFileSync('public/market.js','utf8'),e.context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(e.get('rows').innerHTML,/\$0\.000002/);assert.match(e.get('rows').innerHTML,/&lt;img&gt;/);
 assert.equal(e.get('tokens').textContent,'1');
});
test('token detail renders provider candles and price without requiring local swaps',async()=>{
 const e=environment({token:{symbol:'ABC',metadata:{}},source:'tolly',price:.000003,candles:[{bucket:1700000000,open:.000002,high:.000004,low:.000001,close:.000003}],trades:[]});
 vm.runInNewContext(fs.readFileSync('public/detail.js','utf8'),e.context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.match(e.get('app').innerHTML,/<svg/);assert.match(e.get('app').innerHTML,/\$0\.000003/);
});
