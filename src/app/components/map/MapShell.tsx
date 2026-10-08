"use client";

import type { ReactNode } from "react";
import MapTopBar from "./MapTopBar";
import styles from "./MapShell.module.css";

// One map root for the builder and iframe: header first, then sidebar/map body.
export default function MapShell({ children, canEdit = false }: {
  children: ReactNode;
  canEdit?: boolean;
}) {
  return (
    <div className={styles.root} data-map-root>
      <MapTopBar canEdit={canEdit} />
      {children}
    </div>
  );
}
