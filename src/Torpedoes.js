import * as THREE from 'three';
import { applyTorpedoHits } from './Combat.js';

export class TorpedoManager {
  constructor(scene) {
    this.scene = scene;
    this.salvos = [];
  }

  launch(attacker, weapon, strength) {
    if (strength <= 0) return;

    const dir = attacker.getForward();
    const start = attacker.position.clone().add(dir.clone().multiplyScalar(attacker.collisionRadius + 1));
    const mesh = createTorpedoMesh();
    mesh.position.copy(start);
    mesh.quaternion.copy(attacker.quaternion);
    this.scene.add(mesh);

    this.salvos.push({
      position: start,
      direction: dir.clone(),
      speed: weapon.speed || 15,
      strength,
      owner: attacker,
      mesh,
    });
  }

  advanceAndResolve(ships, dt, turnDuration) {
    const results = [];
    const remaining = [];

    for (const salvo of this.salvos) {
      const move = salvo.direction.clone().multiplyScalar(salvo.speed * (dt / turnDuration));
      salvo.position.add(move);
      salvo.mesh.position.copy(salvo.position);

      let hitSomething = false;

      for (const ship of ships) {
        if (ship === salvo.owner || ship.isDestroyed) continue;
        if (salvo.position.distanceTo(ship.position) > ship.collisionRadius) continue;

        const damage = resolveTorpedoHit(ship, salvo.strength);
        results.push({
          ship: ship.stats.name,
          strength: salvo.strength,
          damage,
        });
        hitSomething = true;
        break;
      }

      if (!hitSomething) {
        remaining.push(salvo);
      } else {
        this.scene.remove(salvo.mesh);
        salvo.mesh.geometry.dispose();
        salvo.mesh.material.dispose();
      }
    }

    this.salvos = remaining;
    return results;
  }
}

function resolveTorpedoHit(ship, strength) {
  let destroyed = 0;
  const turretDice = ship.getEffectiveTurrets();

  for (let i = 0; i < turretDice; i++) {
    if (Math.floor(Math.random() * 6) + 1 >= 4) {
      destroyed += 1;
    }
  }

  const remaining = Math.max(0, strength - destroyed);
  if (remaining <= 0) {
    return { hits: 0, destroyedByTurrets: destroyed, hullDamage: 0, criticals: [] };
  }

  const damage = applyTorpedoHits(ship, remaining);
  return { hits: remaining, destroyedByTurrets: destroyed, ...damage };
}

function createTorpedoMesh() {
  const geometry = new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6);
  const material = new THREE.MeshBasicMaterial({ color: 0xcccccc });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
