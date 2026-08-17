"use client";

import type { MapCategory } from "@/app/types/myTypes";

export const ROOT_CATEGORY_ID = "home";

export const ROOT_CATEGORY: MapCategory = {
  id: ROOT_CATEGORY_ID,
  name: "Home",
  parentId: null,
  iconUrl: null,
  order: 0,
};

const categoriesRef = {
  current: [] as MapCategory[],
};

export const categoryEvents = new EventTarget();

function emitCategoryChange() {
  categoryEvents.dispatchEvent(new Event("change"));
}

export function createCategoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `category_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeParentId(parentId: unknown): string | null {
  if (parentId == null) return null;
  if (typeof parentId !== "string") return null;

  const trimmed = parentId.trim();
  if (!trimmed || trimmed === ROOT_CATEGORY_ID) return null;
  return trimmed;
}

export function normalizePersistedParentId(categoryId: string): string | null {
  return categoryId === ROOT_CATEGORY_ID ? null : categoryId;
}

function breakInvalidParentsAndCycles(categories: MapCategory[]): MapCategory[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories.map((category) => {
    let parentId = category.parentId;

    if (!parentId || parentId === category.id || !byId.has(parentId)) {
      return { ...category, parentId: null };
    }

    const seen = new Set<string>([category.id]);
    while (parentId) {
      if (seen.has(parentId)) {
        return { ...category, parentId: null };
      }

      seen.add(parentId);
      const parent = byId.get(parentId);
      if (!parent) {
        return { ...category, parentId: null };
      }

      parentId = parent.parentId;
    }

    return category;
  });
}

export function normalizeCategories(value: unknown): MapCategory[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const cleaned: MapCategory[] = [];

  value.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") return;

    const candidate = raw as Partial<MapCategory>;
    const id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    const name =
      typeof candidate.name === "string" ? candidate.name.trim() : "";

    if (!id || id === ROOT_CATEGORY_ID || !name || seen.has(id)) return;

    seen.add(id);
    cleaned.push({
      id,
      name,
      parentId: normalizeParentId(candidate.parentId),
      iconUrl:
        typeof candidate.iconUrl === "string" && candidate.iconUrl.trim()
          ? candidate.iconUrl.trim()
          : null,
      order:
        typeof candidate.order === "number" &&
        Number.isFinite(candidate.order)
          ? candidate.order
          : index,
    });
  });

  return breakInvalidParentsAndCycles(cleaned);
}

export function setCategories(categories: unknown): void {
  categoriesRef.current = normalizeCategories(categories);
  emitCategoryChange();
}

export function resetCategories(): void {
  setCategories([]);
}

export function getCategories(): MapCategory[] {
  return categoriesRef.current.map((category) => ({ ...category }));
}

export function getStoredCategory(categoryId: string | null | undefined) {
  if (!categoryId || categoryId === ROOT_CATEGORY_ID) return null;
  return categoriesRef.current.find((category) => category.id === categoryId);
}

export function hasCategory(categoryId: string | null | undefined): boolean {
  if (!categoryId || categoryId === ROOT_CATEGORY_ID) return true;
  return categoriesRef.current.some((category) => category.id === categoryId);
}

export function resolveCategoryId(categoryId: unknown): string {
  if (typeof categoryId !== "string") return ROOT_CATEGORY_ID;

  const trimmed = categoryId.trim();
  if (!trimmed || trimmed === ROOT_CATEGORY_ID) return ROOT_CATEGORY_ID;

  return hasCategory(trimmed) ? trimmed : ROOT_CATEGORY_ID;
}

export function getCategoryName(categoryId: string): string {
  if (categoryId === ROOT_CATEGORY_ID) return ROOT_CATEGORY.name;
  return getStoredCategory(categoryId)?.name ?? ROOT_CATEGORY.name;
}

export function getCategoryParentId(categoryId: string): string {
  if (categoryId === ROOT_CATEGORY_ID) return ROOT_CATEGORY_ID;
  const category = getStoredCategory(categoryId);
  return category?.parentId ?? ROOT_CATEGORY_ID;
}

export function getCategoryDepth(categoryId: string): number {
  let depth = 0;
  let current = resolveCategoryId(categoryId);
  const seen = new Set<string>();

  while (current !== ROOT_CATEGORY_ID && !seen.has(current)) {
    seen.add(current);
    depth += 1;
    current = getCategoryParentId(current);
  }

  return depth;
}

export function getCategoryPath(categoryId: string): MapCategory[] {
  const path: MapCategory[] = [ROOT_CATEGORY];
  let current = resolveCategoryId(categoryId);
  const seen = new Set<string>();

  while (current !== ROOT_CATEGORY_ID && !seen.has(current)) {
    seen.add(current);
    const category = getStoredCategory(current);
    if (!category) break;
    path.push({ ...category });
    current = category.parentId ?? ROOT_CATEGORY_ID;
  }

  return path;
}

export function nextCategoryOrder(parentId: string | null): number {
  const normalizedParentId = parentId ?? null;
  const siblingOrders = categoriesRef.current
    .filter((category) => (category.parentId ?? null) === normalizedParentId)
    .map((category) => category.order)
    .filter((order) => Number.isFinite(order));

  if (siblingOrders.length === 0) return 0;
  return Math.max(...siblingOrders) + 1;
}

export function addCategory(category: MapCategory): void {
  setCategories([...categoriesRef.current, category]);
}

export function updateCategory(
  categoryId: string,
  patch: Partial<Omit<MapCategory, "id">>,
): void {
  setCategories(
    categoriesRef.current.map((category) =>
      category.id === categoryId ? { ...category, ...patch } : category,
    ),
  );
}

export function subscribeCategories(listener: () => void): () => void {
  categoryEvents.addEventListener("change", listener);
  return () => categoryEvents.removeEventListener("change", listener);
}
