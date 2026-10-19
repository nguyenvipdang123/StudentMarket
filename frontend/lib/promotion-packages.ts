import type { QueryResultRow } from "pg";
import { ApiError } from "./api-error";
import { transaction } from "./db";

export function packageId(value: string) {
  const id = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isInteger(id) || id > 2147483647) throw new ApiError("Mã gói dịch vụ không hợp lệ.");
  return id;
}

type PackageFields = { name: string; description: string; durationHours: number; price: number; priority: number; isActive: boolean };
export function packageFields(value: unknown, partial = false): Partial<PackageFields> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError("Dữ liệu gói dịch vụ không hợp lệ.");
  const body = value as Record<string, unknown>, fields: Partial<PackageFields> = {};
  for (const key of ["name", "description"] as const) {
    if (body[key] === undefined && partial) continue;
    const item = key === "description" && body[key] === undefined ? "" : body[key];
    if (typeof item !== "string" || item.trim().length > (key === "name" ? 100 : 4000) || (key === "name" && !item.trim())) throw new ApiError(key === "name" ? "Tên gói cần từ 1 đến 100 ký tự." : "Mô tả tối đa 4000 ký tự.");
    fields[key] = item.trim();
  }
  for (const [key, min, max, message] of [
    ["price", 1, 9999999999, "Giá gói phải là số nguyên VNĐ lớn hơn 0, tối đa 9.999.999.999đ."],
    ["durationHours", 1, 8760, "Thời hạn phải là số nguyên từ 1 đến 8760 giờ."],
    ["priority", 0, 2147483647, "Độ ưu tiên phải là số nguyên từ 0 đến 2147483647."],
  ] as const) {
    if (body[key] === undefined && partial) continue;
    const item = body[key] === undefined ? (key === "priority" ? 1 : key === "durationHours" ? 24 : undefined) : body[key];
    if (typeof item !== "number" || !Number.isSafeInteger(item) || item < min || item > max) throw new ApiError(message);
    fields[key] = item;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") throw new ApiError("Trạng thái gói không hợp lệ.");
    fields.isActive = body.isActive;
  }
  if (!Object.keys(fields).length) throw new ApiError("Chưa có thông tin gói cần cập nhật.");
  return fields;
}

export function packageDto(row: QueryResultRow) {
  return { id: Number(row.id), name: row.name as string, description: String(row.description || ""), durationHours: Number(row.duration_hours),
    price: Number(row.price), priority: Number(row.priority), isActive: Boolean(row.is_active) };
}

export async function updatePromotionPackage(id: number, fields: Partial<PackageFields>, actorId: string) {
  return transaction(async client => {
    const previous = (await client.query("SELECT * FROM promotion_packages WHERE id=$1 AND deleted_at IS NULL FOR UPDATE", [id])).rows[0];
    if (!previous) throw new ApiError("Không tìm thấy gói dịch vụ hoặc gói đã bị xóa.", 404);
    const updated = (await client.query(`UPDATE promotion_packages SET name=COALESCE($2,name),description=COALESCE($3,description),
      duration_hours=COALESCE($4,duration_hours),price=COALESCE($5,price),priority=COALESCE($6,priority),is_active=COALESCE($7,is_active),updated_at=NOW()
      WHERE id=$1 RETURNING *`, [id, fields.name, fields.description, fields.durationHours, fields.price, fields.priority, fields.isActive])).rows[0];
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),$1,'UPDATE_PROMOTION_PACKAGE','PROMOTION_PACKAGE',$2,$3,NOW())`,
    [actorId, String(id), `Sửa gói dịch vụ. Trước: ${JSON.stringify(packageDto(previous))}. Sau: ${JSON.stringify(packageDto(updated))}.`]);
    return packageDto(updated);
  });
}

export async function deletePromotionPackage(id: number, actorId: string) {
  return transaction(async client => {
    const previous = (await client.query("SELECT * FROM promotion_packages WHERE id=$1 FOR UPDATE", [id])).rows[0];
    if (!previous) throw new ApiError("Không tìm thấy gói dịch vụ.", 404);
    if (previous.deleted_at) return;
    await client.query("UPDATE promotion_packages SET is_active=FALSE,deleted_at=NOW(),updated_at=NOW() WHERE id=$1", [id]);
    await client.query(`INSERT INTO audit_logs(id,actor_id,action,target_type,target_id,description,created_at)
      VALUES(gen_random_uuid(),$1,'DELETE_PROMOTION_PACKAGE','PROMOTION_PACKAGE',$2,$3,NOW())`,
    [actorId, String(id), `Xóa gói dịch vụ khỏi danh sách bán: ${previous.name}. Giữ lịch sử đơn và gói đã mua.`]);
  });
}
