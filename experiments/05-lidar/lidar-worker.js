// ─────────────────────────────────────────────────────────────
// Web Worker — decodes a LAZ buffer off the main thread.
// The laz-rs WASM decompressor runs for several seconds on 80 MB
// files; doing it on the main thread triggers browser
// "page unresponsive" dialogs. Vite bundles this file via the
// `?worker` import suffix in main.js.
// ─────────────────────────────────────────────────────────────

import { LAZRsLoader } from '@loaders.gl/las';

self.onmessage = async (event) => {
  const { buffer } = event.data;
  try {
    // `skip: 10` reads every 10th point. Autzen has ~18M points;
    // 1.8M is still plenty dense visually and cuts both parse time
    // and GPU memory by ~10x.
    const data = await LAZRsLoader.parse(buffer, { las: { skip: 10 } });
    const positions = data.attributes.POSITION.value;
    // Transfer the Float32Array's backing buffer so we don't copy.
    self.postMessage({ positions }, [positions.buffer]);
  } catch (err) {
    self.postMessage({ error: err?.message || String(err) });
  }
};
