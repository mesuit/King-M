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

  const _errWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    const s = typeof chunk === 'string' ? chunk : chunk.toString();
    if (NOISE.some(r => r.test(s))) return true;
    return _errWrite(chunk, ...rest);
  };

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

require('./peacemaker/index.js');
