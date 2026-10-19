import { randomBytes, scryptSync } from "node:crypto";
import assert from "node:assert/strict";

export async function seedE2E(db) {
  assert.match(db.database, /^student_market_e2e_[a-f0-9]{12}$/);
  const password = "E2EPass12345";
  const accounts = {};
  for (const [name, role, university] of [["seller", "student", "Đại học Công nghệ Đồng Nai"], ["sellerUEH", "student", "Đại học Kinh tế TP.HCM"], ["desktop", "student", "Đại học Công nghệ Đồng Nai"], ["mobile", "student", "Đại học Công nghệ Đồng Nai"], ["admin", "admin", "SangTay"]]) {
    const salt = randomBytes(16).toString("hex"), hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
    const email = name.toLowerCase() + "@ui-test.edu.vn";
    const account = (await db.query("INSERT INTO auth_identities(full_name,email,student_id,university,password_hash,status,role,created_at,verified_at) VALUES($1,$2,$3,$4,$5,'verified',$6,$7,$7) RETURNING id", ["E2E " + name, email, "UI-" + name, university, hash, role, Date.now()])).rows[0];
    const user = role === "student" ? (await db.query("SELECT id FROM users WHERE auth_id=$1", [account.id])).rows[0].id : null;
    accounts[name] = { email, password, userId: user };
  }
  await db.query("INSERT INTO categories(id,name,slug) VALUES(1,'Học tập','hoc-tap'),(2,'Công nghệ','cong-nghe'),(3,'Nội thất','noi-that'),(4,'Thời trang','thoi-trang'),(5,'Khác','khac') ON CONFLICT(id) DO NOTHING");
  const products = [];
  for (let index = 1; index <= 32; index++) {
    const book = index <= 14 || index > 28, seller = accounts[book ? "seller" : "sellerUEH"].userId;
    const status = index === 29 ? "Hidden" : index === 30 ? "Sold" : "Active";
    const moderation = index === 31 ? "PENDING" : index === 32 ? "REJECTED" : "APPROVED";
    const title = index > 28 ? `Tin E2E không công khai ${index}` : `${book ? "Sách" : "Laptop"} E2E ${String(index).padStart(2, "0")}`;
    const price = book ? 50000 + index * 10000 : index * 100000;
    const product = (await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,view_count,created_at,updated_at,moderation_status)
      VALUES(gen_random_uuid(),$1,$1,$2,$3,'Sản phẩm kiểm thử giao diện, không phải tin thật.',$4,$5,'Sell',$6,'Thư viện trường',$7,0,NOW()-($8::int * INTERVAL '1 minute'),NOW(),$9) RETURNING id`,
    [seller, book ? 1 : 2, title, price, book ? "Tốt" : "Như mới", status, book ? "Đại học Công nghệ Đồng Nai" : "Đại học Kinh tế TP.HCM", index, moderation])).rows[0];
    await db.query("INSERT INTO product_images(id,product_id,image_url,is_primary,sort_order,created_at) VALUES(gen_random_uuid(),$1,$2,true,1,NOW())", [product.id, book ? "/sample/hoc-tap.svg" : "/sample/cong-nghe.svg"]);
    products.push({ id: product.id, title, price, public: index <= 28 });
  }
  return { accounts, products };
}
