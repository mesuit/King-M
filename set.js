
const sessionName = 'session';
const session = process.env.SESSION || '';
const appname = process.env.APP_NAME || '';
const herokuapi = process.env.HEROKU_API;
const botname = process.env.BOTNAME || 'ᴘᴇᴀᴄᴇ-ʜᴜʙ';
const author = process.env.STICKER_AUTHOR || 'ᴄᴏʀᴇ';
const packname = process.env.STICKER_PACKNAME || 'ᴘᴇᴀᴄᴇ';
const dev = process.env.DEV || '254769995625';
const owner = dev.split(",");
const menulink = process.env.MENU_LINK || 'https://files.catbox.moe/as1b4c.png
';
const menu = process.env.MENU_TYPE || 'VIDEO';
const bad = process.env.BAD_WORD || 'fuck';
const admin = process.env.ADMIN_MSG || 'ᴄᴏᴍᴍᴀɴᴅ ʀᴇsᴇʀᴠᴇᴅ ꜰᴏʀ ᴀᴅᴍɪɴs!';
const group = process.env.GROUP_ONLY_MSG || '👥ᴄᴏᴍᴍᴀɴᴅ ᴍᴇᴀɴᴛ ꜰᴏʀ ɢʀᴏᴜᴘs!';
const botAdmin = process.env.BOT_ADMIN_MSG || '🧃 ʏᴏᴜ ɴᴇᴇᴅ ᴀɴ ᴀᴅᴍɪɴ ᴊᴜɪᴄᴇ ʀᴇꜰɪʟʟ ʙᴇꜰᴏʀᴇ sɪᴘᴘɪɴɢ ᴏɴ ᴛʜɪs ᴄᴏᴍᴍᴀɴᴅ!';
const NotOwner = process.env.NOT_OWNER_MSG || '👮ᴄᴏᴍᴍᴀɴᴅ ᴍᴇᴀɴᴛ ꜰᴏʀ ᴛʜᴇ ᴏᴡɴᴇʀ!';
const mycode = process.env.CODE || '254';
const port = process.env.PORT || 8080;
const databaseUrl = process.env.DATABASE_URL || '';

module.exports = {
  session,
  sessionName,
  author,
  packname,
  dev,
  owner,
  bad,
  group,
  NotOwner,
  botname,
  botAdmin, 
  menu,
  menulink,
  admin,
  mycode,
  herokuapi,
  port,
  appname,
  databaseUrl
};
