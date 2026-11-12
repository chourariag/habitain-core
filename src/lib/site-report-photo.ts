import exifr from "exifr";

export type PhotoMeta = { takenAt: string | null; lat: number | null; lng: number | null; source: "exif" | "device" | "none" };

/** Read EXIF date + GPS from the ORIGINAL file (before compression). Falls back to one device GPS read. */
export async function readPhotoMeta(file: File): Promise<PhotoMeta> {
  let takenAt: string | null = null; let lat: number | null = null; let lng: number | null = null;
  try {
    const ex: any = await exifr.parse(file, { pick: ["DateTimeOriginal", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"], gps: true } as any);
    if (ex?.DateTimeOriginal instanceof Date && !isNaN(ex.DateTimeOriginal.getTime())) takenAt = ex.DateTimeOriginal.toISOString();
    if (typeof ex?.latitude === "number" && typeof ex?.longitude === "number") { lat = ex.latitude; lng = ex.longitude; }
  } catch { /* no EXIF */ }
  if (lat != null && lng != null) return { takenAt, lat, lng, source: "exif" };
  const dev = await deviceLocation();
  if (dev) return { takenAt, lat: dev.lat, lng: dev.lng, source: "device" };
  return { takenAt, lat: null, lng: null, source: "none" };
}

function deviceLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/** Compress to roughly 400 KB: long side max 1600 px, JPEG ~0.7, stepping quality down if still large. */
export async function compressPhoto(file: File, maxSide = 1600, targetBytes = 400 * 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  if (bmp) { w = bmp.width; h = bmp.height; draw = (c, W, H) => c.drawImage(bmp, 0, 0, W, H); }
  else {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    w = img.naturalWidth; h = img.naturalHeight; draw = (c, W, H) => c.drawImage(img, 0, 0, W, H);
  }
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!; draw(ctx, canvas.width, canvas.height);
  let q = 0.7; let blob: Blob | null = null;
  for (let i = 0; i < 4; i++) {
    blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", q));
    if (!blob || blob.size <= targetBytes) break;
    q -= 0.1;
  }
  if (!blob) throw new Error("Could not compress photo");
  return blob;
}
