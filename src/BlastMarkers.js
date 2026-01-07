import * as THREE from 'three';

export class BlastMarkerManager {
  constructor(scene) {
    this.scene = scene;
    this.markers = [];
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      transparent: true,
      opacity: 0.6,
    });
  }

  addMarkersAtPosition(position, count) {
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.4, 8, 8);
      const mesh = new THREE.Mesh(geometry, this.material.clone());
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2,
        (Math.random() - 0.5) * 1.2
      );
      mesh.position.copy(position).add(offset);
      this.scene.add(mesh);
      this.markers.push({ mesh, position: mesh.position });
    }
  }

  updateShipBlastMarkers(ship) {
    let count = 0;
    for (const marker of this.markers) {
      if (marker.position.distanceTo(ship.position) <= ship.collisionRadius) {
        count += 1;
      }
    }
    ship.blastMarkersInContact = count;
  }

  isLineObstructed(start, end) {
    const threshold = 0.9;
    for (const marker of this.markers) {
      if (distanceToSegment(marker.position, start, end) <= threshold) {
        return true;
      }
    }
    return false;
  }

  endPhaseRemoval(ships) {
    const removable = this.markers.filter((marker) => {
      return !ships.some(
        (ship) => marker.position.distanceTo(ship.position) <= ship.collisionRadius
      );
    });

    const removeCount = Math.min(removable.length, rollD6());
    for (let i = 0; i < removeCount; i++) {
      const marker = removable[i];
      this.scene.remove(marker.mesh);
      marker.mesh.geometry.dispose();
      marker.mesh.material.dispose();
      const index = this.markers.indexOf(marker);
      if (index >= 0) this.markers.splice(index, 1);
    }
  }
}

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function distanceToSegment(point, start, end) {
  const seg = end.clone().sub(start);
  const lenSq = seg.lengthSq();
  if (lenSq === 0) return point.distanceTo(start);

  const t = Math.max(0, Math.min(1, point.clone().sub(start).dot(seg) / lenSq));
  const projection = start.clone().add(seg.multiplyScalar(t));
  return point.distanceTo(projection);
}
