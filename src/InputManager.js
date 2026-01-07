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

    // Drag state for ship control
    this.dragState = {
      active: false,
      ship: null,
      startX: 0,
      startY: 0,
      pointerId: null,
    };

    // Orbit drag state for setting orbit on enemy
    this.orbitDragState = {
      active: false,
      targetShip: null,
      startX: 0,
      startY: 0,
      currentRadius: 15,
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
    this.onOrbitPreview = null;      // (targetPosition, radius) => void
    this.onOrbitPreviewEnd = null;   // () => void
    this.onOrbitConfirm = null;      // (selectedShip, targetShip, radius) => void

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
          pointer-events: none;
        }
        #joystick-label {
          position: absolute;
          bottom: -20px;
          width: 100%;
          text-align: center;
          color: rgba(255,255,255,0.5);
          font-size: 10px;
          font-family: monospace;
          pointer-events: none;
        }
      </style>
      <div id="joystick-base"></div>
      <div id="joystick-knob"></div>
      <div id="joystick-label">HEADING</div>
    `;

    document.body.appendChild(container);

    this.joystick.element = container;
    this.joystick.knob = container.querySelector('#joystick-knob');
    const base = container.querySelector('#joystick-base');
    this.joystick.base = base;

    // All events on base element - pointer capture redirects events here
    base.addEventListener('pointerdown', this._onJoystickStart.bind(this));
    base.addEventListener('pointermove', this._onJoystickMove.bind(this));
    base.addEventListener('pointerup', this._onJoystickEnd.bind(this));
    base.addEventListener('pointercancel', this._onJoystickEnd.bind(this));
    base.addEventListener('lostpointercapture', this._onJoystickEnd.bind(this));
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

    // Capture pointer to keep receiving events on mobile
    event.target.setPointerCapture(event.pointerId);

    this._updateJoystickVisual();
  }

  _onJoystickMove(event) {
    if (!this.joystick.active || event.pointerId !== this.joystick.pointerId) return;

    this.joystick.currentX = event.clientX;
    this.joystick.currentY = event.clientY;
    this._updateJoystickVisual();
  }

  _onJoystickEnd(event) {
    if (!this.joystick.active) return;
    if (event.pointerId !== undefined && event.pointerId !== this.joystick.pointerId) return;

    // Release pointer capture
    const base = this.joystick.base;
    if (base && base.hasPointerCapture && base.hasPointerCapture(this.joystick.pointerId)) {
      base.releasePointerCapture(this.joystick.pointerId);
    }

    this.joystick.active = false;
    this.joystick.pointerId = null;

    // Reset knob position
    if (this.joystick.knob) {
      this.joystick.knob.style.left = '35px';
      this.joystick.knob.style.top = '35px';
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

      // Click on enemy = start orbit drag mode
      if (selectedShip && hitShip.faction !== selectedShip.faction) {
        selectedShip.target = hitShip;
        if (this.onTargetSet) this.onTargetSet(hitShip);

        // Start orbit drag
        this.orbitDragState.active = true;
        this.orbitDragState.targetShip = hitShip;
        this.orbitDragState.startX = event.clientX;
        this.orbitDragState.startY = event.clientY;
        this.orbitDragState.currentRadius = 15; // Default orbit radius
        this.orbitDragState.pointerId = event.pointerId;

        // Disable OrbitControls during orbit drag
        this.sceneData.controls.enabled = false;
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
    // Handle orbit drag
    if (this.orbitDragState.active) {
      if (event.pointerId !== this.orbitDragState.pointerId) return;
      this._updateOrbitDrag(event);
      return;
    }

    // Handle ship control drag
    if (!this.dragState.active) return;
    if (event.pointerId !== this.dragState.pointerId) return;

    this._updateDragCommand(event);
  }

  _updateOrbitDrag(event) {
    const target = this.orbitDragState.targetShip;
    if (!target) return;

    // Calculate drag distance in pixels
    const dragPx = Math.hypot(
      event.clientX - this.orbitDragState.startX,
      event.clientY - this.orbitDragState.startY
    );

    // Convert to world units (rough approximation)
    // Use camera distance to scale appropriately
    const camDist = this.sceneData.camera.position.distanceTo(target.position);
    const scaleFactor = camDist / 500; // Adjust feel

    // Minimum 5 units, scale with drag
    const radius = Math.max(5, 10 + dragPx * scaleFactor * 0.5);
    this.orbitDragState.currentRadius = radius;

    // Show preview
    if (this.onOrbitPreview) {
      this.onOrbitPreview(target.position, radius);
    }
  }

  _onPointerUp(event) {
    // Handle orbit drag end
    if (this.orbitDragState.active && event.pointerId === this.orbitDragState.pointerId) {
      const selectedShip = this.getSelectedShip();
      const targetShip = this.orbitDragState.targetShip;
      const radius = this.orbitDragState.currentRadius;

      // Hide preview
      if (this.onOrbitPreviewEnd) {
        this.onOrbitPreviewEnd();
      }

      // Confirm orbit order
      if (selectedShip && targetShip && this.onOrbitConfirm) {
        this.onOrbitConfirm(selectedShip, targetShip, radius);
      }

      this.orbitDragState.active = false;
      this.orbitDragState.targetShip = null;
      this.orbitDragState.pointerId = null;

      // Re-enable OrbitControls
      this.sceneData.controls.enabled = true;
      return;
    }

    // Handle ship control drag end
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

    // Check drag distance for deadzone
    const dragPx = Math.hypot(
      event.clientX - this.dragState.startX,
      event.clientY - this.dragState.startY
    );

    if (dragPx < DRAG_DEADZONE) return;

    // Set facing direction only - throttle slider controls thrust power
    ship.desiredFacingDir = combined.lengthSq() > 0.0001 ? combined.clone() : null;

    // Clear any active order - manual control takes over
    if (ship.hasActiveOrder && ship.hasActiveOrder()) {
      ship.clearOrder();
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
      ship.desiredFacingDir = dir.clone();
      // Clear any active order - manual control takes over
      if (ship.hasActiveOrder && ship.hasActiveOrder()) {
        ship.clearOrder();
      }
    }
    // Throttle slider controls thrust power
  }

  _applyJoystickInput(ship) {
    const dx = this.joystick.currentX - this.joystick.startX;
    const dy = this.joystick.currentY - this.joystick.startY;
    const maxRadius = 35;

    const dist = Math.hypot(dx, dy);
    if (dist < 5) {
      // Dead zone - don't change heading
      return;
    }

    // Convert joystick to camera-relative world direction
    const camera = this.sceneData.camera;

    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    // Joystick: push toward top of screen = face camera forward direction
    const normX = dx / maxRadius;
    const normY = dy / maxRadius;

    const dir = new THREE.Vector3();
    dir.addScaledVector(camForward, normY); // Push down = forward (matches knob visual)
    dir.addScaledVector(camRight, normX);
    dir.y = this.elevation;

    if (dir.lengthSq() > 0.001) {
      dir.normalize();
      ship.desiredFacingDir = dir.clone();
      // Clear any active order - manual control takes over
      if (ship.hasActiveOrder && ship.hasActiveOrder()) {
        ship.clearOrder();
      }
    }
    // Throttle slider controls thrust power
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

    ship.desiredFacingDir = null;
    this.elevation = 0;
    // Don't clear thrustPower - throttle slider controls it
  }

  getControlState() {
    return {
      faceMode: this.faceMode,
      elevation: this.elevation,
    };
  }
}
