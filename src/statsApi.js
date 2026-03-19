'use strict';

const TRACKER_BASE = 'https://public-api.tracker.gg/v2';

function trackerHeaders() {
  return {
    'TRN-Api-Key': process.env.TRACKER_API_KEY,
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip',
  };
}

// ─── Valorant ────────────────────────────────────────────────────────────────

async function getValorantStats(gameUsername) {
  // gameUsername format: "Name#TAG"
  const encoded = encodeURIComponent(gameUsername);
  const url = `${TRACKER_BASE}/valorant/standard/profile/riot/${encoded}`;

  const res = await fetch(url, { headers: trackerHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tracker.gg ${res.status} for "${gameUsername}": ${body.slice(0, 120)}`);
  }

  const json = await res.json();
  return parseValorantStats(json, gameUsername);
}

function parseValorantStats(data, username) {
  const segments = data?.data?.segments ?? [];
  const overview = segments.find(s => s.type === 'overview');

  if (!overview) {
    return zeroStats(username, 'Valorant');
  }

  const s = overview.stats ?? {};
  return {
    username,
    game: 'valorant',
    kda:            +(s.kda?.value              ?? 0).toFixed(2),
    kd:             +(s.kdRatio?.value          ?? 0).toFixed(2),
    deaths:         Math.round(s.deaths?.value  ?? 0),
    winRate:        +(s.matchesWinPct?.value     ?? 0).toFixed(1),
    headshot:       +(s.headshotsPercentage?.value ?? 0).toFixed(1),
    matches:        Math.round(s.matchesPlayed?.value ?? 0),
    rank:           s.rank?.metadata?.tierName  ?? 'Unranked',
    damagePerRound: +(s.damagePerRound?.value   ?? 0).toFixed(1),
    raw:            data,
  };
}

// ─── CS2 (Steam Web API) ─────────────────────────────────────────────────────

async function getCS2Stats(steamId) {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new Error('STEAM_API_KEY is not set');

  const url =
    `https://api.steampowered.com/ISteamUserStats/GetUserStatsForGame/v2/` +
    `?appid=730&key=${key}&steamid=${steamId}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Steam API ${res.status} for "${steamId}": ${body.slice(0, 120)}`);
  }

  const json = await res.json();
  return parseCS2Stats(json, steamId);
}

function parseCS2Stats(data, steamId) {
  const stats = data?.playerstats?.stats;
  if (!stats || stats.length === 0) return zeroStats(steamId, 'CS2');

  const get = name => stats.find(s => s.name === name)?.value ?? 0;

  const kills   = get('total_kills');
  const deaths  = get('total_deaths');
  const matches = get('total_matches_played');
  const wins    = get('total_matches_won');
  const hs      = get('total_kills_headshot');

  const kd      = deaths > 0 ? +(kills / deaths).toFixed(2) : kills;
  const winRate = matches > 0 ? +((wins / matches) * 100).toFixed(1) : 0;
  const hsPct   = kills  > 0 ? +((hs   / kills)   * 100).toFixed(1) : 0;

  return {
    username: steamId,
    game:     'cs2',
    kda:      kd,
    kd,
    deaths,
    winRate,
    headshot: hsPct,
    matches,
    rank:     'N/A',
    raw:      data,
  };
}

// ─── Unified entry point ─────────────────────────────────────────────────────

/**
 * Fetches stats for a registered player object from the DB.
 * Never throws — returns zero stats with an `error` field on failure.
 */
async function getPlayerStats(player) {
  try {
    if (player.game === 'valorant') return await getValorantStats(player.game_username);
    if (player.game === 'cs2')      return await getCS2Stats(player.game_username);
    throw new Error(`Unknown game: ${player.game}`);
  } catch (err) {
    console.error(`[statsApi] Failed to fetch stats for ${player.game_username}:`, err.message);
    return { ...zeroStats(player.game_username, player.game), error: err.message };
  }
}

function zeroStats(username, game) {
  return {
    username,
    game:        (game ?? '').toLowerCase(),
    kda:         0,
    kd:          0,
    deaths:      0,
    winRate:     0,
    headshot:    0,
    matches:     0,
    rank:        'Unranked',
    raw:         null,
  };
}

module.exports = { getValorantStats, getCS2Stats, getPlayerStats };
