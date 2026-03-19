'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, getWeeklyStats, getCurrentWeek } = require('../db');
const { getPlayerStats } = require('../statsApi');
const { generateExcuse } = require('../roastEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('excuse')
    .setDescription('Generate a scientifically bulletproof excuse for your terrible performance'),

  async execute(interaction) {
    await interaction.deferReply();

    const user   = interaction.user;
    const player = getPlayer(user.id);

    if (!player) {
      return interaction.editReply(
        `⚖️ <@${user.id}> is not registered with the tribunal. ` +
        `Use \`/register\` first — you cannot excuse your way out of registration.`
      );
    }

    // Try weekly stats first; fall back to live fetch
    let stats = getWeeklyStats(user.id, getCurrentWeek());

    if (!stats || stats.matches === 0) {
      stats = await getPlayerStats(player);
    }

    const excuseText = await generateExcuse(player, stats);

    const embed = new EmbedBuilder()
      .setColor(0x1F6FEB)   // blue — you're trying to defend yourself
      .setTitle(`📋 OFFICIAL EXCUSE — ${user.username.toUpperCase()}`)
      .setDescription(excuseText)
      .addFields({
        name: '📊 EVIDENCE AGAINST YOU',
        value:
          stats.matches > 0
            ? `\`KDA: ${stats.kda ?? '?'}  |  Deaths: ${stats.deaths ?? '?'}  |  Matches: ${stats.matches ?? '?'}\``
            : '`No recorded games — ghost mode confirmed.`',
      })
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
