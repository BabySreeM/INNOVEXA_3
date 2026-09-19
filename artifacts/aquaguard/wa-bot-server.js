import express from 'express';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let sock = null;
let isReady = false;
let currentQR = '';
let connectionAttempts = 0;

async function connectToWhatsApp() {
  const authFolder = path.join(process.cwd(), 'baileys_cloud_auth');
  if (!fs.existsSync(authFolder)) {
    fs.mkdirSync(authFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  console.log(`🤖 Initializing Baileys WA Socket (Version: ${version.join('.')})...`);

  sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: true,
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 25000,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      currentQR = qr;
      connectionAttempts = 0;
      console.log('\n==================================================');
      console.log('📲 FRESH WHATSAPP QR CODE GENERATED FOR CLOUD!');
      console.log('==================================================\n');
    }

    if (connection === 'close') {
      isReady = false;
      connectionAttempts++;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`Baileys connection closed (Attempt ${connectionAttempts}). Reconnecting: ${shouldReconnect}`);
      
      // If stuck in reconnection loop without QR, clean auth state to force QR generation
      if (connectionAttempts > 3) {
        console.log('⚠️ Clearing stale auth state to force fresh QR code generation...');
        try {
          fs.rmSync(authFolder, { recursive: true, force: true });
        } catch (e) {}
        connectionAttempts = 0;
      }

      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 2000);
      }
    } else if (connection === 'open') {
      isReady = true;
      currentQR = '';
      connectionAttempts = 0;
      console.log('\n==================================================');
      console.log('✅ INNOVEXA WHATSAPP BOT CONNECTED VIA BAILEYS CLOUD!');
      console.log('==================================================\n');
    }
  });
}

app.get('/', (req, res) => res.redirect('/qr'));

app.get('/status', (req, res) => {
  res.json({ ready: isReady, status: isReady ? 'connected' : 'waiting_qr', hasQr: Boolean(currentQR) });
});

app.get('/reset', async (req, res) => {
  console.log('🔄 Manual /reset requested. Clearing session storage...');
  isReady = false;
  currentQR = '';
  const authFolder = path.join(process.cwd(), 'baileys_cloud_auth');
  try {
    if (sock) sock.end();
    fs.rmSync(authFolder, { recursive: true, force: true });
  } catch (e) {}
  setTimeout(connectToWhatsApp, 1000);
  res.send('<h2>🔄 Session reset! Generating fresh QR code... <a href="/qr">View QR Code</a></h2>');
});

app.get('/qr', (req, res) => {
  if (isReady) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>WhatsApp Connected</title>
          <style>body { font-family: system-ui; background: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; } .card { background: #1e293b; padding: 2.5rem; border-radius: 1.5rem; text-align: center; border: 1px solid #334155; } h1 { color: #25D366; }</style>
        </head>
        <body>
          <div class="card">
            <h1>✅ WhatsApp Bot Connected & Active!</h1>
            <p>Your cloud server is linked. Telemetry alerts will dispatch in the background automatically.</p>
          </div>
        </body>
      </html>
    `);
  }

  if (!currentQR) {
    return res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Generating QR...</title>
          <meta http-equiv="refresh" content="3">
          <style>body { font-family: system-ui; background: #0f172a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }</style>
        </head>
        <body>
          <h2>Initializing WhatsApp Client... Please wait 3 seconds...</h2>
        </body>
      </html>
    `);
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(currentQR)}`;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Innovexa Cloud WhatsApp QR Code</title>
        <meta http-equiv="refresh" content="6">
        <style>
          body { font-family: system-ui; background: #0b1329; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #172554; padding: 2.5rem; border-radius: 1.5rem; text-align: center; border: 1px solid #1e40af; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
          h2 { margin-top: 0; color: #60a5fa; }
          img { background: white; padding: 1rem; border-radius: 1rem; margin: 1.5rem 0; width: 280px; height: 280px; }
          p { color: #93c5fd; font-size: 14px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>📲 Link WhatsApp Cloud Server</h2>
          <p>Scan this QR code with WhatsApp on your phone (<strong>WhatsApp $\rightarrow$ Settings $\rightarrow$ Linked Devices $\rightarrow$ Link a Device</strong>).</p>
          <img src="${qrImageUrl}" alt="WhatsApp QR Code" />
          <p style="font-size: 11px; opacity: 0.8;">Auto-refreshes every 6 seconds</p>
        </div>
      </body>
    </html>
  `);
});

app.post('/send-alert', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Missing phone or message' });
  }

  if (!isReady || !sock) {
    return res.status(503).json({ error: 'WhatsApp Bot is not connected yet. Scan QR code.' });
  }

  try {
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    const jid = `${cleanNumber}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    console.log(`⚡ Automated alert sent directly to ${phone}!`);
    res.json({ success: true, phone, timestamp: Date.now() });
  } catch (err) {
    console.error('❌ Failed to send WhatsApp message:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 Innovexa Cloud Baileys Webhook Server listening on port ${PORT}`);
  connectToWhatsApp();
});
