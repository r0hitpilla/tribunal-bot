'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, addShameRecord, logRoast, getCurrentWeek, upsertWeeklyStats } = require('../db');
const { getPlayerStats } = require('../statsApi');
const { generateRoast, extractAwardFromRoast } = require('../roastEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tribunal')
    .setDescription('Drag a player before the tribunal — live stats + full AI roast, permanent record')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('The accused')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('player');
    const player = getPlayer(target.id);

    if (!player) {
      return interaction.editReply(
        `⚖️ <@${target.id}> is not registered with the tribunal. ` +
        `Use \`/register\` first. Running from the record only delays the inevitable.`
      );
    }

    // Fetch live stats from tracker.gg
    const stats = await getPlayerStats(player);

    // Persist to weekly stats
    upsertWeeklyStats(player.discord_id, getCurrentWeek(), {
      kda:                  stats.kda,
      deaths:               stats.deaths,
      team_damage:          0,
      surrenders_initiated: 0,
      matches:              stats.matches,
      raw_data:             stats.raw,
    });

    // Generate roast via Claude
    const roastText = await generateRoast(player, stats);
    const awardName = extractAwardFromRoast(roastText);

    // Save permanent records
    logRoast(player.discord_id, roastText);
    addShameRecord(
      player.discord_id,
      awardName,
      `Awarded during tribunal session on ${new Date().toUTCString()}`,
    );

    // Format stats block (monospace, worst number bolded via field value)
    const statsBlock =
      stats.matches > 0
        ? [
            '```',
            `Rank          ${stats.rank}`,
            `KDA           ${stats.kda}`,
            `K/D           ${stats.kd}`,
            `Deaths        ${stats.deaths}`,
            `Win Rate      ${stats.winRate}%`,
            `Headshot %    ${stats.headshot}%`,
            `Matches       ${stats.matches}`,
            stats.damagePerRound ? `Dmg/Round     ${stats.damagePerRound}` : null,
            '```',
          ].filter(Boolean).join('\n')
        : '```\nNo recorded games — ghost mode confirmed.\n```';

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle(`⚖️ TRIBUNAL — ${target.username.toUpperCase()}`)
      .setDescription(roastText)
      .addFields(
        { name: `📊 ${player.game.toUpperCase()} STATS (LIVE)`, value: statsBlock },
        { name: '🏆 PERMANENT RECORD UPDATED', value: `**${awardName}**` },
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
