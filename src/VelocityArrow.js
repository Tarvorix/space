import * as THREE from 'three';

export function createVelocityArrow(color = 0x00ff00) {
  return new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, 0),
    1,
    color,
    0.5,
    0.3
  );
}

export function updateVelocityArrow(arrow, ship) {
  arrow.position.copy(ship.position);

  if (ship.speed > 0.1) {
    const dir = ship.velocity.clone().normalize();
    arrow.setDirection(dir);
    arrow.setLength(ship.speed, 0.5, 0.3);
    arrow.visible = true;
  } else {
    arrow.visible = false;
  }
}
