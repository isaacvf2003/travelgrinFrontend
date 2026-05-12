const MAX_ORIGINAL_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_SIZE_MB = 0.65;
const DEFAULT_MAX_WIDTH_OR_HEIGHT = 1600;

type CloudinarySignatureResponse = {
  ok?: boolean;
  error?: string;
  cloudName?: string;
  apiKey?: string;
  folder?: string;
  timestamp?: string;
  signature?: string;
  uploadUrl?: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
  error?: { message?: string };
};

type UploadOptions = {
  folder?: string;
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
};

export type ImageAsset = {
  url: string;
  secureUrl: string;
  secure_url?: string;
  publicId: string;
  public_id?: string;
  rawUrl?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  originalBytes?: number | null;
  source?: "cloudinary" | "data-url" | "remote-url";
};

type RemoteUploadResponse = {
  ok?: boolean;
  url?: string;
  rawUrl?: string;
  publicId?: string;
  width?: number | null;
  height?: number | null;
  bytes?: number | null;
  format?: string | null;
  error?: string;
};

function getApiBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  return raw ? raw.replace(/\/$/, "") : "";
}

function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Error al leer imagen"));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen"));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo comprimir la imagen"));
    }, type, quality);
  });
}

function toUploadFile(blob: Blob, originalFile: File) {
  const baseName = originalFile.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${baseName}.webp`, { type: blob.type || "image/webp" });
}

export function isCloudinaryImageUrl(value: string) {
  return /^https:\/\/res\.cloudinary\.com\//i.test(value);
}

export function applyCloudinaryAutoTransform(url: string, width?: number) {
  if (!isCloudinaryImageUrl(url) || url.includes("/upload/f_webp")) return url;
  const transform = width ? `f_webp,q_auto,w_${width}` : "f_webp,q_auto";
  return url.replace("/upload/", `/upload/${transform}/`);
}

export async function compressImageForUpload(file: File, options: UploadOptions = {}) {
  if (!file.type.startsWith("image/")) throw new Error("Subí una imagen válida.");
  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) throw new Error("La imagen original debe pesar 10 MB o menos.");

  const maxSizeBytes = Math.max(64 * 1024, (options.maxSizeMB ?? DEFAULT_MAX_SIZE_MB) * 1024 * 1024);
  const maxWidthOrHeight = options.maxWidthOrHeight ?? DEFAULT_MAX_WIDTH_OR_HEIGHT;

  if (file.size <= maxSizeBytes && file.type === "image/webp") return file;

  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const largestSide = Math.max(naturalWidth, naturalHeight, 1);
  const ratio = Math.min(1, maxWidthOrHeight / largestSide);

  let width = Math.max(1, Math.round(naturalWidth * ratio));
  let height = Math.max(1, Math.round(naturalHeight * ratio));
  let quality = 0.82;
  let bestBlob: Blob | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(img, 0, 0, width, height);
    const blob = await canvasToBlob(canvas, "image/webp", quality);
    bestBlob = blob;
    if (blob.size <= maxSizeBytes) return toUploadFile(blob, file);
    quality = Math.max(0.48, quality - 0.08);
    width = Math.max(1, Math.round(width * 0.88));
    height = Math.max(1, Math.round(height * 0.88));
  }

  if (!bestBlob) return file;
  return toUploadFile(bestBlob, file);
}

export async function uploadImageToCloudinary(file: File, options: UploadOptions = {}) {
  const compressedFile = await compressImageForUpload(file, options);
  const signatureRes = await fetch(`${getApiBaseUrl()}/api/uploads/cloudinary-signature`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      contentType: compressedFile.type || file.type,
      size: file.size,
      compressedSize: compressedFile.size,
      folder: options.folder ?? "uploads",
    }),
  });
  const signatureData = (await signatureRes.json().catch(() => ({}))) as CloudinarySignatureResponse;
  if (!signatureRes.ok || !signatureData.ok) {
    throw new Error(signatureData.error || "No se pudo firmar la subida de imagen.");
  }

  const form = new FormData();
  form.append("file", compressedFile);
  form.append("api_key", String(signatureData.apiKey));
  form.append("timestamp", String(signatureData.timestamp));
  form.append("signature", String(signatureData.signature));
  form.append("folder", String(signatureData.folder));

  const uploadRes = await fetch(String(signatureData.uploadUrl), { method: "POST", body: form });
  const uploadData = (await uploadRes.json().catch(() => ({}))) as CloudinaryUploadResponse;
  if (!uploadRes.ok || uploadData.error) {
    throw new Error(uploadData.error?.message || "No se pudo subir la imagen a Cloudinary.");
  }
  if (!uploadData.secure_url) throw new Error("Cloudinary no devolvió una URL segura.");

  return {
    url: applyCloudinaryAutoTransform(uploadData.secure_url),
    secureUrl: uploadData.secure_url,
    secure_url: uploadData.secure_url,
    rawUrl: uploadData.secure_url,
    publicId: uploadData.public_id ?? "",
    public_id: uploadData.public_id ?? "",
    width: uploadData.width ?? null,
    height: uploadData.height ?? null,
    bytes: uploadData.bytes ?? compressedFile.size,
    format: uploadData.format ?? compressedFile.type,
    originalBytes: file.size,
    source: "cloudinary" as const,
  };
}

export async function uploadImageAsset(file: File, options: UploadOptions = {}): Promise<ImageAsset> {
  try {
    return await uploadImageToCloudinary(file, options);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Cloudinary upload failed; falling back to local data URL", error);
    }
    const compressedFile = await compressImageForUpload(file, options);
    const dataUrl = await readFileAsDataUrl(compressedFile);
    return {
      url: dataUrl,
      secureUrl: dataUrl,
      secure_url: dataUrl,
      publicId: "",
      public_id: "",
      bytes: compressedFile.size,
      format: compressedFile.type,
      originalBytes: file.size,
      source: "data-url",
    };
  }
}

export async function uploadImageOrDataUrl(file: File, options: UploadOptions = {}) {
  return (await uploadImageAsset(file, options)).url;
}

export async function uploadRemoteImageAssetToCloudinary(imageUrl: string, options: UploadOptions = {}): Promise<ImageAsset> {
  const normalizedUrl = imageUrl.trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    return { url: normalizedUrl, secureUrl: normalizedUrl, secure_url: normalizedUrl, publicId: "", public_id: "", source: "remote-url" };
  }
  if (isCloudinaryImageUrl(normalizedUrl)) {
    return {
      url: applyCloudinaryAutoTransform(normalizedUrl),
      secureUrl: normalizedUrl,
      secure_url: normalizedUrl,
      rawUrl: normalizedUrl,
      publicId: "",
      public_id: "",
      source: "cloudinary",
    };
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/uploads/cloudinary-remote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ imageUrl: normalizedUrl, folder: options.folder ?? "remote" }),
    });
    const data = (await response.json().catch(() => ({}))) as RemoteUploadResponse;
    if (!response.ok || !data.ok || !data.url) {
      throw new Error(data.error || "No se pudo optimizar la imagen remota.");
    }
    return {
      url: data.url,
      secureUrl: data.rawUrl || data.url,
      secure_url: data.rawUrl || data.url,
      rawUrl: data.rawUrl || data.url,
      publicId: data.publicId || "",
      public_id: data.publicId || "",
      width: data.width ?? null,
      height: data.height ?? null,
      bytes: data.bytes ?? null,
      format: data.format ?? null,
      source: "cloudinary",
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Cloudinary remote upload failed; keeping original URL", error);
    }
    return { url: normalizedUrl, secureUrl: normalizedUrl, secure_url: normalizedUrl, publicId: "", public_id: "", source: "remote-url" };
  }
}

export async function uploadRemoteImageUrlToCloudinary(imageUrl: string, options: UploadOptions = {}) {
  return (await uploadRemoteImageAssetToCloudinary(imageUrl, options)).url;
}

export async function optimizeImageAssetList(values: string[], options: UploadOptions = {}) {
  return Promise.all(values.map((value) => uploadRemoteImageAssetToCloudinary(value, options)));
}

export async function optimizeImageUrlList(values: string[], options: UploadOptions = {}) {
  const assets = await optimizeImageAssetList(values, options);
  return assets.map((asset) => asset.url);
}
