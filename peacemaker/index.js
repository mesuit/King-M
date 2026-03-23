const {
  default: peaceConnect,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  jidDecode,
  proto,
  getContentType,
  jidNormalizedUser // Added this as required by your logic
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require('path');
const axios = require("axios");
const express = require("express");
const chalk = require("chalk");
const FileType = require("file-type");
const figlet = require("figlet");
const qrcode = require("qrcode-terminal");
const logger = pino({ level: 'silent' });
const app = express();
const _ = require("lodash");
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 50;

// Suppress noisy Baileys/libsignal internal console output
const _origLog = console.log;
const _origErr = console.error;
const _noisePatterns = ['Closing session', 'Closing open session', 'SessionEntry', '_chains', 'registrationId', 'currentRatchet', 'ephemeralKeyPair', 'indexInfo', 'remoteIdentityKey', 'rootKey', 'lastRemoteEphemeral'];
console.log = (...args) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  if (_noisePatterns.some(p => msg.includes(p))) return;
  _origLog(...args);
};
console.error = (...args) => {
  const msg = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
  if (_noisePatterns.some(p => msg.includes(p))) return;
  _origErr(...args);
};

let lastTextTime = 0;
const messageDelay = 3000;
const Events = require('../peacemaker/events');
const authenticationn = require('../peacemaker/auth');
const { initializeDatabase } = require('../Database/config');
const fetchSettings = require('../Database/fetchSettings');
const PhoneNumber = require("awesome-phonenumber");
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('../lib/peaceexif');
const { smsg, sleep } = require('../lib/peacefunc');
const { port } = require("../set.js");
const makeInMemoryStore = require('../store/store.js'); 
const store = makeInMemoryStore({ logger: logger.child({ stream: 'store' }) });
const color = (text, color) => {
  return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

authenticationn();

const processedEdits = new Set();
const reactedStatuses = new Set();

async function startPeace() { 
  let autobio, autolike, autoview, mode, prefix, anticall, antiedit;

  try {
    const settings = await fetchSettings();
    ({ autobio, autolike, autoview, mode, prefix, anticall, antiedit } = settings);
    console.log("✅ Settings loaded successfully");
  } catch (error) {
    console.error("❌ Failed to load settings", error.message);
    return;
  }

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

  // Auto bio update
  if (autobio === 'on') {
    setInterval(() => {
      const date = new Date();
      client.updateProfileStatus(
        `📅 ${date.toLocaleString('en-US', { timeZone: 'Africa/Nairobi' })} | KING M`
      ).catch(() => {});
    }, 60 * 1000);
  }

  store.bind(client.ev);
  
  client.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      let mek = chatUpdate.messages[0];
      if (!mek.message) return;
      
      const ms = mek; // Alias to match your logic
      const clienttech = jidNormalizedUser(client.user.id);
      const fromJid = ms.key.participant || ms.key.remoteJid;

      ms.message = getContentType(ms.message) === 'ephemeralMessage'
        ? ms.message.ephemeralMessage.message
        : ms.message;

      // ========== AUTO VIEW & LIKE STATUS (YOUR EXACT LOGIC) ==========
      if (ms.key.remoteJid === "status@broadcast") {
        try {
          // Auto View Status
          if (autoview === "on") {
            const participantToUse = ms.key.participantPn || ms.key.participant;
            const readKey = {
              remoteJid: ms.key.remoteJid,
              id: ms.key.id,
              fromMe: ms.key.fromMe,
              participant: participantToUse
            };
            
            await client.readMessages([readKey]);
            console.log(chalk.cyan(`👁️ Viewed: ${participantToUse}`));
          }

          // Auto Like Status
          if (autolike === "on" && ms.key.participant && !ms.key.fromMe) {
            const participantToUse = ms.key.participantPn || ms.key.participant;
            const reactionKey = {
              remoteJid: ms.key.remoteJid,
              id: ms.key.id,
              fromMe: ms.key.fromMe,
              participant: participantToUse
            };
            
            const emojis = ['🗿', '⌚️', '💠', '✨', '❤️', '🔥', '💯', '🌟', '✅'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            
            await client.sendMessage(
              ms.key.remoteJid,
              { react: { key: reactionKey, text: randomEmoji } },
              { statusJidList: [participantToUse, clienttech] }
            );
            console.log(chalk.green(`✅ Liked: ${participantToUse}`));
          }
          return; // Stop here for statuses
        } catch (error) {
          console.error("Error handling status broadcast:", error);
        }
      }
      
      // Mode Check for Commands
      const isMe = mek.key.fromMe;
      if (mode === 'private' && !isMe) return;
      
      let m = smsg(client, mek, store);
      const peace = require("../peacemaker/peace");
      peace(client, m, chatUpdate, store);
      
    } catch (err) {
      console.log(chalk.red('[MSG ERROR]'), err.message || err);
    }
  });

  // ========== ANTI-EDIT & ANTI-CALL (MAINTAINED) ==========
  client.ev.on('messages.update', async (messageUpdates) => {
    try {
      const { antiedit: currentAntiedit } = await fetchSettings();
      if (currentAntiedit === 'off') return;
      for (const update of messageUpdates) {
        const { key, update: { message } } = update;
        if (!key?.id || !message) continue;
        const editId = `${key.id}-${key.remoteJid}`;
        if (processedEdits.has(editId)) continue;

        const editedMsg = message.editedMessage?.message || message.editedMessage;
        if (!editedMsg) continue;

        let originalMsg = (store && typeof store.loadMessage === 'function') ? await store.loadMessage(key.remoteJid, key.id) : {};
        const sender = key.participant || key.remoteJid;

        const getContent = (msg) => {
          if (!msg) return '[Deleted]';
          const type = Object.keys(msg)[0];
          return type === 'conversation' ? msg[type] : `[${type}]`;
        };

        const notificationMessage = `*⚠️ ANTI-EDIT RESTORED ⚠️*\n👤 *Sender:* @${sender.split('@')[0]}\n📄 *Original:* ${getContent(originalMsg?.message)}\n✏️ *Edited:* ${getContent(editedMsg)}`;

        const sendTo = currentAntiedit === 'private' ? client.user.id : key.remoteJid;
        await client.sendMessage(sendTo, { text: notificationMessage, mentions: [sender] }).catch(() => {});
        processedEdits.add(editId);
      }
    } catch (err) { console.error(chalk.red('[ANTIEDIT ERROR]', err.message)); }
  });

  client.ev.on('call', async (callData) => {
    const { anticall: dbAnticall } = await fetchSettings();
    if (dbAnticall === 'on') {
      const callId = callData[0]?.id;
      const callerId = callData[0]?.from;
      if (callId && callerId) {
        await client.rejectCall(callId, callerId);
        if (Date.now() - lastTextTime >= messageDelay) {
          await client.sendMessage(callerId, { text: "🚫 Anticall is active. Only text messages are allowed." });
          lastTextTime = Date.now();
        }
      }
    }
  });

  client.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log(chalk.yellow("\n📱 Scan this QR code to connect KING-M to WhatsApp:\n"));
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        console.log(`Connection closed: ${reason}. Reconnecting...`);
        startPeace();
      }
    } else if (connection === "open") {
      await initializeDatabase();
      console.log(color("✅ KING-M CONNECTED & DATABASE READY", "green"));
      client.sendMessage(client.user.id, { text: `🔶 *KING M STATUS*\n✅ CONNECTED\n⚙️ MODE: ${mode}` }).catch(() => {});

      // Auto-follow KING-M newsletter and join support group on every (re)connect
      setTimeout(async () => {
        try {
          await client.newsletterFollow('120363425782251560@newsletter');
          console.log(color('[KING-M] Auto-followed newsletter', 'green'));
        } catch (e) {
          console.log('[KING-M] Newsletter follow skipped:', e.message);
        }
        try {
          const link = 'https://chat.whatsapp.com/CjBNEKIJq6VE2vrJLDSQ2Z';
          const code = link.split('/').pop();
          await client.groupAcceptInvite(code);
          console.log(color('[KING-M] Auto-joined support group', 'green'));
        } catch (e) {
          console.log('[KING-M] Group join skipped (already member or error):', e.message);
        }
      }, 5000); // 5-second delay so connection is fully stable first
    }
  });

  client.ev.on("creds.update", saveCreds);
  return client;
}

app.use(express.static(path.join(__dirname, '../pixel')));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, '../pixel/index.html')));
app.listen(port, "0.0.0.0", () => console.log(`📡 Server on port ${port}`));

startPeace();
