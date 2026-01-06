import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();

export async function loadShipModel(modelFile, scale) {
  const cacheKey = `${modelFile}_${scale}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey).clone();
  }

  const path = new URL(`../assets/models/${modelFile}`, import.meta.url).href;

  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (gltf) => {
        const model = gltf.scene;

      // Rotate model so its forward matches Three.js +Z
      model.rotation.y = Math.PI / 2;
        model.scale.setScalar(scale);

        const container = new THREE.Group();
        container.add(model);

        cache.set(cacheKey, container);
        resolve(container.clone());
      },
      undefined,
      reject
    );
  });
}

export function applyFactionMaterial(model, faction) {
  // Intentionally no-op to preserve original textures.
}
