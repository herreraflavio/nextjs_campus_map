// // arcgisRefs.ts
// interface SpatialReference {
//   wkid: number;
//   latestWkid: number;
// }

// interface Polygon {
//   attributes: Record<string, any>;
//   geometry: {
//     type: string;
//     rings: number[][][];
//     spatialReference: SpatialReference;
//   };
//   symbol: {
//     type: string;
//     color: number[]; // [r,g,b,a]
//     outline: {
//       color: number[]; // [r,g,b,a]
//       width: number;
//     };
//   };
// }

// interface Label {
//   attributes: {
//     parentId: string;
//     showAtZoom: number | null;
//     hideAtZoom: number | null;
//     fontSize: number;
//     color: number[]; // [r,g,b,a]
//     haloColor: number[]; // [r,g,b,a]
//     haloSize: number;
//     text: string;
//   };
//   geometry: {
//     type: string;
//     x: number;
//     y: number;
//     spatialReference: SpatialReference;
//   };
// }

// interface URLS {
//   url: string;
// }

// interface FieldInfo {
//   fieldName: string;
//   label: string;
//   visible: boolean;
//   format?: {
//     digitSeparator?: boolean;
//     places?: number;
//   };
// }

// interface FeatureLayerConfig {
//   url: string;
//   index: number;
//   outFields: string[];
//   popupEnabled: boolean;
//   popupTemplate?: {
//     title: string;
//     content: Array<{
//       type: string;
//       fieldInfos?: FieldInfo[];
//     }>;
//   };
// }

// interface ExportBody {
//   userEmail: string;
//   polygons: Polygon[];
//   labels: Label[];
//   settings: {
//     zoom: number;
//     center: {
//       spatialReference: SpatialReference;
//       x: number;
//       y: number;
//     };
//     constraints: {
//       xmin: number;
//       ymin: number;
//       xmax: number;
//       ymax: number;
//     } | null;
//     featureLayers: FeatureLayerConfig[] | null;
//   };
// }

// export const editingLayerRef = { current: null as any };
// export const finalizedLayerRef = {
//   current: null as any,
//   events: new EventTarget(),
// };
// export const labelsLayerRef = { current: null as any };

// export function setFinalizedLayer(layer: any) {
//   finalizedLayerRef.current = layer;
//   finalizedLayerRef.events.dispatchEvent(new Event("change"));
// }
// export function setLabelsLayer(layer: any) {
//   labelsLayerRef.current = layer;
// }

// export const settingsRef: { current: ExportBody["settings"] } = {
//   current: {
//     zoom: 15,
//     center: {
//       // initial default; adjust wkid/latestWkid to whatever makes sense
//       spatialReference: { wkid: 4326, latestWkid: 4326 },
//       x: -120.422045,
//       y: 37.368169,
//     },

//     constraints: null,
//     featureLayers: [
//       {
//         url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
//         index: 5,
//         outFields: ["*"],
//         popupEnabled: true,
//         popupTemplate: {
//           title: "{ZONENAME}",
//           content: [
//             {
//               type: "fields",
//               fieldInfos: [
//                 {
//                   fieldName: "hall",
//                   label: "Hall Name",
//                   visible: true,
//                 },
//                 {
//                   fieldName: "beds",
//                   label: "Number of Beds",
//                   visible: true,
//                   format: {
//                     digitSeparator: true,
//                     places: 0,
//                   },
//                 },
//               ],
//             },
//           ],
//         },
//       },
//     ],
//   },
// };

// export const MapViewRef = { current: null as any };
// export const GraphicRef = { current: null as any };

// export const settingsEvents = new EventTarget();

