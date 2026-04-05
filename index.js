/**
 * KING-M Entry Point
 */

// ── CLEAN TERMINAL: suppress Baileys / libsignal / network noise ────────────
(function suppressNoise() {
  const NOISE = [
    /bad mac/i, /decrypt fail/i, /failed to decrypt/i,
    /failed to process/i, /stream errored/i, /invalid node/i,
    /connection timed out/i, /connection closed/i, /lost connection/i,
    /ECONNRESET/i, /ETIMEDOUT/i, /ENOTFOUND/i, /ECONNREFUSED/i,
    /getaddrinfo/i, /socket hang up/i, /write EPIPE/i,
    /Retrying connection/i, /retrying/i,
    /DeprecationWarning/i, /ExperimentalWarning/i,
    /noise_\w+/i, /handshake/i,
    /Closing open session/i, /Closing session/i, /SessionEntry/i,
    /_chains/i, /chainKey/i, /chainType/i, /messageKeys/i,
    /registrationId/i, /currentRatchet/i, /ephemeralKeyPair/i,
    /lastRemoteEphemeralKey/i, /previousCounter/i, /rootKey/i,
    /indexInfo/i, /baseKey/i, /baseKeyType/i, /remoteIdentityKey/i,
    /pendingPreKey/i, /signedKeyId/i, /preKeyId/i,
    /pubKey/i, /privKey/i, /<Buffer /i, /Buffer \d+/i,
    /MessageCounterError/i, /Key used already/i, /never filled/i,
    /Session error/i, /session_cipher/i, /queue_job/i,
    /MaxListenersExceeded/i, /memory leak detected/i,
    /Decrypted message with closed/i, /closed session/i,
    /Possible EventEmitter/i, /setMaxListeners/i,
    /Antiedit Error/i, /Antidelete Error/i,
  ];
  const isNoisy = (...args) => {
    const msg = args.map(a => (typeof a === 'object' ? (a?.message || '') : String(a))).join(' ');
    return NOISE.some(r => r.test(msg));
  };
  const _err  = console.error.bind(console);
  const _warn = console.warn.bind(console);
  console.error = (...a) => { if (!isNoisy(...a)) _err(...a); };
  console.warn  = (...a) => { if (!isNoisy(...a)) _warn(...a); };

  // Silence stderr writes from native modules (libsignal, etc.)
  const _errWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    const s = typeof chunk === 'string' ? chunk : chunk.toString();
    if (NOISE.some(r => r.test(s))) return true;
    return _errWrite(chunk, ...rest);
  };

  // Silence noisy stdout writes (SessionEntry dumps, Buffer dumps, etc.)
  const _outWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => {
    const s = typeof chunk === 'string' ? chunk : chunk.toString();
    if (NOISE.some(r => r.test(s))) return true;
    return _outWrite(chunk, ...rest);
  };

  process.on('uncaughtException', (err) => {
    if (isNoisy(err.message || '')) return;
    console.error('[UNCAUGHT]', err.message);
  });
  process.on('unhandledRejection', (reason) => {
    const msg = reason?.message || String(reason);
    if (isNoisy(msg)) return;
    console.error('[UNHANDLED]', msg);
  });
})();
// ────────────────────────────────────────────────────────────────────────────

const SESSION = process.env.SESSION || '';
const isReplit = !!(process.env.REPL_ID || process.env.REPL_SLUG);

if (isReplit && !SESSION) {
  // ─── REPLIT (no session): lightweight gateway that proxies to the VPS deployer ──────
  const express = require('express');
  const axios   = require('axios');

  const app     = express();
  app.use(express.json());

  const PORT    = process.env.PORT || 5000;
  const VPS_API = 'http://173.249.50.158:1956';
  const API_KEY = process.env.DEPLOY_KEY || 'lasthope';

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  function auth(req, res, next) {
    const key = req.headers['x-api-key'] || req.query.apiKey || req.body?.apiKey;
    if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
    next();
  }

  app.get('/', (req, res) => {
    res.json({
      service: 'KING-M Deploy Gateway (Replit)',
      status: 'online',
      endpoints: {
        'POST /deploy':      'Deploy a bot — body: { session, dev, code }',
        'GET  /bots':        'List all deployed bots',
        'GET  /status/:dev': 'Get status of a single bot',
        'POST /restart':     'Restart a bot — body: { dev }',
        'DELETE /stop':      'Stop a bot — body: { dev }',
        'GET  /logs/:dev':   'Get last 80 lines of bot logs',
      }
    });
  });

  app.post('/deploy', auth, async (req, res) => {
    const { session, dev, code } = req.body;
    if (!session || !dev) return res.status(400).json({ error: 'session and dev are required' });
    try {
      const { data } = await axios.post(`${VPS_API}/deploy`,
        { apiKey: API_KEY, SESSION: session, DEV: dev, CODE: code || '254' },
        { timeout: 180000 });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: 'VPS deploy failed', detail: err.response?.data || err.message });
    }
  });

  app.get('/bots', auth, async (req, res) => {
    try {
      const { data } = await axios.get(`${VPS_API}/bots?apiKey=${API_KEY}`, { timeout: 15000 });
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: 'Could not reach VPS', detail: err.message });
    }
  });

  app.get('/status/:dev', auth, async (req, res) => {
    try {
      const { data } = await axios.get(`${VPS_API}/status/${req.params.dev}?apiKey=${API_KEY}`, { timeout: 10000 });
      res.json(data);
    } catch (err) {
      res.status(err.response?.status || 502).json({ error: err.response?.data || err.message });
    }
  });

  app.post('/restart', auth, async (req, res) => {
    const { dev } = req.body;
    if (!dev) return res.status(400).json({ error: 'dev is required' });
    try {
      const { data } = await axios.post(`${VPS_API}/restart`, { apiKey: API_KEY, DEV: dev }, { timeout: 15000 });
      res.json(data);
    } catch (err) {
      res.status(err.response?.status || 502).json({ error: err.response?.data || err.message });
    }
  });

  app.delete('/stop', auth, async (req, res) => {
    const { dev } = req.body;
    if (!dev) return res.status(400).json({ error: 'dev is required' });
    try {
      const { data } = await axios.delete(`${VPS_API}/stop`, { data: { apiKey: API_KEY, DEV: dev }, timeout: 15000 });
      res.json(data);
    } catch (err) {
      res.status(err.response?.status || 502).json({ error: err.response?.data || err.message });
    }
  });

  app.get('/logs/:dev', auth, async (req, res) => {
    try {
      const { data } = await axios.get(`${VPS_API}/logs/${req.params.dev}?apiKey=${API_KEY}`, { timeout: 15000 });
      res.json(data);
    } catch (err) {
      res.status(err.response?.status || 502).json({ error: err.response?.data || err.message });
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[KING-M] Replit gateway running on port ${PORT}`);
  });

} else {
  // ─── SESSION is set OR non-Replit host: start the real WhatsApp bot ─────────
  require('./peacemaker/index.js');
}
