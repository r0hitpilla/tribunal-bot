'use strict';

const { EmbedBuilder } = require('discord.js');
const {
  getAllPlayers,
  getAllWeeklyStats,
  upsertWeeklyStats,
  getCurrentWeek,
  addShameRecord,
} = require('./db');
const { getPlayerStats } = require('./statsApi');

// ─── Weekly title logic ───────────────────────────────────────────────────────

const WEEKLY_TITLES = [
  {
    id:    'anchor',
    title: 'The Anchor',
    desc:  'Lowest KDA — single-handedly holding the team back, one death at a time',
    check: (s) => s.kda < 1.0,
  },
  {
    id:    'spectator',
    title: 'The Spectator',
    desc:  'Most deaths recorded — watched the match from the respawn screen',
    check: (s) => s.deaths > 25,
  },
  {
    id:    'friendly_fire',
    title: 'The Friendly Fire Incident',
    desc:  'Worst win rate — their team never wins when they show up',
    check: (s) => s.winRate < 40,
  },
  {
    id:    'ghost',
    title: 'The Ghost',
    desc:  'Fewest matches — gathered intelligence on the game by not playing it',
    check: (s) => s.matches < 5,
  },
  {
    id:    'charity_kills',
    title: 'Certified Kill Donation Service',
    desc:  'K/D ratio beneath the floor — reliably boosting the enemy team's confidence',
    check: (s) => s.kd < 0.5,
  },
  {
    id:    'default',
    title: 'Participation Trophy',
    desc:  'Was present. Technically.',
    check: () => true,
  },
];

/**
 * Assigns the most fitting savage weekly title based on a player's stats.
 * Returns the first matching title (order matters — worst offences first).
 */
function assignWeeklyTitle(stats) {
  if (!stats || stats.matches === 0) {
    return { title: 'The Ghost', desc: 'Zero matches recorded — truly committed to avoidance' };
  }
  const match = WEEKLY_TITLES.find(t => t.check(stats));
  return match ?? WEEKLY_TITLES[WEEKLY_TITLES.length - 1];
}

// ─── Main report builder ─────────────────────────────────────────────────────

/**
 * Fetches fresh stats for every registered player, updates weekly_stats,
 * assigns shame titles, and posts the formatted embed to the tribunal channel.
 *
 * @param {import('discord.js').Client} discordClient
 * @param {string} channelId
 */
async function buildWeeklyShameReport(discordClient, channelId) {
  const channel = await discordClient.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    console.error(`[shameReport] Channel ${channelId} not found or not accessible`);
    return;
  }

  const week    = getCurrentWeek();
  const players = getAllPlayers();

  if (players.length === 0) {
    await channel.send(
      '⚖️ **WEEKLY TRIBUNAL** — No registered players. ' +
      'Use `/register` to add yourself to the permanent record.'
    );
    return;
  }

  // Refresh all player stats
  const statsMap = {};
  for (const player of players) {
    const stats = await getPlayerStats(player);
    statsMap[player.discord_id] = stats;

    upsertWeeklyStats(player.discord_id, week, {
      kda:                  stats.kda,
      deaths:               stats.deaths,
      team_damage:          0,
      surrenders_initiated: 0,
      matches:              stats.matches,
      raw_data:             stats.raw,
    });
  }

  // Sort by KDA ascending (worst at top)
  const sorted = [...players].sort(
    (a, b) => (statsMap[a.discord_id]?.kda ?? 0) - (statsMap[b.discord_id]?.kda ?? 0)
  );

  // Build leaderboard lines
  const rankEmoji = ['🪦', '💀', '😬', '😐', '🙂'];
  const boardLines = sorted.map((player, i) => {
    const s     = statsMap[player.discord_id];
    const emoji = rankEmoji[i] ?? `${i + 1}.`;
    const kda   = s?.kda   ?? 'N/A';
    const dth   = s?.deaths ?? 'N/A';
    const wr    = s?.winRate != null ? `${s.winRate}%` : 'N/A';
    return `${emoji} <@${player.discord_id}> — \`KDA: ${kda} | Deaths: ${dth} | W/R: ${wr}\``;
  });

  // Assign titles and save shame records
  const titleLines = [];
  for (const player of players) {
    const stats = statsMap[player.discord_id];
    const title = assignWeeklyTitle(stats);
    titleLines.push(`<@${player.discord_id}> → **${title.title}** — *${title.desc}*`);
    addShameRecord(player.discord_id, title.title, title.desc);
  }

  // Identify this week's biggest offender
  const worst  = sorted[0];
  const wStats = statsMap[worst?.discord_id];

  const embed = new EmbedBuilder()
    .setColor(0x8B0000)
    .setTitle(`⚖️ WEEKLY TRIBUNAL — ${week}`)
    .setDescription(
      `**The evidence is in. The record is permanent.**\n\n` +
      boardLines.join('\n')
    )
    .addFields(
      { name: '🏆 WEEKLY SHAME AWARDS', value: titleLines.join('\n') || 'No offenders.' },
      wStats && wStats.matches > 0
        ? {
            name: '🪦 BIGGEST OFFENDER OF THE WEEK',
            value:
              `<@${worst.discord_id}> — KDA of **${wStats.kda}**, ` +
              `died **${wStats.deaths}** times, ` +
              `${wStats.winRate}% win rate. ` +
              `The tribunal is watching.`,
          }
        : { name: '\u200b', value: '\u200b' },
    )
    .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
    .setTimestamp();

  // Mention everyone so they get pinged
  const mentions = players.map(p => `<@${p.discord_id}>`).join(' ');
  await channel.send({ content: mentions, embeds: [embed] });
}

module.exports = { buildWeeklyShameReport };
