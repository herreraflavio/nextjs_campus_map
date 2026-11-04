import styles from "./MapLoadingSkeleton.module.css";

export default function MapLoadingSkeleton({ section }: {
  section: "header" | "sidebar" | "map";
}) {
  const label = section === "header" ? "Loading map header" : section === "sidebar" ? "Loading sidebar" : "Loading map";
  return (
    <div className={styles[section]} role="status" aria-label={label} data-map-skeleton={section}>
      {section === "header" && <div className={styles.headerContent} aria-hidden="true">
        <span className={`${styles.piece} ${styles.logo}`} />
        <span className={`${styles.piece} ${styles.square}`} />
      </div>}
      {section === "sidebar" && <div aria-hidden="true">
        <div className={styles.tabs}>
          <span className={`${styles.piece} ${styles.tab}`} />
          <span className={`${styles.piece} ${styles.tab}`} />
        </div>
        <div className={styles.panel}>
          <div className={styles.actions}>
            <span className={`${styles.piece} ${styles.action}`} />
            <span className={`${styles.piece} ${styles.action}`} />
          </div>
          {[0, 1, 2].map(row => <div key={row} className={styles.row}>
            <span className={`${styles.piece} ${styles.square}`} />
            <div className={styles.lines}>
              <span className={`${styles.piece} ${styles.line}`} />
              <span className={`${styles.piece} ${styles.shortLine}`} />
            </div>
            <span className={`${styles.piece} ${styles.toggle}`} />
          </div>)}
        </div>
      </div>}
      {section === "map" && <div className={styles.mapContent} aria-hidden="true">
        <svg className={styles.mapIcon} viewBox="0 0 64 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
          <path d="m4 12 18-8 20 8 18-8v32l-18 8-20-8-18 8V12Zm18-8v32m20-24v32" />
        </svg>
        <span className={`${styles.piece} ${styles.mapLine}`} />
        <span className={`${styles.piece} ${styles.shortLine}`} />
      </div>}
    </div>
  );
}
