// arcgisRefs.js
export const editingLayerRef = { current: null as any };
export const finalizedLayerRef = {
  current: null as any,
  events: new EventTarget(),
};
export const labelsLayerRef = { current: null as any };

export function setFinalizedLayer(layer: any) {
  finalizedLayerRef.current = layer;
  finalizedLayerRef.events.dispatchEvent(new Event("change"));
}
export function setLabelsLayer(layer: any) {
  labelsLayerRef.current = layer;
}

export const settingsRef = {
  current: {
    zoom: 15,
    center: [-120.422045, 37.368169] as [number, number],
    constraints: null as {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null,
  },
};

export const MapViewRef = { current: null as any };
export const GraphicRef = { current: null as any };

export const settingsEvents = new EventTarget();
