// Local credentials and shared UI must be cleared even without a network response.
export async function completeSignOut(revoke: () => Promise<unknown>, clear: () => Promise<void>, finish: () => void) {
  let remoteFailed = false;
  const remote = revoke().catch(() => { remoteFailed = true; });
  try { await clear(); } finally { finish(); }
  await remote;
  if (remoteFailed) throw Error("Đã đăng xuất trên thiết bị. Chưa xác nhận được thu hồi phiên ở máy chủ vì mất kết nối.");
}
