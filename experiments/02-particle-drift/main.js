// ─────────────────────────────────────────────────────────────
// Experiment 02 — Particle Drift
// A few thousand softly-glowing motes in dark cinematic space,
// each on its own slow orbit. Dark base + terracotta warmth,
// with a cool rim so the cloud reads as volume, not a flat fog.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ── Scene ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0d0b);
scene.fog = new THREE.FogExp2(0x0e0d0b, 0.035);

// ── Camera ────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(0, 2, 14);

// ── Renderer ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.body.appendChild(renderer.domElement);

// ── Controls ──────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 6;
controls.maxDistance = 40;
controls.target.set(0, 0, 0);

// ── Particle field ────────────────────────────────────
// Each particle gets a home radius, azimuth, elevation, and an
// individual angular speed. The vertex shader advances the
// azimuth over time so every mote rides its own lazy orbit.
const PARTICLE_COUNT = 4000;

const positions = new Float32Array(PARTICLE_COUNT * 3); // seed radius/azimuth/elevation
const speeds = new Float32Array(PARTICLE_COUNT);
const sizes = new Float32Array(PARTICLE_COUNT);
const tints = new Float32Array(PARTICLE_COUNT); // 0 = cool rim, 1 = warm terracotta

// Palette mirrors the floating monolith experiment.
const warmColor = new THREE.Color(0xc46d47); // terracotta key
const coolColor = new THREE.Color(0x4a6fa5); // rim blue

for (let i = 0; i < PARTICLE_COUNT; i++) {
  // Biased toward a mid radius so the cloud feels like a volume,
  // not a shell or a solid blob.
  const radius = 2.5 + Math.pow(Math.random(), 0.7) * 9.5;
  const azimuth = Math.random() * Math.PI * 2;
  // Flatten the elevation a bit — drifts read more cinematically
  // when the cloud is wider than it is tall.
  const elevation = (Math.random() - 0.5) * Math.PI * 0.55;

  positions[i * 3 + 0] = radius;
  positions[i * 3 + 1] = azimuth;
  positions[i * 3 + 2] = elevation;

  // Inner particles orbit faster, outer ones crawl — feels gravitational.
  speeds[i] = (0.05 + Math.random() * 0.12) * (1.0 / (0.4 + radius * 0.12));

  sizes[i] = 6 + Math.random() * 18;
  tints[i] = Math.pow(Math.random(), 1.6); // mostly cool, occasional warm pop
}

const geometry = new THREE.BufferGeometry();
geometry.setAttribute('aSeed', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 1));

const material = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
    uWarm: { value: warmColor },
    uCool: { value: coolColor },
    uFogColor: { value: new THREE.Color(0x0e0d0b) },
    uFogDensity: { value: 0.035 },
  },
  vertexShader: `
    attribute vec3 aSeed;    // x = radius, y = azimuth, z = elevation
    attribute float aSpeed;
    attribute float aSize;
    attribute float aTint;

    uniform float uTime;
    uniform float uPixelRatio;

    varying float vTint;
    varying float vFogDepth;
    varying float vTwinkle;

    void main() {
      float radius = aSeed.x;
      float azimuth = aSeed.y + uTime * aSpeed;
      float elevation = aSeed.z;

      // Tiny vertical breathing so particles don't sit on rigid rings.
      float wobble = sin(uTime * 0.35 + aSeed.y * 4.0) * 0.25;
      float y = sin(elevation) * radius + wobble;
      float r = cos(elevation) * radius;
      float x = cos(azimuth) * r;
      float z = sin(azimuth) * r;

      vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      // Size attenuates with distance so far motes read as specks.
      gl_PointSize = aSize * uPixelRatio * (1.0 / -mvPosition.z);

      vTint = aTint;
      vFogDepth = -mvPosition.z;
      // Per-particle twinkle keeps the cloud alive when the camera is still.
      vTwinkle = 0.75 + 0.25 * sin(uTime * 1.3 + aSeed.y * 9.0 + aSeed.x);
    }
  `,
  fragmentShader: `
    uniform vec3 uWarm;
    uniform vec3 uCool;
    uniform vec3 uFogColor;
    uniform float uFogDensity;

    varying float vTint;
    varying float vFogDepth;
    varying float vTwinkle;

    void main() {
      // Soft round sprite — quadratic falloff from the center.
      vec2 uv = gl_PointCoord - 0.5;
      float d = length(uv);
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.0, d);
      // Bright hot core keeps particles from looking like flat discs.
      alpha = pow(alpha, 1.6);

      vec3 color = mix(uCool, uWarm, vTint);
      color *= vTwinkle;

      // Match the scene's exp² fog so particles melt into the dark.
      float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
      color = mix(color, uFogColor, fogFactor);

      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(geometry, material);
scene.add(particles);

// ── A faint central glow ──────────────────────────────
// Gives the orbits something to wrap around visually.
const coreGeo = new THREE.SphereGeometry(0.35, 24, 24);
const coreMat = new THREE.MeshBasicMaterial({
  color: 0xc46d47,
  transparent: true,
  opacity: 0.35,
});
const core = new THREE.Mesh(coreGeo, coreMat);
scene.add(core);

// ── Resize handling ───────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
});

// ── Animate ───────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  material.uniforms.uTime.value = elapsed;

  // Very slow whole-field tilt so the cloud never feels locked to axes.
  particles.rotation.y = elapsed * 0.02;
  particles.rotation.x = Math.sin(elapsed * 0.05) * 0.08;

  core.scale.setScalar(1.0 + Math.sin(elapsed * 0.8) * 0.08);

  controls.update();
  renderer.render(scene, camera);
}

animate();
