import express from 'express';
import cors from 'cors';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let chromePath = '';
if (fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')) {
  chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
} else if (fs.existsSync('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe')) {
  chromePath = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
} else if (fs.existsSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe')) {
  chromePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
}

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: chromePath || undefined,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

let isReady = false;
let currentQR = '';

client.on('qr', (qr) => {
  currentQR = qr;
  console.log('\n==================================================');
  console.log('📲 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT:');
  console.log('==================================================\n');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  isReady = true;
  currentQR = '';
  console.log('\n==================================================');
  console.log('✅ INNOVEXA WHATSAPP BOT CONNECTED & READY!');
  console.log('==================================================\n');
});

app.get('/', (req, res) => res.redirect('/qr'));

app.get('/status', (req, res) => {
  res.json({ ready: isReady, status: isReady ? 'connected' : 'waiting_qr', hasQr: Boolean(currentQR) });
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
            <p>Your local dashboard is linked. Telemetry alerts will dispatch in the background automatically.</p>
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
          <h2>Initializing WhatsApp Client... Please wait 5 seconds...</h2>
        </body>
      </html>
    `);
  }

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(currentQR)}`;

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Innovexa WhatsApp QR Code</title>
        <meta http-equiv="refresh" content="8">
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
          <h2>📲 Link WhatsApp Bot</h2>
          <p>Scan this QR code with WhatsApp on your phone (<strong>WhatsApp $\rightarrow$ Settings $\rightarrow$ Linked Devices $\rightarrow$ Link a Device</strong>).</p>
          <img src="${qrImageUrl}" alt="WhatsApp QR Code" />
          <p style="font-size: 11px; opacity: 0.8;">Auto-refreshes every 8 seconds</p>
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

  if (!isReady) {
    return res.status(503).json({ error: 'WhatsApp Bot is not connected yet. Scan QR code.' });
  }

  try {
    const cleanNumber = phone.replace(/[^0-9]/g, '');
    const chatId = `${cleanNumber}@c.us`;
    await client.sendMessage(chatId, message);
    console.log(`⚡ Automated alert sent directly to ${phone}!`);
    res.json({ success: true, phone, timestamp: Date.now() });
  } catch (err) {
    console.error('❌ Failed to send WhatsApp message:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🤖 Innovexa WhatsApp Webhook Server listening on http://localhost:${PORT}`);
  console.log('Initializing WhatsApp Client...');
  client.initialize().catch((err) => console.error('Initialization error:', err));
});
