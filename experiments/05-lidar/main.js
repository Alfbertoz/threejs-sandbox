// ─────────────────────────────────────────────────────────────
// Experiment 05 — LiDAR
// Fetch → decode → render a LAZ aerial scan as a single
// Points cloud. Minimal first pass: flat terracotta, orbit.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
// Vite's `?worker` suffix bundles the worker and gives us a
// constructor. Decoding 80 MB of LAZ on the main thread blocks
// long enough to trigger "page unresponsive"; a worker keeps the
// UI alive.
import LidarWorker from './lidar-worker.js?worker';

// autzen.laz is the plain LAS 1.2 version of the Autzen stadium scan
// (~56 MB, ~10M points). The classified COPC variant at the same
// bucket is LAS 1.4 and laz-rs-wasm's decoder throws on its first
// read from that chunk layout — the close-finally then masks the
// real error with "attempted to take ownership of rust value while
// it was borrowed", so the failure is invisible. LAS 1.2 avoids all
// of that.
const LIDAR_URL = 'https://s3.amazonaws.com/hobu-lidar/autzen.laz';

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0d0b);

// ── Camera ────────────────────────────────────────────
// Tuned after the cloud loads; start with placeholder values so
// nothing crashes if rendering begins before the fetch finishes.
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  1,
  10000,
);
camera.position.set(200, 200, 200);

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ── Controls ──────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.target.set(0, 0, 0);

// ── Load the scan ─────────────────────────────────────
const loaderEl = document.getElementById('loader');

async function loadLidar() {
  // Explicit fetch → arrayBuffer → hand to worker for parse.
  const res = await fetch(LIDAR_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();

  const worker = new LidarWorker();
  const result = await new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    worker.onerror = (e) => reject(new Error(e.message || 'worker error'));
    // Transfer the ArrayBuffer (no copy).
    worker.postMessage({ buffer }, [buffer]);
  });
  worker.terminate();
  return result;
}

// ── Classification palette ────────────────────────────
// LAS ASPRS codes → RGB. Only the codes below get a distinct
// colour; anything else falls through to "other" mid-grey. Values
// are pre-converted from sRGB hex to linear RGB so per-vertex
// colours survive the renderer's tone-mapping + sRGB encode
// unchanged visually.
const CLASS_COLOR = (() => {
  const tmp = new THREE.Color();
  const table = new Float32Array(256 * 3);
  const set = (cls, hex) => {
    tmp.setHex(hex).convertSRGBToLinear();
    table[cls * 3]     = tmp.r;
    table[cls * 3 + 1] = tmp.g;
    table[cls * 3 + 2] = tmp.b;
  };
  // Default every code to "other" mid-grey first.
  for (let i = 0; i < 256; i++) set(i, 0x6a6a6a);
  set(2, 0x3a3a3a);          // ground
  set(3, 0x4a6b3a);          // low vegetation
  set(4, 0x4a6b3a);          // medium vegetation
  set(5, 0x4a6b3a);          // high vegetation
  set(6, 0xc46d47);          // building
  set(9, 0x4a6fa5);          // water
  return table;
})();

function buildPointCloud(positions, classifications) {
  // positions is a Float32Array laid out as x,y,z,x,y,z,...
  // classifications is a Uint8Array, one ASPRS code per point.
  // (Both pulled from loaders.gl attributes in the worker.)

  // ── Centre the cloud ──
  // LAZ files use absolute world coordinates (hundreds of thousands
  // of metres). Find the bounding-box centre and subtract it so the
  // cloud sits near the origin. One pass through the array.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]     -= cx;
    positions[i + 1] -= cy;
    positions[i + 2] -= cz;
  }

  const size = {
    x: maxX - minX,
    y: maxY - minY,
    z: maxZ - minZ,
  };
  const maxDim = Math.max(size.x, size.y, size.z);

  // ── Geometry + material ──
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Bounding sphere is cheap with the extents we already computed.
  geometry.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, 0, 0),
    Math.sqrt(size.x * size.x + size.y * size.y + size.z * size.z) / 2,
  );

  // Per-point colour from classification lookup.
  const pointCount = positions.length / 3;
  const colors = new Float32Array(pointCount * 3);
  if (classifications && classifications.length === pointCount) {
    for (let i = 0; i < pointCount; i++) {
      const c = classifications[i];
      colors[i * 3]     = CLASS_COLOR[c * 3];
      colors[i * 3 + 1] = CLASS_COLOR[c * 3 + 1];
      colors[i * 3 + 2] = CLASS_COLOR[c * 3 + 2];
    }
  } else {
    // Fallback: fill with "other" grey so nothing renders invisibly.
    for (let i = 0; i < pointCount; i++) {
      colors[i * 3]     = CLASS_COLOR[0];
      colors[i * 3 + 1] = CLASS_COLOR[1];
      colors[i * 3 + 2] = CLASS_COLOR[2];
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.5,
    sizeAttenuation: true,
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);
  // LAS/LAZ convention is Z-up (altitude). Three.js is Y-up, so
  // loading positions verbatim leaves the scan standing vertical.
  // Rotate -90° around X to map LAS-Z → Three-Y, i.e. lay the
  // ground plane flat for a natural aerial-style viewing angle.
  points.rotation.x = -Math.PI / 2;
  scene.add(points);

  // ── Frame the camera ──
  // ~1.5× the largest extent pulls the whole cloud into view; angle
  // is elevated (~45°) and offset so we see the scan obliquely.
  const dist = maxDim * 1.5;
  const elevation = Math.PI / 4; // 45°
  camera.position.set(
    dist * Math.cos(elevation) * 0.7,
    dist * Math.sin(elevation),
    dist * Math.cos(elevation) * 0.7,
  );
  camera.near = Math.max(1, dist / 1000);
  camera.far = dist * 10;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

loadLidar()
  .then(({ positions, classifications }) => {
    buildPointCloud(positions, classifications);
    loaderEl.classList.add('gone');
    setTimeout(() => loaderEl.remove(), 500);
  })
  .catch((err) => {
    console.error('LiDAR load failed:', err);
    // Short, distinct message so a silent failure doesn't just look
    // like the loader hanging at "Loading LiDAR scan…".
    loaderEl.textContent = `Load failed · ${err.message || err}`;
  });

// ── Resize ────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animate ───────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
