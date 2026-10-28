import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { validatePhotos, type CompressedPhoto } from "./photos-policy";
export async function compressPhoto(asset: ImagePickerAsset): Promise<CompressedPhoto> {
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 });
  try {
    const image = await context.renderAsync();
    try {
      const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.72 });
      const fileSize = Platform.OS === "web" ? (await (await fetch(result.uri)).blob()).size : new File(result.uri).size;
      const photo: CompressedPhoto = { ...result, fileName: `sangtay-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`, mimeType: "image/jpeg", fileSize };
      const error = validatePhotos([photo]);
      if (error) throw Error(error);
      return photo;
    } finally { image.release(); }
  } finally { context.release(); }
}
export async function appendPhotos(form: FormData, photos: CompressedPhoto[], field: "imageFiles" | "imageFile" | "studentCard" = "imageFiles") {
  for (const photo of photos) {
    if (Platform.OS === "web") form.append(field, await (await fetch(photo.uri)).blob(), photo.fileName);
    else form.append(field, { uri: photo.uri, name: photo.fileName, type: photo.mimeType } as unknown as Blob);
  }
}
