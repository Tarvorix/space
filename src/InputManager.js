import * as THREE from 'three';

const DRAG_MAX_PX = 160;
const DRAG_DEADZONE = 4;

export class InputManager {
  constructor(sceneData, getSelectedShip, setSelectedShip, getAllShips) {
    this.sceneData = sceneData;
    this.getSelectedShip = getSelectedShip;
    this.setSelectedShip = setSelectedShip;
    this.getAllShips = getAllShips;

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    // Drag state
    this.dragState = {
      active: false,
      ship: null,
      startX: 0,
      startY: 0,
      pointerId: null,
    };

    // Keyboard state
    this.keys = {
      forward: false,  // W or ArrowUp
      back: false,     // S or ArrowDown
      left: false,     // A or ArrowLeft
      right: false,    // D or ArrowRight
      up: false,       // Q or Space
      down: false,     // E or Shift
    };

    // Control state (replaces UI.controlState)
    this.elevation = 0;
    this.faceMode = false;

    // Virtual joystick state
    this.joystick = {
      active: false,
      element: null,
      knob: null,
      startX: 0,
      startY: 0,
      currentX: 0,
      currentY: 0,
      pointerId: null,
    };

    // Callbacks
    this.onTargetSet = null;

    this._setupEventListeners();
    this._createVirtualJoystick();
  }

  _setupEventListeners() {
    const canvas = this.sceneData.renderer.domElement;

    // Pointer events for drag control
    canvas.addEventListener('pointerdown', this._onPointerDown.bind(this));
    canvas.addEventListener('pointermove', this._onPointerMove.bind(this));
    canvas.addEventListener('pointerup', this._onPointerUp.bind(this));
    canvas.addEventListener('pointercancel', this._onPointerUp.bind(this));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Keyboard events
    window.addEventListener('keydown', this._onKeyDown.bind(this));
    window.addEventListener('keyup', this._onKeyUp.bind(this));

    // Prevent canvas from capturing all touches when using joystick
    canvas.style.touchAction = 'none';
  }

  _createVirtualJoystick() {
    // Only show on touch devices
    if (!('ontouchstart' in window)) return;

    const container = document.createElement('div');
    container.id = 'virtual-joystick';
    container.innerHTML = `
      <style>
        #virtual-joystick {
          position: fixed;
          right: 20px;
          bottom: 20px;
          width: 120px;
          height: 120px;
          z-index: 100;
          touch-action: none;
        }
        #joystick-base {
          position: absolute;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          border: 2px solid rgba(255,255,255,0.3);
        }
        #joystick-knob {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(100,150,255,0.6);
          border: 2px solid rgba(100,150,255,0.9);
          left: 35px;
          top: 35px;
          transition: none;
        }
        #joystick-label {
          position: absolute;
          bottom: -20px;
          width: 100%;
          text-align: center;
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          font-family: monospace;
        }
      </style>
      <div id="joystick-base"></div>
      <div id="joystick-knob"></div>
      <div id="joystick-label">THRUST</div>
    `;

    document.body.appendChild(container);

    this.joystick.element = container;
    this.joystick.knob = container.querySelector('#joystick-knob');
    const base = container.querySelector('#joystick-base');

    base.addEventListener('pointerdown', this._onJoystickStart.bind(this));
    window.addEventListener('pointermove', this._onJoystickMove.bind(this));
    window.addEventListener('pointerup', this._onJoystickEnd.bind(this));
    window.addEventListener('pointercancel', this._onJoystickEnd.bind(this));
  }

  _onJoystickStart(event) {
    event.preventDefault();
    event.stopPropagation();

    const rect = this.joystick.element.getBoundingClientRect();
    this.joystick.active = true;
    this.joystick.pointerId = event.pointerId;
    this.joystick.startX = rect.left + rect.width / 2;
    this.joystick.startY = rect.top + rect.height / 2;
    this.joystick.currentX = event.clientX;
    this.joystick.currentY = event.clientY;

    this._updateJoystickVisual();
  }

