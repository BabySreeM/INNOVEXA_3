# Cloud HTTPS Webhook Server Deployment Guide (Option B)

To enable **100% zero-click background WhatsApp delivery from ANY device worldwide** (phones, tablets, laptops deployed on Netlify), deploy your local bot server to **Render.com** (Free tier).

---

## 🚀 Step 1: Render.com 1-Click Setup

1. **Create Free Account:** Go to **[https://dashboard.render.com/](https://dashboard.render.com/)** and sign up for free.
2. **Click New Web Service:** Tap **New +** $\rightarrow$ **Web Service**.
3. **Build & Start Commands:**
   - **Environment:** `Node`
   - **Build Command:** `pnpm install`
   - **Start Command:** `node wa-bot-server.js`
4. **Deploy:** Render will build your server in 2 minutes and give you an HTTPS endpoint URL:
   👉 `https://innovexa-wa-bot.onrender.com`

---

## 🌐 Step 2: Link Netlify Dashboard to Cloud Server

1. Open your live deployed site (e.g. `https://innovexa-dashboard.netlify.app`).
2. Go to **Controls** $\rightarrow$ **WhatsApp Dispatcher**.
3. Paste your cloud HTTPS URL into **HTTPS Webhook Endpoint URL**:
   `https://innovexa-wa-bot.onrender.com/send-alert`
4. Tap **Save Settings**.

---

## ⚡ Result
Now, no matter where your dashboard is accessed—from your phone, an engineer's mobile browser, or anywhere globally—every telemetry alert will dispatch **100% automatically in the background with zero clicks and zero Enter key presses!**
