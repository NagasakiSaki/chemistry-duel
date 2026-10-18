/* Headless AI-vs-AI simulation / smoke test */
const path = require('path');
const { Duel } = require('../js/engine.js');
const CARDS = require('../js/cards.js');
const { DECKS, ORDER } = require('../js/decks.js');
const AI = require('../js/ai.js');
const { CHEMISTS, ORDER: CHEM_ORDER } = require('../js/chemists.js');

async function runGame(seed, p0Deck, p1Deck, verbose) {
  const g = new Duel({
    cards: CARDS,
    decks: { 0: DECKS[p0Deck].main, 1: DECKS[p1Deck].main },
    extras: { 0: DECKS[p0Deck].extra, 1: DECKS[p1Deck].extra },
    names: { 0: p0Deck, 1: p1Deck },
    chemists: {
      0: CHEMISTS[CHEM_ORDER[seed % CHEM_ORDER.length]],
      1: CHEMISTS[CHEM_ORDER[(seed + 2) % CHEM_ORDER.length]]
    },
    seed,
    first: seed % 2
  });
  let turns = 0;
  while (g.winner === null && turns++ < 200) {
    const before = g.active;
    await AI.takeTurn(g, g.active, { delay: 0, render() {} });
    if (g.winner === null && g.active === before && g.phase !== 'over') {
      throw new Error('turn did not advance');
    }
  }
  if (g.winner === null) {
    throw new Error(`game ${seed} ${p0Deck} vs ${p1Deck} did not finish in 200 turns`);
  }
  if (verbose) {
    console.log(g.logs.slice(-30).map(l => l.text).join('\n'));
  }
  return { winner: g.winner, turns, g };
}

async function main() {
  const results = {};
  const issues = [];
  let totalTurns = 0, games = 0;
  const pairs = [];
  for (const a of ORDER) for (const b of ORDER) pairs.push([a, b]);

  for (let seed = 1; seed <= 120; seed++) {
    const [a, b] = pairs[seed % pairs.length];
    try {
      const r = await runGame(seed, a, b, false);
      games++;
      totalTurns += r.turns;
      const key = `${a} vs ${b}`;
      results[key] = results[key] || { 0: 0, 1: 0, draw: 0 };
      results[key][r.winner] = (results[key][r.winner] || 0) + 1;
    } catch (e) {
      issues.push({ seed, a, b, error: e.stack || e.message });
    }
  }
  console.log(`games=${games} issues=${issues.length} avgTurns=${(totalTurns / Math.max(1, games)).toFixed(1)}`);
  console.table(results);
  if (issues.length) {
    console.error(JSON.stringify(issues.slice(0, 5), null, 2));
    process.exitCode = 1;
  }
}

main();
