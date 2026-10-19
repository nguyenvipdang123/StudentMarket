import { chatImageDirectory } from "./media-files";
import { query } from "./db";
import { ApiError, isUUID } from "./api-error";
export const chatAttachmentRoot = chatImageDirectory;
export async function requireConversationParticipant(id:string, userId:string) {
  if(!isUUID(id)) throw new ApiError("Cuộc trò chuyện không hợp lệ.",400);
  const rows=await query("SELECT buyer_id,seller_id FROM conversations WHERE id=$1",[id]);
  if(!rows.length) throw new ApiError("Không tìm thấy cuộc trò chuyện.",404);
  if(String(rows[0].buyer_id)!==userId&&String(rows[0].seller_id)!==userId) throw new ApiError("Bạn không có quyền truy cập cuộc trò chuyện.",403);
}