  _onJoystickMove(event) {
    if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;

    this.joystick.currentX = event.clientX;
    this.joystick.currentY = event.clientY;
    this._updateJoystickVisual();
  }

  _onJoystickEnd(event) {
    if (event.pointerId !== this.joystick.pointerId) return;

    this.joystick.active = false;
    this.joystick.pointerId = null;

    // Reset knob position
    if (this.joystick.knob) {
      this.joystick.knob.style.left = '35px';
      this.joystick.knob.style.top = '35px';
    }

    // Clear ship thrust
    const ship = this.getSelectedShip();
    if (ship) {
      ship.thrustPower = 0;
    }
  }

  _updateJoystickVisual() {
    if (!this.joystick.knob) return;

    const dx = this.joystick.currentX - this.joystick.startX;
    const dy = this.joystick.currentY - this.joystick.startY;
    const maxRadius = 35;

    const dist = Math.min(maxRadius, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);

    const knobX = 35 + Math.cos(angle) * dist;
    const knobY = 35 + Math.sin(angle) * dist;

    this.joystick.knob.style.left = `${knobX}px`;
    this.joystick.knob.style.top = `${knobY}px`;
  }

  _onPointerDown(event) {
    const hitShip = this._pickShip(event);

    if (hitShip) {
      const selectedShip = this.getSelectedShip();

      // Click on enemy = set target
      if (selectedShip && hitShip.faction !== selectedShip.faction) {
        selectedShip.target = hitShip;
        if (this.onTargetSet) this.onTargetSet(hitShip);
        return;
      }

      // Click on friendly = select it
      this.setSelectedShip(hitShip);

      // Start drag for ship control
      this.dragState.active = true;
      this.dragState.ship = hitShip;
      this.dragState.startX = event.clientX;
      this.dragState.startY = event.clientY;
      this.dragState.pointerId = event.pointerId;

      // Disable OrbitControls during ship drag
      this.sceneData.controls.enabled = false;

      this._updateDragCommand(event);
    }
    // If no ship hit, OrbitControls handles camera movement naturally
  }

  _onPointerMove(event) {
    if (!this.dragState.active) return;
    if (event.pointerId !== this.dragState.pointerId) return;

    this._updateDragCommand(event);
  }

  _onPointerUp(event) {
    if (event.pointerId !== this.dragState.pointerId) return;

    this.dragState.active = false;
    this.dragState.ship = null;
    this.dragState.pointerId = null;

    // Re-enable OrbitControls
    this.sceneData.controls.enabled = true;
  }

  _pickShip(event) {
    const rect = this.sceneData.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.sceneData.camera);

