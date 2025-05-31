// /components/map/bucketManager.ts

export type Bucket = {
  minZoom: number;
  maxZoom: number;
  labels: __esri.Graphic[];
};

export const labelBuckets: Bucket[] = [];

export function rebuildBuckets(labelsLayer: any) {
  labelBuckets.length = 0;

  labelsLayer.graphics.items.forEach((lbl: any) => {
    const minZ = lbl.attributes.showAtZoom ?? -1;
    const maxZ = lbl.attributes.hideAtZoom ?? Infinity;

    let b = labelBuckets.find((x) => x.minZoom === minZ && x.maxZoom === maxZ);
    if (!b) {
      b = { minZoom: minZ, maxZoom: maxZ, labels: [] };
      labelBuckets.push(b);
    }
    b.labels.push(lbl);
  });
}
