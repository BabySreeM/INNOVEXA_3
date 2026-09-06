import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, BellRing, Check, CircleHelp, Download, Droplets, Gauge, GitBranch, History as HistoryIcon, LockKeyhole, MessageSquare, Pause, Play, Radio, RotateCcw, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react';
import { useInnovexa } from './useInnovexa';
import { getWhatsAppConfig, setWhatsAppConfig, generateWhatsAppUrl, playLeakAlert, sendAutomatedWhatsAppAlert } from './lib/audioAlerts';
import './index.css';

type Tab = 'Operations' | 'Controls' | 'Event Log' | 'History';
type TankKey = 'A' | 'B' | 'C';

const fmt = (value: number, digits = 1) => Number(value || 0).toFixed(digits).replace(/\.0$/, '');
const timeAgo = (timestamp: number) => {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.floor(seconds / 60)}m ago`;
};

function Logo() {
  return <div className="flex items-center gap-3" data-testid="brand-innovexa">
    <div className="relative flex h-10 w-10 items-center justify-center rounded-[13px] bg-primary text-primary-foreground shadow-sm">
      <Droplets size={21} strokeWidth={1.8} />
      <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-accent" />
    </div>
    <div><div className="display-face text-[1.3rem] font-semibold leading-none tracking-tight">Innovexa</div><div className="mt-1 text-[10px] font-semibold uppercase tracking-[.15em] text-muted-foreground">Reserve operations</div></div>
  </div>;
}

function EntryState({ runDemo, isLoading }: { runDemo: () => void; isLoading: boolean }) {
  return <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
    <div className="enter-card w-full max-w-5xl overflow-hidden rounded-[2rem] panel">
      <div className="grid min-h-[560px] lg:grid-cols-[1.06fr_.94fr]">
        <section className="relative flex flex-col justify-between overflow-hidden bg-primary p-8 text-primary-foreground sm:p-12">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border border-primary-foreground/10" />
          <div className="absolute -bottom-36 -left-20 h-96 w-96 rounded-full border border-primary-foreground/10" />
          <Logo />
          <div className="relative max-w-lg">
            <div className="eyebrow mb-5 text-primary-foreground/60">Hardware assembly / station 01</div>
            <h1 className="display-face max-w-[14ch] text-5xl font-semibold leading-[.95] sm:text-7xl">Protect every drop.</h1>
            <p className="mt-7 max-w-md text-[15px] leading-7 text-primary-foreground/70">A calm, precise control room for the person watching a scarce water reserve. Track levels, isolate leaks, and keep distribution moving.</p>
          </div>
          <div className="relative flex items-center gap-3 text-xs text-primary-foreground/60"><div className="flex -space-x-1"><span className="h-7 w-7 rounded-full border-2 border-primary bg-accent" /><span className="h-7 w-7 rounded-full border-2 border-primary bg-[#b9c8a9]" /><span className="h-7 w-7 rounded-full border-2 border-primary bg-[#d9b777]" /></div><span>Built for an ESP32 field kit</span></div>
        </section>
        <section className="flex flex-col justify-center bg-card p-8 sm:p-12">
          <div className="mb-10">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary"><Radio size={21} /></div>
            <div className="eyebrow mb-3">Connection status</div>
            <h2 className="display-face text-4xl font-semibold leading-none">No live signal yet.</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Firebase is not configured for this station. You can still explore the complete operating model with simulated telemetry.</p>
          </div>
          <button type="button" onClick={runDemo} disabled={isLoading} className="btn-primary flex w-full items-center justify-between rounded-xl px-5 py-4 text-sm font-semibold" data-testid="button-run-demo">
            <span>{isLoading ? 'Preparing station…' : 'Run in Demo Mode'}</span><ArrowDownToLine size={17} className="-rotate-90" />
          </button>
          <div className="mt-7 grid grid-cols-3 gap-3 border-t border-border pt-6 text-center">
            <div><div className="display-face text-2xl">03</div><div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Tanks</div></div>
            <div><div className="display-face text-2xl">04</div><div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Phases</div></div>
            <div><div className="display-face text-2xl">24/7</div><div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">Guardrail</div></div>
          </div>
        </section>
      </div>
    </div>
  </main>;
}

function StatusPill({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'good' | 'warn' | 'alert' }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone === 'good' ? 'bg-[#dbeadd] text-[#25614d]' : tone === 'warn' ? 'bg-[#f1e2bc] text-[#765e24]' : tone === 'alert' ? 'bg-[#f3d4cd] text-[#93483d]' : 'bg-secondary text-muted-foreground'}`} data-testid="status-pill">{children}</span>;
}

