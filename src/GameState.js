import * as THREE from 'three';
import { Ship } from './Ship.js';
import { PLAYER_CRUISER, AI_CRUISER } from './ShipData.js';

export const PHASES = {
  PLANNING: 'planning',
  EXECUTION: 'execution',
  SHOOTING: 'shooting',
  ORDNANCE: 'ordnance',
  END: 'end',
};

export class GameState {
  constructor() {
    this.time = 0;
    this.round = 1;
    this.roundDuration = 10;
    this.roundTimer = 0;
    this.gameOver = false;
    this.winner = null;
    this.logLines = [];

    this.playerShip = new Ship(PLAYER_CRUISER, 'imperial');
    this.aiShip = new Ship(AI_CRUISER, 'xenos');
  }

  setup() {
    this.playerShip.position.set(0, 0, -12);
    this.playerShip.velocity.set(0, 0, 0);
    this.playerShip.quaternion.identity();

    this.aiShip.position.set(0, 0, 12);
    this.aiShip.velocity.set(0, 0, 0);
    this.aiShip.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    this.aiShip.autoFire = true;
  }

  getAllShips() {
    return [this.playerShip, this.aiShip];
  }

  log(message) {
    this.logLines.push(message);
    console.log(message);
  }

  checkVictory() {
    const playerDead = this.playerShip.isDestroyed;
    const aiDead = this.aiShip.isDestroyed;

    if (!playerDead && !aiDead) {
      return;
    }

    this.gameOver = true;
    if (playerDead && aiDead) {
      this.winner = 'DRAW';
    } else if (aiDead) {
      this.winner = 'IMPERIAL';
    } else {
      this.winner = 'XENOS';
    }
  }
}
