'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(path.join(DATA_DIR, 'tribunal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ──────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    discord_id   TEXT PRIMARY KEY,
    username     TEXT NOT NULL,
    game_username TEXT NOT NULL,
    game         TEXT NOT NULL CHECK(game IN ('valorant', 'cs2'))
  );

  CREATE TABLE IF NOT EXISTS shame_records (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id   TEXT NOT NULL,
    award_name   TEXT NOT NULL,
    award_desc   TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS weekly_stats (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id            TEXT NOT NULL,
    week                  TEXT NOT NULL,
    kda                   REAL,
    deaths                INTEGER,
    team_damage           REAL,
    surrenders_initiated  INTEGER,
    matches               INTEGER,
    raw_data              TEXT,
    UNIQUE(discord_id, week)
  );

  CREATE TABLE IF NOT EXISTS roast_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id  TEXT NOT NULL,
    roast       TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ─── Week helper ─────────────────────────────────────────────────────────────

/**
 * Returns current ISO week in YYYY-WNN format, e.g. "2025-W21"
 */
function getCurrentWeek() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const startOfYear = new Date(Date.UTC(year, 0, 1));
  const dayOfYear = Math.floor((now - startOfYear) / 86400000) + 1;
  const weekNum = Math.ceil((dayOfYear + startOfYear.getUTCDay()) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

// ─── Players ─────────────────────────────────────────────────────────────────

function registerPlayer(discordId, username, gameUsername, game) {
  return db.prepare(`
    INSERT INTO players (discord_id, username, game_username, game)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      username      = excluded.username,
      game_username = excluded.game_username,
      game          = excluded.game
  `).run(discordId, username, gameUsername, game);
}

function getPlayer(discordId) {
  return db.prepare('SELECT * FROM players WHERE discord_id = ?').get(discordId) || null;
}

function getAllPlayers() {
  return db.prepare('SELECT * FROM players').all();
}

// ─── Shame records ───────────────────────────────────────────────────────────

function addShameRecord(discordId, awardName, awardDesc) {
  return db.prepare(`
    INSERT INTO shame_records (discord_id, award_name, award_desc)
    VALUES (?, ?, ?)
  `).run(discordId, awardName, awardDesc);
}

function getShameRecords(discordId) {
  return db.prepare(`
    SELECT * FROM shame_records
    WHERE discord_id = ?
    ORDER BY created_at ASC
  `).all(discordId);
}

function getAllShameRecordsSummary() {
  return db.prepare(`
    SELECT discord_id, COUNT(*) AS total_awards
    FROM shame_records
    GROUP BY discord_id
    ORDER BY total_awards DESC
  `).all();
}

// ─── Weekly stats ─────────────────────────────────────────────────────────────

function upsertWeeklyStats(discordId, week, stats) {
  return db.prepare(`
    INSERT INTO weekly_stats
      (discord_id, week, kda, deaths, team_damage, surrenders_initiated, matches, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(discord_id, week) DO UPDATE SET
      kda                  = excluded.kda,
      deaths               = excluded.deaths,
      team_damage          = excluded.team_damage,
      surrenders_initiated = excluded.surrenders_initiated,
      matches              = excluded.matches,
      raw_data             = excluded.raw_data
  `).run(
    discordId,
    week,
    stats.kda ?? 0,
    stats.deaths ?? 0,
    stats.team_damage ?? 0,
    stats.surrenders_initiated ?? 0,
    stats.matches ?? 0,
    JSON.stringify(stats.raw_data || {}),
  );
}

function getWeeklyStats(discordId, week) {
  return db.prepare(
    'SELECT * FROM weekly_stats WHERE discord_id = ? AND week = ?'
  ).get(discordId, week) || null;
}

/** All rows for a given week sorted by kda ascending (worst first) */
function getAllWeeklyStats(week) {
  return db.prepare(
    'SELECT * FROM weekly_stats WHERE week = ? ORDER BY kda ASC'
  ).all(week);
}

// ─── Roast log ───────────────────────────────────────────────────────────────

function logRoast(discordId, roast) {
  return db.prepare(
    'INSERT INTO roast_log (discord_id, roast) VALUES (?, ?)'
  ).run(discordId, roast);
}

function getRoastHistory(discordId) {
  return db.prepare(`
    SELECT * FROM roast_log
    WHERE discord_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(discordId);
}

module.exports = {
  getCurrentWeek,
  registerPlayer,
  getPlayer,
  getAllPlayers,
  addShameRecord,
  getShameRecords,
  getAllShameRecordsSummary,
  upsertWeeklyStats,
  getWeeklyStats,
  getAllWeeklyStats,
  logRoast,
  getRoastHistory,
};