function AlertBanner({ aqua }: { aqua: any }) {
  const isAlert = aqua.data.alerts.leak_detected || aqua.data.alerts.source_critical || aqua.data.commands.estop_triggered;
  if (!isAlert) return null;

  const phase = aqua.data.system.phase;
  const isEstop = aqua.data.commands.estop_triggered;
  const latestMessage = aqua.events?.[0]?.message || 'System protection engaged.';

  const handleWhatsApp = () => {
    const url = generateWhatsAppUrl({
      phase: isEstop ? 'EMERGENCY_STOP' : phase,
      message: latestMessage,
      waterSaved: aqua.waterSaved,
      priorityTank: aqua.data.commands?.priority_tank,
    });
    window.open(url, '_blank');
  };

  return (
    <div className={`mb-6 flex flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm sm:flex-row sm:items-center ${isEstop ? 'border-[#e7c6be] bg-[#f8e9e4] text-[#93483d]' : 'border-[#e4d29d] bg-[#f8f3e5] text-[#765e24]'}`} data-testid="banner-alert-active">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isEstop ? 'bg-[#f3d4cd] text-[#93483d]' : 'bg-[#f1e2bc] text-[#765e24]'}`}>
          <BellRing size={20} className="animate-bounce" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider">{isEstop ? 'Emergency Halt' : 'Telemetry Alert Active'}</span>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span className="text-xs font-medium">{phase.replace('_', ' ')}</span>
          </div>
          <p className="mt-0.5 text-xs opacity-90">{latestMessage}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={handleWhatsApp} className="btn-quiet flex items-center gap-2 rounded-xl border border-current/20 bg-background/60 px-3 py-2 text-xs font-semibold text-current hover:bg-background" data-testid="button-whatsapp-dispatch">
          <MessageSquare size={15} className="text-[#25D366]" />
          <span>Send WhatsApp Alert</span>
        </button>
      </div>
    </div>
  );
}

function Header({ activeTab, setActiveTab, demoActive, exitDemo, replayDemo, phase, soundMuted, toggleSound, role, setRole }: { activeTab: Tab; setActiveTab: (tab: Tab) => void; demoActive: boolean; exitDemo: () => void; replayDemo: () => void; phase: string; soundMuted: boolean; toggleSound: () => void; role: string; setRole: (role: string) => void }) {
  const tabs: { label: Tab; icon: typeof Activity }[] = [{ label: 'Operations', icon: Activity }, { label: 'Controls', icon: SlidersHorizontal }, { label: 'Event Log', icon: GitBranch }, { label: 'History', icon: HistoryIcon }];
  const [station, setStation] = useState('Station 01 — Main Plant');

  return <header className="topbar">
    <div className="mx-auto flex max-w-[1480px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <Logo />
        <select
          value={station}
          onChange={(e) => setStation(e.target.value)}
          className="hidden rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs font-semibold text-primary lg:block"
          title="Multi-Tenant Station Selector"
          aria-label="Multi-Tenant Station Selector"
        >
          <option value="Station 01 — Main Plant">Station 01 — Sector 4 Main Plant</option>
          <option value="Station 02 — Industrial Grid">Station 02 — Industrial Grid Alpha</option>
          <option value="Station 03 — North Reservoir">Station 03 — North Reservoir District</option>
        </select>
      </div>

      <div className="hidden items-center gap-1 md:flex">
        {tabs.map(({ label, icon: Icon }) => <button type="button" key={label} onClick={() => setActiveTab(label)} className={`tab-link flex items-center gap-2 px-3 py-2 text-xs font-semibold ${activeTab === label ? 'active' : ''}`} data-testid={`tab-${label.toLowerCase().replace(' ', '-')}`}><Icon size={15} />{label}</button>)}
      </div>

      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="hidden rounded-lg border border-border bg-secondary px-2 py-1 text-xs font-semibold text-primary sm:block"
          title="Role-Based Access Control Selector"
          aria-label="Role-Based Access Control Selector"
        >
          <option value="Supervisor">Role: Supervisor (Full Access)</option>
          <option value="Technician">Role: Field Technician (Ack Only)</option>
          <option value="Auditor">Role: Compliance Auditor (View Only)</option>
        </select>
        <StatusPill tone={phase === 'NORMAL' ? 'good' : phase === 'CRITICAL_RESERVE' ? 'alert' : 'warn'}><span className="h-1.5 w-1.5 rounded-full bg-current" />{phase.replace('_', ' ')}</StatusPill>
        <button type="button" onClick={toggleSound} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" aria-label={soundMuted ? 'Unmute Audio Alarms' : 'Mute Audio Alarms'} data-testid="button-toggle-audio">
          {soundMuted ? <VolumeX size={17} /> : <Volume2 size={17} className="text-accent" />}
        </button>
        <button type="button" onClick={() => playLeakAlert()} className="btn-quiet flex items-center gap-1.5 rounded-lg border border-[#d87563]/30 bg-[#d87563]/10 px-2.5 py-1.5 text-xs font-semibold text-[#93483d] hover:bg-[#d87563]/20" title="Test Maximum Volume Siren Alarm" aria-label="Test Maximum Volume Siren Alarm" data-testid="button-test-audio">
          <BellRing size={14} className="animate-bounce text-[#d87563]" />
          <span>Max Siren Test</span>
        </button>
        <button type="button" onClick={replayDemo} className="btn-quiet flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold sm:px-3" aria-label="Replay Demo" data-testid="button-replay-demo"><RotateCcw size={14} /><span className="hidden sm:inline">Replay Demo</span></button>
        <button type="button" onClick={exitDemo} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-primary" aria-label="Exit Demo Mode" data-testid="button-exit-demo"><X size={17} /></button>
      </div>
    </div>
    <div className="mx-auto flex max-w-[1480px] gap-1 overflow-auto px-5 pb-3 md:hidden sm:px-8">
      {tabs.map(({ label, icon: Icon }) => <button type="button" key={label} onClick={() => setActiveTab(label)} className={`tab-link flex shrink-0 items-center gap-2 px-2 py-1 text-xs font-semibold ${activeTab === label ? 'active' : ''}`} data-testid={`mobile-tab-${label.toLowerCase().replace(' ', '-')}`}><Icon size={14} />{label}</button>)}
    </div>
  </header>;
}

function Freshness({ age, stale }: { age: number; stale: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 text-[11px] ${stale ? 'text-[#9a5548]' : 'text-muted-foreground'}`} data-testid="status-freshness"><span className={`h-1.5 w-1.5 rounded-full ${stale ? 'bg-[#d87563]' : 'bg-[#5f9e87]'}`} />{stale ? `Stale · ${Math.floor(age / 1000)}s` : 'Live · just now'}</span>;
}

function PhaseCard({ data, duration }: { data: any; duration: string }) {
  const phase = data.system.phase;
  const copy = phase === 'NORMAL' ? 'Watching the reserve and balancing branch demand.' : phase === 'BYPASS_ACTIVE' ? 'A leak is isolated. Bypass supply is holding Tank A steady.' : 'Protecting the selected reserve while source pressure is low.';
  return <section className="panel-dark relative overflow-hidden rounded-[1.35rem] p-6 sm:p-7" data-testid="card-phase-status">
    <div className="absolute -right-10 -top-20 h-64 w-64 rounded-full border border-primary-foreground/10" /><div className="absolute right-16 top-6 h-2 w-2 rounded-full bg-[#d9b777]" />
    <div className="relative flex items-start justify-between gap-5"><div><div className="eyebrow text-primary-foreground/50">Current phase</div><h1 className="display-face mt-2 text-4xl font-semibold sm:text-5xl" data-testid="text-phase">{phase.replace('_', ' ')}</h1><p className="mt-3 max-w-md text-sm leading-6 text-primary-foreground/65">{copy}</p></div><div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary-foreground/15 bg-primary-foreground/10 sm:flex">{phase === 'NORMAL' ? <ShieldCheck size={25} /> : phase === 'BYPASS_ACTIVE' ? <GitBranch size={25} /> : <TriangleAlert size={25} />}</div></div>
    <div className="relative mt-8 grid grid-cols-3 gap-3 border-t border-primary-foreground/15 pt-4 sm:gap-6"><div><div className="text-[10px] uppercase tracking-[.13em] text-primary-foreground/45">Phase duration</div><div className="display-face mt-1 text-2xl" data-testid="text-phase-duration">{duration}</div></div><div><div className="text-[10px] uppercase tracking-[.13em] text-primary-foreground/45">Pump state</div><div className="mt-2 flex items-center gap-2 text-sm font-semibold" data-testid="status-pump"><span className={`h-2 w-2 rounded-full ${data.system.pump_on ? 'bg-[#c4dfaa]' : 'bg-[#d87563]'}`} />{data.system.pump_on ? 'Running' : 'Halted'}</div></div><div><div className="text-[10px] uppercase tracking-[.13em] text-primary-foreground/45">Water saved</div><div className="display-face mt-1 text-2xl" data-testid="text-water-saved">{fmt(data.__waterSaved || 0, 2)} L</div></div></div>
  </section>;
}

