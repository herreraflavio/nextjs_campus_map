// arcgisRefs.ts
interface SpatialReference {
  wkid: number;
  latestWkid: number;
}

interface Polygon {
  attributes: Record<string, any>;
  geometry: {
    type: string;
    rings: number[][][];
    spatialReference: SpatialReference;
  };
  symbol: {
    type: string;
    color: number[]; // [r,g,b,a]
    outline: {
      color: number[]; // [r,g,b,a]
      width: number;
    };
  };
}

interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[]; // [r,g,b,a]
    haloColor: number[]; // [r,g,b,a]
    haloSize: number;
    text: string;
  };
  geometry: {
    type: string;
    x: number;
    y: number;
    spatialReference: SpatialReference;
  };
}

interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  settings: {
    zoom: number;
    center: {
      spatialReference: SpatialReference;
      x: number;
      y: number;
    };
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
  };
}

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

export const settingsRef: { current: ExportBody["settings"] } = {
  current: {
    zoom: 15,
    center: {
      // initial default; adjust wkid/latestWkid to whatever makes sense
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      x: -120.422045,
      y: 37.368169,
    },
    constraints: null,
  },
};

export const MapViewRef = { current: null as any };
export const GraphicRef = { current: null as any };

export const settingsEvents = new EventTarget();
