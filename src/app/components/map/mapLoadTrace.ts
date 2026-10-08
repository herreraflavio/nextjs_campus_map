/** User Timing entries for diagnosing initialization in browser DevTools.
 * No logging, network requests, or timing-based UI decisions.
 */
export type MapLoadTrace = { mark: (phase: string) => void };
let sequence = 0;

export function createMapLoadTrace(mapId: string): MapLoadTrace {
  const prefix = `logit-map:${mapId}:${++sequence}`;
  const phases = new Set<string>();
  const start = `${prefix}:start`;
  performance.mark(start);
  return {
    mark(phase) {
      if (phases.has(phase)) return;
      phases.add(phase);
      const name = `${prefix}:${phase}`;
      performance.mark(name);
      performance.measure(`${name}:elapsed`, start, name);
    },
  };
}
