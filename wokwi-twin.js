const https = require('https');
const readline = require('readline');

const FIREBASE_HOST = 'innovexa-sih-default-rtdb.firebaseio.com';

let estopState = false;
let leakState = false;
let tankALevel = 68.8;
let tankBLevel = 57.8;

console.clear();
console.log('================================================================');
console.log('--- INNOVEXA ESP32 HARDWARE DIGITAL TWIN (VS CODE CONTROLLER) ---');
console.log('================================================================');
console.log('🔥 HARDWARE TWIN IS CONNECTED TO FIREBASE & LIVE WEB DASHBOARD!');
console.log('----------------------------------------------------------------');
console.log('🎮 INTERACTIVE HOTKEYS IN VS CODE TERMINAL:');
console.log('   [L] -> Trigger Leak Sensor A (Isolate Branch A + Bypass + WhatsApp)');
console.log('   [N] -> Reset System to Normal Mode');
console.log('   [E] -> Trigger Emergency Stop');
console.log('   [1] -> Set Tank A Level to 20% (Low Water Alert)');
console.log('   [2] -> Set Tank A Level to 50%');
console.log('   [3] -> Set Tank A Level to 85% (High Capacity)');
console.log('----------------------------------------------------------------\n');

// Configure interactive keypress reading if in TTY mode
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') process.exit();
    const ch = (str || '').toUpperCase();
    if (ch === 'L') {
      leakState = true;
      console.log('\n🔴 [HARDWARE SENSOR] Leak Sensor A triggered! SV1 closing, Bypass opening...\n');
    } else if (ch === 'N') {
      leakState = false;
      estopState = false;
      console.log('\n🟢 [HARDWARE STATE] System reset to NORMAL. All valves open.\n');
    } else if (ch === 'E') {
      estopState = !estopState;
      console.log(`\n🚨 [HARDWARE SWITCH] Emergency Stop is now ${estopState ? 'ACTIVE' : 'OFF'}\n`);
    } else if (ch === '1') {
      tankALevel = 20.0;
      console.log('\n🌊 [ULTRASONIC SENSOR] Tank A level changed to 20.0%\n');
    } else if (ch === '2') {
      tankALevel = 50.0;
      console.log('\n🌊 [ULTRASONIC SENSOR] Tank A level changed to 50.0%\n');
    } else if (ch === '3') {
      tankALevel = 85.0;
      console.log('\n🌊 [ULTRASONIC SENSOR] Tank A level changed to 85.0%\n');
    }
  });
}


function sendPatch(data) {
  const payload = JSON.stringify(data);
  const req = https.request({
    hostname: FIREBASE_HOST,
    path: '/.json',
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, (res) => {
    if (res.statusCode === 200) {
      process.stdout.write(`\r[TELEMETRY SENT 200] Tank A: ${data.tanks.A.level_pct}% | Phase: ${data.system.phase} | Pump: ${data.system.pump_on ? 'ON' : 'OFF'} `);
    }
  });
  req.on('error', () => undefined);
  req.write(payload);
  req.end();
}

function checkCommands() {
  https.get(`https://${FIREBASE_HOST}/commands.json`, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const commands = JSON.parse(body);
        if (commands && typeof commands.estop_triggered === 'boolean') {
          if (commands.estop_triggered !== estopState) {
            estopState = commands.estop_triggered;
            console.log(`\n🚨 [REMOTE WEB COMMAND] E-Stop updated via Dashboard: ${estopState ? 'ACTIVE' : 'OFF'}\n`);
          }
        }
      } catch (e) {}
    });
  }).on('error', () => undefined);
}

setInterval(() => {
  checkCommands();

  const phase = estopState ? 'EMERGENCY_STOP' : (leakState ? 'BYPASS_ACTIVE' : 'NORMAL');
  const pumpOn = !estopState;
  const sv1 = (estopState || leakState) ? 'CLOSED' : 'OPEN';
  const sv2 = estopState ? 'CLOSED' : 'OPEN';
  const sv3 = estopState ? 'CLOSED' : 'OPEN';
  const bypass = leakState ? 'OPEN' : 'CLOSED';

  const telemetry = {
    system: {
      phase,
      pump_on: pumpOn,
      last_updated: Date.now(),
    },
    tanks: {
      A: { level_pct: Number(tankALevel.toFixed(1)), level_cm: Number((tankALevel * 1.05).toFixed(1)) },
      B: { level_pct: Number(tankBLevel.toFixed(1)), level_cm: Number((tankBLevel * 1.05).toFixed(1)) },
      C: { level_pct: 65.2, level_cm: 68.5 },
    },
    flow: {
      main_header_lpm: estopState ? 0.0 : (leakState ? 18.2 : 18.6),
      branch_A_lpm: (estopState || leakState) ? 0.0 : 6.8,
      branch_B_inferred_lpm: estopState ? 0.0 : 5.7,
      branch_C_inferred_lpm: estopState ? 0.0 : 6.1,
    },
    valves: {
      SV1: sv1,
      SV2: sv2,
      SV3: sv3,
      bypass_manual: bypass,
    },
    alerts: {
      leak_detected: leakState,
    },
  };

  sendPatch(telemetry);
}, 1000);
