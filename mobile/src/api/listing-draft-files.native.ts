import { Directory, File, Paths } from "expo-file-system";
import type { DraftMedia } from "../state/listing-draft";
import { validatePhotos } from "./photos-policy";

export function draftMedia(scope: string): DraftMedia {
  // Use a collision-free account/API path; never interpret scope as a filesystem path.
  const encoded = encodeURIComponent(scope).replace(/~/g, "%7E").replace(/\./g, "%2E").replace(/%/g, "~");
  const folder = new Directory(Paths.document, "listing-drafts", ...(encoded.match(/.{1,72}/g) || ["empty"]));
  const prefix = folder.uri.replace(/\/$/, "") + "/";
  const owns = (uri: string) => uri.startsWith(prefix) && /^draft-[a-z0-9-]+\.jpg$/.test(uri.slice(prefix.length));
  return {
    async retain(photo) {
      if (validatePhotos([photo])) throw Error("Ảnh chưa nén hợp lệ");
      folder.create({ intermediates: true, idempotent: true });
      const fileName = `draft-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const target = new File(folder, fileName);
      await new File(photo.uri).copy(target);
      const saved = { ...photo, uri: target.uri, fileName, fileSize: target.size };
      if (validatePhotos([saved])) throw Error("Không lưu được ảnh nháp");
      return saved;
    },
    async inspect(photo) {
      if (!owns(photo.uri)) return null;
      const file = new File(photo.uri);
      if (!file.exists) return null;
      const restored = { ...photo, fileSize: file.size };
      return validatePhotos([restored]) ? null : restored;
    },
    async prune(keepUris) {
      if (!folder.exists) return;
      const keep = new Set(keepUris);
      for (const entry of folder.list()) {
        // Delete only our own JPEG copies, never camera originals or another account's files.
        if (entry instanceof File && owns(entry.uri) && !keep.has(entry.uri)) entry.delete();
      }
    },
  };
}
