"use client";

export type DrawableGeometryType = "polygon" | "polyline" | "point";

export type PendingDrawingCreation = {
  name: string;
  categoryId: string | null;
  iconUrl: string | null;
  pointIconUrl?: string | null;
  pointSize?: number | null;
  pointIconWidth?: number | null;
  pointIconHeight?: number | null;
  pointIconRotation?: number | null;
  pointIconOffsetX?: number | null;
  pointIconOffsetY?: number | null;
  pointIconUseMapUnits?: boolean | null;
  geometryType: DrawableGeometryType;
};

let pendingCreation: PendingDrawingCreation | null = null;

const drawingCreationEvents = new EventTarget();

function normalizeGeometryType(value: unknown): DrawableGeometryType {
  if (value === "polyline" || value === "point") return value;
  return "polygon";
}

function normalizeOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function requestDrawingCreation(
  creation: PendingDrawingCreation,
): void {
  pendingCreation = {
    name: creation.name.trim() || "New Item",
    categoryId: creation.categoryId,
    iconUrl: creation.iconUrl?.trim() || null,
    pointIconUrl: creation.pointIconUrl?.trim() || null,
    pointSize:
      typeof creation.pointSize === "number" &&
      Number.isFinite(creation.pointSize)
        ? Math.max(1, creation.pointSize)
        : null,
    pointIconWidth: normalizeOptionalNumber(creation.pointIconWidth),
    pointIconHeight: normalizeOptionalNumber(creation.pointIconHeight),
    pointIconRotation: normalizeOptionalNumber(creation.pointIconRotation),
    pointIconOffsetX: normalizeOptionalNumber(creation.pointIconOffsetX),
    pointIconOffsetY: normalizeOptionalNumber(creation.pointIconOffsetY),
    pointIconUseMapUnits: false,
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
