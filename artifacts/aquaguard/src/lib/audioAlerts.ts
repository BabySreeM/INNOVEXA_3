// High-Decibel Web Audio API Industrial Alarm Engine & 256-Bit SSL Encrypted WhatsApp HTTPS Webhook Dispatcher

let audioCtx: AudioContext | null = null;
let isMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => undefined);
  }
  return audioCtx;
}

// Auto-unlock AudioContext on any user interaction anywhere on page
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

export function setAudioMuted(muted: boolean) {
  isMuted = muted;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('innovexa_audio_muted', muted ? 'true' : 'false');
  }
}

export function getAudioMuted(): boolean {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('innovexa_audio_muted');
    if (saved !== null) return saved === 'true';
  }
  return isMuted;
}

export function toggleAudioMuted(): boolean {
  const next = !getAudioMuted();
  setAudioMuted(next);
  return next;
}

// 1. High-Decibel Industrial Leak Siren (1.0 Gain, Sawtooth/Square sweeping 1400Hz -> 700Hz -> 1400Hz)
export function playLeakAlert() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const pulses = [0, 0.25, 0.5]; // 3 repeating piercing siren bursts

  pulses.forEach((offset) => {
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    subOsc.type = 'square';

    osc.frequency.setValueAtTime(1400, now + offset);
    osc.frequency.linearRampToValueAtTime(700, now + offset + 0.12);
    osc.frequency.linearRampToValueAtTime(1400, now + offset + 0.22);

    subOsc.frequency.setValueAtTime(700, now + offset);
    subOsc.frequency.linearRampToValueAtTime(350, now + offset + 0.12);

    gain.gain.setValueAtTime(1.0, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.23);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    subOsc.start(now + offset);
    osc.stop(now + offset + 0.23);
    subOsc.stop(now + offset + 0.23);
  });
}

// 2. High-Decibel Warble Chime for Critical Reserve (1.0 Gain, 950Hz / 680Hz repeating)
export function playCriticalReserveAlert() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [0, 0.2, 0.4, 0.6].forEach((offset, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const freq = idx % 2 === 0 ? 950 : 680;

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now + offset);

    gain.gain.setValueAtTime(1.0, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.18);
  });
}

// 3. High-Decibel Emergency Stop Alarm (1.0 Gain, Descending 1600Hz -> 300Hz 5 Siren Bursts)
export function playEmergencyStopAlert() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const bursts = [0, 0.35, 0.7, 1.05, 1.4];

  bursts.forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1600, now + offset);
    osc.frequency.exponentialRampToValueAtTime(300, now + offset + 0.3);

    gain.gain.setValueAtTime(1.0, now + offset);
    gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + offset);
    osc.stop(now + offset + 0.32);
  });
}

export interface WhatsAppAlertPayload {
  phase: string;
  stationId?: string;
  message: string;
  waterSaved?: number;
  priorityTank?: string;
}

export interface WhatsAppConfig {
  phone: string;
  apiKey: string;
  webhookUrl: string;
  webhookToken: string;
  autoDispatch: boolean;
  autoLaunchWindow: boolean;
}

const DEFAULT_PHONE = '+91 6369056400';

const DEFAULT_WEBHOOK_URL = 'https://aquaguard-dashboard.onrender.com/send-alert';

export function getWhatsAppConfig(): WhatsAppConfig {
  if (typeof localStorage === 'undefined') {
    return {
      phone: DEFAULT_PHONE,
      apiKey: '',
      webhookUrl: DEFAULT_WEBHOOK_URL,
      webhookToken: '',
      autoDispatch: true,
      autoLaunchWindow: true,
    };
  }
  return {
    phone: localStorage.getItem('innovexa_wa_phone') || DEFAULT_PHONE,
    apiKey: localStorage.getItem('innovexa_wa_apikey') || '',
    webhookUrl: localStorage.getItem('innovexa_wa_webhook') || DEFAULT_WEBHOOK_URL,
    webhookToken: localStorage.getItem('innovexa_wa_token') || '',
    autoDispatch: localStorage.getItem('innovexa_wa_autodispatch') !== 'false',
    autoLaunchWindow: localStorage.getItem('innovexa_wa_autolaunch') !== 'false',
  };
}

