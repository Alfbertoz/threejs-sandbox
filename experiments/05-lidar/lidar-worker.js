// ─────────────────────────────────────────────────────────────
// Web Worker — decodes a LAZ buffer off the main thread.
// The laz-perf WASM decompressor runs for several seconds on the
// autzen file; doing it on the main thread triggers browser
// "page unresponsive" dialogs. Vite bundles this file via the
// `?worker` import suffix in main.js.
//
// Uses LASLoader (laz-perf backend) — supports LAS ≤ 1.3, which
// is what the autzen.laz file is. The LAZRsLoader path can handle
// LAS 1.4 but in 4.4.x panics in its close() on exit and masks
// the real parse error; stick with laz-perf when we can.
// ─────────────────────────────────────────────────────────────

import { LASLoader } from '@loaders.gl/las';

self.onmessage = async (event) => {
  const { buffer } = event.data;
  try {
    // `skip: 10` reads every 10th point. Autzen has ~10M points;
    // 1M is plenty dense and keeps GPU memory light.
    const data = await LASLoader.parse(buffer, { las: { skip: 10 } });
    const positions = data.attributes.POSITION.value;
    // Transfer the Float32Array's backing buffer so we don't copy.
    self.postMessage({ positions }, [positions.buffer]);
  } catch (err) {
    self.postMessage({ error: err?.message || String(err) });
  }
};
