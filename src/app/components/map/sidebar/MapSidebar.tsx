"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

import {
  getCategoryName,
  getCategoryParentId,
  ROOT_CATEGORY_ID,
  resolveCategoryId,
} from "../categories/categoryStore";
import {
  getCategoryOwnVisibility,
  getItemOwnVisibility,
  isCategoryEffectivelyVisible,
  isGraphicEffectivelyVisible,
  subscribeVisibility,
  toggleCategoryVisibility,
  toggleItemVisibility,
} from "../categories/categoryVisibility";
import { useMapCategories } from "../categories/useMapCategories";
import styles from "./MapSidebar.module.css";

export type MapSidebarGraphic = {
  attributes?: {
    id?: string;
    name?: string;
    order?: number;
    categoryId?: string | null;
    iconUrl?: string | null;
    [key: string]: any;
  };
  geometry?: {
    type?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type SidebarContext = {
  activeCategoryId: string;
  activeCategoryName: string;
};

type MapSidebarProps = {
  drawings: MapSidebarGraphic[];
  onGoTo: (graphic: MapSidebarGraphic) => void;
  headerActions?: (context: SidebarContext) => ReactNode;
  renderItemActions?: (graphic: MapSidebarGraphic) => ReactNode;
  onActiveCategoryChange?: (categoryId: string) => void;
};

export function MapSidebarButton({
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = [styles.actionButton, className].filter(Boolean).join(" ");

  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  );
}

function sortByOrderThenName<T extends { order?: number; name?: string }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : 0;
    const orderB = typeof b.order === "number" ? b.order : 0;
    if (orderA !== orderB) return orderA - orderB;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
}

function itemId(graphic: MapSidebarGraphic, index: number): string {
  return graphic.attributes?.id ?? `drawing-${index}`;
}

function IconSlot({
  src,
  fallback,
}: {
  src?: string | null;
  fallback: string;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={styles.iconImage}
        loading="lazy"
      />
    );
  }

  return (
    <span className={styles.iconFallback} aria-hidden="true">
      {fallback}
    </span>
  );
}

export default function MapSidebar({
  drawings,
  onGoTo,
  headerActions,
  renderItemActions,
  onActiveCategoryChange,
}: MapSidebarProps) {
  const categories = useMapCategories();
  const [activeCategoryId, setActiveCategoryId] = useState(ROOT_CATEGORY_ID);
  const [, setVisibilityVersion] = useState(0);

  const categoryIds = useMemo(
    () => new Set(categories.map((category) => category.id)),
    [categories],
  );

  useEffect(() => {
    const unsubscribe = subscribeVisibility(() => {
      setVisibilityVersion((version) => version + 1);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      activeCategoryId !== ROOT_CATEGORY_ID &&
      !categoryIds.has(activeCategoryId)
    ) {
      setActiveCategoryId(ROOT_CATEGORY_ID);
    }
  }, [activeCategoryId, categoryIds]);

  useEffect(() => {
    onActiveCategoryChange?.(activeCategoryId);
  }, [activeCategoryId, onActiveCategoryChange]);

  const activeCategoryName = getCategoryName(activeCategoryId);

  const childCategories = useMemo(() => {
    const parentId =
      activeCategoryId === ROOT_CATEGORY_ID ? null : activeCategoryId;

    return sortByOrderThenName(
      categories
        .filter((category) => (category.parentId ?? null) === parentId)
        .map((category) => ({
          ...category,
          order: category.order,
          name: category.name,
        })),
    );
  }, [activeCategoryId, categories]);

  const directDrawings = useMemo(() => {
    return [...drawings]
      .filter(
        (graphic) =>
          resolveCategoryId(graphic.attributes?.categoryId) ===
          activeCategoryId,
      )
      .sort(
        (a, b) =>
          (a.attributes?.order ?? 0) -
          (b.attributes?.order ?? 0),
      );
  }, [activeCategoryId, drawings]);

  const goBack = () => {
    setActiveCategoryId(getCategoryParentId(activeCategoryId));
  };

  return (
    <section className={styles.sidebarSection}>
      {activeCategoryId !== ROOT_CATEGORY_ID && (
        <button type="button" className={styles.backButton} onClick={goBack}>
          <img
            src="/assets/icons/right-chevron.svg"
            alt=""
            className={styles.backChevron}
          />
          Back
        </button>
      )}

      <div className={styles.header}>
        <h3 className={styles.title}>{activeCategoryName}</h3>
      </div>

      <div className={styles.divider} />

      <div className={styles.list} role="list">
        {childCategories.map((category) => {
          const ownVisible = getCategoryOwnVisibility(category.id);
          const effectiveVisible = isCategoryEffectivelyVisible(category.id);

          return (
            <div
              key={category.id}
              className={[
                styles.categoryRow,
                effectiveVisible ? "" : styles.muted,
              ]
                .filter(Boolean)
                .join(" ")}
              role="listitem"
            >
              <button
                type="button"
                className={styles.categoryLabel}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <IconSlot src={category.iconUrl} fallback="C" />
                <span className={styles.categoryName}>{category.name}</span>
              </button>

              <button
                type="button"
                className={styles.visibilityButton}
                aria-pressed={ownVisible}
                aria-label={`${ownVisible ? "Hide" : "Show"} ${category.name}`}
                title={`${ownVisible ? "Hide" : "Show"} ${category.name}`}
                onClick={() => toggleCategoryVisibility(category.id)}
              >
                {ownVisible ? "✓" : ""}
              </button>

              <button
                type="button"
                className={styles.drillButton}
                aria-label={`Open ${category.name}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <img
                  src="/assets/icons/right-chevron.svg"
                  alt=""
                  className={styles.chevron}
                />
              </button>
            </div>
          );
        })}

        {directDrawings.map((graphic, index) => {
          const id = itemId(graphic, index);
          const name = graphic.attributes?.name ?? "Unnamed drawing";
          const geometryType = graphic.geometry?.type ?? "unknown";
          const ownVisible = getItemOwnVisibility(id);
          const effectiveVisible = isGraphicEffectivelyVisible(graphic);

          return (
            <div
              key={id}
              className={[
                styles.item,
                effectiveVisible ? "" : styles.muted,
              ]
                .filter(Boolean)
                .join(" ")}
              role="listitem"
            >
              <div className={styles.itemTopLine}>
                <div className={styles.itemLabel}>
                  <IconSlot src={graphic.attributes?.iconUrl} fallback="I" />
                  <span>{name}</span>
                </div>

                <button
                  type="button"
                  className={styles.visibilityButton}
                  aria-pressed={ownVisible}
                  aria-label={`${ownVisible ? "Hide" : "Show"} ${name}`}
                  title={`${ownVisible ? "Hide" : "Show"} ${name}`}
                  onClick={() => toggleItemVisibility(id)}
                >
                  {ownVisible ? "✓" : ""}
                </button>
              </div>

              <div className={styles.type}>{geometryType}</div>

              <div className={styles.actions}>
                <MapSidebarButton onClick={() => onGoTo(graphic)}>
                  Go to
                </MapSidebarButton>

                {renderItemActions?.(graphic)}
              </div>
            </div>
          );
        })}

        {childCategories.length === 0 && directDrawings.length === 0 && (
          <div className={styles.empty}>No items here yet.</div>
        )}
      </div>

      {headerActions && (
        <div className={styles.footerActions}>
          {headerActions({ activeCategoryId, activeCategoryName })}
        </div>
      )}
    </section>
  );
}
