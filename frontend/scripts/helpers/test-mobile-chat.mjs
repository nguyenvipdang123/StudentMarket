import assert from 'node:assert/strict';

// Opt-in: exercises the mobile HTTP adapter against the real API and an isolated DB.
export async function testMobileChat({ db, req, users, cookies, check }) {
  assert.match(db.database, /^student_market_test_[a-f0-9]{12}$/);
  const { createChatApi, chatPeer, chatImagePath } = await import('../../../mobile/src/api/chat.ts');
  const adapter = cookie => createChatApi(async (path, options = {}) => {
    const result = await req(path, { cookie, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : undefined });
    if (result.status >= 400) throw Object.assign(new Error(result.data.error || 'Request failed'), { status: result.status });
    return result.data;
  });
  const buyer = adapter(cookies.buyer), seller = adapter(cookies.seller), stranger = adapter(cookies.other);
  const product = (await db.query(`INSERT INTO products(id,user_id,seller_id,category_id,title,description,price,condition,type,status,location,university,created_at,updated_at,moderation_status)
    VALUES(gen_random_uuid(),$1,$1,1,'Món đồ kiểm thử mobile chat','Fixture local, không đăng production',50000,'Tốt','Sell','Active','Thư viện','Trường kiểm thử',NOW(),NOW(),'APPROVED') RETURNING id`, [users.seller.pgUserId])).rows[0].id;
  const [first, repeated] = await Promise.all([buyer.contact(product), buyer.contact(product)]);
  assert.equal(first.id, repeated.id);
  await assert.rejects(seller.contact(product), e => e.status === 400);
  const inbox = await buyer.inbox();
  const conversation = inbox.conversations.find(c => c.id === first.id);
  assert.ok(conversation); assert.equal(conversation.sellerId, users.seller.pgUserId);
  assert.equal(chatPeer(conversation, inbox.pgUserId).buying, true);
  check('mobile contact reuses one conversation, derives seller on server and prevents self-contact');

  const sent = await buyer.send(first.id, '  Bạn ơi, món này còn không?  ');
  assert.equal(sent.message.content, 'Bạn ơi, món này còn không?');
  const received = await seller.history(first.id);
  assert.ok(received.messages.some(m => m.id === sent.message.id));
  assert.equal(chatPeer(received.conversation, received.pgUserId).buying, false);
  assert.equal((await buyer.history(first.id)).messages.find(m => m.id === sent.message.id).isRead, true);
  const reply = await seller.send(first.id, 'Món còn nhé, bạn muốn hẹn lúc nào?');
  assert.ok((await buyer.history(first.id)).messages.some(m => m.id === reply.message.id));
  await assert.rejects(stranger.history(first.id), e => e.status === 403);
  await assert.rejects(stranger.send(first.id, 'Không được gửi'), e => e.status === 403);
  await assert.rejects(adapter('').inbox(), e => e.status === 401);
  check('mobile buyer/seller exchange persisted messages and read receipts; outsiders and anonymous clients are denied');

  const body = new FormData();
  body.append('image', new Blob([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')], { type: 'image/png' }), 'fixture.png');
  const image = await req(`/api/conversations/${first.id}/attachments`, { cookie: cookies.seller, method: 'POST', body });
  assert.equal(image.status, 200);
  await seller.send(first.id, '[Ảnh] ' + image.data.url);
  const history = await buyer.history(first.id);
  assert.equal(chatImagePath(history.messages.at(-1).content, first.id), image.data.url);
  assert.equal((await req(image.data.url, { cookie: cookies.other })).status, 403);
  assert.equal((await req(image.data.url, { cookie: cookies.buyer })).status, 200);
  check('mobile recognizes website photo messages and conversation images remain participant-only');
}
