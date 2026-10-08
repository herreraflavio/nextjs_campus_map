/** Yield work to another browser task without adding a fixed loading delay. */
export function yieldMapWork(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const cleanup = () => {
      channel.port1.close();
      channel.port2.close();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    channel.port1.onmessage = () => { cleanup(); resolve(); };
    channel.port2.postMessage(null);
  });
}

/** Bound synchronous graphic creation so the view and UI can keep rendering. */
export async function hydrateGraphics<T, G>(
  items: readonly T[],
  create: (item: T) => G | null,
  append: (batch: G[]) => void,
  signal: AbortSignal,
): Promise<void> {
  await yieldMapWork(signal);
  let index = 0;
  while (index < items.length) {
    signal.throwIfAborted();
    const start = performance.now();
    const batch: G[] = [];
    let processed = 0;
    // A single complex geometry may exceed the budget; always make progress.
    while (index < items.length && processed < 40 && (processed === 0 || performance.now() - start < 8)) {
      const graphic = create(items[index++]);
      processed++;
      if (graphic !== null) batch.push(graphic);
    }
    if (batch.length) append(batch);
    if (index < items.length) await yieldMapWork(signal);
  }
  signal.throwIfAborted();
}
