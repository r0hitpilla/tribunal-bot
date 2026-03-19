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

// ─── CS2 ─────────────────────────────────────────────────────────────────────

async function getCS2Stats(steamId) {
  const url = `${TRACKER_BASE}/csgo/standard/profile/steam/${encodeURIComponent(steamId)}`;

  const res = await fetch(url, { headers: trackerHeaders() });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`tracker.gg ${res.status} for "${steamId}": ${body.slice(0, 120)}`);
  }

  const json = await res.json();
  return parseCS2Stats(json, steamId);
}

function parseCS2Stats(data, steamId) {
  const segments = data?.data?.segments ?? [];
  const overview = segments.find(s => s.type === 'overview');

  if (!overview) {
    return zeroStats(steamId, 'CS2');
  }

  const s = overview.stats ?? {};
  return {
    username:    steamId,
    game:        'cs2',
    kda:         +(s.kda?.value             ?? 0).toFixed(2),
    kd:          +(s.kdRatio?.value         ?? 0).toFixed(2),
    deaths:      Math.round(s.deaths?.value ?? 0),
    winRate:     +(s.wlPercentage?.value    ?? 0).toFixed(1),
    headshot:    +(s.headshotPct?.value     ?? 0).toFixed(1),
    matches:     Math.round(s.matchesPlayed?.value ?? 0),
    rank:        s.rank?.metadata?.tierName ?? 'Unranked',
    raw:         data,
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