// arcgisRefs.ts
/* ───────────── Your existing types ───────────── */
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
    color: number[];
    outline: { color: number[]; width: number };
  };
}
interface Label {
  attributes: {
    parentId: string;
    showAtZoom: number | null;
    hideAtZoom: number | null;
    fontSize: number;
    color: number[];
    haloColor: number[];
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
interface URLS {
  url: string;
}
interface FieldInfo {
  fieldName: string;
  label: string;
  visible: boolean;
  format?: { digitSeparator?: boolean; places?: number };
}
interface FeatureLayerConfig {
  url: string;
  index: number;
  outFields: string[];
  popupEnabled: boolean;
  popupTemplate?: {
    title: string;
    content: Array<{ type: string; fieldInfos?: FieldInfo[] }>;
  };
}
interface ExportBody {
  userEmail: string;
  polygons: Polygon[];
  labels: Label[];
  settings: {
    zoom: number;
    center: { spatialReference: SpatialReference; x: number; y: number };
    constraints: {
      xmin: number;
      ymin: number;
      xmax: number;
      ymax: number;
    } | null;
    featureLayers: FeatureLayerConfig[] | null;
  };
}

/* ───────────── New: Places registry (dummy UC Merced coords) ───────────── */
export type Place = {
  placeId: string;
  label: string;
  geometry: { wkid: number; x: number; y: number }; // 4326
  aliases?: string[];
};

export const placesRegistry: Place[] = [
  {
    placeId: "ballroom",
    label: "UC Merced Ballroom Conference Center",
    geometry: { wkid: 4326, x: -120.425, y: 37.3656 },
    aliases: ["conference center", "ballroom"],
  },
  {
    placeId: "cob1-105",
    label: "COB1 105",
    geometry: { wkid: 4326, x: -120.4245, y: 37.3637 },
    aliases: ["cob 1 105", "classroom office building 1 room 105"],
  },
  {
    placeId: "cob2-170",
    label: "COB2 170",
    geometry: { wkid: 4326, x: -120.4236, y: 37.3635 },
    aliases: ["cob 2 170"],
  },
  {
    placeId: "library-lantern",
    label: "Library Lantern",
    geometry: { wkid: 4326, x: -120.4241, y: 37.3651 },
    aliases: ["lantern"],
  },
  {
    placeId: "se1",
    label: "Science & Engineering 1 (SE1)",
    geometry: { wkid: 4326, x: -120.4248, y: 37.3639 },
    aliases: ["se1"],
  },
  {
    placeId: "granite",
    label: "Granite Pass",
    geometry: { wkid: 4326, x: -120.4228, y: 37.3665 },
    aliases: [],
  },
  {
    placeId: "glacier",
    label: "Glacier Point",
    geometry: { wkid: 4326, x: -120.4224, y: 37.3669 },
    aliases: [],
  },
  {
    placeId: "rec-field",
    label: "Recreation Field",
    geometry: { wkid: 4326, x: -120.4209, y: 37.369 },
    aliases: ["rec field"],
  },
];

/* ───────────── Events store ───────────── */
export type CampusEvent = {
  id: string;
  event_name: string;
  description?: string;
  date?: string;
  startAt?: string;
  endAt?: string;
  locationTag?: string; // store the placeId
  names?: string[];
  original?: any;
  geometry: { x: number; y: number; wkid: number };
};

export const eventsStore = {
  items: [] as CampusEvent[],
  events: new EventTarget(),
};
export function addEventToStore(ev: CampusEvent) {
  eventsStore.items.push(ev);
  eventsStore.events.dispatchEvent(new CustomEvent("added", { detail: ev }));
}

/* ───────────── Layer refs ───────────── */
export const editingLayerRef = { current: null as any };
export const finalizedLayerRef = {
  current: null as any,
  events: new EventTarget(),
};
export const labelsLayerRef = { current: null as any };
export const eventsLayerRef = { current: null as any };

/* ───────────── Settings & map refs ───────────── */
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
      spatialReference: { wkid: 4326, latestWkid: 4326 },
      x: -120.422045,
      y: 37.368169,
    },
    constraints: null,
    featureLayers: [
      {
        url: "https://services6.arcgis.com/rX5atNlsxFq7LIpv/arcgis/rest/services/County_of_Merced_Jurisdictional_Zoning_Designations/FeatureServer",
        index: 5,
        outFields: ["*"],
        popupEnabled: true,
        popupTemplate: {
          title: "{ZONENAME}",
          content: [
            {
              type: "fields",
              fieldInfos: [
                { fieldName: "hall", label: "Hall Name", visible: true },
                {
                  fieldName: "beds",
                  label: "Number of Beds",
                  visible: true,
                  format: { digitSeparator: true, places: 0 },
                },
              ],
            },
          ],
        },
      },
    ],
  },
};

export const MapViewRef = { current: null as any };
export const GraphicRef = { current: null as any };
export const settingsEvents = new EventTarget();
