import { useState } from 'react';
import { Cpu, AlertTriangle, RotateCcw, Sliders, Play, Pause, ExternalLink } from 'lucide-react';

export interface HardwareTwinPanelProps {
  data: {
    system: { phase: string; pump_on: boolean; last_updated: number };
    tanks: {
      A: { level_pct: number; level_cm: number; is_critical?: boolean };
      B: { level_pct: number; level_cm: number; is_critical?: boolean };
      C: { level_pct: number; level_cm: number; is_critical?: boolean };
    };
    valves: { SV1: string; SV2: string; SV3: string; bypass_manual: string };
    alerts: { leak_detected: boolean; bucket_leak_sensor?: boolean; source_critical?: boolean };
    commands: { estop_triggered?: boolean; priority_tank?: string };
    source?: { level_pct: number; critical?: boolean };
    flow?: { main_header_lpm: number; branch_A_lpm: number };
  };
  onSimulateLeak: () => void;
  onSimulateEstop: () => void;
  onResetNormal: () => void;
  onUpdateTankLevel: (tankKey: 'A' | 'B' | 'C', pct: number) => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface WireJump {
  x: number;
  y: number;
  axis: 'h' | 'v'; // 'h' = horizontal segment jumps vertical wire, 'v' = vertical segment jumps horizontal wire
}

export function routeOrthogonalWire(waypoints: Point[], radius = 4): string {
  if (waypoints.length < 2) return '';

  let d = `M ${waypoints[0].x} ${waypoints[0].y}`;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];

    const isHorizontal = Math.abs(p1.y - p2.y) < 0.1;

    if (i < waypoints.length - 2) {
      const p3 = waypoints[i + 2];
      if (isHorizontal) {
        const dx = Math.sign(p2.x - p1.x) * radius;
        const dy = Math.sign(p3.y - p2.y) * radius;
        d += ` L ${p2.x - dx} ${p2.y} Q ${p2.x} ${p2.y} ${p2.x} ${p2.y + dy}`;
      } else {
        const dy = Math.sign(p2.y - p1.y) * radius;
        const dx = Math.sign(p3.x - p2.x) * radius;
        d += ` L ${p2.x} ${p2.y - dy} Q ${p2.x} ${p2.y} ${p2.x + dx} ${p2.y}`;
      }
    } else {
      d += ` L ${p2.x} ${p2.y}`;
    }
  }

  return d;
}

