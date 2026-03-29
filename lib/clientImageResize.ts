/** Client-only: smanji širinu velikih raster slika prije uploada (GIF se ne dira). */

export const DEFAULT_MAX_IMAGE_WIDTH = 1920;

export async function resizeImageFileIfNeeded(file: File, maxWidth = DEFAULT_MAX_IMAGE_WIDTH): Promise<File> {
  if (typeof window === "undefined") return file;
  if (file.type === "image/gif") return file;
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width <= maxWidth) {
      bitmap.close();
      return file;
    }
    const scale = maxWidth / bitmap.width;
    const w = Math.round(maxWidth);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    bitmap = null;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.88)
    );
    if (!blob) return file;
    const base = (file.name || "image").replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${base}-resized.jpg`, { type: "image/jpeg" });
  } catch {
    if (bitmap) try {
      bitmap.close();
    } catch {
      /* ignore */
    }
    return file;
  }
}
