// ─────────────────────────────────────────────────────────────
// Experiment 03 — Card Fan
// Five cards floating in space, fanned out as if held by an
// invisible hand. Placeholder designs (roman numerals) — swap in
// real card art via the texture functions below in a later pass.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Palette (matches experiment 01) ───────────────────
const PAL = {
  bg:        0x0e0d0b,
  charcoal:  0x1a1a1a,
  terracotta:'#c46d47',
  cool:      0x4a6fa5,
  ink:       '#ece8e0',
};

// ── Card dimensions ───────────────────────────────────
const CARD = {
  width:  1.0,
  height: 1.4,                 // 5:7 aspect (1.0 : 1.4)
  depth:  1.4 * 0.01,          // ~1% of height — real card thickness
};
const TEX_W = 512;
const TEX_H = Math.round(TEX_W * (CARD.height / CARD.width)); // keep aspect

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.bg);
scene.fog = new THREE.Fog(PAL.bg, 6, 16);

// ── Camera ────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
// Head-on, slightly raised to look down at the fan.
camera.position.set(0, 1.6, 5.4);
camera.lookAt(0, 0.2, 0);

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// ── Controls ──────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 3.5;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI / 1.9;
controls.target.set(0, 0.2, 0);

// ── Lighting (product-photography two-light setup) ────
// The card fronts are the feature, so this scene diverges from
// experiment 01's moody terracotta: high ambient floor, white key
// plus a soft white fill on the opposite side, and the familiar
// cool rim for separation against the dark ground.
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xf8f5ef, 1.2);
keyLight.position.set(3, 5, 4);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 4;
keyLight.shadow.camera.bottom = -4;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Soft fill opposite the key — lifts the shadow side of each card
// so fronts read evenly no matter where the hand tilts. No shadows
// from this one; it's there to fill, not re-carve.
const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
fillLight.position.set(-3, 4, 3);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0x4a6fa5, 0.55);
rimLight.position.set(-3, 2, -3);
scene.add(rimLight);

// ── Ground plane ──────────────────────────────────────
const groundGeo = new THREE.CircleGeometry(8, 64);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x161412,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -1.4;
ground.receiveShadow = true;
scene.add(ground);

// ─────────────────────────────────────────────────────────────
// Card textures (PLACEHOLDER — swap these out in a follow-up)
// ─────────────────────────────────────────────────────────────

// Generic canvas → CanvasTexture helper. Pass a draw(ctx, w, h)
// function — keeps individual card art focused and swappable.
function makeCardTexture(draw) {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d');
  draw(ctx, TEX_W, TEX_H);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// Shared border treatment — every card gets the same frame so the
// deck reads as a deck even with different fronts.
function paintBackground(ctx, w, h) {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, w, h);
}
function paintBorder(ctx, w, h) {
  const inset = Math.round(w * 0.06);
  ctx.strokeStyle = PAL.terracotta;
  ctx.lineWidth = Math.max(2, Math.round(w * 0.012));
  ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);

  // Thin inner accent line gives the border a bit more depth.
  const inner = inset + Math.round(w * 0.02);
  ctx.lineWidth = Math.max(1, Math.round(w * 0.004));
  ctx.strokeRect(inner, inner, w - inner * 2, h - inner * 2);
}

