# ⚖️ TRIBUNAL BOT

A Discord bot that drags players before the tribunal — live Valorant/CS2 stats pulled from tracker.gg, savage AI roasts powered by Claude, and a permanent shame record that never forgets.

---

## Commands

| Command | Description |
|---|---|
| `/register @player <username> <game>` | Link a Discord user to their Valorant (`Name#TAG`) or CS2 (Steam ID 64-bit) account |
| `/tribunal @player` | Live stats + full AI roast + permanent shame record saved |
| `/leaderboard shame` | This week's hall of infamy ranked by worst KDA |
| `/hall-of-shame @player` | Every award a player has ever received, oldest to newest |
| `/excuse` | Generate a scientifically bulletproof excuse for your own stats |
| `/cope @player` | Give someone a 1:4 compliment-to-insult cope session |

A weekly shame report fires automatically every **Monday at 09:00 UTC** in your designated channel.

---

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd tribunal-bot
npm install
```

### 2. Get your API keys

#### Discord Bot Token + Client ID
1. Go to [discord.com/developers/applications](https://discord.com/developers/applications)
2. Click **New Application** → name it "Tribunal Bot"
3. Go to **Bot** tab → click **Reset Token** → copy the token → this is your `DISCORD_TOKEN`
4. Go to **General Information** tab → copy **Application ID** → this is your `DISCORD_CLIENT_ID`
5. Under **Bot** tab, enable **Server Members Intent** and **Message Content Intent**

#### Invite the bot to your server
Still on the developer portal:
1. Go to **OAuth2 → URL Generator**
2. Scopes: check `bot` and `applications.commands`
3. Bot Permissions: check `Send Messages`, `Embed Links`, `Read Message History`
4. Copy the generated URL and open it in your browser to invite the bot

#### Anthropic API Key
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. **API Keys** → **Create Key** → copy it → this is your `ANTHROPIC_API_KEY`

#### tracker.gg API Key
1. Go to [tracker.gg/developers](https://tracker.gg/developers)
2. Sign in → **Create Application** → fill in the form
3. Copy your **API Key** → this is your `TRACKER_API_KEY`
   - Free tier: 3,000 requests/day — plenty for a friend group

#### Tribunal Channel ID (for weekly reports)
1. In Discord, enable **Developer Mode**: User Settings → Advanced → Developer Mode
2. Right-click the channel you want weekly reports in → **Copy Channel ID**
3. This is your `TRIBUNAL_CHANNEL_ID`

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in all five values:

```env
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
ANTHROPIC_API_KEY=your_anthropic_key_here
TRACKER_API_KEY=your_tracker_gg_key_here
TRIBUNAL_CHANNEL_ID=your_channel_id_here
```

### 4. Run

```bash
# Production
npm start

# Development (auto-restarts on file changes, Node 18+)
npm run dev
```

On first start the bot registers its slash commands globally. Global commands take up to 1 hour to propagate to all servers — this is a Discord limitation. Subsequent restarts are instant because the commands are already registered.

---

## Registering players

Before anyone can be tribunalled they need a registered account:

```
/register @SomeUser PlayerName#1234 Valorant
/register @SomeUser 76561198012345678 CS2
```

- **Valorant**: username must be in `Name#TAG` format (e.g. `PlayerOne#EUW`)
- **CS2**: provide the Steam ID in 64-bit format (17 digits starting with `765`)
  - Find it at [steamid.io](https://steamid.io) — enter a profile URL and copy the **steamID64**

---

## Weekly shame report

The bot fires a shame report every **Monday at 09:00 UTC** in the channel set by `TRIBUNAL_CHANNEL_ID`. It:

1. Fetches live stats for all registered players
2. Assigns a shame title based on the worst stats that week
3. Posts an embed mentioning each player

If `TRIBUNAL_CHANNEL_ID` is not set the cron job skips silently.

---

## Data storage

Everything is stored in a local SQLite database at `data/tribunal.db` (created automatically on first run):

| Table | Contents |
|---|---|
| `players` | Discord ID, username, game, game username |
| `shame_records` | Award name, description, timestamp per player |
| `weekly_stats` | KDA, deaths, matches per player per week |
| `roast_log` | Full roast text history |

---

## Requirements

- Node.js 18 or higher (uses native `fetch`)
- The four required API keys listed above

---

## Project structure

```
tribunal-bot/
├── src/
│   ├── index.js          — Bot entry point, command loader, cron
│   ├── db.js             — SQLite schema and all database helpers
│   ├── statsApi.js       — tracker.gg API wrapper (Valorant + CS2)
│   ├── roastEngine.js    — Claude API: roast, excuse, cope generators
│   ├── shameReport.js    — Weekly shame report builder
│   └── commands/
│       ├── register.js
│       ├── tribunal.js
│       ├── leaderboard.js
│       ├── hallofshame.js
│       ├── excuse.js
│       └── cope.js
├── data/                 — SQLite database (auto-created)
├── .env.example
├── package.json
└── README.md
```
