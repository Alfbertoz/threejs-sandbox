// ─────────────────────────────────────────────────────────────
// Experiment 01 — Floating Monolith
// A slow-turning obelisk under moody lighting.
// Proves the stack works end to end.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0d0b);
scene.fog = new THREE.Fog(0x0e0d0b, 8, 24);

// ── Camera ────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(4, 3, 6);

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
controls.minDistance = 4;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI / 1.8;
controls.target.set(0, 1, 0);

// ── The monolith ──────────────────────────────────────
const monolithGeo = new THREE.BoxGeometry(0.8, 3.2, 0.4);
const monolithMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a1a,
  roughness: 0.15,
  metalness: 0.85,
});
const monolith = new THREE.Mesh(monolithGeo, monolithMat);
monolith.position.y = 1.6;
monolith.castShadow = true;
monolith.receiveShadow = true;
scene.add(monolith);

// Subtle rim light edges (glowing ribbon around the top)
const ribbonGeo = new THREE.BoxGeometry(0.82, 0.03, 0.42);
const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xc46d47 });
const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
ribbon.position.y = 3.0;
scene.add(ribbon);

// ── Ground plane ──────────────────────────────────────
const groundGeo = new THREE.CircleGeometry(12, 64);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x161412,
  roughness: 0.9,
  metalness: 0.1,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ── Lighting ──────────────────────────────────────────
// Low fill to keep shadows moody but readable
const ambient = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambient);

// Key light — warm terracotta tone, simulates a setting sun
const keyLight = new THREE.DirectionalLight(0xc46d47, 1.6);
keyLight.position.set(4, 6, 3);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 30;
keyLight.shadow.camera.left = -6;
keyLight.shadow.camera.right = 6;
keyLight.shadow.camera.top = 6;
keyLight.shadow.camera.bottom = -6;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);

// Rim light — cool blue from behind, separates monolith from background
const rimLight = new THREE.DirectionalLight(0x4a6fa5, 0.6);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

// ── Resize handling ───────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Animate ───────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Slow rotation + gentle float
  monolith.rotation.y = elapsed * 0.15;
  monolith.position.y = 1.6 + Math.sin(elapsed * 0.6) * 0.08;

  ribbon.rotation.y = monolith.rotation.y;
  ribbon.position.y = 3.0 + Math.sin(elapsed * 0.6) * 0.08;

  controls.update();
  renderer.render(scene, camera);
}

animate();
