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
    // `skip: 2` reads every 2nd point. Autzen has ~10M points;
    // ~5M is visually dense without straining GPU memory (~60 MB
    // for positions).
    const data = await LASLoader.parse(buffer, { las: { skip: 2 } });
    const positions = data.attributes.POSITION.value;
    // LAS classification (ASPRS codes) — one Uint8 per point. Used
    // by the main thread to colour points by ground / vegetation /
    // building / water / other.
    const classifications = data.attributes.classification?.value ?? null;
    const transfer = [positions.buffer];
    if (classifications) transfer.push(classifications.buffer);
    self.postMessage({ positions, classifications }, transfer);
  } catch (err) {
    self.postMessage({ error: err?.message || String(err) });
  }
};
