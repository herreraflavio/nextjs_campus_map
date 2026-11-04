"use client";

import { useState } from "react";
import { Portal, Snackbar } from "@mui/material";
import { useMapId } from "@/app/context/MapContext";
import { copyToClipboard, publicMapUrl } from "@/app/helper/mapSharing";
import styles from "./MapSidebar.module.css";

export default function CopyLocationLinkButton({ name, location, eventId, sourceId }: {
  name: string;
  location?: string;
  eventId?: string;
  sourceId?: string;
}) {
  const mapId = useMapId();
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);

  const copyLink = async () => {
    const url = publicMapUrl(mapId, eventId ? { event: eventId, source: sourceId } : { location }, window.location.origin);
    try {
      await copyToClipboard(url);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };

  return (
    <>
      <button
        type="button"
        className={styles.copyLinkButton}
        aria-label={`Copy link to ${name}`}
        title={`Copy link to ${name}`}
        disabled={!location && !eventId}
        onClick={event => {
          event.stopPropagation();
          void copyLink();
        }}
      >
        <svg className={styles.editIcon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10 13a5 5 0 0 0 7 .1l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7M14 11a5 5 0 0 0-7-.1l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {feedback && (
        <Portal>
          <Snackbar
            open
            autoHideDuration={3000}
            onClose={(_, reason) => {
              if (reason !== "clickaway") setFeedback(null);
            }}
            onClick={event => event.stopPropagation()}
            message={feedback === "copied" ? "Link copied" : "Unable to copy link. Please try again."}
          />
        </Portal>
      )}
    </>
  );
}
