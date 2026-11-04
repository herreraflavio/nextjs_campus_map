export type ApiSourceTab = { url: string; tabName: string };

export function normalizeApiSourceTabs(urls: unknown, value: unknown): ApiSourceTab[] {
  const names = new Map<string, string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item?.url !== "string" || typeof item?.tabName !== "string") continue;
      const name = item.tabName.trim().slice(0, 80);
      names.set(item.url.trim(), name && name.toLowerCase() !== "home" ? name : "Events");
    }
  }
  if (!Array.isArray(urls)) return [];
  return [...new Set(urls.filter((url): url is string => typeof url === "string").map(url => url.trim()).filter(Boolean))]
    .map(url => ({ url, tabName: names.get(url) || "Events" }));
}

// Stable across source reordering, tab renaming and browser sessions.
export function apiSourceId(url: string): string {
  let hash = 2166136261;
  for (const char of url.trim()) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `api-${(hash >>> 0).toString(36)}`;
}

export function eventKey(attributes: { id?: unknown; sourceUrl?: string }): string {
  return JSON.stringify([attributes.sourceUrl || "", String(attributes.id ?? "")]);
}
