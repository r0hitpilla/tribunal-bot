'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getPlayer, getShameRecords } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hall-of-shame')
    .setDescription("Pull up every award a player has ever received — oldest to newest")
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('The accused')
        .setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply();

    const target  = interaction.options.getUser('player');
    const player  = getPlayer(target.id);

    if (!player) {
      return interaction.editReply(
        `⚖️ <@${target.id}> has no file with the tribunal yet. ` +
        `Use \`/register\` to open their case. Their innocence is suspicious.`
      );
    }

    const records = getShameRecords(target.id);

    if (records.length === 0) {
      return interaction.editReply(
        `⚖️ <@${target.id}> has committed no documented offences yet. ` +
        `Run \`/tribunal @${target.username}\` to fix that immediately.`
      );
    }

    // Format each record
    const lines = records.map((r, i) => {
      const ts    = Math.floor(new Date(r.created_at).getTime() / 1000);
      const index = String(i + 1).padStart(2, '0');
      return `**${index}.** **${r.award_name}**\n*${r.award_desc}*\n<t:${ts}:D>`;
    });

    // Discord embed field value limit is 1024 chars — chunk safely
    const CHUNK_SIZE = 5;
    const chunks     = [];
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      chunks.push(lines.slice(i, i + CHUNK_SIZE).join('\n\n'));
    }

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle(`⚖️ HALL OF SHAME — ${target.username.toUpperCase()}`)
      .setDescription(
        `**${records.length} offence(s) on permanent record.** The tribunal does not forget.\n` +
        `*Registered game: ${player.game.toUpperCase()} — \`${player.game_username}\`*`
      )
      .setThumbnail(target.displayAvatarURL({ dynamic: true }));

    chunks.forEach((chunk, i) => {
      embed.addFields({
        name:  i === 0 ? '📜 PERMANENT RECORD' : `📜 CONTINUED (page ${i + 1})`,
        value: chunk,
      });
    });

    embed
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
