export function createUI({
  onManualFire,
  onAutoFireToggle,
  onBraceToggle,
  onElevationChange,
  onCenterControls,
  onPauseToggle,
}) {
  const ui = document.createElement('div');
  ui.id = 'game-ui';
  ui.innerHTML = `
    <style>
      #game-ui {
        position: fixed;
        top: 10px;
        left: 10px;
        font-family: 'Courier New', monospace;
        color: white;
        user-select: none;
        z-index: 10;
      }
      #status {
        padding: 10px;
        background: rgba(0,0,0,0.7);
        border: 1px solid #333;
        font-size: 12px;
        line-height: 1.6;
        min-width: 240px;
      }
      .ship-status {
        margin-top: 10px;
      }
      .ship-status h3 {
        margin: 0 0 5px 0;
        font-size: 13px;
      }
      .crit {
        color: #ff6666;
      }
      .crippled {
        color: #ffaa00;
      }
      #controls {
        position: fixed;
        left: 10px;
        bottom: 10px;
        padding: 10px;
        background: rgba(0,0,0,0.7);
        border: 1px solid #333;
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 200px;
      }
      #controls button {
        padding: 8px;
        font-family: inherit;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid #444;
        background: #222;
        color: white;
      }
      #controls button:hover {
        background: #333;
      }
      #manual-fire {
        background: #663333;
      }
      #manual-fire:hover {
        background: #774444;
      }
      #center-controls {
        background: #333;
      }
      #pause-btn {
        background: #446;
        font-weight: bold;
      }
      #pause-btn:hover {
        background: #557;
      }
      #pause-btn.paused {
        background: #664;
        color: #ffa;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
      }
      .slider {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 11px;
        color: #ddd;
      }
      .slider input[type="range"] {
        width: 180px;
        accent-color: #88aacc;
      }
      .controls-hint {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #333;
        font-size: 10px;
        color: #888;
        line-height: 1.5;
      }
      @media (max-width: 700px) {
        #controls {
          min-width: 160px;
        }
        .slider input[type="range"] {
          width: 150px;
        }
        .controls-hint {
          display: none;
        }
      }
    </style>
    <div id="status"></div>
    <div id="controls">
      <button id="pause-btn">PAUSE (Space)</button>
      <button id="manual-fire">FIRE</button>
      <label class="toggle"><input type="checkbox" id="autofire"> AUTOFIRE</label>
      <label class="toggle"><input type="checkbox" id="brace"> BRACE</label>
      <div class="slider">
        <div>ELEVATION (Q/E)</div>
        <input id="elevation" type="range" min="-1" max="1" step="0.01" value="0">
      </div>
      <button id="center-controls">KILL THRUST</button>
      <div class="controls-hint">
        <div>WASD/Arrows: Set heading | Q/E: Pitch</div>
        <div>Drag on ship: Set heading + thrust</div>
        <div>Thrust is always forward (Newtonian)</div>
        <div>Click enemy: Target | Space: Pause</div>
      </div>
    </div>
  `;

  document.body.appendChild(ui);

  const autoFireToggle = ui.querySelector('#autofire');
  const braceToggle = ui.querySelector('#brace');
  const elevationInput = ui.querySelector('#elevation');

  autoFireToggle.addEventListener('change', () => {
    onAutoFireToggle(autoFireToggle.checked);
  });
  braceToggle.addEventListener('change', () => {
    onBraceToggle(braceToggle.checked);
  });
  elevationInput.addEventListener('input', () => {
    controlState.elevation = parseFloat(elevationInput.value);
    onElevationChange(controlState.elevation);
  });

  ui.querySelector('#manual-fire').addEventListener('click', onManualFire);
  ui.querySelector('#center-controls').addEventListener('click', () => {
    controlState.elevation = 0;
    elevationInput.value = 0;
    onElevationChange(0);
    onCenterControls();
  });

  const pauseBtn = ui.querySelector('#pause-btn');
  let isPaused = false;
  const togglePause = () => {
    isPaused = !isPaused;
    pauseBtn.textContent = isPaused ? 'RESUME (Space)' : 'PAUSE (Space)';
    pauseBtn.classList.toggle('paused', isPaused);
    onPauseToggle(isPaused);
  };
  pauseBtn.addEventListener('click', togglePause);

  // Space bar to toggle pause
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      togglePause();
    }
  });

  const controlState = {
    elevation: 0,
  };

  return {
    getControlState: () => ({ ...controlState }),
    setSelectedShip: (ship) => {
      if (!ship) return;
      autoFireToggle.checked = !!ship.autoFire;
      braceToggle.checked = !!ship.brace;
    },
    updateStatus: (game, selectedShip) => updateStatus(game, selectedShip),
  };
}

function updateStatus(game, selectedShip) {
  const status = document.getElementById('status');
  if (!status) return;

  const p = game.playerShip;
  const a = game.aiShip;

  const selectedName = selectedShip ? selectedShip.stats.name : 'None';
  const targetName = selectedShip && selectedShip.target ? selectedShip.target.stats.name : 'None';
  const cooldown = selectedShip ? `${selectedShip.fireCooldown.toFixed(1)}s` : '--';

  status.innerHTML = `
    <div>Time: ${game.time.toFixed(1)}s | Round: ${game.round}</div>
    <div>Selected: ${selectedName}</div>
    <div>Target: ${targetName} | Cooldown: ${cooldown}</div>
    <hr style="border-color:#333;margin:8px 0;">

    <div class="ship-status">
      <h3 style="color:#4488ff;">IMPERIAL CRUISER</h3>
      <div>Hits: ${p.currentHits}/${p.stats.hits} ${p.isCrippled ? '<span class="crippled">[CRIPPLED]</span>' : ''}</div>
      <div>Shields: ${p.getShieldCapacity()}/${p.stats.shields} (${p.blastMarkersInContact} blast markers)</div>
      <div>Speed: ${p.speed.toFixed(1)}"</div>
      ${formatCriticals(p)}
    </div>

    <div class="ship-status">
      <h3 style="color:#ff4444;">XENOS CRUISER</h3>
      <div>Hits: ${a.currentHits}/${a.stats.hits} ${a.isCrippled ? '<span class="crippled">[CRIPPLED]</span>' : ''}</div>
      <div>Shields: ${a.getShieldCapacity()}/${a.stats.shields} (${a.blastMarkersInContact} blast markers)</div>
      <div>Speed: ${a.speed.toFixed(1)}"</div>
      ${formatCriticals(a)}
    </div>
  `;
}

function formatCriticals(ship) {
  const crits = [];
  if (ship.criticals.dorsal_damaged) crits.push('Dorsal Damaged');
  if (ship.criticals.starboard_damaged) crits.push('Stbd Damaged');
  if (ship.criticals.port_damaged) crits.push('Port Damaged');
  if (ship.criticals.prow_damaged) crits.push('Prow Damaged');
  if (ship.criticals.engines_damaged) crits.push('Engines Damaged');
  if (ship.criticals.thrusters_damaged) crits.push('Thrusters Damaged');
  if (ship.criticals.bridge_smashed) crits.push('Bridge Smashed');
  if (ship.criticals.shields_collapse) crits.push('Shields Collapsed');
  if (ship.criticals.fires > 0) crits.push(`Fires: ${ship.criticals.fires}`);

  if (crits.length === 0) return '';
  return `<div class="crit">! ${crits.join(', ')}</div>`;
}
