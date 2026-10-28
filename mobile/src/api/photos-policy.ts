export type CompressedPhoto = { uri: string; fileName: string; mimeType: "image/jpeg"; fileSize: number; width: number; height: number };
export function validatePhotos(photos: CompressedPhoto[]) {
  if (photos.length < 1) return "Thêm ít nhất 1 ảnh đã nén từ camera hoặc thư viện trước khi đăng tin.";
  if (photos.length > 8) return "Mỗi tin tối đa 8 ảnh.";
  if (photos.some(p => p.mimeType !== "image/jpeg" || !p.uri || !Number.isFinite(p.fileSize) || p.fileSize <= 0 || p.fileSize > 5 * 1024 * 1024 || !Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width < 1 || p.height < 1 || p.width > 1600 || p.height > 1600))
    return "Ảnh chưa nén hợp lệ. Hãy chọn lại ảnh (tối đa 1.600px và 5 MB sau nén).";
  return "";
}
