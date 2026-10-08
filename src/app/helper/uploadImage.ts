// Shared by category images and the map top bar. Keep the API's asset URL;
// never persist a local object URL or base64 preview.
export function getUploadUrlFromResponse(payload: any): string | null {
  const candidates = [
    payload?.url, payload?.imageUrl, payload?.location, payload?.fileUrl,
    payload?.data?.url, payload?.data?.imageUrl, payload?.data?.location,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export async function uploadImage(file: File, signal?: AbortSignal): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.");
  }
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/upload", {
    method: "POST",
    credentials: "same-origin",
    body: formData,
    signal,
  });
  if (!response.ok) throw new Error(`Upload failed (${response.status})`);
  const url = getUploadUrlFromResponse(await response.json());
  if (!url) {
    throw new Error("Upload succeeded but no image URL was returned by /api/upload.");
  }
  return url;
}
