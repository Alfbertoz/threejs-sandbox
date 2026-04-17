// ─────────────────────────────────────────────────────────────
// Experiment 04 — Gaussian Splats
// Loads a 3D Gaussian splat via the Spark library and floats it
// in dark cinematic space. Two camera modes: free-orbit, and a
// hands-off cinematic circle.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';

const SPLAT_URL = 'https://sparkjs.dev/assets/splats/butterfly.spz';

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0d0b);
// Fog tuned so the splat reads clearly but the empty backdrop
// dissolves into the same charcoal as the page.
scene.fog = new THREE.Fog(0x0e0d0b, 8, 22);

// ── Camera ────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
const CAM_RADIUS = 6;     // fixed radius used by cinematic mode
const CAM_HEIGHT = 1.2;   // base height for cinematic orbit
camera.position.set(0, CAM_HEIGHT, CAM_RADIUS);

// ── Renderer ──────────────────────────────────────────
// Spark recommends antialias:false — WebGL MSAA does nothing useful
// for splats and measurably hurts performance.
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ── Lighting ──────────────────────────────────────────
// Splats carry their own baked colour — only a neutral ambient so
// the scene helpers (if any were added later) don't read pitch-black.
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ── Controls ──────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3;
controls.maxDistance = 14;
controls.target.set(0, 0.4, 0);

// ── Splat ─────────────────────────────────────────────
const splat = new SplatMesh({ url: SPLAT_URL });
// .spz files commonly export upside-down relative to THREE's
// +Y-up convention. Spark's own README uses this same quaternion
// to flip the butterfly right-side up.
splat.quaternion.set(1, 0, 0, 0);
splat.position.set(0, 0.4, 0);
scene.add(splat);

// ── Loading indicator ─────────────────────────────────
// SplatMesh exposes `initialized: Promise<SplatMesh>`. No progress
// bytes are surfaced by the API, so a spinner is the honest UI.
const loaderEl = document.getElementById('loader');
splat.initialized
  .then(() => {
    // Fit the splat to a pleasant on-screen size. Bounding box is
    // only valid after initialization.
    frameSplat(splat);
    loaderEl.classList.add('gone');
    setTimeout(() => loaderEl.remove(), 500);
  })
  .catch((err) => {
    console.error('Splat load failed:', err);
    loaderEl.querySelector('div:last-child').textContent = 'Failed to load';
  });

function frameSplat(mesh) {
  const box = mesh.getBoundingBox();
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  // Scale so the splat's largest dimension is ~2.2 world units
  // (camera radius is 6, FOV 40° — fills the frame with breathing room).
  const largest = Math.max(size.x, size.y, size.z) || 1;
  const targetSize = 2.2;
  const s = targetSize / largest;
  mesh.scale.setScalar(s);

  // Re-centre so the splat's visual middle sits at (0, 0.4, 0).
  mesh.position.set(-center.x * s, 0.4 - center.y * s, -center.z * s);
}

// ─────────────────────────────────────────────────────────────
// Camera modes
// ─────────────────────────────────────────────────────────────
//
// `orbit`      — OrbitControls drive the camera.
// `cinematic`  — we ignore input and move the camera on a circle,
//                with a sinusoidal rise-and-fall in height.
//
// Transitions between modes aren't snapped; when switching to
// cinematic we pick up the current camera angle as the starting
// phase, and when switching back to orbit we hand the current pose
// to OrbitControls.
let mode = 'orbit';
let cinematicStartAngle = 0;
let cinematicElapsedOffset = 0; // keeps the orbit smooth across toggles

const hintEl = document.getElementById('hint');
const toggleEl = document.getElementById('mode-toggle');

function enterCinematic(elapsed) {
  // Take the camera's current angle around the target so we don't jump.
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  cinematicStartAngle = Math.atan2(dz, dx);
  cinematicElapsedOffset = elapsed;
  controls.enabled = false;
  toggleEl.classList.add('active');
  toggleEl.textContent = 'Orbit';
  hintEl.textContent = 'Cinematic mode · camera locked';
}

function enterOrbit() {
  controls.enabled = true;
  // OrbitControls computes its spherical coords from the current
  // camera.position vs. controls.target, so handing over is as
  // simple as calling update() — no explicit state sync needed.
  controls.update();
  toggleEl.classList.remove('active');
  toggleEl.textContent = 'Cinematic';
  hintEl.textContent = 'Drag to orbit · Scroll to zoom';
}

toggleEl.addEventListener('click', () => {
  if (mode === 'orbit') {
    mode = 'cinematic';
    enterCinematic(clock.getElapsedTime());
  } else {
    mode = 'orbit';
    enterOrbit();
  }
});

// ── Smooth cinematic-mode camera ──────────────────────
// The camera doesn't jump when we toggle: we lerp position each
// frame toward the cinematic target so it glides into the circle.
const cinematicTarget = new THREE.Vector3();
const CINEMATIC_PERIOD = 26; // seconds per full revolution

function updateCinematicTarget(elapsed) {
  const t = (elapsed - cinematicElapsedOffset) / CINEMATIC_PERIOD;
  const angle = cinematicStartAngle + t * Math.PI * 2;
  // Sinusoidal rise-and-fall — two cycles per revolution.
  const riseFall = Math.sin(t * Math.PI * 4) * 0.6;

  cinematicTarget.set(
    controls.target.x + Math.cos(angle) * CAM_RADIUS,
    controls.target.y + CAM_HEIGHT + riseFall,
    controls.target.z + Math.sin(angle) * CAM_RADIUS,
  );
}

// Frame-rate-independent damped lerp (same idiom as experiment 03).
function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

// ── Resize ────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animate ───────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.getElapsedTime();

  if (mode === 'cinematic') {
    updateCinematicTarget(elapsed);
    // Damp toward the target so the first frame after toggling
    // glides from wherever the user left the camera.
    camera.position.x = damp(camera.position.x, cinematicTarget.x, 2.5, dt);
    camera.position.y = damp(camera.position.y, cinematicTarget.y, 2.5, dt);
    camera.position.z = damp(camera.position.z, cinematicTarget.z, 2.5, dt);
    camera.lookAt(controls.target);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

animate();