export function setWhatsAppConfig(config: Partial<WhatsAppConfig>) {
  if (typeof localStorage === 'undefined') return;
  if (config.phone !== undefined) localStorage.setItem('innovexa_wa_phone', config.phone);
  if (config.apiKey !== undefined) localStorage.setItem('innovexa_wa_apikey', config.apiKey);
  if (config.webhookUrl !== undefined) localStorage.setItem('innovexa_wa_webhook', config.webhookUrl);
  if (config.webhookToken !== undefined) localStorage.setItem('innovexa_wa_token', config.webhookToken);
  if (config.autoDispatch !== undefined) localStorage.setItem('innovexa_wa_autodispatch', config.autoDispatch ? 'true' : 'false');
  if (config.autoLaunchWindow !== undefined) localStorage.setItem('innovexa_wa_autolaunch', config.autoLaunchWindow ? 'true' : 'false');
}

export function generateWhatsAppUrl(payload: WhatsAppAlertPayload, phoneNumber = ''): string {
  const station = payload.stationId || 'Innovexa Smart Node 01';
  const phaseTitle = payload.phase.replace('_', ' ');
  const timeStr = new Date().toLocaleTimeString();

  const text = `🚨 *INNOVEXA AUTOMATED ALERT* 🚨\n📍 *Station:* ${station}\n⏰ *Time:* ${timeStr}\n⚠️ *Phase:* ${phaseTitle}\n📋 *Details:* ${payload.message}`;

  const encodedText = encodeURIComponent(text);
  const cleanPhone = (phoneNumber || getWhatsAppConfig().phone).replace(/[^0-9]/g, '');
  return cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
}

export async function sendAutomatedWhatsAppAlert(payload: WhatsAppAlertPayload): Promise<{ success: boolean; mode: string; url?: string }> {
  const config = getWhatsAppConfig();
  if (!config.autoDispatch) return { success: false, mode: 'disabled' };

  const station = payload.stationId || 'Innovexa Smart Node 01';
  const phaseTitle = payload.phase.replace('_', ' ');
  const timeStr = new Date().toLocaleTimeString();

  const text = `🚨 *INNOVEXA AUTOMATED ALERT* 🚨\n📍 *Station:* ${station}\n⏰ *Time:* ${timeStr}\n⚠️ *Phase:* ${phaseTitle}\n📋 *Details:* ${payload.message}`;

  const cleanPhone = (config.phone || DEFAULT_PHONE).replace(/[^0-9]/g, '');
  const waUrl = generateWhatsAppUrl(payload, cleanPhone);

  let modeUsed = 'background_api';
  let directDelivered = false;

  // 1. First try Dedicated Local WhatsApp Bot Server (http://localhost:3001)
  try {
    const localRes = await fetch('http://localhost:3001/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: cleanPhone,
        message: text,
      }),
    });
    if (localRes.ok) {
      const resData = await localRes.json();
      if (resData.success) {
        modeUsed = 'local_whatsapp_bot';
        directDelivered = true;
      }
    }
  } catch {
    // Local server not running or starting up
  }

  // 2. If Custom Secure HTTPS Webhook URL is provided -> 256-Bit SSL HTTPS POST
  if (!directDelivered && config.webhookUrl) {
    try {
      const isUltraMsg = config.webhookUrl.includes('ultramsg.com');
      const body = isUltraMsg
        ? {
            token: config.webhookToken || '',
            to: cleanPhone,
            body: text,
          }
        : {
            phone: cleanPhone,
            message: text,
            payload,
            timestamp: Date.now(),
          };

      const res = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.webhookToken && !isUltraMsg ? { Authorization: `Bearer ${config.webhookToken}` } : {}),
        },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        modeUsed = 'secure_https_webhook';
        directDelivered = true;
      }
    } catch {
      // Webhook fallback
    }
  } else if (!directDelivered && cleanPhone && config.apiKey) {
    // 3. CallMeBot HTTPS API
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${cleanPhone}&text=${encodeURIComponent(text)}&apikey=${config.apiKey}`;
      await fetch(url, { mode: 'no-cors' });
      modeUsed = 'callmebot_api';
      directDelivered = true;
    } catch {
      // API fallback
    }
  }

  // 4. Dispatch window event for live status toast on dashboard
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('innovexa_wa_dispatched', {
        detail: {
          phone: config.phone || DEFAULT_PHONE,
          mode: modeUsed,
          directDelivered,
          message: payload.message,
          timestamp: Date.now(),
          url: waUrl,
        },
      })
    );
  }

  // 5. Only launch window popup if background direct delivery failed
  if (!directDelivered && typeof window !== 'undefined') {
    try {
      window.open(waUrl, '_blank');
    } catch {
      // Popup blocked
    }
  }

  return { success: true, mode: modeUsed, url: waUrl };
}