// Card back — shared across all five cards.
function drawBack(ctx, w, h) {
  paintBackground(ctx, w, h);
  paintBorder(ctx, w, h);

  // Single centred circle motif (placeholder — easy to elaborate later).
  const cx = w / 2;
  const cy = h / 2;
  const r  = Math.min(w, h) * 0.22;

  ctx.strokeStyle = PAL.terracotta;
  ctx.lineWidth = Math.max(2, Math.round(w * 0.008));
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

// Card front — placeholder roman numeral.
function drawFront(ctx, w, h, label) {
  paintBackground(ctx, w, h);
  paintBorder(ctx, w, h);

  ctx.fillStyle = PAL.terracotta;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `500 ${Math.round(h * 0.32)}px 'JetBrains Mono', monospace`;
  ctx.fillText(label, w / 2, h / 2);
}

// ─────────────────────────────────────────────────────────────
// Card construction
// ─────────────────────────────────────────────────────────────
//
// BoxGeometry face order: [+x, -x, +y, -y, +z, -z]
// We want the front art on +z and the back art on -z; the other four
// faces are plain charcoal so the edges read as card stock.
//
// MeshStandardMaterial is unlit-friendly under our key/rim setup and
// catches the terracotta key nicely on the front face.
const sharedBackTex = makeCardTexture(drawBack);
const edgeMaterial = new THREE.MeshStandardMaterial({
  color: PAL.charcoal,
  roughness: 0.7,
  metalness: 0.0,
});

function buildCard(label) {
  const frontTex = makeCardTexture((ctx, w, h) => drawFront(ctx, w, h, label));
  const frontMat = new THREE.MeshStandardMaterial({
    map: frontTex,
    roughness: 0.55,
    metalness: 0.0,
  });
  const backMat = new THREE.MeshStandardMaterial({
    map: sharedBackTex,
    roughness: 0.55,
    metalness: 0.0,
  });

  const geo = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth);
  const materials = [
    edgeMaterial, // +x  (right edge)
    edgeMaterial, // -x  (left edge)
    edgeMaterial, // +y  (top edge)
    edgeMaterial, // -y  (bottom edge)
    frontMat,     // +z  (front face — toward camera)
    backMat,      // -z  (back face)
  ];
  const mesh = new THREE.Mesh(geo, materials);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ─────────────────────────────────────────────────────────────
// Fan layout
// ─────────────────────────────────────────────────────────────
//
// The hand is parented to a `handGroup` so idle sway and tilt
// move all five cards together without disturbing per-card targets.
const handGroup = new THREE.Group();
scene.add(handGroup);

const CARD_COUNT = 5;
// Fan like a real hand: all cards share a pinch point at their
// bottom edge and splay upward and outward.
const FAN_ANGLE = THREE.MathUtils.degToRad(48); // total spread
// Pinch point Y within handGroup — cards extend upward from here.
const PINCH_Y = -0.5;
// Tiny z step so stacked cards at the shared pinch don't z-fight.
const Z_STACK = CARD.depth * 1.05;
const cards = [];        // outer pivoted groups (anim target objects)
const cardMeshes = [];   // inner meshes — what the raycaster sees

const labels = ['I', 'II', 'III', 'IV', 'V'];
for (let i = 0; i < CARD_COUNT; i++) {
  const mesh = buildCard(labels[i]);
  // Bottom-edge pivot: shift the mesh up by half its height inside
  // its outer group so the group's origin sits at the card's bottom
  // edge. Fan rotations on the group now swing the card top outward
  // around the bottom, as if held between the fingers.
  mesh.position.y = CARD.height / 2;
  mesh.userData.index = i; // raycast results map back to a card via this
  cardMeshes.push(mesh);

  const group = new THREE.Group();
  group.add(mesh);

  // Per-card animated state. `home*` is the resting fan pose;
  // `current*` (x/y/z/rot*) is what we actually render (lerped
  // toward targets each frame).
  const t = (i - (CARD_COUNT - 1) / 2) / ((CARD_COUNT - 1) / 2); // -1..+1
  const homeRotZ = -t * (FAN_ANGLE / 2);
  const homeX = 0;
  const homeY = PINCH_Y;
  const homeZ = i * Z_STACK;

  group.userData = {
    index: i,
    mesh,
    homeX, homeY, homeZ,
    homeRotZ,
    // Off-screen entry — from below and the side the card will land on.
    startX: homeX + t * 2.5 + (Math.random() - 0.5) * 0.4,
    startY: homeY - 4.5,
    startZ: homeZ - 1.5,
    startRotZ: homeRotZ + (Math.random() - 0.5) * 1.2,
    // Per-card animated values (what get lerped each frame).
    x: 0, y: 0, z: 0, rotX: 0, rotZ: 0,
    // Spin is applied to the inner mesh (around the card's own
    // vertical centreline), not the group (whose Y axis sits at the
    // bottom edge). `spinTarget` accumulates by 4π on every hover
    // enter and every hover exit, so rest is always a multiple of
    // 2π and the card always spins forward.
    spin: 0, spinTarget: 0, wantHoverPrev: 0,
    // Targets — folded from home + hover lift + neighbour effects.
    targetX: homeX, targetY: homeY, targetZ: homeZ,
    targetRotX: 0, targetRotZ: homeRotZ,
    // Per-card stagger so they don't land in unison.
    introDelay: i * 0.12,
    introProgress: 0,
    hoverStrength: 0,
  };

  // Start off-screen.
  group.position.set(group.userData.startX, group.userData.startY, group.userData.startZ);
  group.rotation.set(0, 0, group.userData.startRotZ);
  group.userData.x = group.userData.startX;
  group.userData.y = group.userData.startY;
  group.userData.z = group.userData.startZ;
  group.userData.rotZ = group.userData.startRotZ;

  handGroup.add(group);
  cards.push(group);
}

// ─────────────────────────────────────────────────────────────
// Hover interaction
// ─────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoveredIndex = -1;

window.addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('pointerleave', () => {
  pointer.set(-10, -10); // park off-screen so nothing intersects
});

function updateHover() {
  raycaster.setFromCamera(pointer, camera);
  // Raycast against the inner meshes (the outer groups are empty-
  // volume pivots). Each mesh carries its card index in userData.
  const hits = raycaster.intersectObjects(cardMeshes, false);
  hoveredIndex = hits.length ? hits[0].object.userData.index : -1;
}

// ─────────────────────────────────────────────────────────────
// Easing helpers
// ─────────────────────────────────────────────────────────────

// Frame-rate-independent damped lerp. Higher `rate` = snappier.
// dt in seconds. Idiom: lerp_t = 1 - exp(-rate * dt).
function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

// Smooth ease for the intro flight (ease-out cubic).
function easeOutCubic(x) {
  const c = 1 - x;
  return 1 - c * c * c;
}

// ─────────────────────────────────────────────────────────────
// Resize & animate
// ─────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05); // cap to avoid post-tab-switch jumps
  const elapsed = clock.getElapsedTime();

  updateHover();

  // ── Per-card targets: home pose + hover lift + neighbour spread ──
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const u = c.userData;

    // Hover strength eases in/out smoothly per-card.
    const wantHover = (i === hoveredIndex) ? 1 : 0;
    u.hoverStrength = damp(u.hoverStrength, wantHover, 10, dt);

    // Spin: accumulate one full rotation (2π) on every enter and
    // every exit transition — forward in both directions so it
    // reads as a card flourish. spinTarget is always a multiple of
    // 2π, so the card always settles face-forward.
    if (wantHover !== u.wantHoverPrev) {
      u.spinTarget += Math.PI * 2;
      u.wantHoverPrev = wantHover;
    }

    // Neighbour spread — angular fan-out plus a small z pullback,
    // both scaled by 1/dist from the hovered card. Immediate
    // neighbours move the most; distant cards barely notice.
    let neighbourAngle = 0;
    let neighbourZ = 0;
    if (hoveredIndex >= 0 && i !== hoveredIndex) {
      const sign = Math.sign(i - hoveredIndex);
      const dist = Math.abs(i - hoveredIndex);
      // ~12.6° extra splay for an adjacent neighbour — roughly
      // double the old X-push and now correctly angular.
      neighbourAngle = sign * (0.22 / dist);
      // Depth pullback so even aggressive hover lifts can't clip.
      neighbourZ = -0.35 / dist;
    }

    u.targetX   = u.homeX;
    u.targetY   = u.homeY + u.hoverStrength * 0.25;
    u.targetZ   = u.homeZ + u.hoverStrength * 0.6 + neighbourZ;
    // Hovered card un-rotates (faces viewer) and tilts back slightly;
    // neighbours rotate extra outward along the fan.
    u.targetRotZ = u.homeRotZ * (1 - u.hoverStrength * 0.7) + neighbourAngle;
    u.targetRotX = -u.hoverStrength * 0.25;
  }

  // ── Apply intro flight, then damped settle ──
  for (const c of cards) {
    const u = c.userData;

    // Intro: drive a 0→1 progress with stagger and ease.
    if (u.introProgress < 1) {
      const local = Math.max(0, elapsed - u.introDelay);
      const raw = Math.min(1, local / 1.1); // 1.1s flight per card
      u.introProgress = easeOutCubic(raw);
    }
    const p = u.introProgress;

    // Blended target: while flying in, target is the home pose; after
    // arrival, hover/neighbour adjustments take over via the same target.
    const tx = THREE.MathUtils.lerp(u.startX, u.targetX, p);
    const ty = THREE.MathUtils.lerp(u.startY, u.targetY, p);
    const tz = THREE.MathUtils.lerp(u.startZ, u.targetZ, p);
    const trZ = THREE.MathUtils.lerp(u.startRotZ, u.targetRotZ, p);

    // Damped follow — feels physical, no linear interpolation.
    const rate = p < 1 ? 14 : 9;
    u.x = damp(u.x, tx, rate, dt);
    u.y = damp(u.y, ty, rate, dt);
    u.z = damp(u.z, tz, rate, dt);
    u.rotX = damp(u.rotX, u.targetRotX * p, rate, dt);
    u.rotZ = damp(u.rotZ, trZ, rate, dt);
    // Spin eases slower than the lift so it reads as a deliberate
    // flourish rather than a tornado — and the lift/spread land
    // visibly before the spin finishes.
    u.spin = damp(u.spin, u.spinTarget, 4, dt);

    // Group carries position + fan tilt; inner mesh carries the
    // spin around the card's own vertical centreline (not the
    // group's vertical, which passes through the bottom edge).
    c.position.set(u.x, u.y, u.z);
    c.rotation.set(u.rotX, 0, u.rotZ);
    u.mesh.rotation.y = u.spin;
  }

  // ── Idle hand sway: applies to whole group, after all cards are home ──
  const settled = cards[cards.length - 1].userData.introProgress;
  const sway = settled; // 0 during intro, 1 once last card has landed
  handGroup.position.y = sway * Math.sin(elapsed * 0.7) * 0.04;
  handGroup.rotation.z = sway * Math.sin(elapsed * 0.5) * 0.03;
  handGroup.rotation.x = sway * Math.sin(elapsed * 0.4 + 1.0) * 0.025;
  handGroup.rotation.y = sway * Math.sin(elapsed * 0.3 + 0.6) * 0.05;

  controls.update();
  renderer.render(scene, camera);
}

animate();
