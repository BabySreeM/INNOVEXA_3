import express from 'express';
import cors from 'cors';
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let isReady = false;
let currentPairingCode = '';

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('baileys_auth_info');
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      isReady = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log('Baileys connection closed. Reconnecting:', shouldReconnect);
      if (shouldReconnect) {
        setTimeout(connectToWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      isReady = true;
      currentPairingCode = '';
      console.log('\n==================================================');
      console.log('✅ INNOVEXA WHATSAPP BOT CONNECTED & READY!');
      console.log('==================================================\n');
    }
  });
}

app.get('/pair-code', async (req, res) => {
  const phone = (req.query.phone || '916369056400').replace(/[^0-9]/g, '');
  if (!sock) {
    return res.status(503).json({ error: 'WhatsApp client initializing...' });
  }

  try {
    const code = await sock.requestPairingCode(phone);
    currentPairingCode = code;
    console.log(`\n🔑 FRESH WHATSAPP PAIRING CODE FOR +${phone}: [ ${code} ]\n`);
    res.json({ success: true, phone, pairingCode: code });
  } catch (err) {
    console.error('Error requesting pairing code:', err);
    res.status(500).json({ error: err.message || 'Failed to request pairing code' });
  }
});

app.get('/status', (req, res) => {
  res.json({ ready: isReady, status: isReady ? 'connected' : 'waiting_auth' });
});

app.post('/send-alert', async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: 'Missing phone or message' });
  }

  if (!isReady || !sock) {
    return res.status(503).json({ error: 'WhatsApp Bot is not connected yet.' });
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🤖 Innovexa Baileys Local Webhook Server listening on http://localhost:${PORT}`);
  connectToWhatsApp();
});
