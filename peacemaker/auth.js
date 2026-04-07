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
      decoded = atob(session);
    } catch (e) {
      console.log('Session is invalid (bad base64). Using existing creds if available.');
      return;
    }

    if (!fs.existsSync(credPath)) {
      fs.mkdirSync('./session', { recursive: true });
      fs.writeFileSync(credPath, decoded, 'utf8');
      console.log('Session loaded from SECRET.');
    } else {
      console.log('Using existing session credentials.');
    }
  } catch (err) {
    console.log('Session error: ' + err.message);
  }
}

module.exports = authenticationn;
