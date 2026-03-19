'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { registerPlayer, getPlayer } = require('../db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('register')
    .setDescription('Link a Discord user to their game account for tribunal tracking')
    .addUserOption(opt =>
      opt.setName('player')
        .setDescription('The Discord user to register')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('game_username')
        .setDescription('Valorant: Name#TAG  |  CS2: Steam ID (64-bit)')
        .setRequired(true))
    .addStringOption(opt =>
      opt.setName('game')
        .setDescription('Which game?')
        .setRequired(true)
        .addChoices(
          { name: 'Valorant', value: 'valorant' },
          { name: 'CS2',      value: 'cs2' },
        )),

  async execute(interaction) {
    const target       = interaction.options.getUser('player');
    const gameUsername = interaction.options.getString('game_username').trim();
    const game         = interaction.options.getString('game');

    // Validate Valorant format
    if (game === 'valorant' && !gameUsername.includes('#')) {
      return interaction.reply({
        content: '⚖️ Valorant usernames must be in `Name#TAG` format (e.g. `PlayerOne#1234`).',
        ephemeral: true,
      });
    }

    const isUpdate = !!getPlayer(target.id);
    registerPlayer(target.id, target.username, gameUsername, game);

    const embed = new EmbedBuilder()
      .setColor(0x8B0000)
      .setTitle('⚖️ TRIBUNAL REGISTRATION')
      .setDescription(
        isUpdate
          ? `<@${target.id}>'s record has been **updated**. The tribunal adjusts its files.`
          : `<@${target.id}> has been **registered**. The tribunal now has your location. There is no escape.`
      )
      .addFields(
        { name: 'Discord',   value: `\`${target.username}\``,    inline: true },
        { name: 'Game',      value: `\`${game.toUpperCase()}\``, inline: true },
        { name: 'Username',  value: `\`${gameUsername}\``,       inline: true },
      )
      .setFooter({ text: '⚖️ TRIBUNAL BOT — no one escapes the record' });

    await interaction.reply({ embeds: [embed] });
  },
};