export function HardwareTwinPanel({
  data,
  onSimulateLeak,
  onSimulateEstop,
  onResetNormal,
  onUpdateTankLevel,
}: HardwareTwinPanelProps) {
  const [activeTab, setActiveTab] = useState<'schematic' | 'pins'>('schematic');

  const sv1Open = data.valves.SV1 === 'OPEN';
  const sv2Open = data.valves.SV2 === 'OPEN';
  const sv3Open = data.valves.SV3 === 'OPEN';
  const bypassOpen = data.valves.bypass_manual === 'OPEN';
  const isEstop = data.commands.estop_triggered === true;
  const isLeak = data.alerts.leak_detected === true;

  // Pin logic levels
  const pinD26 = sv1Open ? 'HIGH' : 'LOW'; // SV1 Red LED
  const pinD27 = sv2Open ? 'HIGH' : 'LOW'; // SV2 Yellow LED
  const pinD25 = sv3Open ? 'HIGH' : 'LOW'; // SV3 Green LED
  const pinD32 = bypassOpen ? 'HIGH' : 'LOW'; // Bypass Blue LED
  const pinD34 = isLeak ? 'LOW' : 'HIGH'; // Leak sensor pullup

  const targetALevel = Math.round(data.tanks.A?.level_pct ?? 69);
  const targetBLevel = Math.round(data.tanks.B?.level_pct ?? 58);

  return (
    <section className="panel relative overflow-hidden rounded-[1.35rem] p-6 shadow-sm border border-border" data-testid="card-hardware-digital-twin">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary shadow-sm">
            <Cpu size={22} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow">Wokwi 1:1 Hardware Digital Twin</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#5f9e87]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">ESP32 DEVKIT V1</span>
            </div>
            <h2 className="display-face mt-0.5 text-2xl font-semibold text-primary">
              Hardware Digital Twin
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onSimulateLeak}
            className={`btn-quiet flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              isLeak
                ? 'border-[#e7c6be] bg-[#f8e9e4] text-[#93483d]'
                : 'border-border bg-secondary text-primary hover:bg-secondary/80'
            }`}
            data-testid="button-hw-trigger-leak"
          >
            <AlertTriangle size={15} className={isLeak ? 'text-[#d87563] animate-bounce' : 'text-[#c39a4d]'} />
            <span>{isLeak ? 'Leak Active (D34 LOW)' : 'Trigger Leak Button'}</span>
          </button>

          <button
            type="button"
            onClick={isEstop ? onResetNormal : onSimulateEstop}
            className={`btn-quiet flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              isEstop
                ? 'border-[#e7c6be] bg-[#f8e9e4] text-[#93483d]'
                : 'border-border bg-secondary text-primary hover:bg-secondary/80'
            }`}
            data-testid="button-hw-trigger-estop"
          >
            {isEstop ? <Play size={15} /> : <Pause size={15} className="text-[#d87563]" />}
            <span>{isEstop ? 'Resume Operation' : 'E-Stop Switch'}</span>
          </button>

          <button
            type="button"
            onClick={onResetNormal}
            className="btn-quiet flex items-center gap-2 rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-semibold text-primary hover:bg-secondary/80"
            data-testid="button-hw-reset"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={() => {
              window.open('/?view=twin', 'InnovexaHardwareTwin', 'width=1180,height=820,resizable=yes,scrollbars=yes');
            }}
            className="btn-quiet flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition"
            title="Pop-Out Circuit Twin into standalone window (BroadcastChannel zero latency sync)"
            data-testid="button-hw-popout"
          >
            <ExternalLink size={14} />
            <span>Pop-Out Twin</span>
          </button>

          <div className="ml-1 flex rounded-lg border border-border bg-secondary p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('schematic')}
              className={`rounded-md px-2.5 py-1 transition ${
                activeTab === 'schematic' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Schematic
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pins')}
              className={`rounded-md px-2.5 py-1 transition ${
                activeTab === 'pins' ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'
              }`}
            >
              GPIO Matrix
            </button>
          </div>
        </div>
      </div>

      {/* Main Schematic View - Wokwi Light Theme */}
      {activeTab === 'schematic' ? (
        <div className="relative mt-6 overflow-x-auto rounded-2xl border border-border bg-[#e5e9f0] p-4 sm:p-6 shadow-inner">
          <svg viewBox="0 0 960 580" className="min-w-[880px] w-full" role="img" aria-label="Wokwi ESP32 Circuit Canvas">
            <defs>
              {/* Metallic Silver Gradient for ESP32 Shield & Ultrasonic Cylinders */}
              <linearGradient id="metal-silver-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="25%" stopColor="#cbd5e1" />
                <stop offset="50%" stopColor="#f1f5f9" />
                <stop offset="75%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              {/* Gold Pin Header Gradient */}
              <linearGradient id="gold-pin-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#ca8a04" />
                <stop offset="100%" stopColor="#854d0e" />
              </linearGradient>

              {/* Chrome Metal Lead Gradient */}
              <linearGradient id="chrome-lead-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>

              {/* Ceramic 220 Ohm Resistor Body Gradient */}
              <linearGradient id="resistor-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fde68a" />
                <stop offset="50%" stopColor="#d97706" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>

              {/* Ultrasonic Speaker Mesh Pattern */}
              <pattern id="speaker-mesh-pattern" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
                <rect width="4" height="4" fill="#1e293b" />
                <circle cx="2" cy="2" r="1.2" fill="#64748b" />
              </pattern>

              {/* Component Drop Shadow */}
              <filter id="wokwi-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="5" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.35" />
              </filter>

              {/* LED Diffusion Glow Filters */}
              <filter id="glow-red-light" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-yellow-light" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-green-light" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="glow-blue-light" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Wokwi Light Canvas Grid Lines */}
            <g stroke="#cbd5e1" strokeWidth="1" opacity="0.6">
              {Array.from({ length: 24 }).map((_, i) => (
                <line key={`v-${i}`} x1={i * 40} y1="0" x2={i * 40} y2="580" />
              ))}
              {Array.from({ length: 15 }).map((_, i) => (
                <line key={`h-${i}`} x1="0" y1={i * 40} x2="960" y2={i * 40} />
              ))}
            </g>

            {/* ========================================================================= */}
            {/* 1. TARGET A: HC-SR04 ULTRASONIC SENSOR (TOP LEFT) */}
            {/* ========================================================================= */}
            <g transform="translate(160, 20)" data-testid="hw-sensor-target-a" filter="url(#wokwi-shadow)">
              {/* Sleek Translucent Level Control Pill */}
              <rect x="10" y="0" width="200" height="28" rx="14" fill="#0f172a" opacity="0.85" stroke="#38bdf8" strokeWidth="1" />
              <text x="24" y="18" fontSize="10" fontWeight="bold" fill="#38bdf8">Target A Level:</text>
              <rect x="110" y="9" width="55" height="10" rx="5" fill="#1e293b" />
              <rect x="110" y="9" width={Math.max(8, (targetALevel / 100) * 55)} height="10" rx="5" fill="#10b981" />
              <circle cx={110 + (targetALevel / 100) * 55} cy="14" r="6" fill="#ffffff" stroke="#10b981" strokeWidth="2" className="cursor-pointer" />
              <text x="172" y="18" fontSize="10" fontWeight="bold" fill="#ffffff" className="font-mono">{targetALevel}%</text>

              {/* Blue FR4 PCB Board */}
              <rect x="0" y="34" width="220" height="92" rx="8" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
              {/* Corner Mounting Holes with Metallic Rings */}
              <circle cx="10" cy="44" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="210" cy="44" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="10" cy="118" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="210" cy="118" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <text x="110" y="49" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff" letterSpacing="1.5">HC-SR04</text>

              {/* Ultrasonic Metallic Transducer Cylinder 1 (T - Transmitter) */}
              <circle cx="55" cy="80" r="26" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="2" />
              <circle cx="55" cy="80" r="23" fill="url(#speaker-mesh-pattern)" stroke="#0f172a" strokeWidth="1.5" />
              <text x="55" y="83" textAnchor="middle" fontSize="12" fontWeight="900" fill="#f8fafc" opacity="0.8">T</text>

              {/* Ultrasonic Metallic Transducer Cylinder 2 (R - Receiver) */}
              <circle cx="165" cy="80" r="26" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="2" />
              <circle cx="165" cy="80" r="23" fill="url(#speaker-mesh-pattern)" stroke="#0f172a" strokeWidth="1.5" />
              <text x="165" y="83" textAnchor="middle" fontSize="12" fontWeight="900" fill="#f8fafc" opacity="0.8">R</text>

              {/* Gold Solder Pad Pin Headers at Bottom */}
              <g transform="translate(45, 126)">
                {['VCC', 'TRIG', 'ECHO', 'GND'].map((pin, index) => (
                  <g key={pin} transform={`translate(${index * 40}, 0)`}>
                    <circle cx="0" cy="0" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
                    <circle cx="0" cy="0" r="1.8" fill="#1e293b" />
                    <text x="0" y="-6" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#ffffff">{pin}</text>
                  </g>
                ))}
              </g>
            </g>

            {/* ========================================================================= */}
            {/* 2. TARGET B: HC-SR04 ULTRASONIC SENSOR (TOP RIGHT) */}
            {/* ========================================================================= */}
            <g transform="translate(620, 20)" data-testid="hw-sensor-target-b" filter="url(#wokwi-shadow)">
              {/* Sleek Translucent Level Control Pill */}
              <rect x="10" y="0" width="200" height="28" rx="14" fill="#0f172a" opacity="0.85" stroke="#38bdf8" strokeWidth="1" />
              <text x="24" y="18" fontSize="10" fontWeight="bold" fill="#38bdf8">Target B Level:</text>
              <rect x="110" y="9" width="55" height="10" rx="5" fill="#1e293b" />
              <rect x="110" y="9" width={Math.max(8, (targetBLevel / 100) * 55)} height="10" rx="5" fill="#10b981" />
              <circle cx={110 + (targetBLevel / 100) * 55} cy="14" r="6" fill="#ffffff" stroke="#10b981" strokeWidth="2" className="cursor-pointer" />
              <text x="172" y="18" fontSize="10" fontWeight="bold" fill="#ffffff" className="font-mono">{targetBLevel}%</text>

              {/* Blue FR4 PCB Board */}
              <rect x="0" y="34" width="220" height="92" rx="8" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
              <circle cx="10" cy="44" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="210" cy="44" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="10" cy="118" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="210" cy="118" r="4" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <text x="110" y="49" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff" letterSpacing="1.5">HC-SR04</text>

              {/* Ultrasonic Metallic Transducer Cylinders */}
              <circle cx="55" cy="80" r="26" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="2" />
              <circle cx="55" cy="80" r="23" fill="url(#speaker-mesh-pattern)" stroke="#0f172a" strokeWidth="1.5" />
              <text x="55" y="83" textAnchor="middle" fontSize="12" fontWeight="900" fill="#f8fafc" opacity="0.8">T</text>

              <circle cx="165" cy="80" r="26" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="2" />
              <circle cx="165" cy="80" r="23" fill="url(#speaker-mesh-pattern)" stroke="#0f172a" strokeWidth="1.5" />
              <text x="165" y="83" textAnchor="middle" fontSize="12" fontWeight="900" fill="#f8fafc" opacity="0.8">R</text>

              {/* Gold Solder Pad Pin Headers at Bottom */}
              <g transform="translate(45, 126)">
                {['VCC', 'TRIG', 'ECHO', 'GND'].map((pin, index) => (
                  <g key={pin} transform={`translate(${index * 40}, 0)`}>
                    <circle cx="0" cy="0" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
                    <circle cx="0" cy="0" r="1.8" fill="#1e293b" />
                    <text x="0" y="-6" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#ffffff">{pin}</text>
                  </g>
                ))}
              </g>
            </g>

            {/* ========================================================================= */}
            {/* 3. RELAY MODULE (LEFT SIDE - 1-CHANNEL 5V HORIZONTAL WOKWI SPEC) */}
            {/* ========================================================================= */}
            <g transform="translate(30, 220)" data-testid="hw-relay-module" filter="url(#wokwi-shadow)">
              {/* Industrial Red FR4 PCB */}
              <rect x="0" y="0" width="135" height="75" rx="6" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
              {/* Corner Screw Holes */}
              <circle cx="8" cy="8" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="127" cy="8" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="8" cy="67" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="127" cy="67" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />

              {/* Left 3-Pin Blue Screw Terminal Block (NO COM NC) */}
              <rect x="6" y="16" width="26" height="44" rx="3" fill="#1d4ed8" stroke="#1e40af" strokeWidth="1" />
              <circle cx="19" cy="23" r="4" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
              <circle cx="19" cy="23" r="1.5" fill="#0f172a" />
              <circle cx="19" cy="38" r="4" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
              <circle cx="19" cy="38" r="1.5" fill="#0f172a" />
              <circle cx="19" cy="53" r="4" fill="#475569" stroke="#cbd5e1" strokeWidth="1" />
              <circle cx="19" cy="53" r="1.5" fill="#0f172a" />
              <text x="35" y="40" fontSize="6.5" fontWeight="bold" fill="#ffffff">NO COM NC</text>

              {/* SONGLE Blue Relay Module Center Cube */}
              <rect x="42" y="12" width="60" height="52" rx="4" fill="#2563eb" stroke="#1d4ed8" strokeWidth="1.5" />
              <text x="72" y="34" textAnchor="middle" fontSize="12" fontWeight="900" fill="#ffffff" letterSpacing="0.5">Relay</text>
              <text x="72" y="48" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#93c5fd">Module</text>

              {/* Right Pin Header Plastic Base & 3 Male Pins facing RIGHT */}
              <rect x="135" y="16" width="10" height="44" rx="1.5" fill="#18181b" stroke="#0f172a" strokeWidth="1" />
              {/* VCC Pin */}
              <line x1="145" y1="23" x2="162" y2="23" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="square" />
              <text x="131" y="26" textAnchor="end" fontSize="7.5" fontWeight="bold" fill="#ffffff">VCC</text>
              {/* GND Pin */}
              <line x1="145" y1="38" x2="162" y2="38" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="square" />
              <text x="131" y="41" textAnchor="end" fontSize="7.5" fontWeight="bold" fill="#ffffff">GND</text>
              {/* IN Pin */}
              <line x1="145" y1="53" x2="162" y2="53" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="square" />
              <text x="131" y="56" textAnchor="end" fontSize="7.5" fontWeight="bold" fill="#ffffff">IN</text>
            </g>

            {/* ========================================================================= */}
            {/* 4. ESP32 DEVKIT MICROCONTROLLER BOARD (CENTER) */}
            {/* ========================================================================= */}
            <g transform="translate(430, 200)" data-testid="hw-esp32-board" filter="url(#wokwi-shadow)">
              {/* Matte Black FR4 PCB Board */}
              <rect x="0" y="0" width="130" height="250" rx="12" fill="#18181b" stroke="#27272a" strokeWidth="2" />
              <circle cx="10" cy="10" r="3.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="120" cy="10" r="3.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="10" cy="240" r="3.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="120" cy="240" r="3.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />

              {/* Brushed Metallic ESP-WROOM-32 Metal Shield */}
              <rect x="16" y="42" width="98" height="114" rx="6" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="1.5" />
              <path d="M 30 15 H 100 V 38 H 30" stroke="#ca8a04" strokeWidth="2" fill="none" strokeLinecap="square" />
              <text x="65" y="90" textAnchor="middle" fontSize="15" fontWeight="900" fill="#0f172a" letterSpacing="1">ESP32</text>
              <text x="65" y="106" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#334155">ESP-WROOM-32</text>
              <text x="65" y="118" textAnchor="middle" fontSize="7" fill="#64748b">FCC ID: 2AC7Z-ESPWROOM32</text>

              {/* Micro-USB Port */}
              <rect x="42" y="234" width="46" height="16" rx="4" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="1.5" />
              <rect x="50" y="240" width="30" height="8" rx="2" fill="#0f172a" />

              {/* EN & BOOT Buttons */}
              <g transform="translate(16, 224)">
                <rect x="0" y="0" width="16" height="12" rx="2" fill="#334155" />
                <text x="8" y="9" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#ffffff">EN</text>
              </g>
              <g transform="translate(98, 224)">
                <rect x="0" y="0" width="16" height="12" rx="2" fill="#334155" />
                <text x="8" y="9" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="#ffffff">BOOT</text>
              </g>

              {/* Status LEDs */}
              <circle cx="28" cy="180" r="2.5" fill="#ef4444" />
              <text x="28" y="191" textAnchor="middle" fontSize="6" fill="#cbd5e1">PWR</text>
              <circle cx="102" cy="180" r="2.5" fill="#3b82f6" />
              <text x="102" y="191" textAnchor="middle" fontSize="6" fill="#cbd5e1">IO2</text>

              {/* Left Row Header Pins */}
              {[
                { name: 'EN', color: '#f8fafc' },
                { name: 'VP', color: '#f8fafc' },
                { name: 'VN', color: '#f8fafc' },
                { name: 'D34', color: '#f59e0b' }, // LEAK INPUT ONLY
                { name: 'D35', color: '#f8fafc' },
                { name: 'D32', color: '#3b82f6' }, // BYPASS
                { name: 'D33', color: '#64748b' },
                { name: 'D25', color: '#22c55e' }, // SV3
                { name: 'D26', color: '#ef4444' }, // SV1
                { name: 'D27', color: '#f97316' }, // RELAY PUMP OUTPUT
                { name: 'D14', color: '#f8fafc' },
                { name: 'D12', color: '#f8fafc' },
                { name: 'D13', color: '#ea580c' }, // E-STOP
                { name: 'GND', color: '#cbd5e1' },
                { name: 'VIN', color: '#ef4444' }
              ].map((pin, i) => (
                <g key={`L-${pin.name}`} transform={`translate(0, ${15 + i * 15.5})`}>
                  <rect x="-4" y="-3" width="8" height="6" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="1.5" fill="#1e293b" />
                  <text x="8" y="2.5" fontSize="7.5" fontWeight="bold" fill={pin.color}>{pin.name}</text>
                </g>
              ))}

              {/* Right Row Header Pins */}
              {[
                'D23', 'D22', 'TX0', 'RX0', 'D21', 'D19', 'D18', 'D5', 'D24', 'RX2', 'D4', 'D2', 'D15', 'GND', '3V3'
              ].map((pin, i) => (
                <g key={`R-${pin}`} transform={`translate(130, ${15 + i * 15.5})`}>
                  <rect x="-4" y="-3" width="8" height="6" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="0.8" />
                  <circle cx="0" cy="0" r="1.5" fill="#1e293b" />
                  <text x="-8" y="2.5" textAnchor="end" fontSize="7.5" fontWeight="bold" fill="#f8fafc">{pin}</text>
                </g>
              ))}
            </g>

            {/* ========================================================================= */}
            {/* 4.5 INDUSTRIAL E-STOP / RESUME PUSHBUTTON SWITCH (BOTTOM LEFT - X: 70, Y: 450) */}
            {/* ========================================================================= */}
            <g
              transform="translate(70, 450)"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const bc = new BroadcastChannel('innovexa_hardware_twin_bus');
                  if (isEstop) {
                    bc.postMessage({ type: 'RESET_NORMAL' });
                  } else {
                    bc.postMessage({ type: 'SIMULATE_ESTOP' });
                  }
                  bc.close();
                }
                if (isEstop) {
                  if (onResetNormal) onResetNormal();
                } else {
                  if (onSimulateEstop) onSimulateEstop();
                }
              }}
              className="cursor-pointer hover:opacity-95 transition"
              data-testid="hw-btn-estop-switch"
              filter="url(#wokwi-shadow)"
            >
              {/* Yellow Industrial Enclosure Housing */}
              <rect x="0" y="0" width="80" height="80" rx="10" fill="#f59e0b" stroke="#b45309" strokeWidth="2.5" />
              {/* Corner Screw Fixings */}
              <circle cx="8" cy="8" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="72" cy="8" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="8" cy="72" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              <circle cx="72" cy="72" r="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
              
              {/* Inner Bezel Ring */}
              <circle cx="40" cy="40" r="30" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
              
              {/* Main Mushroom Knob Button (Red for E-Stop, Green for Resume) */}
              <circle cx="40" cy="40" r="24" fill={isEstop ? '#16a34a' : '#dc2626'} stroke={isEstop ? '#86efac' : '#fca5a5'} strokeWidth="2" />
              <circle cx="40" cy="40" r="18" fill={isEstop ? '#15803d' : '#991b1b'} />
              
              {/* Button Label Text */}
              <text x="40" y="43" textAnchor="middle" fontSize="8" fontWeight="900" fill="#ffffff" letterSpacing="0.5">
                {isEstop ? 'RESUME' : 'E-STOP'}
              </text>

              {/* PCB Pin Terminals */}
              <circle cx="40" cy="0" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
              <circle cx="40" cy="80" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
            </g>

            {/* ========================================================================= */}
            {/* 5. RED TACTILE PUSHBUTTON LEAK SENSOR (BOTTOM LEFT - X: 210, Y: 450) */}
            {/* ========================================================================= */}
            <g
              transform="translate(210, 450)"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  const bc = new BroadcastChannel('innovexa_hardware_twin_bus');
                  bc.postMessage({ type: 'SIMULATE_LEAK' });
                  bc.close();
                }
                if (onSimulateLeak) onSimulateLeak();
              }}
              className="cursor-pointer hover:opacity-95 transition"
              data-testid="hw-btn-leak-sensor"
              filter="url(#wokwi-shadow)"
            >
              <rect x="0" y="0" width="80" height="80" rx="8" fill="url(#metal-silver-grad)" stroke="#475569" strokeWidth="2" />
              <circle cx="8" cy="8" r="3" fill="url(#gold-pin-grad)" />
              <circle cx="72" cy="8" r="3" fill="url(#gold-pin-grad)" />
              <circle cx="8" cy="72" r="3" fill="url(#gold-pin-grad)" />
              <circle cx="72" cy="72" r="3" fill="url(#gold-pin-grad)" />
              <circle cx="40" cy="40" r="30" fill="#1e293b" stroke="#0f172a" strokeWidth="1.5" />
              <circle cx="40" cy="40" r="24" fill={isLeak ? '#dc2626' : '#ef4444'} stroke="#fca5a5" strokeWidth="2" />
              <circle cx="40" cy="40" r="18" fill={isLeak ? '#991b1b' : '#dc2626'} />
              <text x="40" y="44" textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff" letterSpacing="0.5">
                {isLeak ? 'LEAK!' : 'LEAK'}
              </text>
              <circle cx="40" cy="0" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
              <circle cx="40" cy="80" r="4" fill="url(#gold-pin-grad)" stroke="#78350f" strokeWidth="1" />
            </g>

            {/* ========================================================================= */}
            {/* 6. 4x 5MM DOME LEDS WITH VISIBLE THICK DUAL LEGS & 220Ω RESISTORS */}
            {/* ========================================================================= */}
            {/* SV1 RED LED */}
            <g transform="translate(420, 470)" data-testid="hw-led-sv1" filter="url(#wokwi-shadow)">
              {/* Left Anode (+) Silver Lead Leg */}
              <line x1="-8" y1="23" x2="-8" y2="65" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              {/* Right Cathode (-) Silver Lead Leg */}
              <line x1="8" y1="23" x2="8" y2="38" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              
              {/* 220 Ohm Axial Resistor on Cathode (-) Leg */}
              <g transform="translate(8, 38)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="2.5" />
                <rect x="-5" y="6" width="10" height="18" rx="2.5" fill="#d97706" stroke="#78350f" strokeWidth="1" />
                <rect x="-5" y="9" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="12" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="15" width="10" height="2" fill="#78350f" />
                <rect x="-5" y="18" width="10" height="2" fill="#eab308" />
                <line x1="0" y1="24" x2="0" y2="32" stroke="#475569" strokeWidth="2.5" />
              </g>

              {/* 5mm Red Dome LED */}
              <path
                d="M -14 20 A 14 14 0 0 1 14 20 Z"
                fill={sv1Open ? '#ef4444' : '#7f1d1d'}
                stroke={sv1Open ? '#fca5a5' : '#991b1b'}
                strokeWidth="2"
                filter={sv1Open ? 'url(#glow-red-light)' : undefined}
              />
              <rect x="-16" y="18" width="32" height="5" rx="2" fill={sv1Open ? '#dc2626' : '#7f1d1d'} />
              <text x="0" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">SV1</text>
              <text x="0" y="97" textAnchor="middle" fontSize="8" fontWeight="semibold" fill="#64748b">Branch A</text>
            </g>

            {/* SV2 YELLOW LED */}
            <g transform="translate(520, 470)" data-testid="hw-led-sv2" filter="url(#wokwi-shadow)">
              <line x1="-8" y1="23" x2="-8" y2="65" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <line x1="8" y1="23" x2="8" y2="38" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <g transform="translate(8, 38)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="2.5" />
                <rect x="-5" y="6" width="10" height="18" rx="2.5" fill="#d97706" stroke="#78350f" strokeWidth="1" />
                <rect x="-5" y="9" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="12" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="15" width="10" height="2" fill="#78350f" />
                <rect x="-5" y="18" width="10" height="2" fill="#eab308" />
                <line x1="0" y1="24" x2="0" y2="32" stroke="#475569" strokeWidth="2.5" />
              </g>
              <path
                d="M -14 20 A 14 14 0 0 1 14 20 Z"
                fill={sv2Open ? '#eab308' : '#854d0e'}
                stroke={sv2Open ? '#fef08a' : '#a16207'}
                strokeWidth="2"
                filter={sv2Open ? 'url(#glow-yellow-light)' : undefined}
              />
              <rect x="-16" y="18" width="32" height="5" rx="2" fill={sv2Open ? '#ca8a04' : '#854d0e'} />
              <text x="0" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">SV2</text>
              <text x="0" y="97" textAnchor="middle" fontSize="8" fontWeight="semibold" fill="#64748b">Branch B</text>
            </g>

            {/* SV3 GREEN LED */}
            <g transform="translate(620, 470)" data-testid="hw-led-sv3" filter="url(#wokwi-shadow)">
              <line x1="-8" y1="23" x2="-8" y2="65" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <line x1="8" y1="23" x2="8" y2="38" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <g transform="translate(8, 38)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="2.5" />
                <rect x="-5" y="6" width="10" height="18" rx="2.5" fill="#d97706" stroke="#78350f" strokeWidth="1" />
                <rect x="-5" y="9" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="12" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="15" width="10" height="2" fill="#78350f" />
                <rect x="-5" y="18" width="10" height="2" fill="#eab308" />
                <line x1="0" y1="24" x2="0" y2="32" stroke="#475569" strokeWidth="2.5" />
              </g>
              <path
                d="M -14 20 A 14 14 0 0 1 14 20 Z"
                fill={sv3Open ? '#22c55e' : '#166534'}
                stroke={sv3Open ? '#86efac' : '#15803d'}
                strokeWidth="2"
                filter={sv3Open ? 'url(#glow-green-light)' : undefined}
              />
              <rect x="-16" y="18" width="32" height="5" rx="2" fill={sv3Open ? '#16a34a' : '#166534'} />
              <text x="0" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">SV3</text>
              <text x="0" y="97" textAnchor="middle" fontSize="8" fontWeight="semibold" fill="#64748b">Main</text>
            </g>

            {/* BYPASS BLUE LED */}
            <g transform="translate(730, 470)" data-testid="hw-led-bypass" filter="url(#wokwi-shadow)">
              <line x1="-8" y1="23" x2="-8" y2="65" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <line x1="8" y1="23" x2="8" y2="38" stroke="#475569" strokeWidth="3" strokeLinecap="square" />
              <g transform="translate(8, 38)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="#475569" strokeWidth="2.5" />
                <rect x="-5" y="6" width="10" height="18" rx="2.5" fill="#d97706" stroke="#78350f" strokeWidth="1" />
                <rect x="-5" y="9" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="12" width="10" height="2" fill="#ef4444" />
                <rect x="-5" y="15" width="10" height="2" fill="#78350f" />
                <rect x="-5" y="18" width="10" height="2" fill="#eab308" />
                <line x1="0" y1="24" x2="0" y2="32" stroke="#475569" strokeWidth="2.5" />
              </g>
              <path
                d="M -14 20 A 14 14 0 0 1 14 20 Z"
                fill={bypassOpen ? '#3b82f6' : '#1e40af'}
                stroke={bypassOpen ? '#93c5fd' : '#1d4ed8'}
                strokeWidth="2"
                filter={bypassOpen ? 'url(#glow-blue-light)' : undefined}
              />
              <rect x="-16" y="18" width="32" height="5" rx="2" fill={bypassOpen ? '#2563eb' : '#1e40af'} />
              <text x="0" y="86" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#0f172a">Bypass</text>
              <text x="0" y="97" textAnchor="middle" fontSize="8" fontWeight="semibold" fill="#64748b">Valve</text>
            </g>

            {/* ========================================================================= */}
            {/* 7. PIN-TO-PIN COLOR-CODED MANHATTAN WIRING TRACES (PERFECTLY ALIGNED) */}
            {/* ========================================================================= */}

            {/* --- A. RED VCC POWER RAIL (#ef4444, width 3.5, top rail y = 135) --- */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 431.5 },
                { x: 340, y: 431.5 },
                { x: 340, y: 135 },
                { x: 205, y: 135 },
                { x: 205, y: 146 },
              ])}
              stroke="#ef4444"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Target B VCC Pin Branch */}
            <path
              d={routeOrthogonalWire([
                { x: 340, y: 135 },
                { x: 665, y: 135 },
                { x: 665, y: 146 },
              ])}
              stroke="#ef4444"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Relay VCC Pin Branch */}
            <line x1="192" y1="243" x2="340" y2="243" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            {/* Target A VCC Pin Branch */}
            <line x1="205" y1="135" x2="205" y2="146" stroke="#ef4444" strokeWidth="3.5" strokeLinecap="round" />
            {/* Junction Dots for VCC */}
            <circle cx="340" cy="243" r="3.5" fill="#ef4444" />
            <circle cx="340" cy="135" r="3.5" fill="#ef4444" />
            <circle cx="205" cy="135" r="3.5" fill="#ef4444" />
            <circle cx="665" cy="135" r="3.5" fill="#ef4444" />

            {/* --- B. BLACK GND GROUND RAIL (#18181b, width 4, top rail y = 125) --- */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 416 },
                { x: 325, y: 416 },
                { x: 325, y: 125 },
                { x: 785, y: 125 },
                { x: 785, y: 146 },
              ])}
              stroke="#18181b"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Relay GND Pin Branch */}
            <line x1="192" y1="258" x2="325" y2="258" stroke="#18181b" strokeWidth="4" strokeLinecap="round" />
            {/* Target A GND Pin Branch (Straight vertical drop from y=125) */}
            <line x1="325" y1="125" x2="325" y2="146" stroke="#18181b" strokeWidth="4" strokeLinecap="round" />
            {/* Downward GND Bus to Bottom Rail (y = 540) */}
            <path
              d={routeOrthogonalWire([
                { x: 325, y: 258 },
                { x: 325, y: 540 },
                { x: 110, y: 540 },
                { x: 740, y: 540 },
              ])}
              stroke="#18181b"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* E-STOP Pushbutton GND Leg */}
            <line x1="110" y1="530" x2="110" y2="540" stroke="#18181b" strokeWidth="3.5" strokeLinecap="round" />
            {/* LEAK Pushbutton GND Leg */}
            <line x1="250" y1="530" x2="250" y2="540" stroke="#18181b" strokeWidth="3.5" strokeLinecap="round" />
            {/* Junction Dots for GND */}
            <circle cx="325" cy="258" r="4" fill="#18181b" />
            <circle cx="325" cy="125" r="4" fill="#18181b" />
            <circle cx="785" cy="125" r="4" fill="#18181b" />
            <circle cx="110" cy="540" r="4" fill="#18181b" />
            <circle cx="250" cy="540" r="4" fill="#18181b" />
            <circle cx="428" cy="540" r="4" fill="#18181b" />
            <circle cx="528" cy="540" r="4" fill="#18181b" />
            <circle cx="628" cy="540" r="4" fill="#18181b" />
            <circle cx="738" cy="540" r="4" fill="#18181b" />

            {/* --- C. TARGET A SENSOR WIRES (HC-SR04 A: TRIG -> GPIO19, ECHO -> 1kΩ/2kΩ DIVIDER -> GPIO18) --- */}
            {/* Target A TRIG -> ESP32 D19 (Direct) */}
            <path
              d={routeOrthogonalWire([
                { x: 245, y: 146 },
                { x: 245, y: 170 },
                { x: 590, y: 170 },
                { x: 590, y: 292.5 },
                { x: 560, y: 292.5 },
              ])}
              stroke="#22c55e"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Target A ECHO 5V Output -> 1kΩ Resistor -> Node -> GPIO18 */}
            <path
              d={routeOrthogonalWire([
                { x: 285, y: 146 },
                { x: 285, y: 160 },
                { x: 605, y: 160 },
                { x: 605, y: 308 },
                { x: 560, y: 308 },
              ])}
              stroke="#10b981"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Target A Voltage Divider Component (1kΩ in-line + 2kΩ to GND) */}
            <g transform="translate(285, 150)">
              {/* 1kΩ Resistor Body */}
              <rect x="-4" y="0" width="8" height="14" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <rect x="-4" y="2" width="8" height="2" fill="#78350f" />
              <rect x="-4" y="5" width="8" height="2" fill="#18181b" />
              <rect x="-4" y="8" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="11" width="8" height="2" fill="#eab308" />
              <text x="6" y="10" fontSize="7" fontWeight="bold" fill="#0f172a">1kΩ</text>

              {/* Node to 2kΩ GND Resistor */}
              <circle cx="0" cy="14" r="2.5" fill="#10b981" />
              <line x1="0" y1="14" x2="0" y2="28" stroke="#18181b" strokeWidth="2" strokeDasharray="2 2" />
              <rect x="-4" y="28" width="8" height="14" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <rect x="-4" y="30" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="33" width="8" height="2" fill="#18181b" />
              <rect x="-4" y="36" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="39" width="8" height="2" fill="#eab308" />
              <text x="6" y="38" fontSize="7" fontWeight="bold" fill="#475569">2kΩ (GND)</text>
            </g>

            {/* --- D. TARGET B SENSOR WIRES (HC-SR04 B: TRIG -> GPIO23, ECHO -> 1kΩ/2kΩ DIVIDER -> GPIO22) --- */}
            {/* Target B TRIG -> ESP32 D23 (Direct) */}
            <path
              d={routeOrthogonalWire([
                { x: 705, y: 146 },
                { x: 705, y: 190 },
                { x: 575, y: 190 },
                { x: 575, y: 215 },
                { x: 560, y: 215 },
              ])}
              stroke="#3b82f6"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Target B ECHO 5V Output -> 1kΩ Resistor -> Node -> GPIO22 */}
            <path
              d={routeOrthogonalWire([
                { x: 745, y: 146 },
                { x: 745, y: 180 },
                { x: 585, y: 180 },
                { x: 585, y: 230.5 },
                { x: 560, y: 230.5 },
              ])}
              stroke="#60a5fa"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Target B Voltage Divider Component (1kΩ in-line + 2kΩ to GND) */}
            <g transform="translate(745, 150)">
              {/* 1kΩ Resistor Body */}
              <rect x="-4" y="0" width="8" height="14" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <rect x="-4" y="2" width="8" height="2" fill="#78350f" />
              <rect x="-4" y="5" width="8" height="2" fill="#18181b" />
              <rect x="-4" y="8" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="11" width="8" height="2" fill="#eab308" />
              <text x="6" y="10" fontSize="7" fontWeight="bold" fill="#0f172a">1kΩ</text>

              {/* Node to 2kΩ GND Resistor */}
              <circle cx="0" cy="14" r="2.5" fill="#60a5fa" />
              <line x1="0" y1="14" x2="0" y2="28" stroke="#18181b" strokeWidth="2" strokeDasharray="2 2" />
              <rect x="-4" y="28" width="8" height="14" rx="2" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <rect x="-4" y="30" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="33" width="8" height="2" fill="#18181b" />
              <rect x="-4" y="36" width="8" height="2" fill="#ef4444" />
              <rect x="-4" y="39" width="8" height="2" fill="#eab308" />
              <text x="6" y="38" fontSize="7" fontWeight="bold" fill="#475569">2kΩ (GND)</text>
            </g>

            {/* --- E. RELAY IN SIGNAL WIRE (ORANGE #f97316 -> ESP32 GPIO27 / D27) --- */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 355 },
                { x: 192, y: 355 },
                { x: 192, y: 273 },
              ])}
              stroke="#f97316"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* --- F. PUSHBUTTON SIGNAL WIRES & EXTERNAL 10kΩ PULL-UP FOR LEAK (GPIO34 ONLY) --- */}
            {/* Dedicated 3.3V Power Line (Magenta #ec4899) from ESP32 3V3 Pin to 10kΩ LEAK Pull-Up */}
            <path
              d={routeOrthogonalWire([
                { x: 560, y: 432.5 },
                { x: 560, y: 446 },
                { x: 275, y: 446 },
                { x: 275, y: 390 },
              ])}
              stroke="#ec4899"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* 3.3V Pin Pinpoint Label & Junction Dot */}
            <circle cx="560" cy="432.5" r="3.5" fill="#ec4899" />
            <text x="552" y="435" textAnchor="end" fontSize="7" fontWeight="bold" fill="#ec4899">3.3V Rail</text>

            {/* External 10kΩ Pull-Up Resistor for GPIO34 LEAK Input (CONNECTED STRICTLY TO 3.3V & GPIO34 NODE) */}
            <g transform="translate(275, 380)">
              {/* Top Terminal Lead to 3.3V Wire */}
              <line x1="0" y1="0" x2="0" y2="10" stroke="#ec4899" strokeWidth="2" />
              {/* 10kΩ Resistor Body (Brown, Black, Orange, Gold) */}
              <rect x="-5" y="10" width="10" height="20" rx="3" fill="#d97706" stroke="#78350f" strokeWidth="1" />
              <rect x="-5" y="13" width="10" height="2.5" fill="#78350f" />
              <rect x="-5" y="17" width="10" height="2.5" fill="#18181b" />
              <rect x="-5" y="21" width="10" height="2.5" fill="#d97706" />
              <rect x="-5" y="25" width="10" height="2.5" fill="#eab308" />
              <text x="8" y="22" fontSize="7.5" fontWeight="bold" fill="#ec4899">10kΩ (3.3V Pull-Up)</text>
              {/* Lower Terminal Lead connecting directly to GPIO34 LEAK Signal Node */}
              <line x1="0" y1="30" x2="0" y2="50" stroke="#f59e0b" strokeWidth="2" />
              <line x1="0" y1="50" x2="-25" y2="50" stroke="#f59e0b" strokeWidth="2" />
              <circle cx="-25" cy="50" r="3.5" fill="#f59e0b" />
            </g>

            {/* LEAK Pushbutton Signal Wire (Amber #f59e0b -> ESP32 GPIO34 / D34 INPUT ONLY) */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 261.5 },
                { x: 250, y: 261.5 },
                { x: 250, y: 450 },
              ])}
              stroke="#f59e0b"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* E-STOP Pushbutton Signal Wire (Amber-Orange #ea580c -> ESP32 GPIO13 / D13 INPUT) */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 401.5 },
                { x: 110, y: 401.5 },
                { x: 110, y: 450 },
              ])}
              stroke="#ea580c"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* --- G. LED ANODE SIGNAL WIRES (PARALLEL BUS LANES ABOVE LEDS) --- */}
            {/* SV1 Red Anode -> ESP32 D26 */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 339.5 },
                { x: 405, y: 339.5 },
                { x: 405, y: 484 },
                { x: 412, y: 484 },
                { x: 412, y: 493 },
              ])}
              stroke="#ef4444"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* SV2 Yellow Anode -> ESP32 D24 */}
            <path
              d={routeOrthogonalWire([
                { x: 560, y: 339.5 },
                { x: 535, y: 339.5 },
                { x: 535, y: 476 },
                { x: 512, y: 476 },
                { x: 512, y: 493 },
              ])}
              stroke="#eab308"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* SV3 Green Anode -> ESP32 D25 */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 324 },
                { x: 365, y: 324 },
                { x: 365, y: 468 },
                { x: 612, y: 468 },
                { x: 612, y: 493 },
              ])}
              stroke="#22c55e"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Bypass Blue Anode -> ESP32 D32 */}
            <path
              d={routeOrthogonalWire([
                { x: 430, y: 293 },
                { x: 350, y: 293 },
                { x: 350, y: 460 },
                { x: 722, y: 460 },
                { x: 722, y: 493 },
              ])}
              stroke="#3b82f6"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

          </svg>
        </div>
      ) : (
        /* GPIO Matrix View */
        <div className="mt-6 grid gap-3 sm:grid-cols-2 md:grid-cols-7">
          {[
            { pin: 'GPIO 27', label: 'Relay IN (Pump)', val: data.system?.pump_on ? 'HIGH (1)' : 'LOW (0)', tone: data.system?.pump_on ? 'bg-emerald-500/15 text-emerald-700 border-emerald-300' : 'bg-secondary text-muted-foreground border-border' },
            { pin: 'GPIO 13', label: 'E-STOP Switch', val: isEstop ? 'LOW (0)' : 'HIGH (1)', tone: isEstop ? 'bg-red-500/20 text-red-800 border-red-300' : 'bg-emerald-500/15 text-emerald-700 border-emerald-300' },
            { pin: 'GPIO 34', label: 'LEAK Sensor (ONLY)', val: isLeak ? 'LOW (0)' : 'HIGH (1)', tone: isLeak ? 'bg-red-500/20 text-red-800 border-red-300' : 'bg-emerald-500/15 text-emerald-700 border-emerald-300' },
            { pin: 'GPIO 26', label: 'SV1 (Branch A)', val: sv1Open ? 'HIGH (1)' : 'LOW (0)', tone: sv1Open ? 'bg-red-500/15 text-red-700 border-red-300' : 'bg-secondary text-muted-foreground border-border' },
            { pin: 'GPIO 24', label: 'SV2 (Branch B)', val: sv2Open ? 'HIGH (1)' : 'LOW (0)', tone: sv2Open ? 'bg-yellow-500/15 text-yellow-700 border-yellow-300' : 'bg-secondary text-muted-foreground border-border' },
            { pin: 'GPIO 25', label: 'SV3 (Main)', val: sv3Open ? 'HIGH (1)' : 'LOW (0)', tone: sv3Open ? 'bg-green-500/15 text-green-700 border-green-300' : 'bg-secondary text-muted-foreground border-border' },
            { pin: 'GPIO 32', label: 'Bypass Valve', val: bypassOpen ? 'HIGH (1)' : 'LOW (0)', tone: bypassOpen ? 'bg-blue-500/15 text-blue-700 border-blue-200' : 'bg-secondary text-muted-foreground border-border' },
          ].map((item) => (
            <div key={item.pin} className={`rounded-xl border p-3.5 transition ${item.tone}`}>
              <div className="text-[10px] font-mono uppercase tracking-wider opacity-75">{item.pin}</div>
              <div className="mt-1 text-sm font-semibold">{item.label}</div>
              <div className="mt-2 flex items-center justify-between border-t border-current/10 pt-2">
                <span className="text-[11px] opacity-75">Logic Level</span>
                <span className="font-mono text-xs font-bold">{item.val}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Interactive Ultrasonic Tank Level Adjusters */}
      <div className="mt-6 border-t border-border pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders size={16} className="text-accent" />
            <h3 className="text-sm font-semibold text-primary">
              Ultrasonic Level Sensor Controls (HC-SR04 Twin)
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Slide to adjust physical tank levels in real time
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {(['A', 'B', 'C'] as const).map((key) => {
            const level = data.tanks[key]?.level_pct ?? 50;
            return (
              <div key={key} className="rounded-xl border border-border bg-secondary/60 p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Tank {key} Level</span>
                  <span className="font-mono text-primary">{level.toFixed(1)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="0.5"
                  value={level}
                  onChange={(e) => onUpdateTankLevel(key, parseFloat(e.target.value))}
                  className="mt-2.5 w-full cursor-pointer accent-[#5f9e87]"
                  data-testid={`slider-hw-tank-${key}`}
                />
                <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
                  <span>0% (Empty)</span>
                  <span>100% (Full)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
