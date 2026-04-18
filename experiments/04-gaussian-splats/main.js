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
  {
    // Heavy one — ~163MB compressed ply of a full church interior.
    // Button label warns the user so the long load isn't a surprise;
    // the existing spinner stays visible for the whole download.
    // `walkable: true` unlocks first-person Walk mode on the toggle.
    name: 'Church (163MB)',
    url: 'https://d28zzqy0iyovbz.cloudfront.net/c67edb74/v1/scene.compressed.ply',
    position: new THREE.Vector3(0, 0, 0),
    quaternion: new THREE.Quaternion(1, 0, 0, 0),
    scale: 1.0,
    cameraRadius: 7,
    cameraHeight: 1.5,
    walkable: true,
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
let mode = 'orbit'; // 'orbit' | 'cinematic' | 'walk' (walk only on walkable splats)
let cinematicStartAngle = 0;
let cinematicElapsedOffset = 0;

// ── Walk-mode state ───────────────────────────────────
// Yaw/pitch are Euler angles (YXZ order) applied to the camera each
// frame. Velocity is lerped toward a target derived from held keys so
// movement feels smooth rather than snapping on/off.
const walkKeys = new Set();
let walkYaw = 0;
let walkPitch = 0;
let walkDragging = false;
let walkLastMouseX = 0;
let walkLastMouseY = 0;
const walkVelocity = new THREE.Vector3();
const walkTargetVelocity = new THREE.Vector3();
const WALK_SPEED = 2.5;               // world units per second
const WALK_LOOK_SENSITIVITY = 0.0028; // radians per pixel of drag
const WALK_ACCEL = 9;                 // higher = snappier stops/starts

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

  // Resolve which mode the new splat should land in:
  //   walkable splat      → walk (brief: default for the church)
  //   non-walkable + walk → silently drop back to orbit
  //   anything else       → keep current mode
  if (cfg.walkable) {
    mode = 'walk';
    enterWalk(cfg);
  } else if (mode === 'walk') {
    mode = 'orbit';
    enterOrbit();
  }

  // Reset camera to the splat's preferred framing when in orbit mode.
  // Cinematic mode reads cameraRadius/cameraHeight from the current
  // config each frame and will glide the camera to the new values.
  // (Walk mode positions the camera itself inside enterWalk.)
  if (mode === 'orbit') {
    camera.position.set(
      cfg.position.x,
      cfg.position.y + cfg.cameraHeight,
      cfg.position.z + cfg.cameraRadius,
    );
    controls.update();
  }

  // Toggle label depends on the new splat's walkable-ness.
  refreshToggleLabel();

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

// Keep toggle label + hint + active-class in one place so each
// mode-entry function doesn't hand-write them independently.
// Convention (unchanged): the button shows the mode you'd switch
// TO if clicked.
function refreshToggleLabel() {
  const walkable = SPLATS[currentIndex]?.walkable === true;
  if (mode === 'orbit') {
    toggleEl.classList.remove('active');
    toggleEl.textContent = 'Cinematic';
    hintEl.textContent = 'Drag to orbit · Scroll to zoom';
  } else if (mode === 'cinematic') {
    toggleEl.classList.add('active');
    // After cinematic we go to walk on walkable splats, orbit otherwise.
    toggleEl.textContent = walkable ? 'Walk' : 'Orbit';
    hintEl.textContent = 'Cinematic mode · camera locked';
  } else if (mode === 'walk') {
    toggleEl.classList.add('active');
    toggleEl.textContent = 'Orbit';
    hintEl.textContent = 'WASD to move · Drag to look · Space/Shift for height';
  }
}

function enterCinematic(elapsed) {
  // Take the camera's current angle around the target so we don't jump.
  const dx = camera.position.x - controls.target.x;
  const dz = camera.position.z - controls.target.z;
  cinematicStartAngle = Math.atan2(dz, dx);
  cinematicElapsedOffset = elapsed;
  controls.enabled = false;
  refreshToggleLabel();
}

function enterOrbit() {
  controls.enabled = true;
  // OrbitControls re-derives spherical coords from camera vs. target
  // on update() — no explicit state sync needed.
  controls.update();
  refreshToggleLabel();
}

function enterWalk(cfg) {
  controls.enabled = false;
  // Land at the splat's default orbit pose so the user isn't
  // teleported somewhere disorienting, but face the splat's centre.
  camera.position.set(
    cfg.position.x,
    cfg.position.y + cfg.cameraHeight,
    cfg.position.z + cfg.cameraRadius,
  );
  const look = new THREE.Vector3()
    .subVectors(cfg.position, camera.position)
    .normalize();
  // Default camera forward is -Z; rotate around Y by yaw then X by
  // pitch (YXZ) — these are the angles that put -Z along `look`.
  walkYaw = Math.atan2(-look.x, -look.z);
  walkPitch = Math.asin(THREE.MathUtils.clamp(look.y, -1, 1));
  applyWalkRotation();
  walkVelocity.set(0, 0, 0);
  walkKeys.clear();
  walkDragging = false;
  refreshToggleLabel();
}

function applyWalkRotation() {
  camera.rotation.order = 'YXZ';
  camera.rotation.set(walkPitch, walkYaw, 0);
}

toggleEl.addEventListener('click', () => {
  const walkable = SPLATS[currentIndex]?.walkable === true;
  if (mode === 'orbit') {
    mode = 'cinematic';
    enterCinematic(clock.getElapsedTime());
  } else if (mode === 'cinematic') {
    if (walkable) {
      mode = 'walk';
      enterWalk(SPLATS[currentIndex]);
    } else {
      mode = 'orbit';
      enterOrbit();
    }
  } else if (mode === 'walk') {
    mode = 'orbit';
    enterOrbit();
  }
  // Drop focus so a subsequent space/enter keypress in walk mode
  // doesn't re-trigger this click handler.
  toggleEl.blur();
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

// ── Walk-mode input ───────────────────────────────────
// Listeners are always attached; they no-op unless mode === 'walk'.
// Keyed off `e.code` so `shift` doesn't uppercase the WASD keys.
function onWalkKeyDown(e) {
  if (mode !== 'walk') return;
  switch (e.code) {
    case 'KeyW': case 'KeyA': case 'KeyS': case 'KeyD':
    case 'Space': case 'ShiftLeft': case 'ShiftRight':
      walkKeys.add(e.code);
      e.preventDefault();
      break;
  }
}
function onWalkKeyUp(e) {
  walkKeys.delete(e.code);
}
window.addEventListener('keydown', onWalkKeyDown);
window.addEventListener('keyup', onWalkKeyUp);

renderer.domElement.addEventListener('mousedown', (e) => {
  if (mode !== 'walk' || e.button !== 0) return;
  walkDragging = true;
  walkLastMouseX = e.clientX;
  walkLastMouseY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!walkDragging || mode !== 'walk') return;
  const dx = e.clientX - walkLastMouseX;
  const dy = e.clientY - walkLastMouseY;
  walkLastMouseX = e.clientX;
  walkLastMouseY = e.clientY;
  walkYaw -= dx * WALK_LOOK_SENSITIVITY;
  walkPitch -= dy * WALK_LOOK_SENSITIVITY;
  // Prevent flipping at the poles.
  const lim = Math.PI / 2 - 0.01;
  walkPitch = Math.max(-lim, Math.min(lim, walkPitch));
});
window.addEventListener('mouseup', () => {
  walkDragging = false;
});

// Compose a horizontal target velocity from held keys. Forward is
// the camera's -Z projected onto the ground plane, so movement
// follows where you're facing, not arbitrary world axes. Y is a
// separate free-fly up/down axis for Space / Shift.
function computeWalkTargetVelocity() {
  const forwardX = -Math.sin(walkYaw);
  const forwardZ = -Math.cos(walkYaw);
  const rightX = Math.cos(walkYaw);
  const rightZ = -Math.sin(walkYaw);

  let tx = 0, ty = 0, tz = 0;
  if (walkKeys.has('KeyW')) { tx += forwardX; tz += forwardZ; }
  if (walkKeys.has('KeyS')) { tx -= forwardX; tz -= forwardZ; }
  if (walkKeys.has('KeyD')) { tx += rightX;   tz += rightZ;   }
  if (walkKeys.has('KeyA')) { tx -= rightX;   tz -= rightZ;   }
  if (walkKeys.has('Space'))                                    ty += 1;
  if (walkKeys.has('ShiftLeft') || walkKeys.has('ShiftRight'))  ty -= 1;

  const len = Math.hypot(tx, ty, tz);
  if (len > 0) {
    tx = (tx / len) * WALK_SPEED;
    ty = (ty / len) * WALK_SPEED;
    tz = (tz / len) * WALK_SPEED;
  }
  walkTargetVelocity.set(tx, ty, tz);
  return walkTargetVelocity;
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
  } else if (mode === 'walk') {
    const target = computeWalkTargetVelocity();
    walkVelocity.x = damp(walkVelocity.x, target.x, WALK_ACCEL, dt);
    walkVelocity.y = damp(walkVelocity.y, target.y, WALK_ACCEL, dt);
    walkVelocity.z = damp(walkVelocity.z, target.z, WALK_ACCEL, dt);
    camera.position.addScaledVector(walkVelocity, dt);
    applyWalkRotation();
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
}

// Kick off with the first splat (butterfly) — preserves the
// pre-switcher default behaviour.
setActiveSplat(0);
animate();
