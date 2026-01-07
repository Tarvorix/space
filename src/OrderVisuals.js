import * as THREE from 'three';
import { ORDER_TYPES } from './Ship.js';

/**
 * Manages visual indicators for ship orders (orbit rings, waypoints, etc.)
 */
export class OrderVisuals {
  constructor(scene) {
    this.scene = scene;

    // Orbit ring for dragging
    this.orbitRing = null;
    this.orbitRingLabel = null;

    // Active order indicators per ship
    this.activeIndicators = new Map();

    this._createOrbitRing();
  }

  _createOrbitRing() {
    // Create a ring geometry for orbit preview
    const geometry = new THREE.RingGeometry(1, 1.1, 64);
    const material = new THREE.MeshBasicMaterial({
      color: 0x44ff44,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });

    this.orbitRing = new THREE.Mesh(geometry, material);
    this.orbitRing.rotation.x = -Math.PI / 2; // Lay flat
    this.orbitRing.visible = false;
    this.scene.add(this.orbitRing);

    // Create distance label sprite
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    this.labelCanvas = canvas;
    this.labelContext = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    this.orbitRingLabel = new THREE.Sprite(spriteMaterial);
    this.orbitRingLabel.scale.set(4, 2, 1);
    this.orbitRingLabel.visible = false;
    this.scene.add(this.orbitRingLabel);
  }

  _updateLabelText(distance) {
    const ctx = this.labelContext;
    ctx.clearRect(0, 0, 128, 64);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, 128, 64);
    ctx.fillStyle = '#44ff44';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${distance.toFixed(0)}`, 64, 32);

    this.orbitRingLabel.material.map.needsUpdate = true;
  }

  /**
   * Show orbit ring preview while dragging
   */
  showOrbitPreview(targetPosition, radius) {
    // Update ring geometry
    this.orbitRing.geometry.dispose();
    this.orbitRing.geometry = new THREE.RingGeometry(radius - 0.3, radius + 0.3, 64);
    this.orbitRing.position.copy(targetPosition);
    this.orbitRing.visible = true;

    // Update label
    this._updateLabelText(radius);
    this.orbitRingLabel.position.copy(targetPosition);
    this.orbitRingLabel.position.y += 3;
    this.orbitRingLabel.visible = true;
  }

  /**
   * Hide orbit ring preview
   */
  hideOrbitPreview() {
    this.orbitRing.visible = false;
    this.orbitRingLabel.visible = false;
  }

  /**
   * Update visuals for a ship's active order
   */
  updateShipOrderVisual(ship) {
    const order = ship.currentOrder;

    // Get or create indicator for this ship
    let indicator = this.activeIndicators.get(ship);

    if (order.type === ORDER_TYPES.ORBIT && order.target) {
      if (!indicator) {
        indicator = this._createOrderIndicator(ship.faction);
        this.activeIndicators.set(ship, indicator);
      }

      // Update orbit ring position and size
      indicator.ring.geometry.dispose();
      indicator.ring.geometry = new THREE.RingGeometry(
        order.range - 0.2,
        order.range + 0.2,
        64
      );
      indicator.ring.position.copy(order.target.position);
      indicator.ring.visible = true;
    } else if (indicator) {
      // No orbit order - hide indicator
      indicator.ring.visible = false;
    }
  }

  _createOrderIndicator(faction) {
    const color = faction === 'imperial' ? 0x4488ff : 0xff4444;
    const geometry = new THREE.RingGeometry(1, 1.1, 64);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });

    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = -Math.PI / 2;
    ring.visible = false;
    this.scene.add(ring);

    return { ring };
  }

  /**
   * Clean up indicator for destroyed ship
   */
  removeShipIndicator(ship) {
    const indicator = this.activeIndicators.get(ship);
    if (indicator) {
      this.scene.remove(indicator.ring);
      indicator.ring.geometry.dispose();
      indicator.ring.material.dispose();
      this.activeIndicators.delete(ship);
    }
  }

  /**
   * Update all active order visuals
   */
  updateAll(ships) {
    for (const ship of ships) {
      if (!ship.isDestroyed) {
        this.updateShipOrderVisual(ship);
      }
    }
  }

  dispose() {
    this.scene.remove(this.orbitRing);
    this.orbitRing.geometry.dispose();
    this.orbitRing.material.dispose();

    this.scene.remove(this.orbitRingLabel);
    this.orbitRingLabel.material.map.dispose();
    this.orbitRingLabel.material.dispose();

    for (const indicator of this.activeIndicators.values()) {
      this.scene.remove(indicator.ring);
      indicator.ring.geometry.dispose();
      indicator.ring.material.dispose();
    }
    this.activeIndicators.clear();
  }
}
