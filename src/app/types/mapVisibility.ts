import type { MapCategory, MapDrawingAttributes } from "./myTypes";

function categoryPath(categories: MapCategory[], categoryId?: string | null): MapCategory[] {
  const byId = new Map(categories.map(category => [category.id, category]));
  const path: MapCategory[] = [];
  const seen = new Set<string>();
  let current = categoryId;
  while (current && current !== "home" && !seen.has(current)) {
    seen.add(current);
    const category = byId.get(current);
    if (!category) break;
    path.push(category);
    current = category.parentId;
  }
  return path;
}

export function isCategoryAlwaysVisibleInList(
  categories: MapCategory[], categoryId?: string | null,
): boolean {
  return categoryPath(categories, categoryId).some(category => category.alwaysVisible === true);
}

export function isCategoryAdminVisibleInList(
  categories: MapCategory[], categoryId?: string | null,
): boolean {
  const path = categoryPath(categories, categoryId);
  return path.some(category => category.alwaysVisible === true) ||
    path.every(category => category.adminVisible !== false);
}

export function isDrawingAlwaysVisibleInList(
  categories: MapCategory[], attributes?: MapDrawingAttributes,
): boolean {
  return attributes?.alwaysVisible === true ||
    isCategoryAlwaysVisibleInList(categories, attributes?.categoryId);
}

export function isDrawingAdminVisibleInList(
  categories: MapCategory[], attributes?: MapDrawingAttributes,
): boolean {
  return isDrawingAlwaysVisibleInList(categories, attributes) ||
    (attributes?.adminVisible !== false &&
      isCategoryAdminVisibleInList(categories, attributes?.categoryId));
}

// Keep the category path reachable when a pinned descendant overrides a hidden parent.
export function publicMapCategories(
  categories: MapCategory[], drawings: { attributes?: MapDrawingAttributes }[],
): MapCategory[] {
  const visibleIds = new Set<string>();
  const includePath = (categoryId?: string | null) => {
    categoryPath(categories, categoryId).forEach(category => visibleIds.add(category.id));
  };
  categories.forEach(category => {
    if (isCategoryAdminVisibleInList(categories, category.id)) includePath(category.id);
  });
  drawings.forEach(drawing => {
    if (isDrawingAdminVisibleInList(categories, drawing.attributes)) includePath(drawing.attributes?.categoryId);
  });
  return categories.filter(category => visibleIds.has(category.id));
}
