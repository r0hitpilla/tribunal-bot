'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getAllWeeklyStats, getAllPlayers, getCurrentWeek } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the ranked hall of infamy')
    .addStringOption(opt =>
      opt.setName('type')
        .setDescription('Leaderboard type')
        .setRequired(true)
        .addChoices(
          { name: 'Shame (Worst KDA first)', value: 'shame' },
        )),

  async execute(interaction) {
    await interaction.deferReply();

    const week        = getCurrentWeek();
    const weeklyStats = getAllWeeklyStats(week);  // already sorted by kda ASC
    const players     = getAllPlayers();
    const playerMap   = Object.fromEntries(players.map(p => [p.discord_id, p]));

    if (weeklyStats.length === 0) {
      return interaction.editReply(
        `⚖️ No stats recorded for **${week}** yet. ` +
        `Run \`/tribunal @someone\` to get the shame engine rolling.`
      );
    }

    const MEDALS = ['🪦', '💀', '😬', '😐', '🙂'];

    const boardLines = weeklyStats.map((row, i) => {
      const player   = playerMap[row.discord_id];
      const mention  = player ? `<@${row.discord_id}>` : `\`${row.discord_id}\``;
      const medal    = MEDALS[i] ?? `${i + 1}.`;
      const kda      = row.kda    != null ? row.kda.toFixed(2)  : '?.??';
      const deaths   = row.deaths != null ? row.deaths          : '?';
      const wr       = row.winRate != null ? `${row.winRate}%`  : '?%';    // not stored — kept for future
      const matches  = row.matches != null ? row.matches        : '?';
      const game     = player?.game?.toUpperCase() ?? '';

      return (
        `${medal} **#${i + 1}** ${mention}  \`[${game}]\`\n` +
        `        \`KDA: ${kda}  |  Deaths: ${deaths}  |  Matches: ${matches}\``
      );
    });

    // Shame stats summary
    const avgKda = (
      weeklyStats.reduce((acc, r) => acc + (r.kda ?? 0), 0) / weeklyStats.length
    ).toFixed(2);

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle(`⚖️ TRIBUNAL LEADERBOARD — ${week}`)
      .setDescription(
        `**Hall of Infamy** — ranked by shame (worst KDA first)\n\n` +
        boardLines.join('\n\n')
      )
      .addFields({
        name: '📊 WEEKLY STATS',
        value: `Players tracked: **${weeklyStats.length}** | Server avg KDA: **${avgKda}**`,
      })
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
