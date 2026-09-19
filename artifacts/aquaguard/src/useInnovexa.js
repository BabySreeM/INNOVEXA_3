import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onChildAdded, onValue, ref, set } from 'firebase/database';
import { playLeakAlert, playCriticalReserveAlert, playEmergencyStopAlert, getAudioMuted, toggleAudioMuted, sendAutomatedWhatsAppAlert, speakAlertAnnouncement, stopAllAlertSoundsAndSpeech } from './lib/audioAlerts';

const initialTanks = {
  A: { level_cm: 72.4, level_pct: 68.8, is_critical: false },
  B: { level_cm: 60.7, level_pct: 57.8, is_critical: false },
  C: { level_cm: 55.3, level_pct: 51.2, is_critical: false },
};

const initialData = {
  system: { phase: 'NORMAL', pump_on: true, last_updated: Date.now() },
  tanks: initialTanks,
  source: { level_pct: 76.2, critical: false },
  valves: { SV1: 'OPEN', SV2: 'OPEN', SV3: 'OPEN', bypass_manual: 'CLOSED' },
  flow: { main_header_lpm: 18.6, branch_A_lpm: 6.8, branch_B_inferred_lpm: 5.7, branch_C_inferred_lpm: 6.1 },
  alerts: { leak_detected: false, bucket_leak_sensor: false, source_critical: false },
  commands: { bypass_confirm: false, estop_triggered: false, priority_tank: 'A', manual_valve_override: {} },
};

