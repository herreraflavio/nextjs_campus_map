"use client";

import { useEffect, useState } from "react";
import { Portal, Snackbar } from "@mui/material";
import { useMapId } from "@/app/context/MapContext";
import { copyToClipboard, graphicShareTarget, publicMapUrl } from "@/app/helper/mapSharing";
import { finalizedLayerRef, MapViewRef } from "./arcgisRefs";
import { resolveEventLocation } from "./eventLocations";
import { revealDrawing } from "./categories/categoryVisibility";

export default function PopupSharing({ viewReady }: { viewReady: boolean }) {
  const mapId = useMapId();
  const [feedback, setFeedback] = useState<string | null>(null);
  useEffect(() => {
    const view = MapViewRef.current;
    if (!viewReady || !view) return;
    let disposed = false;
    let sequence = 0;
    let highlight: { remove: () => void } | undefined;
    let popupHandles: { remove: () => void }[] = [];
    let viewHandle: { remove: () => void } | undefined;
    (window as any).require(["esri/core/reactiveUtils"], (reactiveUtils: any) => {
      if (disposed) return;
      // MapView initially exposes popup properties; the widget loads on first use.
      viewHandle = reactiveUtils.watch(() => view.popup?.actions, () => {
        const popup = view.popup;
        popupHandles.forEach(handle => handle.remove());
        popupHandles = [];
        if (!popup?.actions || typeof popup.on !== "function") return;
        if (!popup.actions.find((action: any) => action.id === "share-map-item")) {
          popup.actions.add({ id: "share-map-item", title: "Share", className: "esri-icon-share2" });
        }
        const action = popup.actions.find((action: any) => action.id === "share-map-item");
        popupHandles.push(popup.on("trigger-action", async (event: any) => {
          if (event.action.id !== "share-map-item") return;
          const target = graphicShareTarget(popup.selectedFeature?.attributes ?? {});
          if (!target) return;
          try {
            await copyToClipboard(publicMapUrl(mapId, target, window.location.origin));
            if (!disposed) setFeedback("Link copied");
          } catch {
            if (!disposed) setFeedback("Unable to copy link. Please try again.");
          }
        }));
        popupHandles.push(reactiveUtils.watch(() => [popup.selectedFeature, popup.visible], async () => {
          const token = ++sequence;
          highlight?.remove();
          highlight = undefined;
          const feature = popup.selectedFeature;
          action.disabled = !graphicShareTarget(feature?.attributes ?? {});
          if (!popup.visible || !feature?.attributes?.event_name) return;
          const target = await resolveEventLocation(feature.attributes.location);
          if (disposed || token !== sequence || !popup.visible || !target?.drawing) return;
          revealDrawing(target.drawing);
          try {
            const layerView = await view.whenLayerView(finalizedLayerRef.current);
            if (!disposed && token === sequence && popup.visible) highlight = layerView.highlight(target.drawing);
          } catch { /* Layer or view may have been removed while resolving. */ }
        }, { initial: true }));
      }, { initial: true });
    });
    return () => {
      disposed = true;
      sequence++;
      highlight?.remove();
      viewHandle?.remove();
      popupHandles.forEach(handle => handle.remove());
    };
  }, [mapId, viewReady]);
  return feedback ? <Portal><Snackbar open autoHideDuration={3000} message={feedback}
    onClose={(_, reason) => { if (reason !== "clickaway") setFeedback(null); }} /></Portal> : null;
}
