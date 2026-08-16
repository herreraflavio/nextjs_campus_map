//src/app/components/map/sidebar/DrawingSidebar.tsx
"use client";

import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react";

import styles from "./DrawingSidebar.module.css";

export type DrawingGraphic = {
  attributes?: {
    id?: string;
    name?: string;
    order?: number;
    [key: string]: any;
  };
  geometry?: {
    type?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

type DrawingSidebarProps = {
  drawings: DrawingGraphic[];
  onGoTo: (graphic: DrawingGraphic) => void;
  renderActions?: (graphic: DrawingGraphic) => ReactNode;
};

export function DrawingSidebarButton({
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

export default function DrawingSidebar({
  drawings,
  onGoTo,
  renderActions,
}: DrawingSidebarProps) {
  return (
    <section className={styles.sidebarSection}>
      <div className={styles.header}>
        <div aria-hidden="true">╔═</div>
        <h3 className={styles.title}>Drawings</h3>
        <div aria-hidden="true">═╗</div>
      </div>

      <ul className={styles.list}>
        {drawings.map((graphic, index) => {
          const id = graphic.attributes?.id ?? `drawing-${index}`;
          const name = graphic.attributes?.name ?? "Unnamed drawing";
          const geometryType = graphic.geometry?.type ?? "unknown";

          return (
            <li key={id} className={styles.item}>
              <div className={styles.itemLabel}>
                <span>{name}</span>{" "}
                <span className={styles.type}>({geometryType})</span>
              </div>

              <div className={styles.actions}>
                <DrawingSidebarButton onClick={() => onGoTo(graphic)}>
                  Go to
                </DrawingSidebarButton>

                {renderActions?.(graphic)}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