const baseEvents = [
  { timestamp: Date.now() - 52000, type: 'SYSTEM', message: 'Innovexa connected to local reserve network.' },
  { timestamp: Date.now() - 184000, type: 'FLOW', message: 'All three distribution branches reporting nominal flow.' },
  { timestamp: Date.now() - 406000, type: 'SYSTEM', message: 'Morning inspection complete. No isolation requests pending.' },
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeLive(raw) {
  if (!raw) return initialData;
  return {
    ...initialData,
    ...raw,
    system: { ...initialData.system, ...(raw.system || {}), last_updated: Date.now() },
    tanks: { ...initialTanks, ...(raw.tanks || {}) },
    source: { ...initialData.source, ...(raw.source || {}) },
    valves: { ...initialData.valves, ...(raw.valves || {}), bypass_manual: raw.valves?.bypass_manual === true ? 'OPEN' : raw.valves?.bypass_manual || 'CLOSED' },
    flow: { ...initialData.flow, ...(raw.flow || {}) },
    alerts: { ...initialData.alerts, ...(raw.alerts || {}) },
    commands: { ...initialData.commands, ...(raw.commands || {}) },
  };
}


const firebaseDatabaseUrl = import.meta.env.VITE_FIREBASE_DATABASE_URL || 'https://innovexa-sih-default-rtdb.firebaseio.com';
const firebaseApiKey = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForSIHHackathon2026';
const firebaseProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'innovexa-sih';
const firebaseAppId = import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456';
const firebaseApp = (getApps()[0] || initializeApp({
  apiKey: firebaseApiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'innovexa-sih.firebaseapp.com',
  databaseURL: firebaseDatabaseUrl,
  projectId: firebaseProjectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'innovexa-sih.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: firebaseAppId,
}));
const firebaseDatabase = firebaseApp ? getDatabase(firebaseApp, firebaseDatabaseUrl) : null;


export function useInnovexa(opts = {}) {
  const liveUrl = firebaseDatabaseUrl;
  const [demoActive, setDemoActive] = useState(false);




  const [scenario, setScenario] = useState('NORMAL');
  const [data, setData] = useState(() => clone(initialData));
  const [events, setEvents] = useState(baseEvents);
  const [history, setHistory] = useState(() => [{ at: Date.now(), A: 68.8, B: 57.8, C: 51.2, phase: 'NORMAL' }]);
  const [waterSaved, setWaterSaved] = useState(0);
  const [phaseStartedAt, setPhaseStartedAt] = useState(Date.now());
  const [isLiveLoading, setIsLiveLoading] = useState(Boolean(liveUrl));
  const [liveConnected, setLiveConnected] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const [soundMuted, setSoundMuted] = useState(() => getAudioMuted());
  const toggleSound = useCallback(() => setSoundMuted(toggleAudioMuted()), []);
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const stationRef = useRef(opts?.stationId);
  stationRef.current = opts?.stationId;
  const roleRef = useRef(opts?.role);
  roleRef.current = opts?.role;

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const addEvent = useCallback((type, message) => {
    setEvents((current) => [{ timestamp: Date.now(), type, message }, ...current].slice(0, 120));
  }, []);

  const updateDemo = useCallback((nextScenario) => {
    const target = nextScenario || scenarioRef.current;
    setScenario(target);
    setPhaseStartedAt(Date.now());
    setWaterSaved((amount) => amount + (target === 'NORMAL' ? 0 : 1.8));
    const currentPriority = data.commands?.priority_tank || 'A';
    setData((current) => {
      const next = clone(current);
      next.system.last_updated = Date.now();
      next.system.phase = target === 'NORMAL' ? 'NORMAL' : target === 'SOURCE_CRITICAL' ? 'CRITICAL_RESERVE' : 'BYPASS_ACTIVE';
      next.system.pump_on = true;
      next.alerts.leak_detected = target === 'BRANCH_A' || target === 'BRANCH_B';
      next.alerts.source_critical = target === 'SOURCE_CRITICAL';
      next.valves.SV1 = target === 'BRANCH_A' ? 'CLOSED' : 'OPEN';
      next.valves.SV2 = target === 'BRANCH_B' ? 'CLOSED' : 'OPEN';
      next.valves.SV3 = target === 'SOURCE_CRITICAL' ? 'CLOSED' : 'OPEN';
      if (target === 'SOURCE_CRITICAL') {
        const priority = next.commands.priority_tank || 'A';
        next.valves.SV1 = priority === 'A' ? 'OPEN' : 'CLOSED';
        next.valves.SV2 = priority === 'B' ? 'OPEN' : 'CLOSED';
        next.valves.SV3 = priority === 'C' ? 'OPEN' : 'CLOSED';
      }
      next.valves.bypass_manual = target === 'BRANCH_A' ? 'OPEN' : 'CLOSED';
      next.source.critical = target === 'SOURCE_CRITICAL';
      next.source.level_pct = target === 'SOURCE_CRITICAL' ? 23.6 : 76.2;
      next.commands.bypass_confirm = target === 'BRANCH_A';
      if (target === 'NORMAL') {
        next.tanks = clone(initialTanks);
        next.commands.manual_valve_override = {};
        next.commands.priority_tank = 'A';
        next.commands.bypass_confirm = false;
        next.commands.estop_triggered = false;
        next.alerts.leak_detected = false;
        next.alerts.bucket_leak_sensor = false;
        next.alerts.source_critical = false;
        next.valves.SV1 = 'OPEN';
        next.valves.SV2 = 'OPEN';
        next.valves.SV3 = 'OPEN';
        next.valves.bypass_manual = 'CLOSED';
        next.system.pump_on = true;
        next.system.phase = 'NORMAL';
      }
      return next;
    });
    const message = target === 'BRANCH_A'
      ? 'Leak isolated on Branch A. SV1 closed; bypass routing supply to Tank A.'
      : target === 'BRANCH_B'
        ? 'Branch B anomaly isolated. SV2 closed; header routing held for safe inspection.'
        : target === 'SOURCE_CRITICAL'
          ? `Source critical threshold reached. Priority reserve protection engaged for Tank ${currentPriority}.`
          : 'Demo replay reset. All branches returned to normal distribution.';
    addEvent(target === 'NORMAL' ? 'SYSTEM' : 'ALERT', message);
    if (target === 'BRANCH_A' || target === 'BRANCH_B') {
      playLeakAlert();
      speakAlertAnnouncement(message);
      sendAutomatedWhatsAppAlert({ phase: target, stationId: stationRef.current, role: roleRef.current, message, priorityTank: currentPriority });
    } else if (target === 'SOURCE_CRITICAL') {
      playCriticalReserveAlert();
      speakAlertAnnouncement(message);
      sendAutomatedWhatsAppAlert({ phase: 'CRITICAL_RESERVE', stationId: stationRef.current, role: roleRef.current, message, priorityTank: currentPriority });
    }
  }, [addEvent, data.commands?.priority_tank]);

  const runDemo = useCallback(() => {
    setDemoActive(true);
    setScenario('NORMAL');
    setPhaseStartedAt(Date.now());
    setData(clone(initialData));
    setHistory([{ at: Date.now(), A: 68.8, B: 57.8, C: 51.2, phase: 'NORMAL' }]);
    setWaterSaved(0);
    setEvents([{ timestamp: Date.now(), type: 'SYSTEM', message: 'Demo Mode started. Telemetry is simulated locally.' }, ...baseEvents]);
  }, []);

  const exitDemo = useCallback(() => {
    setDemoActive(false);
    setScenario('NORMAL');
    setData(clone(initialData));
    addEvent('SYSTEM', 'Demo Mode exited. Waiting for a live Firebase connection.');
  }, [addEvent]);

  const replayDemo = useCallback(() => {
    runDemo();
    setTimeout(() => addEvent('SYSTEM', 'Replay ready. Use a scenario control to exercise isolation logic.'), 10);
  }, [addEvent, runDemo]);

  const updateCommand = useCallback((key, value) => {
    setData((current) => {
      const next = { ...current, commands: { ...current.commands, [key]: value }, system: { ...current.system, last_updated: Date.now() } };
      if (key === 'priority_tank' && scenarioRef.current === 'SOURCE_CRITICAL') {
        next.valves = {
          ...next.valves,
          SV1: value === 'A' ? 'OPEN' : 'CLOSED',
          SV2: value === 'B' ? 'OPEN' : 'CLOSED',
          SV3: value === 'C' ? 'OPEN' : 'CLOSED',
        };
      }
      if (key === 'manual_valve_override' && value?.valveId && value?.state) {
        next.commands.manual_valve_override = {
          ...(current.commands.manual_valve_override || {}),
          [value.valveId]: value.state,
        };
        next.valves[value.valveId] = value.state;
      }
      return next;
    });
    if (firebaseDatabase && !demoActive) {
      const path = key === 'manual_valve_override' && value?.valveId
        ? `commands/manual_valve_override/${value.valveId}`
        : `commands/${key}`;
      set(ref(firebaseDatabase, path), key === 'manual_valve_override' ? value.state : value).catch(() => undefined);
    }
    const isSourceCrit = scenarioRef.current === 'SOURCE_CRITICAL';
    const message = key === 'priority_tank'
      ? (isSourceCrit
          ? `Source critical threshold reached. Priority reserve protection engaged for Tank ${value}.`
          : `Priority reserve set to Tank ${value}.`)
      : key === 'manual_valve_override'
        ? `Manual override set ${value.valveId} ${value.state}.`
        : `${key} set to ${value}.`;
    addEvent(key === 'priority_tank' && isSourceCrit ? 'ALERT' : 'COMMAND', message);
  }, [addEvent, demoActive]);

  const resetControls = useCallback(() => {
    setScenario('NORMAL');
    scenarioRef.current = 'NORMAL';
    setPhaseStartedAt(Date.now());
    setData((current) => ({
      ...current,
      system: { phase: 'NORMAL', pump_on: true, last_updated: Date.now() },
      tanks: clone(initialTanks),
      source: { level_pct: 76.2, critical: false },
      valves: { SV1: 'OPEN', SV2: 'OPEN', SV3: 'OPEN', bypass_manual: 'CLOSED' },
      alerts: { leak_detected: false, bucket_leak_sensor: false, source_critical: false },
      commands: { bypass_confirm: false, estop_triggered: false, priority_tank: 'A', manual_valve_override: {} },
    }));
    if (firebaseDatabase && !demoActive) {
      set(ref(firebaseDatabase, 'commands/estop_triggered'), false).catch(() => undefined);
      set(ref(firebaseDatabase, 'commands/bypass_confirm'), false).catch(() => undefined);
      set(ref(firebaseDatabase, 'commands/manual_valve_override'), null).catch(() => undefined);
    }
    addEvent('COMMAND', 'Command flags and manual overrides reset. System returned to normal operation.');
  }, [addEvent, demoActive]);

  const emergencyStop = useCallback(() => {
    setData((current) => ({
      ...current,
      system: { ...current.system, pump_on: false, last_updated: Date.now() },
      valves: { SV1: 'CLOSED', SV2: 'CLOSED', SV3: 'CLOSED', bypass_manual: 'CLOSED' },
      flow: { main_header_lpm: 0, branch_A_lpm: 0, branch_B_inferred_lpm: 0, branch_C_inferred_lpm: 0 },
      commands: { ...current.commands, estop_triggered: true },
    }));
    if (firebaseDatabase && !demoActive) {
      set(ref(firebaseDatabase, 'commands/estop_triggered'), true).catch(() => undefined);
      set(ref(firebaseDatabase, 'valves/SV1'), 'CLOSED').catch(() => undefined);
      set(ref(firebaseDatabase, 'valves/SV2'), 'CLOSED').catch(() => undefined);
      set(ref(firebaseDatabase, 'valves/SV3'), 'CLOSED').catch(() => undefined);
      set(ref(firebaseDatabase, 'valves/bypass_manual'), 'CLOSED').catch(() => undefined);
    }
    const msg = 'Emergency Stop engaged. All valves closed and pump halted for system safety.';
    addEvent('EMERGENCY', msg);
    playEmergencyStopAlert();
    speakAlertAnnouncement(msg);
    sendAutomatedWhatsAppAlert({ phase: 'EMERGENCY_STOP', stationId: stationRef.current, role: roleRef.current, message: msg });
  }, [addEvent, demoActive]);

  const resume = useCallback(() => {
    stopAllAlertSoundsAndSpeech();
    setScenario('NORMAL');
    scenarioRef.current = 'NORMAL';
    setPhaseStartedAt(Date.now());
    setData((current) => ({
      ...current,
      system: { phase: 'NORMAL', pump_on: true, last_updated: Date.now() },
      tanks: clone(initialTanks),
      source: { level_pct: 76.2, critical: false },
      valves: { SV1: 'OPEN', SV2: 'OPEN', SV3: 'OPEN', bypass_manual: 'CLOSED' },
      alerts: { leak_detected: false, bucket_leak_sensor: false, source_critical: false },
      commands: { bypass_confirm: false, estop_triggered: false, priority_tank: 'A', manual_valve_override: {} },
    }));
    if (firebaseDatabase && !demoActive) {
      set(ref(firebaseDatabase, 'commands/estop_triggered'), false).catch(() => undefined);
      set(ref(firebaseDatabase, 'commands/bypass_confirm'), false).catch(() => undefined);
      set(ref(firebaseDatabase, 'commands/manual_valve_override'), null).catch(() => undefined);
    }
    addEvent('SYSTEM', 'System resumed. Emergency halt cleared and distribution restored to NORMAL operation.');
  }, [addEvent, demoActive]);

  useEffect(() => {
    if (!firebaseDatabase || demoActive) {
      setIsLiveLoading(false);
      return undefined;
    }
    let cancelled = false;
    const rootRef = ref(firebaseDatabase);
    const eventsRef = ref(firebaseDatabase, 'events');
    const unsubscribeData = onValue(rootRef, (snapshot) => {
      const raw = snapshot.val();
      if (!cancelled && raw) {
        setData(normalizeLive(raw));
        setLiveConnected(true);
        setIsLiveLoading(false);
        setDemoActive(false);
      }
    }, () => {

      if (!cancelled) {
        setLiveConnected(false);
        setIsLiveLoading(false);
      }
    });
    const unsubscribeEvents = onChildAdded(eventsRef, (snapshot) => {
      const event = snapshot.val();
      if (event && !cancelled) {
        setEvents((current) => [{ ...event, timestamp: Number(event.timestamp || Date.now()) }, ...current.filter((item) => item.timestamp !== event.timestamp)].slice(0, 120));
      }
    });
    return () => { cancelled = true; unsubscribeData(); unsubscribeEvents(); };
  }, [demoActive]);

  useEffect(() => {
    if (!demoActive) return undefined;
    const timer = window.setInterval(() => {
      const active = scenarioRef.current;
      setData((current) => {
        const next = clone(current);
        next.system.last_updated = Date.now();
        if (!next.system.pump_on || next.commands.estop_triggered) {
          next.valves.SV1 = 'CLOSED';
          next.valves.SV2 = 'CLOSED';
          next.valves.SV3 = 'CLOSED';
          next.valves.bypass_manual = 'CLOSED';
          next.flow.main_header_lpm = 0;
          next.flow.branch_A_lpm = 0;
          next.flow.branch_B_inferred_lpm = 0;
          next.flow.branch_C_inferred_lpm = 0;
          return next;
        }
        if (active === 'NORMAL') {
          next.tanks.A.level_pct = Math.max(0, Math.min(100, next.tanks.A.level_pct + (Math.random() - .44) * .34));
          next.tanks.B.level_pct = Math.max(0, Math.min(100, next.tanks.B.level_pct + (Math.random() - .5) * .28));
          next.tanks.C.level_pct = Math.max(0, Math.min(100, next.tanks.C.level_pct + (Math.random() - .47) * .25));
        } else if (active === 'BRANCH_A') {
          next.tanks.A.level_pct = Math.min(100, next.tanks.A.level_pct + .12);
          next.flow.branch_A_lpm = 7.4;
          next.flow.main_header_lpm = 18.2;
        } else if (active === 'BRANCH_B') {
          next.tanks.B.level_pct = Math.max(0, next.tanks.B.level_pct - .04);
          next.flow.branch_B_inferred_lpm = 0;
          next.flow.main_header_lpm = 12.7;
        } else if (active === 'SOURCE_CRITICAL') {
          const priority = next.commands.priority_tank || 'A';
          next.tanks[priority].level_pct = Math.min(100, next.tanks[priority].level_pct + .1);
          ['A', 'B', 'C'].filter((key) => key !== priority).forEach((key) => {
            next.tanks[key].level_pct = Math.max(0, next.tanks[key].level_pct - .05);
            next.tanks[key].is_critical = next.tanks[key].level_pct < 28;
          });
        }
        Object.keys(next.tanks).forEach((key) => {
          next.tanks[key].level_cm = Number((next.tanks[key].level_pct * 1.05).toFixed(1));
          next.tanks[key].is_critical = next.tanks[key].level_pct < 28;
        });
        return next;
      });
      setHistory((current) => {
        const last = data.tanks;
        const point = { at: Date.now(), A: last.A.level_pct, B: last.B.level_pct, C: last.C.level_pct, phase: data.system.phase };
        return [...current, point].slice(-42);
      });
      if (active === 'SOURCE_CRITICAL') setWaterSaved((amount) => Number((amount + .03).toFixed(2)));
    }, 1200);
    return () => window.clearInterval(timer);
  }, [data, demoActive]);

  const freshness = useMemo(() => {
    const age = Math.max(0, clock - Number(data.system.last_updated || 0));
    return { age, stale: age > 5000 };
  }, [clock, data.system.last_updated]);

  const updateTankLevel = useCallback((tankKey, pct) => {
    setData((current) => {
      const next = clone(current);
      if (next.tanks[tankKey]) {
        const wasCritical = next.tanks[tankKey].is_critical;
        const isNowCritical = pct < 20;
        next.tanks[tankKey].level_pct = pct;
        next.tanks[tankKey].level_cm = Number((pct * 1.05).toFixed(1));
        next.tanks[tankKey].is_critical = isNowCritical;

        if (!wasCritical && isNowCritical) {
          const msg = `Critical low level detected in Tank ${tankKey} (${pct.toFixed(1)}%). Priority reserve protection engaged.`;
          addEvent('ALERT', msg);
          playCriticalReserveAlert();
          speakAlertAnnouncement(msg);
          sendAutomatedWhatsAppAlert({ phase: 'CRITICAL_RESERVE', stationId: stationRef.current, role: roleRef.current, message: msg, priorityTank: tankKey });
        }
      }
      next.system.last_updated = Date.now();
      return next;
    });
  }, [addEvent]);

  return {
    data, events, history, waterSaved, scenario, phaseStartedAt, freshness,
    demoActive, liveConfigured: Boolean(firebaseDatabase), isLiveLoading,
    isConnected: demoActive || liveConnected, soundMuted, toggleSound,
    runDemo, exitDemo, replayDemo, simulateLeakA: () => updateDemo('BRANCH_A'),
    simulateLeakB: () => updateDemo('BRANCH_B'), simulateSourceCritical: () => updateDemo('SOURCE_CRITICAL'),
    resetScenario: () => updateDemo('NORMAL'), updateCommand, resetControls, emergencyStop, resume, updateTankLevel,
  };
}


export default useInnovexa;
