"use client";

import {
  finalizedLayerRef,
  labelsLayerRef,
  MapViewRef,
  spriteLayerRef,
  eventsLayerRef,
} from "../arcgisRefs";
import { eventKey } from "@/app/types/apiSources";
import {
  getCategoryParentId,
  getCategories,
  ROOT_CATEGORY_ID,
  resolveCategoryId,
} from "./categoryStore";
import { isCategoryAlwaysVisibleInList, isDrawingAlwaysVisibleInList } from "@/app/types/mapVisibility";

const categoryOwnVisibility = new Map<string, boolean>();
const itemOwnVisibility = new Map<string, boolean>();
const eventOwnVisibility = new Map<string, boolean>();
const eventSourceVisibility = new Map<string, boolean>();
let homeBulkVisibility: boolean | null = null;
let locationFocus: { itemId: string; categoryIds: Set<string>; eventKey?: string } | null = null;

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
  eventOwnVisibility.clear();
  eventSourceVisibility.clear();
  homeBulkVisibility = null;
  locationFocus = null;
  applyMapVisibility();
  emitVisibilityChange();
}

export function getCategoryOwnVisibility(categoryId: string): boolean {
  if (categoryId === ROOT_CATEGORY_ID) return true;
  if (isCategoryVisibilityLocked(categoryId)) return true;
  return categoryOwnVisibility.get(categoryId) ??
    homeBulkVisibility ??
    (locationFocus ? locationFocus.categoryIds.has(categoryId) : true);
}

export function getItemOwnVisibility(itemId: string, graphic?: any): boolean {
  if (graphic ? isGraphicVisibilityLocked(graphic) : isItemVisibilityLocked(itemId)) return true;
  return itemVisibility(itemId);
}

function itemVisibility(itemId: string): boolean {
  return itemOwnVisibility.get(itemId) ??
    homeBulkVisibility ??
    (locationFocus ? locationFocus.itemId === itemId : true);
}

export function isCategoryVisibilityLocked(categoryId: string): boolean {
  return isCategoryAlwaysVisibleInList(getCategories(), categoryId);
}

export function isGraphicVisibilityLocked(graphic: any): boolean {
  return isDrawingAlwaysVisibleInList(getCategories(), graphic?.attributes);
}

export function isItemVisibilityLocked(itemId: string): boolean {
  const graphic = finalizedGraphicsById().get(itemId);
  return !!graphic && isGraphicVisibilityLocked(graphic);
}

export function setMapLocationFocus(itemId: string | null, categoryId?: string | null, selectedEventKey?: string): void {
  const categoryIds = new Set<string>();
  let current = resolveCategoryId(categoryId);
  while (current !== ROOT_CATEGORY_ID && !categoryIds.has(current)) {
    categoryIds.add(current);
    current = getCategoryParentId(current);
  }
  categoryOwnVisibility.clear();
  itemOwnVisibility.clear();
  eventOwnVisibility.clear();
  eventSourceVisibility.clear();
  homeBulkVisibility = null;
  locationFocus = itemId ? { itemId, categoryIds, eventKey: selectedEventKey } : null;
  applyMapVisibility();
  emitVisibilityChange();
}

export function isCategoryEffectivelyVisible(categoryId: string): boolean {
  if (isCategoryVisibilityLocked(categoryId)) return true;
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
  if (isGraphicVisibilityLocked(graphic)) return true;
  const id = drawingId(graphic);
  const categoryId = resolveCategoryId(graphic?.attributes?.categoryId);
  const itemVisible = id ? itemVisibility(id) : !locationFocus;

  return itemVisible && isCategoryEffectivelyVisible(categoryId);
}

export function isItemEffectivelyVisibleById(itemId: string): boolean {
  const graphic = finalizedGraphicsById().get(itemId);
  if (graphic) return isGraphicEffectivelyVisible(graphic);
  return itemVisibility(itemId);
}

export function toggleCategoryVisibility(categoryId: string): void {
  if (categoryId === ROOT_CATEGORY_ID || isCategoryVisibilityLocked(categoryId)) return;

  categoryOwnVisibility.set(
    categoryId,
    !getCategoryOwnVisibility(categoryId),
  );
  applyMapVisibility();
  emitVisibilityChange();
}

export function toggleItemVisibility(itemId: string): void {
  if (isItemVisibilityLocked(itemId)) return;
  itemOwnVisibility.set(itemId, !itemVisibility(itemId));
  applyMapVisibility();
  emitVisibilityChange();
}

export function setItemVisibility(itemId: string, visible: boolean): void {
  if (isItemVisibilityLocked(itemId)) return;
  itemOwnVisibility.set(itemId, visible);
  applyMapVisibility();
  emitVisibilityChange();
}

export function revealDrawing(graphic: any): void {
  const id = drawingId(graphic);
  if (id) itemOwnVisibility.set(id, true);
  let categoryId = resolveCategoryId(graphic?.attributes?.categoryId);
  const seen = new Set<string>();
  while (categoryId !== ROOT_CATEGORY_ID && !seen.has(categoryId)) {
    seen.add(categoryId);
    categoryOwnVisibility.set(categoryId, true);
    categoryId = getCategoryParentId(categoryId);
  }
  applyMapVisibility();
  emitVisibilityChange();
}

export function setHomeVisibility(visible: boolean): void {
  homeBulkVisibility = visible;
  categoryOwnVisibility.clear();
  itemOwnVisibility.clear();
  applyMapVisibility();
  emitVisibilityChange();
}

export function getEventOwnVisibility(graphic: any): boolean {
  const attributes = graphic?.attributes ?? {};
  return eventOwnVisibility.get(eventKey(attributes)) ??
    eventSourceVisibility.get(attributes.sourceUrl || "") ??
    (locationFocus ? locationFocus.eventKey === eventKey(attributes) : true);
}

export function setEventVisibility(graphic: any, visible: boolean): void {
  eventOwnVisibility.set(eventKey(graphic.attributes ?? {}), visible);
  applyMapVisibility();
  emitVisibilityChange();
}

export function setEventSourcesVisibility(urls: string[], visible: boolean): void {
  urls.forEach(url => eventSourceVisibility.set(url, visible));
  graphicsArray(eventsLayerRef.current).forEach(graphic => {
    if (urls.includes(graphic.attributes?.sourceUrl || "")) eventOwnVisibility.delete(eventKey(graphic.attributes));
  });
  applyMapVisibility();
  emitVisibilityChange();
}

export function applyEventVisibility(): void {
  graphicsArray(eventsLayerRef.current).forEach(graphic => {
    const selected = locationFocus?.eventKey === eventKey(graphic.attributes ?? {});
    graphic.visible = getEventOwnVisibility(graphic) &&
      (selected || graphic.attributes?.runtimeCalendarVisible !== false);
  });
}

export function applyMapVisibility(zoom = MapViewRef.current?.zoom ?? 0): void {
  applyEventVisibility();
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