    const meshes = [];
    for (const ship of this.getAllShips()) {
      if (ship.mesh) meshes.push(ship.mesh);
      if (ship.ring) meshes.push(ship.ring);
    }

    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length === 0) return null;

    const hit = hits[0].object;
    return hit.userData.ship || hit.parent?.userData.ship || null;
  }

  _updateDragCommand(event) {
    const ship = this.dragState.ship;
    if (!ship) return;

    const rect = this.sceneData.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.sceneData.camera);

    // Create plane perpendicular to camera at ship position
    const planeNormal = new THREE.Vector3();
    this.sceneData.camera.getWorldDirection(planeNormal);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(planeNormal, ship.position);
    const intersection = new THREE.Vector3();

    if (!this.raycaster.ray.intersectPlane(plane, intersection)) return;

    const dragDir = intersection.clone().sub(ship.position);
    const dirLength = dragDir.length();
    if (dirLength < 0.001) return;
    dragDir.normalize();

    // Add elevation component
    const up = new THREE.Vector3(0, 1, 0).multiplyScalar(this.elevation);
    const combined = dragDir.add(up);
    if (combined.lengthSq() > 0.0001) {
      combined.normalize();
    }

    // Calculate power based on drag distance
    const dragPx = Math.hypot(
      event.clientX - this.dragState.startX,
      event.clientY - this.dragState.startY
    );

    if (dragPx < DRAG_DEADZONE) return;

    const power = Math.min(1, dragPx / DRAG_MAX_PX);

    if (this.faceMode) {
      ship.desiredFacingDir = combined.lengthSq() > 0.0001 ? combined.clone() : null;
    } else {
      ship.desiredThrustDir.copy(combined);
      ship.thrustPower = power > 0.02 ? power : 0;
    }
  }

  _onKeyDown(event) {
    // Don't capture if typing in input
    if (event.target.tagName === 'INPUT') return;

    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = true;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = true;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = true;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = true;
        break;
      case 'KeyQ':
        this.keys.up = true;
        break;
      case 'KeyE':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = true;
        break;
    }
  }

  _onKeyUp(event) {
    switch (event.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.keys.forward = false;
        break;
      case 'KeyS':
      case 'ArrowDown':
        this.keys.back = false;
        break;
      case 'KeyA':
      case 'ArrowLeft':
        this.keys.left = false;
        break;
      case 'KeyD':
      case 'ArrowRight':
        this.keys.right = false;
        break;
      case 'KeyQ':
        this.keys.up = false;
        break;
      case 'KeyE':
      case 'ShiftLeft':
      case 'ShiftRight':
        this.keys.down = false;
        break;
    }
  }

  // Call this every frame to apply keyboard/joystick input
  update() {
    const ship = this.getSelectedShip();
    if (!ship) return;

    // Don't override during active drag
    if (this.dragState.active) return;

    // Handle virtual joystick
    if (this.joystick.active) {
      this._applyJoystickInput(ship);
      return;
    }

    // Handle keyboard input
    this._applyKeyboardInput(ship);
  }

  _applyKeyboardInput(ship) {
    const camera = this.sceneData.camera;

    // Get camera-relative directions (flattened to XZ plane)
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    // Build direction from keys
    const dir = new THREE.Vector3();

    if (this.keys.forward) dir.add(camForward);
    if (this.keys.back) dir.sub(camForward);
    if (this.keys.right) dir.add(camRight);
    if (this.keys.left) dir.sub(camRight);
    if (this.keys.up) dir.y += 1;
    if (this.keys.down) dir.y -= 1;

    const hasInput = dir.lengthSq() > 0.001;

    if (hasInput) {
      dir.normalize();

      if (this.faceMode) {
        ship.desiredFacingDir = dir.clone();
      } else {
        ship.desiredThrustDir.copy(dir);
        ship.thrustPower = 1; // Full power when using keyboard
      }
    } else {
      // No keyboard input - don't clear thrust (let drag or joystick control it)
    }
  }

  _applyJoystickInput(ship) {
    const dx = this.joystick.currentX - this.joystick.startX;
    const dy = this.joystick.currentY - this.joystick.startY;
    const maxRadius = 35;

    const dist = Math.hypot(dx, dy);
    if (dist < 5) {
      ship.thrustPower = 0;
      return;
    }

    const power = Math.min(1, dist / maxRadius);

    // Convert joystick to camera-relative world direction
    const camera = this.sceneData.camera;

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    // Joystick: up = forward, right = right
    const normX = dx / maxRadius;
    const normY = -dy / maxRadius; // Invert Y so up = forward

    const dir = new THREE.Vector3();
    dir.addScaledVector(camForward, normY);
    dir.addScaledVector(camRight, normX);
    dir.y = this.elevation;

    if (dir.lengthSq() > 0.001) {
      dir.normalize();

      if (this.faceMode) {
        ship.desiredFacingDir = dir.clone();
      } else {
        ship.desiredThrustDir.copy(dir);
        ship.thrustPower = power;
      }
    }
  }

  // Public methods for UI integration
  setElevation(value) {
    this.elevation = value;
  }

  setFaceMode(value) {
    this.faceMode = value;
  }

  centerControls() {
    const ship = this.getSelectedShip();
    if (!ship) return;

    ship.desiredThrustDir.set(0, 0, 0);
    ship.thrustPower = 0;
    ship.desiredFacingDir = null;
    this.elevation = 0;
  }

  getControlState() {
    return {
      faceMode: this.faceMode,
      elevation: this.elevation,
    };
  }
}
