'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, getWeeklyStats, getCurrentWeek } = require('../db');
const { getPlayerStats } = require('../statsApi');
const { generateCope } = require('../roastEngine');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cope')
    .setDescription('Offer someone a 1:4 compliment-to-insult cope session')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('The player who needs to cope')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const target = interaction.options.getUser('player');

    // Can't cope yourself
    if (target.id === interaction.user.id) {
      return interaction.editReply(
        `⚖️ You cannot \`/cope\` yourself. The tribunal has no therapy budget. ` +
        `Use \`/excuse\` for self-delusion instead.`
      );
    }

    const player = getPlayer(target.id);

    if (!player) {
      return interaction.editReply(
        `⚖️ <@${target.id}> is not registered with the tribunal. ` +
        `Use \`/register\` first — even cope requires a file.`
      );
    }

    // Try weekly stats first; fall back to live fetch
    let stats = getWeeklyStats(target.id, getCurrentWeek());

    if (!stats || stats.matches === 0) {
      stats = await getPlayerStats(player);
    }

    const copeText = await generateCope(player, stats);

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle(`🧠 COPE SESSION — ${target.username.toUpperCase()}`)
      .setDescription(copeText)
      .addFields({
        name: '📊 THE NUMBERS THAT REQUIRE COPING',
        value:
          stats.matches > 0
            ? `\`KDA: ${stats.kda ?? '?'}  |  Deaths: ${stats.deaths ?? '?'}  |  Matches: ${stats.matches ?? '?'}\``
            : '`No recorded games — possibly too afraid to play.`',
      })
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
