export type MapShareTarget = { location?: string; event?: string; source?: string };

export function publicMapUrl(mapId: string, target: MapShareTarget, origin: string): string {
  const url = new URL(`/share/${encodeURIComponent(mapId)}`, origin);
  for (const key of ["location", "event", "source"] as const) {
    if (target[key]) url.searchParams.set(key, target[key]!);
  }
  return url.toString();
}

export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Embedded maps may not have permission to use the Clipboard API.
  }
  const previousFocus = document.activeElement;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  try {
    field.select();
    if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
  } finally {
    field.remove();
    if (previousFocus instanceof HTMLElement) previousFocus.focus({ preventScroll: true });
  }
}

export function graphicShareTarget(attributes: Record<string, any>): MapShareTarget | null {
  if (attributes.event_name && attributes.id != null) {
    return { event: String(attributes.id), source: attributes.sourceId };
  }
  const location = attributes.name?.trim() || attributes.id;
  return location ? { location } : null;
}
