import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDirect} from '../src/direct.js';
const address='0x'+'a'.repeat(40);
test('Sharc uses its declared scales and never treats all-time counts as 24h',()=>{
 const [t]=normalizeDirect('sharc',[{address,chainKey:'arc',priceE18:'2000000000000',marketCap:'2000000000',volume24h:'12500000',change24hBps:'1250',tradesCount:1000,tradersCount:50,createdAt:'1700000000'}]);
 assert.equal(t.metadata.price,.000002);assert.equal(t.metadata.mcap,2000);
 assert.equal(t.metadata.volume24h,12.5);assert.equal(t.metadata.changes['24h'],12.5);
 assert.equal(t.metadata.txns24h,null);assert.equal(t.metadata.traders24h,null);
 assert.equal(t.metadata.liquidity,null);assert.equal(t.metadata.token_created_at,1700000000);
});
test('Tolly rejects external markets',()=>{
 assert.equal(normalizeDirect('tolly',{tokens:[{address,tolly:false}]}).length,0);
 assert.equal(normalizeDirect('tolly',{tokens:[{address,tolly:true,price:.000001}]}).length,1);
});
test('Sharc rejects a token from another chain',()=>{
 assert.equal(normalizeDirect('sharc',[{address,chainKey:'base'}]).length,0);
});
