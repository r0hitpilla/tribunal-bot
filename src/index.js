'use strict';

require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const cron = require('node-cron');
const fs   = require('fs');
const path = require('path');

const { buildWeeklyShameReport } = require('./shameReport');

// ─── Validate env ─────────────────────────────────────────────────────────────

const REQUIRED_ENV = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'ANTHROPIC_API_KEY', 'TRACKER_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[TRIBUNAL] Missing required env var: ${key}. Copy .env.example → .env and fill it in.`);
    process.exit(1);
  }
}

// ─── Discord client ───────────────────────────────────────────────────────────

const discordClient = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

discordClient.commands = new Collection();

// ─── Load commands ────────────────────────────────────────────────────────────

const COMMANDS_DIR = path.join(__dirname, 'commands');
for (const file of fs.readdirSync(COMMANDS_DIR).filter(f => f.endsWith('.js'))) {
  const command = require(path.join(COMMANDS_DIR, file));
  if (command.data && command.execute) {
    discordClient.commands.set(command.data.name, command);
    console.log(`[TRIBUNAL] Loaded command: /${command.data.name}`);
  } else {
    console.warn(`[TRIBUNAL] Skipping ${file} — missing data or execute export`);
  }
}

// ─── Register slash commands globally ────────────────────────────────────────

async function deployCommands() {
  const commands = [...discordClient.commands.values()].map(c => c.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

  try {
    console.log(`[TRIBUNAL] Registering ${commands.length} slash commands globally…`);
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands },
    );
    console.log('[TRIBUNAL] ✅ Global slash commands registered.');
  } catch (err) {
    console.error('[TRIBUNAL] Failed to register slash commands:', err);
  }
}

// ─── Bot ready ────────────────────────────────────────────────────────────────

discordClient.once('ready', async () => {
  console.log(`[TRIBUNAL] ⚖️ Online as ${discordClient.user.tag}`);
  await deployCommands();

  // ── Weekly shame report — every Monday at 09:00 UTC ─────────────────────
  cron.schedule('0 9 * * 1', async () => {
    const channelId = process.env.TRIBUNAL_CHANNEL_ID;
    if (!channelId) {
      console.warn('[TRIBUNAL] TRIBUNAL_CHANNEL_ID not set — skipping weekly shame report');
      return;
    }
    console.log('[TRIBUNAL] 📋 Posting weekly shame report…');
    await buildWeeklyShameReport(discordClient, channelId).catch(err =>
      console.error('[TRIBUNAL] Weekly report error:', err)
    );
  }, { timezone: 'UTC' });

  console.log('[TRIBUNAL] 🕐 Weekly shame cron active — fires every Monday 09:00 UTC');
});

// ─── Command handler ──────────────────────────────────────────────────────────

discordClient.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = discordClient.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[TRIBUNAL] Error in /${interaction.commandName}:`, err);
    const errReply = {
      content: '⚖️ The tribunal encountered an internal error. Even our shame engine has limits.',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errReply).catch(() => {});
    } else {
      await interaction.reply(errReply).catch(() => {});
    }
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

discordClient.login(process.env.DISCORD_TOKEN).catch(err => {
  console.error('[TRIBUNAL] Failed to login:', err.message);
  process.exit(1);
});
