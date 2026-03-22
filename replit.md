# KING M - WhatsApp Bot

## Overview
A WhatsApp Multi-Device bot built with Node.js using the Baileys library. It connects to WhatsApp Web and provides automation features like auto-view/like statuses, anti-call, anti-edit, and various message commands.

## Architecture

- **Entry Point**: `index.js` → loads `./peacemaker/index`
- **Bot Core**: `peacemaker/index.js` — WhatsApp connection, event handling, Express server
- **Commands**: `peacemaker/peace.js` — command routing and handlers
- **Auth**: `peacemaker/auth.js` — session management (decodes SESSION env var into `session/creds.json`)
- **Database**: `Database/config.js` — hybrid mode: PostgreSQL if `DATABASE_URL` env is set, SQLite otherwise
- **Settings**: `set.js` — all configurable constants, reads from `.env` or environment variables
- **Web UI**: `pixel/index.html` — static HTML page served by Express on port 5000
- **Store**: `store/store.js` — in-memory message store

## Running

The app runs via `node index.js`. The Express web server binds to `0.0.0.0:5000`.

## Environment Variables

- `SESSION` — WhatsApp session credentials (base64-encoded JSON), required for bot connection
- `DEV` — Bot owner phone number(s), comma-separated, no `+` sign (e.g. `254712345678`)
- `CODE` — Country code without `+` (e.g. `254`)
- `DATABASE_URL` — PostgreSQL connection string (if not set, falls back to SQLite)
- `APP_NAME` — Application name
- `HEROKU_API` — Heroku API key (for var updates via DM)
- `PORT` — Web server port (defaults to 5000)

## Database

- **PostgreSQL** (cloud): Used when `DATABASE_URL` is set. Tables: `bot_settings`, `sudo_owners`, `badwords`
- **SQLite** (local): Used when `DATABASE_URL` is not set. File: `Database/database.db`

## VPS Deployment (Primary)

The bot runs on VPS `173.249.50.158` via a PM2 deployer API on port 1956.
- Deploy API: `POST http://173.249.50.158:1956/deploy` with `{apiKey: "lasthope", SESSION, DEV, CODE}`
- Bot instance path: `/home/makamesco/hope/instances/<DEV>/`
- Repo path: `/home/makamesco/hope/repo/`
- PM2 process name: `king-<DEV>` (e.g. `king-254727218651`)
- Database on VPS: SQLite (no DATABASE_URL set)
- Replit runs in standby mode only (bot is on VPS to avoid session conflicts)

## Known Fixes Applied

- `downloadContentFromMessage` + `downloadMediaMessage` imported in `peace.js` (fixes `s`, `vv`, `vv2`, `take`)
- `vv` command uses `downloadContentFromMessage` directly instead of `client.downloadMediaMessage`
- `vv2` now handles all media types and view-once variants properly
- `take` uses `m.quoted.msg || m.quoted.message?.stickerMessage` for robust sticker access
- `logInfo` undefined replaced with `console.log(chalk.cyan(...))` in hot-reload watcher
- EventEmitter maxListeners raised to 50 (was 20, causing warning)
- Terminal noise filter: suppresses Baileys/libsignal internal signal protocol console dumps
- Raw `console.log(err)` in message handler replaced with `console.log(chalk.red('[MSG ERROR]'), err.message)`
