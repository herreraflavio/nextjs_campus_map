"use client";

export type DrawableGeometryType = "polygon" | "polyline" | "point";

export type PendingDrawingCreation = {
  name: string;
  categoryId: string | null;
  iconUrl: string | null;
  geometryType: DrawableGeometryType;
};

let pendingCreation: PendingDrawingCreation | null = null;

const drawingCreationEvents = new EventTarget();

function normalizeGeometryType(value: unknown): DrawableGeometryType {
  if (value === "polyline" || value === "point") return value;
  return "polygon";
}

export function requestDrawingCreation(
  creation: PendingDrawingCreation,
): void {
  pendingCreation = {
    name: creation.name.trim() || "New Item",
    categoryId: creation.categoryId,
    iconUrl: creation.iconUrl?.trim() || null,
    geometryType: normalizeGeometryType(creation.geometryType),
  };

  drawingCreationEvents.dispatchEvent(
    new CustomEvent<PendingDrawingCreation>("request", {
      detail: pendingCreation,
    }),
  );
}

export function peekPendingDrawingCreation(): PendingDrawingCreation | null {
  return pendingCreation ? { ...pendingCreation } : null;
}

export function clearPendingDrawingCreation(): void {
  pendingCreation = null;
}

export function subscribeDrawingCreation(
  listener: (creation: PendingDrawingCreation) => void,
): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<PendingDrawingCreation>).detail);
  };

  drawingCreationEvents.addEventListener("request", handler);
  return () => drawingCreationEvents.removeEventListener("request", handler);
}
