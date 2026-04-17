// ─────────────────────────────────────────────────────────────
// Experiment 04 — Gaussian Splats
// Loads 3D Gaussian splats via the Spark library and floats them
// in dark cinematic space. Switcher UI cycles between scenes.
// Two camera modes: free-orbit, and a hands-off cinematic circle.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { SplatMesh } from '@sparkjsdev/spark';

// ── Splat catalog ─────────────────────────────────────
// Each capture arrives in its own coordinate system and scale,
// so framing values are hand-tuned rather than auto-fit from
// bounding boxes. Tweak freely — every other system reads from
// the currently-selected entry.
//
// .spz/.splat files commonly export upside-down relative to THREE's
// +Y-up convention; `new Quaternion(1,0,0,0)` is a 180° flip around
// X that puts them right-way-up. Fine-tune per splat if needed.
const SPLATS = [
  {
    name: 'Butterfly',
    url: 'https://sparkjs.dev/assets/splats/butterfly.spz',
    position: new THREE.Vector3(0, 0.4, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
    scale: 2.2,
    cameraRadius: 6,
    cameraHeight: 1.2,
  },
  {
    name: 'Bonsai',
    url: 'https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bonsai/bonsai-7k-mini.splat',
    position: new THREE.Vector3(0, 0.4, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
    scale: 1.4,
    cameraRadius: 5,
    cameraHeight: 1.0,
  },
  {
    name: 'Bicycle',
    url: 'https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/bicycle/bicycle-7k-mini.splat',
    position: new THREE.Vector3(0, 0.4, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
    scale: 1.0,
    cameraRadius: 7,
    cameraHeight: 1.3,
  },
  {
    name: 'Luigi',
    url: 'https://huggingface.co/datasets/dylanebert/3dgs/resolve/main/luigi/luigi.ply',
    position: new THREE.Vector3(0, 0.4, 0),
    quaternion: new THREE.Quaternion(0, 1, 0, 1),
    // Figurine-scale capture — much smaller than the room-scale scenes
    // above, so scale/cameraRadius are tuned tighter.
    scale: 0.5,
    cameraRadius: 4.0,
    cameraHeight: 1.0,
  },
];

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0d0b);
// Fog tuned so each splat reads clearly but the empty backdrop
// dissolves into the same charcoal as the page.
scene.fog = new THREE.Fog(0x0e0d0b, 8, 22);

// ── Camera ────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);

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
// Splats carry their own baked colour — neutral ambient only.
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

// ── Controls ──────────────────────────────────────────
// Wider distance range so the three splats' different scales can
// all be navigated comfortably.
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1;
controls.maxDistance = 30;

// ── DOM refs & state ──────────────────────────────────
const loaderEl = document.getElementById('loader');
const loaderLabel = loaderEl.querySelector('div:last-child');
const hintEl = document.getElementById('hint');
const toggleEl = document.getElementById('mode-toggle');
const pickerEl = document.getElementById('splat-picker');

let splat = null;
let currentIndex = -1;
let mode = 'orbit'; // 'orbit' | 'cinematic'
let cinematicStartAngle = 0;
let cinematicElapsedOffset = 0;

// ─────────────────────────────────────────────────────────────
// Splat loading
// ─────────────────────────────────────────────────────────────

function showLoader() {
  loaderEl.style.display = 'flex';
  loaderLabel.textContent = 'Loading splat';
  // Force a reflow so the transition replays on repeat loads.
  void loaderEl.offsetWidth;
  loaderEl.classList.remove('gone');
}

function hideLoader() {
  loaderEl.classList.add('gone');
  setTimeout(() => {
    // Only fully hide if we haven't been asked to show it again.
    if (loaderEl.classList.contains('gone')) loaderEl.style.display = 'none';
  }, 500);
}

function setActiveSplat(index) {
  if (index === currentIndex) return;

  // Dispose of the previous splat's GPU resources — avoids leaks
  // when the user hops between splats repeatedly.
  if (splat) {
    scene.remove(splat);
    splat.dispose();
    splat = null;
  }

  currentIndex = index;
  const cfg = SPLATS[index];

  splat = new SplatMesh({ url: cfg.url });
  splat.position.copy(cfg.position);
  splat.quaternion.copy(cfg.quaternion);
  splat.scale.setScalar(cfg.scale);
  scene.add(splat);

  // The orbit target follows the splat's centre so controls feel natural.
  controls.target.copy(cfg.position);

  // Reset camera to the splat's preferred framing when in orbit mode.
  // Cinematic mode reads cameraRadius/cameraHeight from the current
  // config each frame and will glide the camera to the new values.
  if (mode === 'orbit') {
    camera.position.set(
      cfg.position.x,
      cfg.position.y + cfg.cameraHeight,
      cfg.position.z + cfg.cameraRadius,
    );
    controls.update();
  }

  showLoader();
  splat.initialized
    .then(() => hideLoader())
    .catch((err) => {
      console.error('Splat load failed:', err);
      loaderEl.classList.remove('gone');
      loaderEl.style.display = 'flex';
      loaderLabel.textContent = 'Failed to load';
    });

  // Refresh button highlights.
  pickerEl.querySelectorAll('.chip').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });
}

// ── Build splat picker buttons from the catalog ───────
SPLATS.forEach((cfg, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'chip';
  btn.textContent = cfg.name;
  btn.addEventListener('click', () => setActiveSplat(i));
  pickerEl.appendChild(btn);
});

// ─────────────────────────────────────────────────────────────
// Camera modes
// ─────────────────────────────────────────────────────────────

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
  // OrbitControls re-derives spherical coords from camera vs. target
  // on update() — no explicit state sync needed.
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
const cinematicTarget = new THREE.Vector3();
const CINEMATIC_PERIOD = 26; // seconds per full revolution

function updateCinematicTarget(elapsed) {
  const cfg = SPLATS[currentIndex];
  const t = (elapsed - cinematicElapsedOffset) / CINEMATIC_PERIOD;
  const angle = cinematicStartAngle + t * Math.PI * 2;
  // Sinusoidal rise-and-fall — two cycles per revolution.
  const riseFall = Math.sin(t * Math.PI * 4) * 0.6;

  cinematicTarget.set(
    controls.target.x + Math.cos(angle) * cfg.cameraRadius,
    controls.target.y + cfg.cameraHeight + riseFall,
    controls.target.z + Math.sin(angle) * cfg.cameraRadius,
  );
}

// Frame-rate-independent damped lerp.
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
    // Damp toward the target so the first frame after toggling or
    // switching splats glides from wherever the camera was.
    camera.position.x = damp(camera.position.x, cinematicTarget.x, 2.5, dt);
    camera.position.y = damp(camera.position.y, cinematicTarget.y, 2.5, dt);
    camera.position.z = damp(camera.position.z, cinematicTarget.z, 2.5, dt);
    camera.lookAt(controls.target);
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

// Kick off with the first splat (butterfly) — preserves the
// pre-switcher default behaviour.
setActiveSplat(0);
animate();
