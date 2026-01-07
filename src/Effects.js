import * as THREE from 'three';

export function createWeaponLine(scene, from, to, color = 0xff4444) {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
  });

  const geometry = new THREE.BufferGeometry().setFromPoints([
    from.clone(),
    to.clone(),
  ]);

  const line = new THREE.Line(geometry, material);
  scene.add(line);

  const startTime = performance.now();
  const duration = 500;

  function animate() {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    material.opacity = 1 - t;

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(line);
      geometry.dispose();
      material.dispose();
    }
  }

  animate();
}

export function createExplosion(scene, position, size = 3) {
  const geometry = new THREE.SphereGeometry(size, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 1,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  scene.add(mesh);

  const startTime = performance.now();
  const duration = 1000;

  function animate() {
    const t = Math.min(1, (performance.now() - startTime) / duration);
    material.opacity = 1 - t;
    mesh.scale.setScalar(1 + t * 2);

    if (t < 1) {
      requestAnimationFrame(animate);
    } else {
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
    }
  }

  animate();
}