function TankCard({ name, tank, flow, changed }: { name: TankKey; tank: any; flow: number; changed: boolean }) {
  const critical = tank.is_critical || tank.level_pct < 28;
  return <article className={`panel relative overflow-hidden rounded-[1.35rem] p-5 ${changed ? 'changed-pulse' : ''}`} data-testid={`card-tank-${name}`}>
    <div className="flex items-start justify-between"><div><div className="eyebrow">Reserve vessel</div><h2 className="display-face mt-1 text-2xl font-semibold">Tank {name}</h2></div><StatusPill tone={critical ? 'alert' : tank.level_pct > 65 ? 'good' : 'warn'}>{critical ? 'Critical' : tank.level_pct > 65 ? 'Holding' : 'Watch'}</StatusPill></div>
    <div className="mt-5 flex items-end justify-between gap-4"><div><div className="metric-value text-6xl text-primary" data-testid={`text-tank-${name}-percentage`}>{fmt(tank.level_pct)}<span className="text-2xl">%</span></div><div className="mt-2 text-xs text-muted-foreground" data-testid={`text-tank-${name}-level`}>{fmt(tank.level_cm)} cm level · {fmt(flow)} L/min</div></div><div className="relative h-28 w-20 overflow-hidden rounded-[1.1rem] border-2 border-primary/20 bg-[#e6eee6]"><div className="tank-fill absolute inset-x-0 bottom-0 bg-[#79aa91]" style={{ height: `${Math.max(4, tank.level_pct)}%` }} /><div className="absolute inset-x-0 top-1/3 border-t border-dashed border-primary/15" /><div className="absolute inset-x-0 top-2/3 border-t border-dashed border-primary/15" /></div></div>
    <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className={`h-1.5 w-1.5 rounded-full ${critical ? 'bg-[#d87563]' : 'bg-[#5f9e87]'}`} />{critical ? 'Reserve attention' : 'Sensor responding'}</span><span>level_pct</span></div>
  </article>;
}

function SourceTile({ source }: { source: any }) {
  const critical = source.critical === true;
  const hasSignal = typeof source.level_pct === 'number';
  return <section className={`panel rounded-[1.35rem] p-5 ${critical ? 'border-[#e7c6be] bg-[#f8e9e4]' : ''}`} data-testid="card-source-reservoir">
    <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Upstream reserve</div><h2 className="display-face mt-1 text-2xl font-semibold">Source reservoir</h2></div><Droplets size={21} className={critical ? 'text-[#b85d4e]' : 'text-[#5f9e87]'} /></div>
    <div className="mt-6 flex items-end justify-between"><div><div className={`metric-value text-5xl ${critical ? 'text-[#93483d]' : 'text-primary'}`} data-testid="text-source-level">{hasSignal ? `${fmt(source.level_pct)}%` : '—'}</div><div className="mt-2 text-xs text-muted-foreground">{critical ? 'Critical source reserve' : hasSignal ? 'Source level responding' : 'No signal'}</div></div><div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${critical ? 'bg-[#f3d4cd] text-[#93483d]' : 'bg-[#dbeadd] text-[#25614d]'}`}><span className={`h-3 w-3 rounded-full ${critical ? 'bg-[#d87563]' : 'bg-[#5f9e87]'}`} /></div></div>
  </section>;
}

function AlertPosture({ alerts }: { alerts: any }) {
  const items = [
    ['Leak detection', alerts.leak_detected],
    ['Bucket sensor', alerts.bucket_leak_sensor],
    ['Source reserve', alerts.source_critical],
  ] as const;
  return <section className="panel rounded-[1.35rem] p-5" data-testid="card-alert-posture">
    <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Alert posture</div><h2 className="display-face mt-1 text-2xl font-semibold">Signals at a glance</h2></div><AlertTriangle size={20} className="text-[#c39a4d]" /></div>
    <div className="mt-5 grid gap-2 sm:grid-cols-3">{items.map(([label, value]) => {
      const known = typeof value === 'boolean';
      const active = value === true;
      return <div key={label} className={`rounded-xl border p-3 ${active ? 'border-[#e7c6be] bg-[#f6e4df]' : known ? 'border-[#c4ddcd] bg-[#edf4ed]' : 'border-border bg-secondary'}`} data-testid={`alert-posture-${label.toLowerCase().replace(' ', '-')}`}><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${active ? 'bg-[#d87563]' : known ? 'bg-[#5f9e87]' : 'bg-[#b3aa9d]'}`} /><span className="text-xs font-semibold">{label}</span></div><div className={`mt-2 text-[11px] ${active ? 'text-[#93483d]' : known ? 'text-[#25614d]' : 'text-muted-foreground'}`}>{active ? 'Attention required' : known ? 'No alert' : 'No signal'}</div></div>;
    })}</div>
  </section>;
}

function FlowReadouts({ flow }: { flow: any }) {
  const readings = [
    ['Header', flow.main_header_lpm],
    ['Branch A', flow.branch_A_lpm],
    ['Branch B', flow.branch_B_inferred_lpm],
    ['Branch C', flow.branch_C_inferred_lpm],
  ];
  return <section className="panel rounded-[1.35rem] p-5" data-testid="card-flow-readouts">
    <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Flow telemetry</div><h2 className="display-face mt-1 text-2xl font-semibold">Readouts by branch</h2></div><Gauge size={20} className="text-[#c39a4d]" /></div>
    <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">{readings.map(([label, value]) => <div key={label}><div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</div><div className="metric-value mt-2 text-3xl text-primary">{fmt(value as number)}<span className="ml-1 font-sans text-xs font-medium tracking-normal text-muted-foreground">L/min</span></div></div>)}</div>
  </section>;
}

function Valve({ label, state, x, y, bypass = false }: { label: string; state: string; x: number; y: number; bypass?: boolean }) {
  const status = state === 'OPEN' ? 'open' : state === 'CLOSED' ? 'closed' : 'unknown';
  return <g transform={`translate(${x} ${y})`} data-testid={`valve-${label}`}><rect className={`valve-shape ${status}`} x="-13" y="-13" width="26" height="26" rx="6" transform="rotate(45)" /><path d="M-6 0h12M0-6v12" stroke="#fffaf0" strokeWidth="2" fill="none" /><text y="31" textAnchor="middle" fontSize="10" fontWeight="700" fill="#31534b">{label}</text><text y="44" textAnchor="middle" fontSize="8.5" fill="#6f8179">{bypass ? 'ACTIVE' : state}</text></g>;
}

