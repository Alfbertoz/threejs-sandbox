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

  // Workaround for a laz-rs-wasm bug in @loaders.gl/las 4.4.x:
  // after the point loop completes cleanly, parseLASChunked's
  // `finally { dataHandler.close() }` panics in wasm-bindgen with
  // "attempted to take ownership of rust value while it was
  // borrowed", and that error replaces the successful parse.
  //
  // The POSITION Float32Array is allocated once up front and is
  // populated across chunks; onProgress fires after each chunk
  // (including the final one) with the live mesh, so by the time
  // close() explodes we already hold a fully-populated array.
  // Capture it and swallow only the known close-time bug.
  let capturedPositions = null;

  try {
    // `skip: 10` reads every 10th point. Autzen has ~18M points;
    // 1.8M is still plenty dense visually and cuts both parse time
    // and GPU memory by ~10×.
    await LAZRsLoader.parse(buffer, {
      las: { skip: 10 },
      onProgress: (batch) => {
        const positions = batch?.attributes?.POSITION?.value;
        if (positions) capturedPositions = positions;
      },
    });
  } catch (err) {
    const msg = err?.message || String(err);
    const isCloseBug =
      msg.includes('Failed to close file') ||
      msg.includes('while it was borrowed');
    if (!(capturedPositions && isCloseBug)) {
      self.postMessage({ error: msg });
      return;
    }
  }

  if (!capturedPositions) {
    self.postMessage({ error: 'No positions captured from LAZ parse' });
    return;
  }

  // Transfer the Float32Array's backing buffer so we don't copy.
  self.postMessage(
    { positions: capturedPositions },
    [capturedPositions.buffer],
  );
};
