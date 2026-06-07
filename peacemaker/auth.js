const fs = require('fs');
const session = process.env.SESSION || '';

async function authenticationn() {
  const credPath = './session/creds.json';
  try {
    if (!session || session === 'YOUR_SESSION_ID_HERE' || session === '') {
      if (!fs.existsSync(credPath)) {
        console.log('No SESSION set. Bot will show QR code for pairing.');
      } else {
        console.log('Using existing session credentials.');
      }
      return;
    }

    let decoded;
    try {
      // Handle all base64 variants: standard, URL-safe, with/without padding
      let b64 = session.trim();
      // Convert URL-safe base64 (- and _) to standard base64 (+ and /)
      b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      const pad = b64.length % 4;
      if (pad === 2) b64 += '==';
      else if (pad === 3) b64 += '=';
      decoded = Buffer.from(b64, 'base64').toString('utf8');
      // Validate it looks like JSON
      JSON.parse(decoded);
    } catch (e) {
      // Try raw atob as last resort
      try { decoded = atob(session); JSON.parse(decoded); }
      catch (_) {
        console.log('Session is invalid or corrupted. Using existing creds if available.');
        return;
      }
    }

    if (!fs.existsSync(credPath)) {
      fs.mkdirSync('./session', { recursive: true });
      fs.writeFileSync(credPath, decoded, 'utf8');
      console.log('Session loaded from SESSION secret.');
    } else {
      console.log('Using existing session credentials.');
    }
  } catch (err) {
    console.log('Session error: ' + err.message);
  }
}

module.exports = authenticationn;
