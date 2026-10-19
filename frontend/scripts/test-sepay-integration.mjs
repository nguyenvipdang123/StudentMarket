import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomBytes, scryptSync, createHmac } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import pg from "pg";

process.loadEnvFile(".env.local");
const database="student_market_sepay_test_"+randomBytes(6).toString("hex");
assert.match(database,/^student_market_sepay_test_[a-f0-9]{12}$/);
const settings={host:process.env.PG_HOST||"localhost",port:Number(process.env.PG_PORT||5432),user:process.env.PG_USER||"postgres",password:process.env.PG_PASSWORD};
const control=new pg.Client({...settings,database:"postgres"});
await mkdir(resolve("../.backups"),{recursive:true});
const dir=await mkdtemp(resolve("../.backups/sepay-test-"));
const reservation=createServer();await new Promise(r=>reservation.listen(0,"127.0.0.1",r));
const port=reservation.address().port;await new Promise(r=>reservation.close(r));
const origin="http://127.0.0.1:"+port,secret=randomBytes(32).toString("hex");
const env={...process.env,PG_DATABASE:database,APP_ORIGIN:origin,SEPAY_ENABLED:"true",SEPAY_BANK_CODE:"MBBank",SEPAY_ACCOUNT_NUMBER:"1234567890",SEPAY_ACCOUNT_NAME:"TEST ONLY",SEPAY_WEBHOOK_AUTH:"hmac",SEPAY_WEBHOOK_SECRET:secret,SEPAY_ORDER_PREFIX:"ST",SEPAY_QR_ACCOUNT:"",SEPAY_SUB_ACCOUNT:"",SEPAY_DESCRIPTION_PREFIX:"",NODE_OPTIONS:""};
let db,app,created=false,output="",passed=0,eventId=1000,packageId,sellerId;
env.MEDIA_STORAGE_PROVIDER="local";
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function pass(name){passed++;console.log("PASS "+name);}
async function req(path,{cookie="",method="GET",body,headers={}}={}){
 const response=await fetch(origin+path,{method,headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(body?{"Content-Type":"application/json"}:{}),...headers},body:body?JSON.stringify(body):undefined});
 let data;try{data=await response.json();}catch{data={};}return {status:response.status,data,cookie:response.headers.get("set-cookie")?.split(";")[0]};
}
async function product(title="Sách kiểm thử thanh toán"){
 return (await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,moderation_status,location,university,view_count,created_at,updated_at)
 VALUES(gen_random_uuid(),$1,$1,1,$2,'Sản phẩm giả lập chỉ dùng kiểm thử',80000,'Tốt','Sell','Active','APPROVED','Trường kiểm thử','Trường kiểm thử',0,NOW(),NOW()) RETURNING id`,[sellerId,title])).rows[0].id;
}
async function order(cookie,id){const response=await req(`/api/listings/${id}/promotions`,{cookie,method:"POST",body:{packageId,amount:1,paymentStatus:"PAID"}});assert.equal(response.status,201);return response.data.order;}
function bankTime(date=new Date()){return new Date(date.getTime()+7*3600000).toISOString().slice(0,19).replace("T"," ");}
function event(order,patch={}){const id=++eventId;return {id,gateway:"MBBank",accountNumber:env.SEPAY_ACCOUNT_NUMBER,subAccount:"",code:order.transactionCode,content:"Thanh toan "+order.transactionCode,transferType:"in",transferAmount:order.amount,referenceCode:"TEST-"+id,transactionDate:bankTime(),...patch};}
async function webhook(payload,{timestamp=String(Math.floor(Date.now()/1000)),tamper=false,signature=true}={}){
 const raw=JSON.stringify(payload),signed=tamper?raw+" ":raw;
 const response=await fetch(origin+"/api/payments/sepay/webhook",{method:"POST",headers:{"Content-Type":"application/json",...(signature?{"x-sepay-timestamp":timestamp,"x-sepay-signature":"sha256="+createHmac("sha256",secret).update(timestamp+"."+signed).digest("hex")}: {})},body:raw});
 return {status:response.status,data:await response.json()};
}
async function paymentState(id){return (await db.query("SELECT payment_status,promotion_id,review_required FROM promotion_orders WHERE id=$1",[id])).rows[0];}
try{
 await control.connect();
 const schema=execFileSync(join(process.env.PG_BIN||"C:/Program Files/PostgreSQL/16/bin","pg_dump.exe"),["--schema-only","--no-owner","--no-privileges","-h",settings.host,"-p",String(settings.port),"-U",settings.user,"-d",process.env.PG_DATABASE],{env:{...process.env,PGPASSWORD:settings.password},encoding:"utf8",windowsHide:true});
 await control.query('CREATE DATABASE "'+database+'"');created=true;
 db=new pg.Client({...settings,database});await db.connect();
 await db.query(schema.split("\n").filter(line=>!line.startsWith("\\")).join("\n"));
 await db.query("SET search_path TO public");
 for(const file of ["auth-schema.sql","postgres-schema.sql","sepay-schema.sql"])await db.query(await readFile("scripts/"+file,"utf8"));
 const salt=randomBytes(16).toString("hex"),hash=`scrypt:${salt}:${scryptSync("TestPass123",salt,64).toString("hex")}`;
 for(const [name,role]of [["seller","student"],["other","student"],["admin","admin"],["staff","staff"]])await db.query(`INSERT INTO auth_identities(full_name,email,student_id,university,password_hash,status,role,created_at,verified_at)
 VALUES($1,$2,$3,'Trường kiểm thử',$4,'verified',$5,$6,$6)`,["SePay Test "+name,name+"@sepay-test.invalid","SEPAY-"+name,hash,role,Date.now()]);
 sellerId=(await db.query("SELECT id FROM users WHERE email='seller@sepay-test.invalid'")).rows[0].id;
 packageId=(await db.query("INSERT INTO promotion_packages(name,description,duration_hours,price,priority,is_active) VALUES('Gói kiểm thử','Không dùng tiền thật',24,25000,3,TRUE) RETURNING id")).rows[0].id;
 app=spawn(process.execPath,["node_modules/next/dist/bin/next","start","-p",String(port),"-H","127.0.0.1"],{cwd:process.cwd(),env,windowsHide:true,stdio:["ignore","pipe","pipe"]});
 app.stdout.on("data",b=>output+=b);app.stderr.on("data",b=>output+=b);
 let ready=false;for(let i=0;i<100;i++){if(app.exitCode!==null)throw Error("Test server stopped");try{if((await fetch(origin+"/api/auth/me")).ok){ready=true;break;}}catch{}await delay(100);}assert.ok(ready);
 const cookies={};for(const name of ["seller","other","admin","staff"]){const login=await req("/api/auth/login",{method:"POST",body:{email:name+"@sepay-test.invalid",password:"TestPass123"}});assert.equal(login.status,200);cookies[name]=login.cookie;}
 const id=await product();
 assert.equal((await req(`/api/listings/${id}/promotions`,{method:"POST",body:{packageId}})).status,401);
 assert.equal((await req(`/api/listings/${id}/promotions`,{cookie:cookies.other,method:"POST",body:{packageId}})).status,403);
 assert.equal((await req(`/api/listings/${id}/promotions`,{cookie:cookies.staff,method:"POST",body:{packageId}})).status,403);
 assert.equal((await req(`/api/listings/${id}/promotions`,{cookie:cookies.seller,method:"POST",body:{packageId},headers:{Origin:"https://evil.invalid"}})).status,403);
 pass("only the authenticated listing owner can create payment orders");
 const simultaneous=await Promise.all([order(cookies.seller,id),order(cookies.seller,id)]),good=simultaneous[0];
 assert.equal(good.id,simultaneous[1].id);assert.equal(good.amount,25000);assert.equal(good.paymentStatus,"PENDING");assert.ok(good.qrUrl);assert.equal(JSON.stringify(good).includes(secret),false);
 assert.equal((await req(`/api/promotion-orders/${good.id}`,{cookie:cookies.other})).status,404);
 assert.equal((await req(`/api/promotion-orders/${good.id}`,{cookie:cookies.admin})).status,200);
 assert.equal((await req(`/api/listings/${id}/promotions`,{cookie:cookies.seller})).data.order.id,good.id);
 await db.query("UPDATE promotion_packages SET price=99000,duration_hours=72,priority=1 WHERE id=$1",[packageId]);
 assert.equal((await req(`/api/promotion-orders/${good.id}`,{cookie:cookies.seller})).data.order.durationHours,24);
 pass("concurrent orders reuse one checkout; client amounts are ignored; price, duration and recipient are snapshotted; details are private");
 const paid=event(good);
 for(const options of [{signature:false},{tamper:true},{timestamp:String(Math.floor(Date.now()/1000)-301)}])assert.equal((await webhook(paid,options)).status,401);
 assert.equal((await paymentState(good.id)).payment_status,"PENDING");
 assert.equal((await req(`/api/payments/${good.id}`,{cookie:cookies.seller,method:"POST",body:{paymentStatus:"PAID"}})).status,405);
 assert.equal((await req(`/api/promotion-orders/${good.id}/pay`,{cookie:cookies.seller,method:"POST",body:{paymentStatus:"PAID"}})).status,405);
 pass("unsigned, modified, stale and browser-forged payment confirmations cannot activate a package");
 const responses=await Promise.all([webhook(paid),webhook(paid)]);responses.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.success,true);});
 assert.equal((await paymentState(good.id)).payment_status,"PAID");
 const promotion=(await db.query("SELECT *,EXTRACT(EPOCH FROM end_at-start_at)/3600 AS hours FROM listing_promotions WHERE listing_id=$1",[id])).rows;
 assert.equal(promotion.length,1);assert.equal(Number(promotion[0].hours),24);assert.equal(promotion[0].priority_snapshot,3);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='SEPAY_PAYMENT_CONFIRMED' AND target_id=$1",[good.id])).rows[0].n,1);
 assert.equal((await req(`/api/promotion-orders/${good.id}`,{cookie:cookies.seller})).data.order.qrUrl,null);
 assert.ok((await req("/api/products")).data.products.some(p=>p.id===id&&p.promotion?.priority===3));
 pass("a valid signed transfer atomically activates one package, commits one audit record and honors the purchased snapshot");
 assert.equal((await webhook({...paid,transferAmount:99999})).status,409);
 assert.equal((await webhook(event(good))).status,200);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[id])).rows[0].n,1);
 pass("duplicate IDs with altered data and extra transfers never extend or activate the package twice");
 await db.query("UPDATE promotion_packages SET price=25000,duration_hours=24,priority=3 WHERE id=$1",[packageId]);
 for(const [patch,expected]of [[{transferAmount:24999},"REVIEW"],[{transferAmount:25001},"REVIEW"],[{accountNumber:"9999999999"},"IGNORED"],[{gateway:"Vietcombank"},"IGNORED"],[{transferType:"out"},"IGNORED"]]){
  const current=await order(cookies.seller,await product());const transfer=event(current,patch);assert.equal((await webhook(transfer)).status,200);
  assert.equal((await paymentState(current.id)).payment_status,"PENDING");
  assert.equal((await db.query("SELECT status FROM sepay_payment_events WHERE transaction_id=$1",[transfer.id])).rows[0].status,expected);
 }
 pass("wrong amounts require reconciliation; wrong recipient, bank and outgoing transfers do not activate packages");
 const unknown=event(good,{code:null,content:"Chuyen tien khong co ma don"});assert.equal((await webhook(unknown)).status,200);
 assert.equal((await db.query("SELECT status FROM sepay_payment_events WHERE transaction_id=$1",[unknown.id])).rows[0].status,"REVIEW");
 const late=await order(cookies.seller,await product());
 await db.query("UPDATE promotion_orders SET created_at=NOW()-INTERVAL '30 minutes',expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[late.id]);
 const lateEvent=event(late);
 await webhook(lateEvent);assert.equal((await paymentState(late.id)).review_required,true);
 const delayed=await order(cookies.seller,await product());
 await db.query("UPDATE promotion_orders SET created_at=NOW()-INTERVAL '30 minutes',expires_at=NOW()-INTERVAL '1 minute' WHERE id=$1",[delayed.id]);
 await webhook(event(delayed,{transactionDate:bankTime(new Date(Date.now()-120000))}));assert.equal((await paymentState(delayed.id)).payment_status,"PAID");
 pass("unmatched/late payments are recorded for Admin; a delayed webhook for an on-time transfer can still settle");
 const hiddenListing=await product(),hidden=await order(cookies.seller,hiddenListing);await db.query("UPDATE products SET status='Hidden' WHERE id=$1",[hiddenListing]);
 await webhook(event(hidden));assert.equal((await paymentState(hidden.id)).review_required,true);
 const rollback=await order(cookies.seller,await product()),rollbackEvent=event(rollback);
 await db.query("CREATE FUNCTION sepay_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SEPAY_PAYMENT_CONFIRMED' THEN RAISE EXCEPTION 'test rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER sepay_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION sepay_test_fail_audit()");
 assert.equal((await webhook(rollbackEvent)).status,500);assert.equal((await paymentState(rollback.id)).payment_status,"PENDING");
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM sepay_payment_events WHERE transaction_id=$1",[rollbackEvent.id])).rows[0].n,0);
 await db.query("DROP TRIGGER sepay_test_audit ON audit_logs; DROP FUNCTION sepay_test_fail_audit()");
 assert.equal((await webhook(rollbackEvent)).status,200);assert.equal((await paymentState(rollback.id)).payment_status,"PAID");
 pass("listing changes prevent activation; failed transactions roll back fully and can safely retry");
 const approve=(id,cookie=cookies.admin,body={note:"Đã kiểm tra khoản tiền và mã đơn trên ngân hàng.",confirmed:true},headers={})=>req(`/api/admin/payments/sepay/${id}/approve`,{cookie,method:"POST",body,headers});
 assert.equal((await approve(lateEvent.id,"")).status,401);
 for(const cookie of [cookies.seller,cookies.staff])assert.equal((await approve(lateEvent.id,cookie)).status,403);
 assert.equal((await approve(lateEvent.id,cookies.admin,undefined,{Origin:"https://evil.invalid"})).status,403);
 assert.equal((await approve(lateEvent.id,cookies.admin,{note:"Đã kiểm tra",confirmed:false})).status,400);
 assert.equal((await approve(lateEvent.id,cookies.admin,{note:"ngắn",confirmed:true})).status,400);
 assert.equal((await approve("not-a-transaction")).status,400);
 assert.equal((await approve(unknown.id)).status,404);
 const shortPayment=(await db.query("SELECT transaction_id FROM sepay_payment_events WHERE amount=24999 LIMIT 1")).rows[0];
 assert.equal((await approve(shortPayment.transaction_id)).status,409);
 const hiddenEvent=(await db.query("SELECT transaction_id FROM sepay_payment_events WHERE order_id=$1",[hidden.id])).rows[0];
 assert.equal((await approve(hiddenEvent.transaction_id)).status,409);
 pass("manual approval requires Admin, same origin, a checked receipt, a note, a matched exact amount and an eligible listing");
 const manualResponses=await Promise.all([approve(lateEvent.id),approve(lateEvent.id)]);
 manualResponses.forEach(r=>assert.equal(r.status,200));assert.equal(manualResponses.filter(r=>r.data.alreadyApproved).length,1);
 assert.equal((await paymentState(late.id)).payment_status,"PAID");assert.equal((await paymentState(late.id)).review_required,false);
 const manualPromo=(await db.query("SELECT *,EXTRACT(EPOCH FROM end_at-start_at)/3600 AS hours FROM listing_promotions WHERE listing_id=$1",[late.listingId])).rows;
 assert.equal(manualPromo.length,1);assert.equal(Number(manualPromo[0].hours),24);assert.equal(manualPromo[0].priority_snapshot,3);
 const manualAudit=(await db.query("SELECT actor_id,description FROM audit_logs WHERE action='SEPAY_PAYMENT_MANUALLY_APPROVED' AND target_id=$1",[late.id])).rows;
 assert.equal(manualAudit.length,1);assert.ok(manualAudit[0].actor_id);assert.ok(manualAudit[0].description.includes("Đã kiểm tra khoản tiền"));
 assert.equal((await req(`/api/promotion-orders/${late.id}`,{cookie:cookies.seller})).data.order.status,"PAID");
 const settledReason=(await db.query("SELECT reason FROM sepay_payment_events WHERE transaction_id=$1",[lateEvent.id])).rows[0].reason;
 assert.ok(settledReason.includes("ngoài thời hạn"));assert.ok(settledReason.includes("Admin đã đối soát"));
 assert.equal((await webhook(lateEvent)).status,200);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[late.listingId])).rows[0].n,1);
 pass("concurrent manual approval activates one purchased package, preserves the exception, clears review and records the Admin; webhook replays stay idempotent");
 const manualRollback=await order(cookies.seller,await product());
 const manualRollbackEvent=event(manualRollback,{transactionDate:bankTime(new Date(Date.now()-180000))});
 await webhook(manualRollbackEvent);assert.equal((await paymentState(manualRollback.id)).review_required,true);
 await db.query("CREATE FUNCTION sepay_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SEPAY_PAYMENT_MANUALLY_APPROVED' THEN RAISE EXCEPTION 'test manual rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER sepay_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION sepay_test_fail_audit()");
 assert.equal((await approve(manualRollbackEvent.id)).status,500);
 assert.equal((await paymentState(manualRollback.id)).payment_status,"PENDING");
 assert.equal((await db.query("SELECT status FROM sepay_payment_events WHERE transaction_id=$1",[manualRollbackEvent.id])).rows[0].status,"REVIEW");
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[manualRollback.listingId])).rows[0].n,0);
 await db.query("DROP TRIGGER sepay_test_audit ON audit_logs; DROP FUNCTION sepay_test_fail_audit()");
 assert.equal((await approve(manualRollbackEvent.id)).status,200);
 pass("manual settlement, package activation and audit either commit together or roll back fully; retry remains safe");
 assert.equal((await req("/api/admin/payments/sepay",{cookie:cookies.seller})).status,403);
 assert.equal((await req("/api/admin/payments/sepay",{cookie:cookies.staff})).status,403);
 const adminData=(await req("/api/admin/payments/sepay",{cookie:cookies.admin})).data;
 assert.ok(adminData.reviewCount>0);assert.equal(adminData.configured,true);assert.equal(JSON.stringify(adminData).includes(secret),false);
 const revenue=(await req("/api/admin/revenue",{cookie:cookies.admin})).data;
 assert.equal(revenue.totalRevenue,125000);
 assert.equal(revenue.packagesBreakdown.find(p=>p.packageId===packageId).totalRevenue,125000);
 assert.ok(revenue.packagesBreakdown.every(p=>Number.isFinite(p.totalRevenue)));
 pass("Admin sees reconciliation events and real settled revenue; students/staff cannot access financial records");
 const createPackage=await req("/api/admin/promotion-packages",{cookie:cookies.admin,method:"POST",body:{name:"Gói quản lý thử nghiệm",description:"Chỉ kiểm thử",durationHours:48,price:12000,priority:2}});
 assert.equal(createPackage.status,201);const managedId=createPackage.data.package.id;
 const packagePath=`/api/admin/promotion-packages/${managedId}`;
 for(const method of ["PATCH","DELETE"]){
  assert.equal((await req(packagePath,{method,body:method==="PATCH"?{price:17000}:undefined})).status,401);
  for(const cookie of [cookies.seller,cookies.staff])assert.equal((await req(packagePath,{cookie,method,body:method==="PATCH"?{price:17000}:undefined})).status,403);
  assert.equal((await req(packagePath,{cookie:cookies.admin,method,body:method==="PATCH"?{price:17000}:undefined,headers:{Origin:"https://evil.invalid"}})).status,403);
 }
 assert.equal((await req("/api/admin/promotion-packages/not-an-id",{cookie:cookies.admin,method:"DELETE"})).status,400);
 for(const body of [{},{name:" "},{price:0},{price:1.5},{price:10000000000},{durationHours:0},{durationHours:8761},{durationHours:null},{priority:-1},{isActive:"true"},[]])assert.equal((await req(packagePath,{cookie:cookies.admin,method:"PATCH",body})).status,400);
 assert.equal((await req("/api/admin/promotion-packages",{cookie:cookies.admin,method:"POST",body:{name:"Gói lỗi",price:1.5}})).status,400);
 pass("only Admin can edit/delete packages; CSRF, identifiers and invalid prices, durations, names and priorities are rejected");
 const mainPackageId=packageId;packageId=managedId;
 const purchased=await order(cookies.seller,await product()),unpaid=await order(cookies.seller,await product());
 assert.equal((await webhook(event(purchased))).status,200);
 const editPackage=await req(packagePath,{cookie:cookies.admin,method:"PATCH",body:{name:"Gói sau chỉnh sửa",description:"Quyền lợi mới",price:17000,durationHours:72,priority:5}});
 assert.equal(editPackage.status,200);assert.equal(editPackage.data.package.price,17000);
 const publicPackage=(await req("/api/promotions/packages")).data.packages.find(p=>p.id===managedId);
 assert.equal(publicPackage.name,"Gói sau chỉnh sửa");assert.equal(publicPackage.durationHours,72);
 const oldOrder=(await req(`/api/promotion-orders/${unpaid.id}`,{cookie:cookies.seller})).data.order;
 assert.equal(oldOrder.amount,12000);assert.equal(oldOrder.durationHours,48);assert.equal(oldOrder.packageName,"Gói quản lý thử nghiệm");
 const newPurchase=await order(cookies.seller,await product());assert.equal(newPurchase.amount,17000);assert.equal(newPurchase.durationHours,72);
 const ownListings=(await req("/api/my-listings",{cookie:cookies.seller})).data.listings;
 assert.equal(ownListings.find(p=>p.id===purchased.listingId).promotion.name,"Gói quản lý thử nghiệm");
 assert.equal(ownListings.find(p=>p.id===purchased.listingId).promotion.priority,2);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='UPDATE_PROMOTION_PACKAGE' AND target_id=$1",[String(managedId)])).rows[0].n,1);
 pass("package edits update the catalogue and new checkouts while existing orders and active benefits retain their purchased terms");
 await db.query("CREATE FUNCTION sepay_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action IN ('UPDATE_PROMOTION_PACKAGE','DELETE_PROMOTION_PACKAGE') THEN RAISE EXCEPTION 'test package audit rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER sepay_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION sepay_test_fail_audit()");
 assert.equal((await req(packagePath,{cookie:cookies.admin,method:"PATCH",body:{price:1}})).status,500);
 assert.equal((await req(packagePath,{cookie:cookies.admin,method:"DELETE"})).status,500);
 const unchanged=(await db.query("SELECT price,is_active,deleted_at FROM promotion_packages WHERE id=$1",[managedId])).rows[0];
 assert.equal(Number(unchanged.price),17000);assert.equal(unchanged.is_active,true);assert.equal(unchanged.deleted_at,null);
 await db.query("DROP TRIGGER sepay_test_audit ON audit_logs; DROP FUNCTION sepay_test_fail_audit()");
 pass("package edits/deletions and their audit logs commit atomically and roll back together on failure");
 for(let n=0;n<2;n++)assert.equal((await req(packagePath,{cookie:cookies.admin,method:"DELETE"})).status,200);
 assert.equal((await req("/api/admin/promotion-packages",{cookie:cookies.admin})).data.packages.some(p=>p.id===managedId),false);
 for(const path of ["/api/promotions/packages","/api/promotion-packages"]){assert.equal((await req(path)).data.packages.some(p=>p.id===managedId),false);}
 assert.equal((await req(packagePath,{cookie:cookies.admin,method:"PATCH",body:{isActive:true}})).status,404);
 assert.equal((await req(packagePath+"/activate",{cookie:cookies.admin,method:"PATCH"})).status,404);
 assert.equal((await req(`/api/listings/${await product()}/promotions`,{cookie:cookies.seller,method:"POST",body:{packageId:managedId}})).status,404);
 assert.equal((await webhook(event(unpaid))).status,200);
 assert.equal((await paymentState(unpaid.id)).payment_status,"PAID");
 const preserved=(await req(`/api/promotion-orders/${purchased.id}`,{cookie:cookies.seller})).data.order;
 assert.equal(preserved.paymentStatus,"PAID");assert.equal(preserved.packageName,"Gói quản lý thử nghiệm");
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='DELETE_PROMOTION_PACKAGE' AND target_id=$1",[String(managedId)])).rows[0].n,1);
 assert.equal((await req("/api/admin/revenue",{cookie:cookies.admin})).data.totalRevenue,149000);
 packageId=mainPackageId;
 pass("deletion removes the package from both catalogues, blocks new sales/reactivation, preserves paid history and still settles existing checkouts; repeated deletion is idempotent");
 const cancel=(current,cookie=cookies.seller,body={confirmed:true},headers={})=>req(`/api/promotion-orders/${current.id}/cancel`,{cookie,method:"POST",body,headers});
 const cancellable=await order(cookies.seller,await product());
 assert.equal((await cancel(cancellable,"")).status,401);
 assert.equal((await cancel(cancellable,cookies.other)).status,404);
 for(const cookie of [cookies.staff,cookies.admin])assert.equal((await cancel(cancellable,cookie)).status,403);
 assert.equal((await cancel(cancellable,cookies.seller,undefined,{Origin:"https://evil.invalid"})).status,403);
 assert.equal((await cancel(cancellable,cookies.seller,{confirmed:false})).status,400);
 assert.equal((await cancel({id:"invalid"})).status,404);
 assert.equal((await cancel(good)).status,409);
 assert.equal((await cancel(hidden)).status,409);
 pass("only the order owner can cancel; authentication, CSRF and confirmation are enforced; paid and review orders cannot be cancelled");
 const cancelled=await Promise.all([cancel(cancellable),cancel(cancellable)]);
 cancelled.forEach(r=>{assert.equal(r.status,200);assert.equal(r.data.order.status,"CANCELLED");assert.equal(r.data.order.qrUrl,null);assert.equal(r.data.order.canCancel,false);assert.ok(r.data.order.cancelledAt);});
 assert.equal((await req(`/api/listings/${cancellable.listingId}/promotions`,{cookie:cookies.seller})).data.order.status,"CANCELLED");
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM audit_logs WHERE action='SEPAY_PAYMENT_CANCELLED' AND target_id=$1",[cancellable.id])).rows[0].n,1);
 const replacement=await order(cookies.seller,cancellable.listingId);
 assert.notEqual(replacement.id,cancellable.id);assert.notEqual(replacement.transactionCode,cancellable.transactionCode);
 assert.equal((await cancel(replacement)).status,200);
 const expiredCancellation=await order(cookies.seller,await product());
 await db.query("UPDATE promotion_orders SET expires_at=NOW()-INTERVAL '1 second' WHERE id=$1",[expiredCancellation.id]);
 assert.equal((await cancel(expiredCancellation)).status,200);
 pass("cancellation persists without deleting history, removes the QR, is idempotent and allows a fresh checkout; unpaid expired orders may also be cancelled");
 const afterCancel=event(cancellable);
 assert.equal((await webhook(afterCancel)).status,200);
 assert.equal((await paymentState(cancellable.id)).payment_status,"CANCELLED");assert.equal((await paymentState(cancellable.id)).review_required,true);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[cancellable.listingId])).rows[0].n,0);
 assert.equal((await cancel(cancellable)).status,409);
 assert.equal((await req(`/api/promotion-orders/${cancellable.id}`,{cookie:cookies.seller})).data.order.status,"REVIEW");
 assert.equal((await req("/api/admin/payments/sepay",{cookie:cookies.admin})).data.events.find(e=>String(e.id)===String(afterCancel.id)).canApprove,true);
 assert.equal((await approve(afterCancel.id)).status,200);
 assert.equal((await paymentState(cancellable.id)).payment_status,"PAID");
 assert.equal((await webhook(afterCancel)).status,200);
 assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[cancellable.listingId])).rows[0].n,1);
 pass("money received after cancellation goes to Admin reconciliation without automatic activation and can be settled exactly once after review");
 const racing=await order(cookies.seller,await product()),racingEvent=event(racing);
 const [racingCancel,racingWebhook]=await Promise.all([cancel(racing),webhook(racingEvent)]);
 assert.equal(racingWebhook.status,200);assert.ok([200,409].includes(racingCancel.status));
 const racingState=await paymentState(racing.id),racingPromos=(await db.query("SELECT COUNT(*)::int AS n FROM listing_promotions WHERE listing_id=$1",[racing.listingId])).rows[0].n;
 if(racingCancel.status===200){assert.equal(racingState.payment_status,"CANCELLED");assert.equal(racingState.review_required,true);assert.equal(racingPromos,0);}
 else{assert.equal(racingState.payment_status,"PAID");assert.equal(racingPromos,1);}
 pass("a webhook racing with cancellation either settles the payment or records a cancelled-order review; payment and cancellation never overwrite each other");
 const cancelRollback=await order(cookies.seller,await product());
 await db.query("CREATE FUNCTION sepay_test_fail_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='SEPAY_PAYMENT_CANCELLED' THEN RAISE EXCEPTION 'test cancel rollback'; END IF; RETURN NEW; END $$; CREATE TRIGGER sepay_test_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION sepay_test_fail_audit()");
 assert.equal((await cancel(cancelRollback)).status,500);
 const afterFailedCancel=(await db.query("SELECT payment_status,cancelled_at FROM promotion_orders WHERE id=$1",[cancelRollback.id])).rows[0];
 assert.equal(afterFailedCancel.payment_status,"PENDING");assert.equal(afterFailedCancel.cancelled_at,null);
 await db.query("DROP TRIGGER sepay_test_audit ON audit_logs; DROP FUNCTION sepay_test_fail_audit()");
 assert.equal((await cancel(cancelRollback)).status,200);
 pass("cancellation and its audit record roll back together on failure and can be retried safely");
 console.log(JSON.stringify({passed,database,testOnly:true,realMoneyTransferred:false}));
}catch(e){await writeFile(join(dir,"server.log"),output);console.error(e.message);console.error("Diagnostic log: "+join(dir,"server.log"));process.exitCode=1;}
finally{
 if(app&&app.exitCode===null){app.kill();await Promise.race([new Promise(r=>app.once("exit",r)),delay(5000)]);}
 await db?.end().catch(()=>{});
 if(created){await control.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()",[database]);await control.query('DROP DATABASE "'+database+'"');console.log("Isolated SePay test database cleaned up.");}
 await control.end().catch(()=>{});
}
