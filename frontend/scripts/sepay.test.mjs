import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { bankMatches, parseSePayEvent, paymentCode, sepayQr, validSePaySignature } from "../lib/sepay-policy.ts";

const config={enabled:true,bank:"MBBank",account:"1234567890",holder:"TEST ONLY",qrAccount:"1234567890",subAccount:"",descriptionPrefix:"",orderPrefix:"ST",auth:"hmac",secret:"test-only-".repeat(6)};
const payload={id:123,gateway:"MBBank",accountNumber:"1234567890",subAccount:"",code:null,content:"Thanh toan ST0123456789ABCDEF",transferType:"in",transferAmount:25000,referenceCode:"TEST-REF",transactionDate:"2026-10-18 12:30:00"};
test("HMAC signs the original body and timestamp; altered/stale/unsigned payloads fail",()=>{
 const raw=JSON.stringify(payload),now=Date.now(),timestamp=String(Math.floor(now/1000));
 const headers=new Headers({"x-sepay-timestamp":timestamp,"x-sepay-signature":"sha256="+createHmac("sha256",config.secret).update(timestamp+"."+raw).digest("hex")});
 assert.equal(validSePaySignature(raw,headers,config,now),true);
 assert.equal(validSePaySignature(raw+" ",headers,config,now),false);
 assert.equal(validSePaySignature(raw,headers,config,now+301000),false);
 assert.equal(validSePaySignature(raw,new Headers(),config,now),false);
 assert.equal(validSePaySignature(raw,new Headers({Authorization:"Apikey "+config.secret}),config,now),false);
 assert.equal(validSePaySignature(raw,new Headers({Authorization:"Apikey "+config.secret}),{...config,auth:"apikey"},now),true);
});
test("strict bank payload validation and Vietnam transaction timezone",()=>{
 const event=parseSePayEvent(payload);assert.equal(event.transactionAt,"2026-10-18T05:30:00.000Z");
 for(const changed of [{id:"123"},{transferAmount:-1},{transferAmount:1.5},{transferAmount:"25000"},{transferType:"refund"},{transactionDate:"2026-02-30 12:00:00"},{transactionDate:"bad"},{content:""}])assert.throws(()=>parseSePayEvent({...payload,...changed}));
});
test("only a unique complete order code is matched",()=>{
 const event=parseSePayEvent(payload);assert.equal(paymentCode(event,"ST"),"ST0123456789ABCDEF");
 assert.equal(paymentCode({...event,content:"XST0123456789ABCDEFZ"},"ST"),null);
 assert.equal(paymentCode({...event,content:event.content+" STFFFFFFFFFFFFFFFF"},"ST"),null);
 assert.equal(paymentCode({...event,content:event.content+" ST0123456789ABCDEF"},"ST"),"ST0123456789ABCDEF");
 assert.equal(paymentCode({...event,code:"STFFFFFFFFFFFFFFFF"},"ST"),null);
});
test("QR keeps exact bank, account, amount, and bank-specific memo",()=>{
 const qr=sepayQr({...config,descriptionPrefix:"SEVQR"},"ST0123456789ABCDEF",25000),url=new URL(qr.qrUrl);
 assert.equal(url.origin,"https://vietqr.app");assert.equal(url.searchParams.get("acc"),config.account);assert.equal(url.searchParams.get("amount"),"25000");assert.equal(url.searchParams.get("des"),"SEVQR ST0123456789ABCDEF");
 assert.equal(qr.qrUrl.includes(config.secret),false);assert.equal(bankMatches("MB","MBBank"),true);assert.equal(bankMatches("VCB","MBBank"),false);
});
