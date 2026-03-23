const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const VPS_API = 'http://173.249.50.158:1956';
const API_KEY = process.env.DEPLOY_KEY || 'lasthope';

// ─── CORS — allow frontend and any caller ─────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'KING-M Deploy API',
    status: 'online',
    endpoints: {
      'POST /deploy':          'Deploy a bot — body: { session, dev, code }',
      'GET  /bots':            'List all deployed bots with status and port',
      'GET  /status/:dev':     'Get status of a single bot',
      'POST /restart':         'Restart a bot — body: { dev }',
      'DELETE /stop':          'Stop and remove a bot — body: { dev }',
      'GET  /logs/:dev':       'Get last 80 lines of bot logs',
    }
  });
});

// ─── POST /deploy ─────────────────────────────────────────────────────────────
// Body: { session, dev, code }
// session = base64 WhatsApp session string
// dev     = phone number (e.g. "254727218651")
// code    = country code  (e.g. "254")
app.post('/deploy', auth, async (req, res) => {
  const { session, dev, code } = req.body;
  if (!session || !dev) {
    return res.status(400).json({ error: 'session and dev are required' });
  }
  try {
    const { data } = await axios.post(`${VPS_API}/deploy`, {
      apiKey: 'lasthope',
      SESSION: session,
      DEV: dev,
      CODE: code || '254'
    }, { timeout: 180000 });
    res.json(data);
  } catch (err) {
    const msg = err.response?.data || err.message;
    res.status(502).json({ error: 'VPS deploy failed', detail: msg });
  }
});

// ─── GET /bots ────────────────────────────────────────────────────────────────
app.get('/bots', auth, async (req, res) => {
  try {
    const { data } = await axios.get(`${VPS_API}/bots?apiKey=lasthope`, { timeout: 15000 });
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Could not reach VPS', detail: err.message });
  }
});

// ─── GET /status/:dev ─────────────────────────────────────────────────────────
app.get('/status/:dev', auth, async (req, res) => {
  try {
    const { data } = await axios.get(
      `${VPS_API}/status/${req.params.dev}?apiKey=lasthope`,
      { timeout: 10000 }
    );
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data || err.message });
  }
});

// ─── POST /restart ────────────────────────────────────────────────────────────
app.post('/restart', auth, async (req, res) => {
  const { dev } = req.body;
  if (!dev) return res.status(400).json({ error: 'dev is required' });
  try {
    const { data } = await axios.post(`${VPS_API}/restart`,
      { apiKey: 'lasthope', DEV: dev },
      { timeout: 15000 }
    );
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data || err.message });
  }
});

// ─── DELETE /stop ─────────────────────────────────────────────────────────────
app.delete('/stop', auth, async (req, res) => {
  const { dev } = req.body;
  if (!dev) return res.status(400).json({ error: 'dev is required' });
  try {
    const { data } = await axios.delete(`${VPS_API}/stop`,
      { data: { apiKey: 'lasthope', DEV: dev }, timeout: 15000 }
    );
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data || err.message });
  }
});

// ─── GET /logs/:dev ───────────────────────────────────────────────────────────
app.get('/logs/:dev', auth, async (req, res) => {
  try {
    const { data } = await axios.get(
      `${VPS_API}/logs/${req.params.dev}?apiKey=lasthope`,
      { timeout: 15000 }
    );
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 502;
    res.status(status).json({ error: err.response?.data || err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`KING-M Deploy API running on port ${PORT}`);
});
