'use strict';

const Anthropic = require('@anthropic-ai/sdk');

// Lazy-init so we don't crash on import if the key isn't set yet
let _client = null;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

// Model: user specified claude-sonnet-4-20250514 (alias: claude-sonnet-4-0)
const MODEL = 'claude-sonnet-4-0';

// ─── System prompts ──────────────────────────────────────────────────────────

const TRIBUNAL_SYSTEM = `\
You are TRIBUNAL BOT — a savage, witty Discord bot that roasts gamers based on their actual stats. \
You have zero mercy and maximum chaos energy. You are not a generic insult machine — every roast \
is specific to the numbers in front of you.

Rules:
- Write 4–6 lines. Reference the ACTUAL stat numbers (KDA, deaths, win rate, headshot %, rank, matches).
- Be brutally specific. "Your KDA of 0.43 means you contribute to the enemy's highlight reel more \
  than your own team's victory screen" — not "you are bad."
- Use gaming slang naturally (griefing, feeding, int, throwing, inting, walking highlight reel, etc.)
- The award name must be creative and savage (e.g. "The Human Bullet Sponge", "Certified Anchor", \
  "Walking Respawn Timer", "The Enemy's Carry", "Five-Star Feed Delivery Service").
- Always end your roast with exactly this format on its own line:
  Sentence: [AWARD NAME] — permanent record updated.
- Never be kind. Never soften the blow. This is a tribunal.`;

const EXCUSE_SYSTEM = `\
You are TRIBUNAL BOT generating an unhinged, hyper-specific excuse for a gamer's catastrophic \
performance. One excuse, 3–4 lines. Reference the actual stat numbers in the excuse. \
Make it increasingly delusional as it goes on. \
End with a nonsensical "scientific" explanation that sounds almost plausible \
(e.g. "Studies show that a 12% headshot rate is actually optimal for conserving bullets, \
according to the Geneva Convention of 1847"). Maximum chaos energy. No apology.`;

const COPE_SYSTEM = `\
You are TRIBUNAL BOT delivering the most backhanded compliment sequence in gaming history. \
Exact structure — no exceptions:
1. One (1) genuine compliment. Make it specific to their stats. It must be real.
2. Then spend exactly 3 lines absolutely dismantling every aspect of that compliment and their \
   overall performance. Each line should be more devastating than the last.
3. Final line: something technically true but utterly damning based on their exact numbers.

The compliment-to-insult ratio is 1:4. This is tribunal law. \
Never let the compliment land without immediately weaponising it.`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatStatsForPrompt(stats, gameUsername, game) {
  if (!stats || stats.matches === 0) {
    return (
      `Player: ${gameUsername} | Game: ${game.toUpperCase()} | ` +
      `Status: NO RECORDED GAMES — they don't even show up in the database`
    );
  }
  return (
    `Player: ${gameUsername} | Game: ${game.toUpperCase()} | ` +
    `Rank: ${stats.rank} | KDA: ${stats.kda} | K/D: ${stats.kd} | ` +
    `Deaths: ${stats.deaths} | Win Rate: ${stats.winRate}% | ` +
    `Headshot %: ${stats.headshot}% | Matches: ${stats.matches}` +
    (stats.damagePerRound ? ` | Damage/Round: ${stats.damagePerRound}` : '')
  );
}

async function streamText(system, userContent, maxTokens = 512) {
  const stream = await client().messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userContent }],
  });
  const msg = await stream.finalMessage();
  const block = msg.content.find(b => b.type === 'text');
  return block?.text ?? '';
}

// ─── Public API ──────────────────────────────────────────────────────────────

async function generateRoast(player, stats) {
  const statsLine = formatStatsForPrompt(stats, player.game_username, player.game);

  const prompt =
    stats.matches === 0 || stats.error
      ? `Roast this player who has ZERO recorded games:\n` +
        `Discord username: ${player.username} | Game: ${player.game.toUpperCase()} | ` +
        `Username: ${player.game_username}\n` +
        `They don't show up in the database. That's somehow worse than having bad stats. ` +
        `Roast them for their absence from existence.`
      : `Roast this player based on their stats:\n${statsLine}`;

  const text = await streamText(TRIBUNAL_SYSTEM, prompt, 600);
  return text || "The tribunal has no words. Your stats broke the shame generator. That's impressive in the worst possible way.";
}

async function generateExcuse(player, stats) {
  const statsLine = formatStatsForPrompt(stats, player.game_username, player.game);
  const prompt = `Generate an excuse for this player's performance:\n${statsLine}`;

  const text = await streamText(EXCUSE_SYSTEM, prompt, 450);
  return text || 'My excuse generator is broken — much like your aim.';
}

async function generateCope(targetPlayer, stats) {
  const statsLine = formatStatsForPrompt(stats, targetPlayer.game_username, targetPlayer.game);
  const prompt = `Generate a cope report for this player:\n${statsLine}`;

  const text = await streamText(COPE_SYSTEM, prompt, 450);
  return text || "Even my compliment generator refused to help you. That's statistically significant.";
}

/**
 * Extracts the award name from a roast ending in:
 *   "Sentence: The Award Name — permanent record updated."
 */
function extractAwardFromRoast(roastText) {
  // Primary pattern: "Sentence: X — permanent record updated"
  const primary = roastText.match(/Sentence:\s*(.+?)\s*(?:—|–|-)\s*permanent record updated\.?/i);
  if (primary) return primary[1].trim();

  // Fallback: anything after "Sentence:"
  const fallback = roastText.match(/Sentence:\s*([^\n]+)/i);
  if (fallback) return fallback[1].replace(/\s*[-–—].*$/, '').trim();

  return 'Distinguished Failure';
}

module.exports = { generateRoast, generateExcuse, generateCope, extractAwardFromRoast };
