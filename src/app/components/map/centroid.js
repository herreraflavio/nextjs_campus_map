/**
 * Calculates the centroid of a polygon ring using the shoelace formula.
 * @param {number[][]} ring - Array of [x, y] coordinate pairs.
 * @returns {[number, number]} - [cx, cy] coordinates of the centroid.
 */
export function getPolygonCentroid(ring) {
  let signedArea = 0;
  let cx = 0;
  let cy = 0;

  if (
    ring.length > 0 &&
    (ring[0][0] !== ring[ring.length - 1][0] ||
      ring[0][1] !== ring[ring.length - 1][1])
  ) {
    ring.push([...ring[0]]);
  }

  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }

  signedArea = signedArea / 2;
  cx = cx / (6 * signedArea);
  cy = cy / (6 * signedArea);

  return [cx, cy];
}
