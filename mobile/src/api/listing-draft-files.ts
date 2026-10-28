import type { DraftMedia } from "../state/listing-draft";

// Web preview fallback: blob URLs expire on reload, so store the compressed JPEG itself.
export function draftMedia(_scope: string): DraftMedia {
  return {
    async retain(photo) {
      const blob = await (await fetch(photo.uri)).blob();
      const uri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(Error("Không đọc được ảnh"));
        reader.readAsDataURL(blob);
      });
      return { ...photo, uri };
    },
    async inspect(photo) { return photo.uri.startsWith("data:image/jpeg;base64,") ? photo : null; },
    async prune() {},
  };
}
