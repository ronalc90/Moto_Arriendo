/**
 * Browser-side image compression: max 1600 px on the longest side, JPG.
 * Keeps uploads small for drivers on mobile data.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.8): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  return blob ?? file;
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // imageOrientation keeps phone photos upright.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // fall through to <img>
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function randomName(ext: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${id}.${ext}`;
}

/**
 * Quick quality check of a photo of a document, done on the phone before
 * uploading. Returns what is wrong in plain Spanish (empty list = looks fine).
 * Thresholds were calibrated with sharp vs. blurred photos: sharp pictures
 * score 95-1.200 on the blur metric, blurred ones 2-27.
 */
export async function assessDocumentPhoto(file: File): Promise<string[]> {
  if (!file.type.startsWith("image/")) return [];
  const problems: string[] = [];
  const bitmap = await loadBitmap(file);
  const shortSide = Math.min(bitmap.width, bitmap.height);
  if (shortSide < 600) problems.push("La foto es muy pequeña: acércate al documento o usa la cámara del celular.");

  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(3, Math.round(bitmap.width * scale));
  const h = Math.max(3, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return problems;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Grayscale, brightness and blown-out (glare) pixels
  const gray = new Float32Array(w * h);
  let sum = 0;
  let glare = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[p] = v;
    sum += v;
    if (v > 250) glare++;
  }
  const mean = sum / gray.length;
  if (mean < 50) problems.push("La foto está muy oscura: tómala con más luz.");
  else if (mean > 235) problems.push("La foto está muy clara o quemada: evita el flash o la luz directa.");
  if (glare / gray.length > 0.2) problems.push("Hay mucho reflejo de luz sobre el documento: inclínalo un poco.");

  // Sharpness: variance of the Laplacian (low = blurry)
  let n = 0;
  let s = 0;
  let s2 = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = gray[i - w] + gray[i + w] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      s += lap;
      s2 += lap * lap;
      n++;
    }
  }
  const variance = n ? s2 / n - (s / n) ** 2 : 0;
  if (mean >= 50 && variance < 30) problems.push("La foto se ve borrosa: apoya el celular, enfoca y no te muevas.");
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  return problems;
}
