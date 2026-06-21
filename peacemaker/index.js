const {
  default: peaceConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  jidDecode,
  getContentType,
  jidNormalizedUser
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require('path');
const express = require("express");
const chalk = require("chalk");
const qrcode = require("qrcode-terminal");
const app = express();

const port = process.env.PORT || 5000;

const authenticationn = require('./auth');
const { initializeDatabase } = require('../Database/config');
const fetchSettings = require('../Database/fetchSettings');
const { smsg } = require('../lib/peacefunc');
const makeInMemoryStore = require('../store/store.js'); 
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// Reconnect — exponential backoff, resets on clean open
let _reconnectDelay = 3000;

// Process-level guard: startup notification fires at most once per process
let _startupNotified = false;

const processedEdits = new Map();
const processedCalls = new Set();
setInterval(() => processedCalls.clear(), 600000);

authenticationn();

async function startPeace() { 
  process.setMaxListeners(0);

  const { state, saveCreds } = await useMultiFileAuthState("session");
  const { version } = await fetchLatestBaileysVersion();

  const client = peaceConnect({
    version,
    logger: pino({ level: "silent" }),
    browser: ["KING-M", "Safari", "5.1.7"],
    auth: state,
    syncFullHistory: true,
  });

  client.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      let decode = jidDecode(jid) || {};
      return (decode.user && decode.server && decode.user + "@" + decode.server) || jid;
    }
    return jid;
  };

  store.bind(client.ev);
  
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      
      const ms = mek; 
      const clienttech = jidNormalizedUser(client.user.id);
      const settings = await fetchSettings();

      // ========== AUTO VIEW & LIKE STATUS ==========
      if (mek.key.remoteJid === "status@broadcast") {
          if (settings.autoview === "on") {
              const participantToUse = mek.key.participantPn || mek.key.participant;
              await client.readMessages([{
                  remoteJid: mek.key.remoteJid,
                  id: mek.key.id,
                  fromMe: mek.key.fromMe,
                  participant: participantToUse || undefined
              }]).catch(() => {});
              console.log(chalk.cyan(`👁️ Status Viewed`));
          }
          if (settings.autolike === "on" && !mek.key.fromMe) {
              const participantToUse = mek.key.participantPn || mek.key.participant;
              if (participantToUse) {
                const defaultEmojis = ['🗿', '✨', '✅', '🔥', '❤️'];
                let emojis = defaultEmojis;
                const custom = settings.autolike_emojis;
                if (custom && custom !== 'default' && typeof custom === 'string' && custom.trim()) {
                    const split = custom.includes(',')
                      ? custom.split(',').map(s => s.trim()).filter(Boolean)
                      : Array.from(custom.trim());
                    if (split.length > 0) emojis = split;
                }
                await client.sendMessage(mek.key.remoteJid, { 
                    react: { key: mek.key, text: emojis[Math.floor(Math.random()*emojis.length)] } 
                }, { statusJidList: [participantToUse, clienttech] }).catch(() => {});
              }
          }
          return;
      }

      // ========== COMMAND HANDLER ==========
      let m = smsg(client, mek, store);
      require("./peace")(client, m, chatUpdate, store);
      
    } catch (err) {
      console.log(chalk.red('[MSG ERROR]'), err.message, err.stack?.split('\n')[1]?.trim() || '');
    }
  });

  // ========== ANTICALL ==========
  client.ev.on('call', async (callData) => {
    try {
        const { anticall } = await fetchSettings();
        if (anticall === 'on') {
            const { id, from, status } = callData[0];
            if (status === 'offer' && !processedCalls.has(id)) {
                processedCalls.add(id);
                await client.rejectCall(id, from);
                await client.sendMessage(from, { 
                    text: "🚫 *Anticall is active.* Please use text messages to communicate." 
                });
                console.log(chalk.yellow(`[ANTICALL] Rejected call ${id} from ${from}`));
            }
        }
    } catch (e) {
        console.error('[ANTICALL ERROR]', e.message);
    }
  });

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) qrcode.generate(qr, { small: true });
    
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log(chalk.red("⛔ KING-M LOGGED OUT — please update SESSION"));
      } else {
        console.log(chalk.yellow(`⚠️ Connection closed (reason: ${reason}). Reconnecting in ${_reconnectDelay / 1000}s…`));
        setTimeout(startPeace, _reconnectDelay);
        _reconnectDelay = Math.min(_reconnectDelay * 2, 60000);
      }
    } else if (connection === "open") {
      _reconnectDelay = 3000;
      await initializeDatabase();
      const { mode, prefix } = await fetchSettings();
      const num = client.user?.id?.split(':')[0] || 'unknown';
      const name = client.user?.name || 'KING-M';
      console.log('');
      console.log(chalk.bold.green('╔══════════════════════════════╗'));
      console.log(chalk.bold.green('║') + chalk.bold.white('       KING-M BOT ACTIVE       ') + chalk.bold.green('║'));
      console.log(chalk.bold.green('╚══════════════════════════════╝'));
      console.log(chalk.cyan(`  📱 Number  : +${num}`));
      console.log(chalk.cyan(`  👤 Name    : ${name}`));
      console.log(chalk.cyan(`  🎯 Mode    : ${mode}`));
      console.log(chalk.cyan(`  ⚡ Prefix  : ${prefix}`));
      console.log(chalk.cyan(`  🕐 Time    : ${new Date().toLocaleString()}`));
      console.log(chalk.bold.green('══════════════════════════════════'));
      console.log('');

      try {
        if (!_startupNotified) {
          const notifyFlag = path.join(__dirname, '../session/.startup_notified');
          const NOTIFY_COOLDOWN_MS = 60 * 60 * 1000;
          let shouldNotify = true;
          if (fs.existsSync(notifyFlag)) {
            const last = parseInt(fs.readFileSync(notifyFlag, 'utf8').trim(), 10);
            if (!isNaN(last) && (Date.now() - last) < NOTIFY_COOLDOWN_MS) {
              shouldNotify = false;
            }
          }
          _startupNotified = true;
          if (shouldNotify) {
            try {
              if (!fs.existsSync(path.dirname(notifyFlag))) {
                fs.mkdirSync(path.dirname(notifyFlag), { recursive: true });
              }
              fs.writeFileSync(notifyFlag, String(Date.now()));
            } catch (e) {}
            client.sendMessage(client.user.id, {
              text: `🟢 *KING-M ONLINE*\n📱 +${num}\n🎯 Mode: ${mode}\n⚡ Prefix: ${prefix || '(prefixless)'}`
            }).catch(() => {});
          }
        }
      } catch (_) {}

      setTimeout(async () => {
        try {
          await client.newsletterFollow('120363425782251560@newsletter');
          await client.groupAcceptInvite('CjBNEKIJq6VE2vrJLDSQ2Z');
        } catch (e) {}
      }, 5000);
    }
  });

  client.ev.on("creds.update", saveCreds);
}

app.get("/", (req, res) => res.status(200).send("KING-M Bot is Active"));
app.listen(port, "0.0.0.0", () => {
    console.log(chalk.bold.yellow(`\n  ⚡ KING-M starting up on port ${port} ...\n`));
    startPeace();
});
