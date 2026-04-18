// ─────────────────────────────────────────────────────────────
// Experiment 05 — LiDAR
// Fetch → decode → render a LAZ aerial scan as a single
// Points cloud. Minimal first pass: flat terracotta, orbit.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parse } from '@loaders.gl/core';
import { LASLoader } from '@loaders.gl/las';

const LIDAR_URL = 'https://s3.amazonaws.com/hobu-lidar/autzen-classified.copc.laz';

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
  // Explicit fetch → arrayBuffer → parse, per the brief.
  const res = await fetch(LIDAR_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buffer = await res.arrayBuffer();
  const data = await parse(buffer, LASLoader);
  return data;
}

function buildPointCloud(lasMesh) {
  // loaders.gl returns a Mesh-shaped object; POSITION.value is a
  // Float32Array laid out as x,y,z,x,y,z,...
  const positions = lasMesh.attributes.POSITION.value;

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

  const material = new THREE.PointsMaterial({
    color: 0xc46d47,
    size: 1.5,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
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
  .then((data) => {
    buildPointCloud(data);
    loaderEl.classList.add('gone');
    setTimeout(() => loaderEl.remove(), 500);
  })
  .catch((err) => {
    console.error('LiDAR load failed:', err);
    loaderEl.textContent = 'Failed to load scan';
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
