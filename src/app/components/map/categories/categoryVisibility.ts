"use client";

import {
  finalizedLayerRef,
  labelsLayerRef,
  MapViewRef,
  spriteLayerRef,
} from "../arcgisRefs";
import {
  getCategoryParentId,
  ROOT_CATEGORY_ID,
  resolveCategoryId,
} from "./categoryStore";

const categoryOwnVisibility = new Map<string, boolean>();
const itemOwnVisibility = new Map<string, boolean>();

export const categoryVisibilityEvents = new EventTarget();

function emitVisibilityChange() {
  categoryVisibilityEvents.dispatchEvent(new Event("change"));
}

function graphicsArray(layer: any): any[] {
  const graphics = layer?.graphics;
  if (!graphics) return [];
  if (typeof graphics.toArray === "function") return graphics.toArray();
  if (Array.isArray(graphics.items)) return graphics.items;
  return [];
}

function ownVisibility(store: Map<string, boolean>, id: string): boolean {
  return store.get(id) ?? true;
}

function drawingId(graphic: any): string | null {
  const id = graphic?.attributes?.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function sourceDrawingId(graphic: any): string | null {
  const explicit = graphic?.attributes?.sourceDrawingId;
  if (typeof explicit === "string" && explicit.trim()) return explicit.trim();
  return drawingId(graphic);
}

function parentId(label: any): string | null {
  const id = label?.attributes?.parentId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

function finalizedGraphicsById(): Map<string, any> {
  const byId = new Map<string, any>();

  graphicsArray(finalizedLayerRef.current).forEach((graphic) => {
    const id = drawingId(graphic);
    if (id) byId.set(id, graphic);
  });

  return byId;
}

function zoomAllowsLabel(label: any, zoom: number): boolean {
  const showAtZoom = label?.attributes?.showAtZoom;
  const hideAtZoom = label?.attributes?.hideAtZoom;

  const min =
    typeof showAtZoom === "number" && Number.isFinite(showAtZoom)
      ? showAtZoom
      : -Infinity;
  const max =
    typeof hideAtZoom === "number" && Number.isFinite(hideAtZoom)
      ? hideAtZoom
      : Infinity;

  return zoom >= min && zoom <= max;
}

export function resetMapVisibility(): void {
  categoryOwnVisibility.clear();
  itemOwnVisibility.clear();
  applyMapVisibility();
  emitVisibilityChange();
}

export function getCategoryOwnVisibility(categoryId: string): boolean {
  if (categoryId === ROOT_CATEGORY_ID) return true;
  return ownVisibility(categoryOwnVisibility, categoryId);
}

export function getItemOwnVisibility(itemId: string): boolean {
  return ownVisibility(itemOwnVisibility, itemId);
}

export function isCategoryEffectivelyVisible(categoryId: string): boolean {
  let current = resolveCategoryId(categoryId);
  const seen = new Set<string>();

  while (current !== ROOT_CATEGORY_ID) {
    if (seen.has(current)) return true;
    seen.add(current);

    if (!getCategoryOwnVisibility(current)) return false;
    current = getCategoryParentId(current);
  }

  return true;
}

export function isGraphicEffectivelyVisible(graphic: any): boolean {
  const id = drawingId(graphic);
  const categoryId = resolveCategoryId(graphic?.attributes?.categoryId);
  const itemVisible = id ? getItemOwnVisibility(id) : true;

  return itemVisible && isCategoryEffectivelyVisible(categoryId);
}

export function isItemEffectivelyVisibleById(itemId: string): boolean {
  const graphic = finalizedGraphicsById().get(itemId);
  if (graphic) return isGraphicEffectivelyVisible(graphic);
  return getItemOwnVisibility(itemId);
}

export function toggleCategoryVisibility(categoryId: string): void {
  if (categoryId === ROOT_CATEGORY_ID) return;

  categoryOwnVisibility.set(
    categoryId,
    !getCategoryOwnVisibility(categoryId),
  );
  applyMapVisibility();
  emitVisibilityChange();
}

export function toggleItemVisibility(itemId: string): void {
  itemOwnVisibility.set(itemId, !getItemOwnVisibility(itemId));
  applyMapVisibility();
  emitVisibilityChange();
}

export function setItemVisibility(itemId: string, visible: boolean): void {
  itemOwnVisibility.set(itemId, visible);
  applyMapVisibility();
  emitVisibilityChange();
}

export function applyMapVisibility(zoom = MapViewRef.current?.zoom ?? 0): void {
  const finalizedGraphics = graphicsArray(finalizedLayerRef.current);
  const byId = new Map<string, any>();

  finalizedGraphics.forEach((graphic) => {
    const id = drawingId(graphic);
    if (id) byId.set(id, graphic);
    graphic.visible = isGraphicEffectivelyVisible(graphic);
  });

  graphicsArray(labelsLayerRef.current).forEach((label) => {
    const id = parentId(label);
    const parent = id ? byId.get(id) : null;
    const parentVisible = parent
      ? isGraphicEffectivelyVisible(parent)
      : id
        ? getItemOwnVisibility(id)
        : true;

    label.visible = parentVisible && zoomAllowsLabel(label, zoom);
  });

  graphicsArray(spriteLayerRef.current).forEach((graphic) => {
    const id = sourceDrawingId(graphic);
    if (!id) return;
    const baseVisible = graphic.attributes?.runtimeBaseVisible;
    graphic.visible =
      isItemEffectivelyVisibleById(id) &&
      (typeof baseVisible === "boolean" ? baseVisible : true);
  });
}

export function subscribeVisibility(listener: () => void): () => void {
  categoryVisibilityEvents.addEventListener("change", listener);
  return () => categoryVisibilityEvents.removeEventListener("change", listener);
}