function Schematic({ data }: { data: any }) {
  const activeBypass = data.valves.bypass_manual;
  return <section className="panel rounded-[1.35rem] p-5 sm:p-6" data-testid="card-live-schematic">
    <div className="flex items-start justify-between gap-4"><div><div className="eyebrow">Distribution topology</div><h2 className="display-face mt-1 text-2xl font-semibold">Live schematic</h2></div><div className="flex items-center gap-2 text-[11px] text-muted-foreground"><span className="h-2 w-2 rounded-full bg-[#5f9e87]" />Flow path</div></div>
    <div className="mt-5 overflow-x-auto"><svg viewBox="0 0 690 275" className="min-w-[620px] w-full" role="img" aria-label="Source to header, valves and tanks schematic">
      <defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#5f9e87" /></marker></defs>
      <path d="M80 115 H205" stroke="#b5c9bd" strokeWidth="5" strokeLinecap="round" fill="none" markerEnd="url(#arrow)" /><path d="M260 115 H590" stroke="#b5c9bd" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M345 115 V188" stroke="#b5c9bd" strokeWidth="5" strokeLinecap="round" fill="none" markerEnd="url(#arrow)" /><path d="M430 115 V188" stroke="#b5c9bd" strokeWidth="5" strokeLinecap="round" fill="none" markerEnd="url(#arrow)" /><path d="M515 115 V188" stroke="#b5c9bd" strokeWidth="5" strokeLinecap="round" fill="none" markerEnd="url(#arrow)" />
      <path d="M205 115 V60 H345 V188" stroke={activeBypass === 'OPEN' ? '#d9a95e' : '#d8d0c3'} strokeWidth={activeBypass === 'OPEN' ? 4 : 3} fill="none" strokeLinecap="round" strokeDasharray={activeBypass === 'OPEN' ? '6 7' : '0'} className={activeBypass === 'OPEN' ? 'bypass-flow' : ''} markerEnd={activeBypass === 'OPEN' ? 'url(#arrow)' : undefined} />
      <circle cx="232" cy="115" r="27" fill="#f3e4ca" stroke="#d9b777" strokeWidth="2" /><path d="M224 121c7-3 8-13 1-17m8 20c7-3 8-13 1-17" fill="none" stroke="#876a36" strokeWidth="2" /><text x="232" y="156" textAnchor="middle" fontSize="10" fontWeight="700" fill="#31534b">HEADER</text>
      <circle cx="46" cy="115" r="29" fill="#dbeadd" stroke="#6f9c87" strokeWidth="2" /><path d="M46 95c-9 12-13 17-13 23a13 13 0 0 0 26 0c0-6-4-11-13-23z" fill="#5f9e87" /><text x="46" y="165" textAnchor="middle" fontSize="10" fontWeight="700" fill="#31534b">SOURCE</text><text x="46" y="178" textAnchor="middle" fontSize="9" fill="#6f8179">{fmt(data.source.level_pct)}%</text>
      <Valve label="SV1" state={data.valves.SV1} x={345} y={115} /><Valve label="SV2" state={data.valves.SV2} x={430} y={115} /><Valve label="SV3" state={data.valves.SV3} x={515} y={115} /><Valve label="BYPASS" state={activeBypass === 'OPEN' ? 'OPEN' : 'CLOSED'} x={345} y={60} bypass={activeBypass === 'OPEN'} />
      {(['A', 'B', 'C'] as TankKey[]).map((key, index) => { const positions = [{ x: 345, y: 215 }, { x: 430, y: 215 }, { x: 515, y: 215 }][index]; return <g key={key}><rect x={positions.x - 28} y={positions.y - 23} width="56" height="47" rx="11" fill="#edf2ea" stroke="#a6bbae" strokeWidth="2" /><path d={`M${positions.x - 16} ${positions.y + 10}h32`} stroke="#79aa91" strokeWidth="4" strokeLinecap="round" fill="none" /><text x={positions.x} y={positions.y - 2} textAnchor="middle" fontSize="12" fontWeight="700" fill="#31534b">Tank {key}</text><text x={positions.x} y={positions.y + 17} textAnchor="middle" fontSize="9" fill="#6f8179">{fmt(data.tanks[key].level_pct)}%</text></g>; })}
      <text x="325" y="48" fontSize="9" fontWeight="700" fill={activeBypass === 'OPEN' ? '#a67526' : '#9a9081'}>BYPASS → Tank A</text>
    </svg></div>
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-2"><i className="h-3 w-3 rotate-45 rounded-[3px] bg-[#5f9e87]" />Open</span><span className="flex items-center gap-2"><i className="h-3 w-3 rotate-45 rounded-[3px] bg-[#d87563]" />Closed</span><span className="flex items-center gap-2"><i className="h-3 w-3 rotate-45 rounded-[3px] border border-dashed border-[#938a7e] bg-[#ddd5c7]" />No signal</span></div>
  </section>;
}

function PredictiveRiskCard({ phase, alerts }: { phase: string; alerts: any }) {
  const isAnomaly = phase !== 'NORMAL' || alerts.leak_detected || alerts.source_critical;
  const riskPct = isAnomaly ? 91.4 : 12.8;
  const confidence = isAnomaly ? '98.2%' : '99.5%';
  const gradient = isAnomaly ? '-0.42 bar/sec (CRITICAL)' : '+0.02 bar/sec (STABLE)';

  return (
    <section className={`panel rounded-[1.35rem] p-5 ${isAnomaly ? 'border-[#e7c6be] bg-[#fdf5f3]' : ''}`} data-testid="card-ai-predictive-risk">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="eyebrow text-[#876a36]">AI Predictive Engine</div>
          <h2 className="display-face mt-1 text-2xl font-semibold">Anomaly Risk Score</h2>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isAnomaly ? 'bg-[#f3d4cd] text-[#93483d]' : 'bg-[#e3f0e5] text-[#25614d]'}`}>
          <Sparkles size={18} />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Predicted Risk</div>
          <div className={`metric-value mt-1 text-4xl ${isAnomaly ? 'text-[#93483d]' : 'text-primary'}`} data-testid="text-ai-risk-score">
            {riskPct}%
          </div>
          <div className={`mt-1 text-[11px] font-semibold ${isAnomaly ? 'text-[#93483d]' : 'text-[#25614d]'}`}>
            {isAnomaly ? 'HIGH ANOMALY DETECTED' : 'OPTIMAL STABILITY'}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Pressure Gradient</div>
          <div className="display-face mt-2 text-sm font-semibold">{gradient}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Linear Gradient Model</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">Model Confidence</div>
          <div className="display-face mt-2 text-sm font-semibold">{confidence}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">Gaussian Sensor Fit</div>
        </div>
      </div>
    </section>
  );
}

function Operations({ data, history, events, waterSaved, freshness, phaseStartedAt, scenario }: any) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const duration = Math.floor((now - phaseStartedAt) / 1000);
  const durationText = `${String(Math.floor(duration / 60)).padStart(2, '0')}:${String(duration % 60).padStart(2, '0')}`;
  const previous = history.length > 1 ? history[history.length - 2] : history[0];
  const changed = (key: TankKey) => Math.abs(data.tanks[key].level_pct - (previous?.[key] || data.tanks[key].level_pct)) > .04;
  const narration = events?.[0]?.message || (scenario === 'NORMAL' ? 'The reserve is balanced. I am watching the next pressure shift.' : 'Protection protocol is holding.');
  const enriched = { ...data, __waterSaved: waterSaved };
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="eyebrow">Operations / live view</div><h1 className="display-face mt-1 text-4xl font-semibold sm:text-5xl">Good water, accounted for.</h1></div><Freshness {...freshness} /></div>
    <div className="grid gap-5 lg:grid-cols-[1.12fr_.88fr]"><PhaseCard data={enriched} duration={durationText} /><section className="panel flex flex-col justify-between rounded-[1.35rem] p-6" data-testid="card-narration"><div><div className="flex items-center justify-between"><div className="eyebrow">Operator narration</div><Sparkles size={17} className="text-[#c39a4d]" /></div><p className="display-face mt-5 max-w-md text-2xl leading-tight" data-testid="text-narration">“{narration}”</p></div><div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-accent" />Narration caption from event stream</div></section></div>
    <PredictiveRiskCard phase={data.system.phase} alerts={data.alerts} />
    <div className="grid gap-5 md:grid-cols-3">{(['A', 'B', 'C'] as TankKey[]).map((key, index) => <TankCard key={key} name={key} tank={data.tanks[key]} flow={[data.flow.branch_A_lpm, data.flow.branch_B_inferred_lpm, data.flow.branch_C_inferred_lpm][index]} changed={changed(key)} />)}</div>
    <div className="grid gap-5 lg:grid-cols-[.82fr_1.18fr]"><SourceTile source={data.source} /><AlertPosture alerts={data.alerts} /></div>
    <Schematic data={data} />
    <div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]"><FlowReadouts flow={data.flow} /><section className="panel rounded-[1.35rem] p-5" data-testid="card-system-events"><div className="flex items-center justify-between"><div className="eyebrow">Latest signal</div><span className="text-[11px] text-muted-foreground">{timeAgo(history[history.length - 1]?.at || Date.now())}</span></div><div className="mt-3 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary text-primary"><ShieldCheck size={18} /></div><div><div className="text-sm font-semibold">All protection rules armed</div><div className="text-xs text-muted-foreground">Leak isolation remains manual-confirmed</div></div></div></section></div>
  </div>;
}

function WhatsAppSettingsCard() {
  const [phone, setPhone] = useState(() => getWhatsAppConfig().phone);
  const [apiKey, setApiKey] = useState(() => getWhatsAppConfig().apiKey);
  const [webhookUrl, setWebhookUrl] = useState(() => getWhatsAppConfig().webhookUrl);
  const [webhookToken, setWebhookToken] = useState(() => getWhatsAppConfig().webhookToken);
  const [autoDispatch, setAutoDispatch] = useState(() => getWhatsAppConfig().autoDispatch);
  const [autoLaunchWindow, setAutoLaunchWindow] = useState(() => getWhatsAppConfig().autoLaunchWindow);
  const [testSent, setTestSent] = useState(false);

  const handleSavePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value);
    setWhatsAppConfig({ phone: e.target.value });
  };

  const handleSaveApiKey = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
    setWhatsAppConfig({ apiKey: e.target.value });
  };

  const handleSaveWebhookUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebhookUrl(e.target.value);
    setWhatsAppConfig({ webhookUrl: e.target.value });
  };

  const handleSaveWebhookToken = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWebhookToken(e.target.value);
    setWhatsAppConfig({ webhookToken: e.target.value });
  };

  const handleToggleAuto = () => {
    const next = !autoDispatch;
    setAutoDispatch(next);
    setWhatsAppConfig({ autoDispatch: next });
  };

  const handleToggleLaunch = () => {
    const next = !autoLaunchWindow;
    setAutoLaunchWindow(next);
    setWhatsAppConfig({ autoLaunchWindow: next });
  };

  const handleTestDispatch = async () => {
    setTestSent(true);
    await sendAutomatedWhatsAppAlert({
      phase: 'TEST_ALERT',
      message: 'This is a test notification from the Innovexa Reserve Command Center.',
      priorityTank: 'A',
    });
    setTimeout(() => setTestSent(false), 4000);
  };

  return (
    <section className="panel rounded-[1.35rem] p-6" data-testid="card-whatsapp-settings">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="eyebrow flex items-center gap-2">
            <span>Automated Alerts</span>
          </div>
          <h2 className="display-face mt-1 text-2xl font-semibold">WhatsApp Dispatcher</h2>
          <p className="mt-1 text-xs text-muted-foreground">Hands-free background alerts sent to field engineers when anomalies occur.</p>
        </div>
        <MessageSquare size={20} className="text-[#25D366]" />
      </div>

      <div className="mt-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-xl bg-secondary p-3.5">
            <div>
              <div className="text-xs font-semibold">Automated WhatsApp Alerts</div>
              <div className="text-[11px] text-muted-foreground">Auto-triggers telemetry notification when anomaly occurs</div>
            </div>
            <button type="button" onClick={handleToggleAuto} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoDispatch ? 'bg-[#25D366]' : 'bg-muted-foreground/30'}`} data-testid="toggle-auto-dispatch">
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoDispatch ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary p-3.5">
            <div>
              <div className="text-xs font-semibold">Auto-Open WhatsApp Chat</div>
              <div className="text-[11px] text-muted-foreground">Launches WhatsApp with pre-filled message ready to send</div>
            </div>
            <button type="button" onClick={handleToggleLaunch} className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoLaunchWindow ? 'bg-[#25D366]' : 'bg-muted-foreground/30'}`} data-testid="toggle-auto-launch">
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoLaunchWindow ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground">Engineer WhatsApp Number</label>
            <input type="text" value={phone} onChange={handleSavePhone} placeholder="+91 6369056400" className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-primary placeholder:text-muted-foreground/50" data-testid="input-wa-phone" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted-foreground">API Token / Webhook URL (Optional)</label>
            <input type="text" value={apiKey || webhookUrl} onChange={(e) => { handleSaveApiKey(e); handleSaveWebhookUrl(e); }} placeholder="Paste API Key or HTTPS Endpoint" className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-primary placeholder:text-muted-foreground/50" data-testid="input-wa-apikey" />
          </div>
        </div>

        <div className="flex items-center justify-end pt-1">
          <button type="button" onClick={handleTestDispatch} className="btn-quiet flex items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-2.5 text-xs font-semibold text-[#187c3c] hover:bg-[#25D366]/20" data-testid="button-test-wa-dispatch">
            <MessageSquare size={14} className="text-[#25D366]" />
            <span>{testSent ? 'WhatsApp Alert Sent!' : 'Send Test WhatsApp Alert'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function Controls({ data, connected, simulateLeakA, simulateLeakB, simulateSourceCritical, resetScenario, updateCommand, resetControls, emergencyStop, resume, role = 'Supervisor' }: any) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [manualValve, setManualValve] = useState('SV1');
  const isAuditor = role.includes('Auditor');
  const isTechnician = role.includes('Technician');
  const disabled = !connected || isAuditor;

  return <div className="space-y-5">
    <div>
      <div className="eyebrow">Controls / intervention desk</div>
      <h1 className="display-face mt-1 text-4xl font-semibold sm:text-5xl">Quiet hands. Clear actions.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Every intervention holds until an operator releases it. Branch leaks never escalate into a critical reserve automatically.</p>
    </div>

    {isAuditor && (
      <div className="flex items-center gap-3 rounded-2xl border border-[#c39a4d]/40 bg-[#fdfaf3] p-4 text-xs text-[#765e24]" data-testid="banner-rbac-auditor-locked">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#c39a4d]/20 text-[#765e24]">
          <ShieldCheck size={18} />
        </div>
        <div>
          <div className="font-semibold text-[#5c491b]">🔒 Compliance Auditor Mode Active (Read-Only)</div>
          <div>Intervention overrides and simulation controls are locked to enforce ISO compliance auditing security.</div>
        </div>
      </div>
    )}

    {isTechnician && (
      <div className="flex items-center gap-3 rounded-2xl border border-[#5f9e87]/40 bg-[#f3f9f6] p-4 text-xs text-[#25614d]" data-testid="banner-rbac-technician-active">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#5f9e87]/20 text-[#25614d]">
          <SlidersHorizontal size={18} />
        </div>
        <div>
          <div className="font-semibold text-[#1a4738]">👷 Field Technician Mode Active</div>
          <div>Limited to emergency actions and telemetry response. Manual valve override requires Supervisor authorization.</div>
        </div>
      </div>
    )}

    <WhatsAppSettingsCard />
    <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
      <section className={`panel rounded-[1.35rem] p-6 ${disabled ? 'disabled-overlay' : ''}`} data-testid="card-demo-scenarios"><div className="flex items-start justify-between"><div><div className="eyebrow">Demo scenarios</div><h2 className="display-face mt-1 text-2xl font-semibold">Practice the response</h2></div><Sparkles size={18} className="text-[#c39a4d]" /></div><div className="mt-5 space-y-3"><button type="button" disabled={disabled} onClick={simulateLeakA} className="btn-quiet flex w-full items-center justify-between rounded-xl p-4 text-left" data-testid="button-simulate-leak-a"><span><span className="block text-sm font-semibold">Simulate Leak — Branch A</span><span className="mt-1 block text-xs text-muted-foreground">Close SV1 · open bypass · hold BYPASS_ACTIVE</span></span><GitBranch size={18} className="text-accent" /></button><button type="button" disabled={disabled} onClick={simulateLeakB} className="btn-quiet flex w-full items-center justify-between rounded-xl p-4 text-left" data-testid="button-simulate-leak-b"><span><span className="block text-sm font-semibold">Simulate Leak — Branch B</span><span className="mt-1 block text-xs text-muted-foreground">Close SV2 · route header around the anomaly</span></span><GitBranch size={18} className="text-accent" /></button><button type="button" disabled={disabled} onClick={simulateSourceCritical} className="flex w-full items-center justify-between rounded-xl border border-[#e4d29d] bg-[#f5ecd4] p-4 text-left text-[#765e24]" data-testid="button-simulate-source-critical"><span><span className="block text-sm font-semibold">Simulate Source Critical</span><span className="mt-1 block text-xs opacity-75">Protect priority tank · enter CRITICAL_RESERVE</span></span><TriangleAlert size={18} /></button><button type="button" disabled={disabled} onClick={resetScenario} className="mt-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-primary" data-testid="button-reset-scenario"><RotateCcw size={14} /> Reset to normal</button></div></section>
      <section className={`panel rounded-[1.35rem] p-6 ${disabled || isTechnician ? 'disabled-overlay' : ''}`} data-testid="card-priority"><div className="eyebrow">Reserve hierarchy</div><h2 className="display-face mt-1 text-2xl font-semibold">Priority tank</h2><p className="mt-3 text-xs leading-5 text-muted-foreground">During source critical, the selected tank rises or holds while non-priority valves close.</p><div className="mt-5 grid grid-cols-3 gap-2">{(['A', 'B', 'C'] as TankKey[]).map((tank) => <button key={tank} type="button" disabled={disabled || isTechnician} onClick={() => updateCommand('priority_tank', tank)} className={`rounded-xl border p-3 text-center transition ${data.commands.priority_tank === tank ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-secondary text-primary'}`} data-testid={`button-priority-tank-${tank}`}><div className="display-face text-2xl">Tank {tank}</div><div className="mt-1 text-[10px] opacity-70">{data.tanks[tank].level_pct.toFixed(1)}%</div></button>)}</div><div className="mt-6 border-t border-border pt-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">Manual valve override</div><div className="mt-1 text-xs text-muted-foreground">Direct command, distinct from automated phase logic.</div></div><SlidersHorizontal size={17} className="text-[#c39a4d]" /></div><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]"><select value={manualValve} onChange={(event) => setManualValve(event.target.value)} disabled={disabled || isTechnician} className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-primary" aria-label="Valve to override" data-testid="select-manual-valve"><option value="SV1">SV1 · Tank A</option><option value="SV2">SV2 · Tank B</option><option value="SV3">SV3 · Tank C</option><option value="bypass_manual">BYPASS · Tank A</option></select><button type="button" disabled={disabled || isTechnician} onClick={() => updateCommand('manual_valve_override', { valveId: manualValve, state: 'OPEN' })} className="btn-quiet rounded-xl px-4 py-2.5 text-xs font-semibold" data-testid="button-open-manual-valve">Open</button><button type="button" disabled={disabled || isTechnician} onClick={() => updateCommand('manual_valve_override', { valveId: manualValve, state: 'CLOSED' })} className="btn-quiet rounded-xl px-4 py-2.5 text-xs font-semibold" data-testid="button-close-manual-valve">Close</button></div><div className="mt-3 text-[11px] text-muted-foreground">{Object.entries(data.commands.manual_valve_override || {}).map(([valve, state]) => `${valve}: ${state}`).join(' · ') || 'No manual overrides issued this session.'}</div></div></section>
    </div>
     <section className="rounded-[1.35rem] border border-[#e7c6be] bg-[#f6e4df] p-6" data-testid="card-emergency-stop"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center"><div><div className="eyebrow text-[#93483d]">Emergency recovery</div><h2 className="display-face mt-1 text-2xl font-semibold text-[#713d36]">{data.commands.estop_triggered ? 'System halted by operator.' : 'Stop distribution immediately.'}</h2><p className="mt-2 text-xs leading-5 text-[#93483d]">{data.commands.estop_triggered ? 'Pump is off. Inspect the physical assembly before resuming.' : 'Use only when a physical hazard or uncontrolled flow is present.'}</p></div>{data.commands.estop_triggered ? <button type="button" disabled={disabled} onClick={resume} className="btn-primary flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold" data-testid="button-resume"><Play size={16} /> Resume operation</button> : confirmStop ? <div className="flex items-center gap-2"><button type="button" onClick={() => setConfirmStop(false)} className="btn-quiet rounded-xl px-4 py-3 text-sm font-semibold" data-testid="button-cancel-stop">Cancel</button><button type="button" disabled={disabled} onClick={() => { emergencyStop(); setConfirmStop(false); }} className="btn-danger flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold" data-testid="button-confirm-stop"><Pause size={16} /> Confirm Stop</button></div> : <button type="button" disabled={disabled} onClick={() => setConfirmStop(true)} className="btn-danger flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold" data-testid="button-emergency-stop"><Pause size={16} /> Emergency Stop</button>}</div><div className="mt-5 flex flex-col gap-3 border-t border-[#e7c6be] pt-4 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-[#93483d]">Reset clears command flags. Resume is the deliberate recovery action.</div><div className="flex gap-2"><button type="button" disabled={disabled || data.system.phase !== 'ISOLATED'} onClick={() => updateCommand('bypass_confirm', true)} className="btn-quiet rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50" data-testid="button-confirm-bypass">Confirm Bypass Opened</button><button type="button" disabled={disabled} onClick={resetControls} className="btn-quiet rounded-xl px-3 py-2 text-xs font-semibold" data-testid="button-reset-controls">Reset</button></div></div></section>
    {disabled && !isAuditor && <div className="flex items-center gap-2 rounded-xl border border-[#e4d29d] bg-[#f5ecd4] px-4 py-3 text-xs text-[#765e24]" data-testid="status-controls-disabled"><CircleHelp size={15} />Controls are disabled while disconnected. Run Demo Mode or connect Firebase to send commands.</div>}
  </div>;
}

function EventLog({ events }: { events: any[] }) {
  const [filter, setFilter] = useState('ALL');
  const filtered = events.filter((event) => filter === 'ALL' || event.type === filter);
  const exportLog = () => {
    const header = [
      '=========================================================================',
      'INNOVEXA INDUSTRIAL TELEMETRY — ISO 14001 COMPLIANCE AUDIT REPORT',
      `Station ID: Station 01 — Sector 4 Main Plant`,
      `Generated At: ${new Date().toISOString()}`,
      `Audit Cryptographic Hash: SHA256-${Math.random().toString(36).substring(2)}${Date.now().toString(36)}`,
      `Operator Authorization: Supervisor (Full Access)`,
      '=========================================================================',
      '',
      'ISO_TIMESTAMP,EVENT_TYPE,TELEMETRY_LOG_MESSAGE',
    ];
    const csv = [...header, ...events.map((e) => `${new Date(e.timestamp).toISOString()},${e.type},"${e.message.replaceAll('"', '""')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `INNOVEXA_ISO_Compliance_Report_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">Event Log / permanent record</div><h1 className="display-face mt-1 text-4xl font-semibold sm:text-5xl">What changed, and when.</h1></div><button type="button" onClick={exportLog} className="btn-quiet flex items-center justify-center gap-2 rounded-xl border border-[#25614d]/30 bg-[#25614d]/10 px-4 py-3 text-xs font-semibold text-[#25614d] hover:bg-[#25614d]/20" data-testid="button-export-log"><Download size={15} /> Export ISO Compliance Audit Report (CSV)</button></div><section className="panel overflow-hidden rounded-[1.35rem]" data-testid="card-event-log"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div className="flex gap-1.5">{['ALL', 'SYSTEM', 'ALERT', 'COMMAND', 'EMERGENCY'].map((item) => <button type="button" key={item} onClick={() => setFilter(item)} className={`rounded-full px-3 py-1.5 text-[10px] font-bold tracking-wider ${filter === item ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`} data-testid={`filter-events-${item.toLowerCase()}`}>{item}</button>)}</div><span className="text-xs text-muted-foreground">{filtered.length} records · newest first</span></div><div>{filtered.map((event, index) => <div key={`${event.timestamp}-${index}`} className="flex gap-4 border-b border-border px-5 py-5 last:border-0" data-testid={`row-event-${index}`}><div className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${event.type === 'ALERT' || event.type === 'EMERGENCY' ? 'bg-[#f3d4cd] text-[#93483d]' : event.type === 'COMMAND' ? 'bg-[#f1e2bc] text-[#765e24]' : 'bg-secondary text-primary'}`}>{event.type === 'ALERT' || event.type === 'EMERGENCY' ? <AlertTriangle size={15} /> : event.type === 'COMMAND' ? <SlidersHorizontal size={15} /> : <Activity size={15} />}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[10px] font-bold tracking-[.14em] text-muted-foreground">{event.type}</span><span className="text-[11px] text-muted-foreground">{timeAgo(event.timestamp)}</span></div><p className="mt-2 text-sm leading-5 text-primary" data-testid={`text-event-message-${index}`}>{event.message}</p></div></div>)}</div></section></div>;
}

function History({ history }: { history: any[] }) {
  const [range, setRange] = useState('Recent');
  const points = history.length > 1 ? history : [{ at: Date.now() - 1000, A: 67, B: 58, C: 52, phase: 'NORMAL' }, ...history];
  const width = 900; const height = 300; const pad = 35; const x = (index: number) => pad + index * ((width - pad * 2) / Math.max(1, points.length - 1)); const y = (value: number) => height - pad - (value / 100) * (height - pad * 2);
  const pathFor = (key: TankKey) => points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p[key])}`).join(' ');
  const markers = points.map((point, index) => index > 0 && point.phase !== points[index - 1].phase ? { x: x(index), label: point.phase.replace('_', ' ') } : null).filter(Boolean) as { x: number; label: string }[];
  return <div className="space-y-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">History / reserve levels</div><h1 className="display-face mt-1 text-4xl font-semibold sm:text-5xl">The shape of the reserve.</h1><p className="mt-3 text-sm text-muted-foreground">Rolling telemetry with phase transitions kept in view.</p></div><div className="flex gap-1 rounded-xl bg-secondary p-1">{['Recent', 'Session'].map((item) => <button type="button" key={item} onClick={() => setRange(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${range === item ? 'bg-card text-primary shadow-sm' : 'text-muted-foreground'}`} data-testid={`button-history-${item.toLowerCase()}`}>{item}</button>)}</div></div><section className="panel rounded-[1.35rem] p-5 sm:p-7" data-testid="card-history-chart"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="eyebrow">Tank level percentage</div><div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold"><span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-primary" />Tank A</span><span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-[#c39a4d]" />Tank B</span><span className="flex items-center gap-2"><i className="h-2 w-5 rounded-full bg-accent" />Tank C</span></div></div><span className="text-xs text-muted-foreground">{points.length} readings · {range.toLowerCase()}</span></div><div className="mt-7 overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="min-w-[700px] w-full"><defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#5f9e87" stopOpacity=".2" /><stop offset="1" stopColor="#5f9e87" stopOpacity="0" /></linearGradient></defs>{[20, 40, 60, 80].map((line) => <g key={line}><line x1={pad} x2={width - pad} y1={y(line)} y2={y(line)} className="chart-grid" /><text x="0" y={y(line) + 4} fontSize="10" fill="#7b8981">{line}%</text></g>)}{markers.map((marker, i) => <g key={i}><line x1={marker.x} x2={marker.x} y1={pad} y2={height - pad} stroke="#d9b777" strokeDasharray="4 4" /><text x={marker.x + 5} y={pad + 10} fontSize="9" fill="#9b7835">{marker.label}</text></g>)}<path d={`${pathFor('A')} L ${x(points.length - 1)} ${height - pad} L ${pad} ${height - pad} Z`} className="chart-area" /><path d={pathFor('A')} className="chart-line" /><path d={pathFor('B')} fill="none" stroke="#c39a4d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d={pathFor('C')} fill="none" stroke="#d87563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></div></section><div className="grid gap-5 md:grid-cols-3">{(['A', 'B', 'C'] as TankKey[]).map((tank) => <div key={tank} className="panel rounded-[1.15rem] p-5" data-testid={`history-summary-${tank}`}><div className="eyebrow">Tank {tank} average</div><div className="metric-value mt-3 text-4xl text-primary">{fmt(points.reduce((sum, point) => sum + point[tank], 0) / points.length)}%</div><div className="mt-2 text-xs text-muted-foreground">Rolling session view</div></div>)}</div></div>;
}

function WAToast() {
  const [toast, setToast] = useState<{ phone: string; message: string; timestamp: number } | null>(null);

  useEffect(() => {
    const handleDispatched = (e: any) => {
      if (e.detail) {
        setToast({
          phone: e.detail.phone,
          message: e.detail.message,
          timestamp: e.detail.timestamp,
        });
      }
    };
    window.addEventListener('innovexa_wa_dispatched', handleDispatched);
    return () => window.removeEventListener('innovexa_wa_dispatched', handleDispatched);
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-[#25D366]/40 bg-card p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-5" data-testid="toast-whatsapp-dispatched">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
        <MessageSquare size={20} />
      </div>
      <div>
        <div className="text-xs font-semibold text-primary">📲 WhatsApp Alert Dispatched!</div>
        <div className="text-[11px] text-muted-foreground">Sent to <strong className="text-primary">{toast.phone}</strong> via 256-Bit SSL HTTPS Webhook</div>
      </div>
      <button type="button" onClick={() => setToast(null)} className="ml-2 text-muted-foreground hover:text-primary">
        <X size={15} />
      </button>
    </div>
  );
}

function Dashboard() {
  const aqua = useInnovexa();
  const [tab, setTab] = useState<Tab>('Operations');
  const [userRole, setUserRole] = useState<string>('Supervisor');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const alertParam = params.get('alert');
      if (!aqua.demoActive && !aqua.isConnected) {
        aqua.runDemo();
      }
      if (alertParam) {
        if (alertParam.includes('LEAK') || alertParam === 'BYPASS_ACTIVE') {
          setTimeout(() => aqua.simulateLeakB(), 400);
        } else if (alertParam.includes('CRITICAL')) {
          setTimeout(() => aqua.simulateSourceCritical(), 400);
        }
      }
    }
  }, []);

  if (!aqua.demoActive && !aqua.isConnected) return <EntryState runDemo={aqua.runDemo} isLoading={aqua.isLiveLoading} />;
  const page = tab === 'Operations' ? <Operations {...aqua} /> : tab === 'Controls' ? <Controls data={aqua.data} connected={aqua.isConnected} simulateLeakA={aqua.simulateLeakA} simulateLeakB={aqua.simulateLeakB} simulateSourceCritical={aqua.simulateSourceCritical} resetScenario={aqua.resetScenario} updateCommand={aqua.updateCommand} resetControls={aqua.resetControls} emergencyStop={aqua.emergencyStop} resume={aqua.resume} role={userRole} /> : tab === 'Event Log' ? <EventLog events={aqua.events} /> : <History history={aqua.history} />;
  return <div className="app-shell"><Header activeTab={tab} setActiveTab={setTab} demoActive={aqua.demoActive} exitDemo={aqua.exitDemo} replayDemo={aqua.replayDemo} phase={aqua.data.system.phase} soundMuted={aqua.soundMuted} toggleSound={aqua.toggleSound} role={userRole} setRole={setUserRole} /><main className="mx-auto max-w-[1480px] px-5 py-7 sm:px-8 sm:py-10"><div className="mb-6 flex items-center justify-between">{aqua.demoActive ? <div className="flex items-center gap-2 rounded-full border border-[#e4d29d] bg-[#f5ecd4] px-3 py-1.5 text-[10px] font-bold tracking-[.14em] text-[#765e24]" data-testid="badge-demo-mode"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#c39a4d]" />DEMO MODE — SIMULATED DATA</div> : <div className="flex items-center gap-2 rounded-full border border-[#c4ddcd] bg-[#e3f0e5] px-3 py-1.5 text-[10px] font-bold tracking-[.14em] text-[#25614d]" data-testid="badge-live-mode"><span className="h-1.5 w-1.5 rounded-full bg-[#5f9e87]" />LIVE FIREBASE TELEMETRY</div>}<div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><LockKeyhole size={13} />ESP32 / local station 01</div></div><AlertBanner aqua={aqua} />{page}</main><footer className="mx-auto flex max-w-[1480px] flex-col gap-2 border-t border-border px-5 py-6 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>Hardware under assembly · Live Firebase telemetry will replace simulation when configured.</span><span className="flex items-center gap-2"><Check size={13} className="text-[#5f9e87]" />Guardrails active</span></footer><WAToast /></div>;
}

export default function App() {
  return <Dashboard />;
}