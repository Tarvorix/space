import * as THREE from 'three';
import { createScene } from './scene.js';
import { GameState } from './GameState.js';
import { loadShipModel, applyFactionMaterial } from './ShipLoader.js';
import { applyRTSPhysics } from './Physics.js';
import { resolveAllWeapons } from './Combat.js';
import { rollCatastrophicDamage, applyExplosionDamage, rollND6 } from './CriticalHits.js';
import { updateAI } from './AI.js';
import { createVelocityArrow, updateVelocityArrow } from './VelocityArrow.js';
import { createWeaponLine, createExplosion } from './Effects.js';
import { BlastMarkerManager } from './BlastMarkers.js';
import { TorpedoManager } from './Torpedoes.js';
import { createUI } from './UI.js';
import { InputManager } from './InputManager.js';
import { executeOrder } from './Orders.js';
import { OrderVisuals } from './OrderVisuals.js';

const TURN_DURATION = 10;
const FIRE_COOLDOWN = 10;

let game;
let sceneData;
let blastMarkers;
let torpedoes;
let orderVisuals;
let ui;
let inputManager;
let selectedShip = null;
let isPaused = true;
let gameStarted = false;

// Track velocity arrows per ship
const velocityArrows = new Map();

function createFactionRing(color, radius) {
  const geometry = new THREE.TorusGeometry(radius, Math.max(0.02, radius * 0.016), 12, 48);
  geometry.rotateX(Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  return new THREE.Mesh(geometry, material);
}

function updateShipRing(ship) {
  if (!ship.ring) return;
  ship.ring.position.copy(ship.position);
  ship.ring.quaternion.copy(ship.quaternion);

  const isTarget = selectedShip && selectedShip.target === ship;
  const isSelected = ship.selected;
  const scale = isTarget ? 1.25 : isSelected ? 1.15 : 1;
  ship.ring.scale.setScalar(scale);
  ship.ring.material.opacity = isTarget || isSelected ? 1 : 0.6;
}

function syncShipVisuals(ship) {
  ship.syncMesh();
  updateShipRing(ship);
}

/**
 * Initialize visuals for a ship (model, ring, velocity arrow)
 */
async function initShipVisuals(ship) {
  const { scene } = sceneData;

  // Load model
  const model = await loadShipModel(ship.stats.modelFile, ship.stats.modelScale);
  applyFactionMaterial(model, ship.faction);
  ship.mesh = model;
  scene.add(model);

  // Create ring
  const ringColor = ship.faction === 'imperial' ? 0x4488ff : 0xff4444;
  ship.ring = createFactionRing(ringColor, ship.collisionRadius * 1.4);
  scene.add(ship.ring);

  // Create velocity arrow
  const arrowColor = ship.faction === 'imperial' ? 0x4488ff : 0xff4444;
  const arrow = createVelocityArrow(arrowColor);
  scene.add(arrow);
  velocityArrows.set(ship.id, arrow);

  // Attach hitbox data
  if (ship.mesh) {
    ship.mesh.traverse((child) => {
      if (child.isMesh) {
        child.userData.ship = ship;
      }
    });
  }
  if (ship.ring) {
    ship.ring.userData.ship = ship;
  }

  syncShipVisuals(ship);
}

/**
 * Remove visuals for a destroyed ship
 */
function removeShipVisuals(ship) {
  const { scene } = sceneData;

  if (ship.mesh) {
    scene.remove(ship.mesh);
    ship.mesh = null;
  }
  if (ship.ring) {
    scene.remove(ship.ring);
    ship.ring.geometry.dispose();
    ship.ring.material.dispose();
    ship.ring = null;
  }

  const arrow = velocityArrows.get(ship.id);
  if (arrow) {
    scene.remove(arrow);
    velocityArrows.delete(ship.id);
  }
}

async function init() {
  sceneData = createScene(document.getElementById('game'));
  const { scene } = sceneData;
  sceneData.renderer.domElement.style.touchAction = 'none';

  game = new GameState();

  // Load scenario instead of legacy setup
  game.loadScenario('FIRST_CONTACT');

  blastMarkers = new BlastMarkerManager(scene);
  torpedoes = new TorpedoManager(scene);
  orderVisuals = new OrderVisuals(scene);

  // Initialize visuals for all ships
  const allShips = game.getAllShips();
  await Promise.all(allShips.map(ship => initShipVisuals(ship)));

  // Position camera on first player ship
  const playerShips = game.getPlayerShips();
  if (playerShips.length > 0) {
    positionCameraOnShip(playerShips[0]);
  }

  // Initialize InputManager
  inputManager = new InputManager(
    sceneData,
    () => selectedShip,
    setSelectedShip,
    () => game.getAllShips()
  );

  // Wire up order callbacks
  inputManager.onOrbitPreview = (targetPosition, radius) => {
    orderVisuals.showOrbitPreview(targetPosition, radius);
  };
  inputManager.onOrbitPreviewEnd = () => {
    orderVisuals.hideOrbitPreview();
  };
  inputManager.onOrbitConfirm = (ship, target, radius) => {
    ship.orbitTarget(target, radius);
    game.log(`${ship.stats.name} ordered to orbit ${target.stats.name} at ${radius.toFixed(0)} units`);
  };
  inputManager.onApproachTarget = (ship, target) => {
    ship.approachTarget(target);
    game.log(`${ship.stats.name} ordered to approach ${target.stats.name}`);
  };
  inputManager.onFlyToPosition = (ship, position) => {
    ship.flyToPosition(position);
    game.log(`${ship.stats.name} ordered to fly to waypoint`);
  };

  ui = createUI({
    onManualFire: handleManualFire,
    onAutoFireToggle: (value) => {
      if (!selectedShip) return;
      selectedShip.autoFire = value;
    },
    onBraceToggle: (value) => {
      if (!selectedShip) return;
      selectedShip.brace = value;
    },
    onThrottleChange: (value) => {
      if (!selectedShip) return;
      selectedShip.thrustPower = value;
    },
    onElevationChange: (value) => {
      inputManager.setElevation(value);
    },
    onCenterControls: () => {
      inputManager.centerControls();
    },
    onPauseToggle: (paused) => {
      isPaused = paused;
    },
    onAllStop: () => {
      if (selectedShip) {
        selectedShip.allStop();
        game.log(`${selectedShip.stats.name} ordered to all stop`);
      }
    },
  });

  // Select first player ship
  if (playerShips.length > 0) {
    setSelectedShip(playerShips[0]);
  }

  ui.updateStatus(game, selectedShip);

  // Show start button once loading is complete
  const startScreen = document.getElementById('start-screen');
  const startButton = document.getElementById('start-button');
  const loadingText = document.getElementById('loading-text');

  loadingText.style.display = 'none';
  startButton.style.display = 'block';

  startButton.addEventListener('click', () => {
    startScreen.classList.add('hidden');
    isPaused = false;
    gameStarted = true;
  });

  // Start render loop (paused until start button clicked)
  animate(performance.now());
}

let lastTime = 0;
function animate(time) {
  requestAnimationFrame(animate);

  const dt = Math.min(0.1, (time - lastTime) / 1000 || 0);
  lastTime = time;

  // Process input every frame (even when paused, for camera control)
  inputManager.update();

  if (!game.gameOver && !isPaused) {
    updateRTS(dt);
  }

  // Update visuals for all ships
  for (const ship of game.getAllShips()) {
    const arrow = velocityArrows.get(ship.id);
    if (arrow) {
      updateVelocityArrow(arrow, ship);
    }
    updateShipRing(ship);
  }

  // Update planned arrow for selected ship
  if (selectedShip) {
    // Could add a planned arrow here if desired
  }

  sceneData.controls.update();
  sceneData.renderer.render(sceneData.scene, sceneData.camera);
}

async function updateRTS(dt) {
  game.time += dt;
  game.roundTimer += dt;

  // Update wave spawning
  game.updateWaves(dt);

  // Check for new ships that need visuals
  for (const ship of game.getAllShips()) {
    if (!ship.mesh && !ship.isDestroyed) {
      await initShipVisuals(ship);
    }
  }

  // Update AI for all AI-controlled ships
  const aiShips = game.getAIShips();
  for (const aiShip of aiShips) {
    if (!aiShip.isDestroyed) {
      updateAI(aiShip, game);
    }
  }

  // Execute orders for player ships
  for (const ship of game.getPlayerShips()) {
    if (ship.hasActiveOrder() && !ship.isDestroyed) {
      executeOrder(ship);
    }
  }

  // Apply physics to all ships
  for (const ship of game.getAllShips()) {
    if (!ship.isHulk && !ship.isDestroyed) {
      applyRTSPhysics(ship, dt, TURN_DURATION);
    }
    syncShipVisuals(ship);
  }

  // Update order visuals
  orderVisuals.updateAll(game.getAllShips());

  // Update blast markers for all ships
  for (const ship of game.getAllShips()) {
    blastMarkers.updateShipBlastMarkers(ship);
  }

  // Update torpedoes
  const torpedoResults = torpedoes.advanceAndResolve(game.getAllShips(), dt, TURN_DURATION);
  for (const result of torpedoResults) {
    if (result.damage && result.damage.hullDamage > 0) {
      game.log(`Torpedoes hit ${result.ship} for ${result.damage.hullDamage} damage!`);
      for (const crit of result.damage.criticals || []) {
        game.log(`  CRITICAL: ${crit.name}!`);
      }
    }
  }

  updateCooldowns(dt);
  handleAutoFire();

  if (game.roundTimer >= TURN_DURATION) {
    while (game.roundTimer >= TURN_DURATION) {
      game.roundTimer -= TURN_DURATION;
      game.round += 1;
      resolveEndPhase();
    }
  }

  // Check destruction for all ships
  for (const ship of game.getAllShips()) {
    checkDestruction(ship);
  }

  // Clear dead targets
  for (const ship of game.getAllShips()) {
    if (ship.target && ship.target.isDestroyed) {
      ship.target = null;
    }
  }

  game.checkVictory();
  if (game.gameOver) {
    setTimeout(() => {
      alert(`GAME OVER!\n\n${game.winner} VICTORY!`);
    }, 500);
  }

  ui.updateStatus(game, selectedShip);
}

function updateCooldowns(dt) {
  for (const ship of game.getAllShips()) {
    ship.fireCooldown = Math.max(0, ship.fireCooldown - dt);
  }
}

function handleAutoFire() {
  for (const ship of game.getAllShips()) {
    if (!ship.autoFire || ship.fireCooldown > 0) continue;
    if (!ship.target || ship.target.isDestroyed) continue;
    const fired = tryFire(ship, ship.target);
    if (fired) {
      ship.fireCooldown = FIRE_COOLDOWN;
    }
  }
}

function handleManualFire() {
  if (!selectedShip || selectedShip.fireCooldown > 0) return;
  if (!selectedShip.target || selectedShip.target.isDestroyed) return;
  const fired = tryFire(selectedShip, selectedShip.target);
  if (fired) {
    selectedShip.fireCooldown = FIRE_COOLDOWN;
  }
}

function tryFire(attacker, target) {
  if (!attacker || !target) return false;
  if (attacker.isDestroyed || target.isDestroyed) return false;

  target.resetPhaseState();

  const results = resolveAllWeapons(attacker, target, blastMarkers, torpedoes);
  if (results.length === 0) return false;

  const color = attacker.faction === 'imperial' ? 0x4488ff : 0xff4444;
  for (const result of results) {
    if (result.type === 'torpedo' && result.launched > 0) {
      game.log(`${attacker.stats.name} launches ${result.launched} torpedoes`);
      continue;
    }

    if (result.hits > 0) {
      createWeaponLine(sceneData.scene, attacker.position, target.position, color);
      game.log(`${attacker.stats.name} ${result.weapon}: ${result.rolls.join(',')} = ${result.hits} hits`);

      if (result.damage) {
        if (result.damage.shieldsAbsorbed > 0) {
          blastMarkers.addMarkersAtPosition(target.position, result.damage.shieldsAbsorbed);
        }
        if (result.damage.hullDamage > 0) {
          game.log(`  Hull damage: ${result.damage.hullDamage}`);
        }
        for (const crit of result.damage.criticals) {
          game.log(`  CRITICAL: ${crit.name}!`);
        }
      }
    }
  }

  checkDestruction(target);
  return true;
}

function setSelectedShip(ship) {
  if (selectedShip) {
    selectedShip.selected = false;
  }
  selectedShip = ship;
  if (selectedShip) {
    selectedShip.selected = true;
    ui.setSelectedShip(selectedShip);
  }
}


function positionCameraOnShip(ship) {
  const offset = new THREE.Vector3(0, 10, -22);
  sceneData.camera.position.copy(ship.position).add(offset);
  sceneData.controls.target.copy(ship.position);
  sceneData.controls.update();
}

function resolveEndPhase() {
  for (const ship of game.getAllShips()) {
    if (ship.isHulk) {
      resolveHulkDrift(ship);
      continue;
    }

    if (ship.isDestroyed) continue;

    if (ship.criticals.fires > 0) {
      let repaired = 0;
      for (let i = 0; i < ship.criticals.fires; i++) {
        if (Math.random() >= 0.5) {
          repaired += 1;
        }
      }
      ship.criticals.fires -= repaired;

      if (ship.criticals.fires > 0) {
        ship.currentStructure = Math.max(0, ship.currentStructure - ship.criticals.fires);
        game.log(`${ship.stats.name} takes ${ship.criticals.fires} fire damage!`);
      }
    }

    const repairables = [
      'dorsal_damaged',
      'starboard_damaged',
      'port_damaged',
      'prow_damaged',
      'fore_damaged',
      'engines_damaged',
      'thrusters_damaged',
    ];

    for (const crit of repairables) {
      if (ship.criticals[crit] && Math.random() >= 0.5) {
        ship.criticals[crit] = false;
        game.log(`${ship.stats.name} repairs ${crit.replace('_', ' ')}!`);
      }
    }

    if (ship.currentStructure <= 0 && !ship.catastrophicResolved) {
      checkDestruction(ship);
    }
  }

  blastMarkers.endPhaseRemoval(game.getAllShips());
}

function checkDestruction(ship) {
  if (ship.currentStructure > 0 || ship.catastrophicResolved) return;

  ship.catastrophicResolved = true;
  const catResult = rollCatastrophicDamage(ship);
  game.log(`${ship.stats.name} DESTROYED! ${catResult.name} (rolled ${catResult.roll})`);

  blastMarkers.addMarkersAtPosition(ship.position, catResult.blastMarkers);

  if (catResult.effect === 'drifting_hulk' || catResult.effect === 'blazing_hulk') {
    ship.isHulk = true;
    ship.hulkType = catResult.effect;
    ship.velocity.set(0, 0, 0);
    return;
  }

  if (catResult.effect === 'plasma_explosion' || catResult.effect === 'warp_implosion') {
    createExplosion(sceneData.scene, ship.position, catResult.explosionRadius / 3);

    const explosionResults = applyExplosionDamage(
      ship,
      game.getAllShips(),
      catResult.explosionRadius,
      catResult.explosionStrength
    );

    for (const expRes of explosionResults) {
      if (expRes.hits > 0) {
        game.log(`  Explosion hits ${expRes.ship.stats.name} for ${expRes.hits} damage!`);
      }
    }

    for (const expRes of explosionResults) {
      checkDestruction(expRes.ship);
    }
  }

  removeShipVisuals(ship);

  if (selectedShip === ship) {
    // Select next available player ship
    const playerShips = game.getPlayerShips().filter(s => !s.isDestroyed);
    if (playerShips.length > 0) {
      setSelectedShip(playerShips[0]);
    } else {
      selectedShip = null;
    }
  }
}

function resolveHulkDrift(ship) {
  const drift = rollND6(4);
  const forward = ship.getForward();
  ship.position.add(forward.multiplyScalar(drift));
  syncShipVisuals(ship);
  blastMarkers.addMarkersAtPosition(ship.position, 1);

  if (ship.hulkType === 'blazing_hulk') {
    const catResult = rollCatastrophicDamage(ship);
    game.log(`${ship.stats.name} hulk catastrophically shifts: ${catResult.name} (rolled ${catResult.roll})`);

    blastMarkers.addMarkersAtPosition(ship.position, catResult.blastMarkers);

    if (catResult.effect === 'drifting_hulk') {
      ship.hulkType = 'drifting_hulk';
      return;
    }

    if (catResult.effect === 'blazing_hulk') {
      ship.hulkType = 'blazing_hulk';
      return;
    }

    if (catResult.effect === 'plasma_explosion' || catResult.effect === 'warp_implosion') {
      createExplosion(sceneData.scene, ship.position, catResult.explosionRadius / 3);

      const explosionResults = applyExplosionDamage(
        ship,
        game.getAllShips(),
        catResult.explosionRadius,
        catResult.explosionStrength
      );

      for (const expRes of explosionResults) {
        if (expRes.hits > 0) {
          game.log(`  Explosion hits ${expRes.ship.stats.name} for ${expRes.hits} damage!`);
        }
      }

      for (const expRes of explosionResults) {
        checkDestruction(expRes.ship);
      }
    }

    ship.isHulk = false;
    ship.hulkType = null;
    removeShipVisuals(ship);
  }
}

init();
