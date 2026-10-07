const GRADIENT_STOPS = [
  [0.34, 0.3, 0.42],
  [0.52, 0.48, 0.6],
  [0.78, 0.75, 0.88],
  [1.0, 0.98, 1.0]
];

const toonCache = new WeakMap();
let gradientCache = null;

export function getToonGradient(THREE) {
  if (gradientCache) return gradientCache;
  const size = GRADIENT_STOPS.length;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const stop = GRADIENT_STOPS[i];
    data[i * 4] = Math.round(stop[0] * 255);
    data[i * 4 + 1] = Math.round(stop[1] * 255);
    data[i * 4 + 2] = Math.round(stop[2] * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  gradientCache = tex;
  return tex;
}

export function toonifyMaterial(THREE, mat) {
  if (!mat || mat.isMeshToonMaterial || !mat.isMeshStandardMaterial) return mat;
  if (toonCache.has(mat)) return mat;
  const toon = new THREE.MeshToonMaterial({
    color: mat.color,
    map: mat.map,
    emissive: mat.emissive,
    emissiveIntensity: mat.emissiveIntensity,
    emissiveMap: mat.emissiveMap,
    transparent: mat.transparent,
    opacity: mat.opacity,
    side: mat.side,
    alphaMap: mat.alphaMap,
    alphaTest: mat.alphaTest,
    depthWrite: mat.depthWrite,
    depthTest: mat.depthTest
  });
  toon.gradientMap = getToonGradient(THREE);
  Object.assign(mat, toon);
  mat.isMeshStandardMaterial = false;
  mat.isMeshToonMaterial = true;
  mat.needsUpdate = true;
  toonCache.set(mat, true);
  return mat;
}

export function toonifyScene(THREE, scene) {
  scene.traverse((obj) => {
    if (!obj.isMesh) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (let i = 0; i < mats.length; i++) {
      toonifyMaterial(THREE, mats[i]);
    }
  });
}
