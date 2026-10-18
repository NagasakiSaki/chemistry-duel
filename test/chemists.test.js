/* Chemist / skill tests */
const assert = require('assert');
const { Duel, makeCard } = require('../js/engine.js');
const CARDS = require('../js/cards.js');
const { CHEMISTS } = require('../js/chemists.js');
const { DECKS } = require('../js/decks.js');
const CONTENT = require('../js/content.js');

const DUMMY = [];
for (let i = 0; i < 40; i++) DUMMY.push('H2');

function baseGame(chemistId, opponentChemistId) {
  const g = new Duel({
    cards: CARDS,
    decks: { 0: DUMMY.slice(), 1: DUMMY.slice() },
    extras: { 0: [], 1: [] },
    chemists: { 0: CHEMISTS[chemistId || 'mendeleev'], 1: CHEMISTS[opponentChemistId || 'mendeleev'] },
    names: { 0: 'A', 1: 'B' },
    seed: 7,
    first: 0
  });
  g.players[0].hand.length = 0;
  g.players[1].hand.length = 0;
  g.turn = 3;
  g.active = 0;
  g.phase = 'main';
  g.winner = null;
  return g;
}

function put(g, p, id, zone, position = 'attack', faceUp = true) {
  const c = makeCard(CARDS[id], p);
  c.zone = zone;
  c.position = position;
  c.faceUp = faceUp;
  c.summonedTurn = g.turn;
  g.players[p].monsters[zone] = c;
  return c;
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n' + (e.stack || e)); process.exitCode = 1; }
}

test('content registry validates', () => {
  const v = CONTENT.validate();
  assert(v.ok, JSON.stringify(v.errors));
  assert.strictEqual(Object.keys(CONTENT.cards).length, 135);
  assert.strictEqual(CONTENT.chemistOrder.length, 6);
});

test('Mendeleev passive: ATK per distinct tag', () => {
  const g = baseGame('mendeleev');
  const acid = put(g, 0, 'HCl', 0);
  put(g, 0, 'NaCl', 1);
  assert.strictEqual(g.effectiveAtk(acid), 1800); // 1600 + 2 tags × 100
});

test('Haber passive: gas ATK +300', () => {
  const g = baseGame('haber');
  const gas = put(g, 0, 'O2', 0);
  assert.strictEqual(g.effectiveAtk(gas), 1500);
});

test('Nobel passive: fusion ATK +300', () => {
  const g = baseGame('nobel');
  const f = put(g, 0, 'nacl_fusion', 0);
  assert.strictEqual(g.effectiveAtk(f), 2700);
});

test('Pauling passive: fusion DEF +300', () => {
  const g = baseGame('pauling');
  const f = put(g, 0, 'nacl_fusion', 0, 'defense');
  assert.strictEqual(g.effectiveDef(f), 2500);
});

test('Curie passive: effect damage -300', () => {
  const g = baseGame('curie');
  g.damagePlayer(0, 800, { reason: 'test' });
  assert.strictEqual(g.players[0].lp, 7500);
  const hp = g.players[0].hand;
  g.damagePlayer(0, 200, { battle: true });
  assert.strictEqual(g.players[0].lp, 7300); // battle damage not reduced
});

test('Lavoisier passive: end phase heal', () => {
  const g = baseGame('lavoisier');
  g.endTurn(0);
  assert.strictEqual(g.players[0].lp, 8300);
});

test('Mendeleev active: draw 2 discard 1, once per duel', () => {
  const g = baseGame('mendeleev');
  const r = g.activateSkill(0, 'periodic_deduction');
  assert(r.ok);
  assert.strictEqual(g.players[0].hand.length, 1);
  const once = g.activateSkill(0, 'periodic_deduction');
  assert.strictEqual(once.ok, false);
});

test('Curie active: burn and heal', () => {
  const g = baseGame('curie');
  const r = g.activateSkill(0, 'radium_glow');
  assert(r.ok);
  assert.strictEqual(g.players[1].lp, 7100);
  assert.strictEqual(g.players[0].lp, 8400);
});

test('Lavoisier active: recover GY card', () => {
  const g = baseGame('lavoisier');
  const c = makeCard(CARDS.NaCl, 0);
  c.zone = -2;
  g.players[0].gy.push(c);
  const r = g.activateSkill(0, 'conservation');
  assert(r.ok);
  assert(g.players[0].hand.includes(c));
  assert.strictEqual(g.players[0].lp, 8500);
});

test('Haber active: buff own monsters, resets at end', () => {
  const g = baseGame('haber');
  const gas = put(g, 0, 'O2', 0);
  assert.strictEqual(g.effectiveAtk(gas), 1500);
  const r = g.activateSkill(0, 'catalytic_synthesis');
  assert(r.ok);
  assert.strictEqual(g.effectiveAtk(gas), 2100);
  g.endTurn(0);
  assert.strictEqual(g.effectiveAtk(gas), 1500);
});

test('Nobel active: 1200 burn, 400 self', () => {
  const g = baseGame('nobel');
  const r = g.activateSkill(0, 'nitro_detonation');
  assert(r.ok);
  assert.strictEqual(g.players[1].lp, 6800);
  assert.strictEqual(g.players[0].lp, 7600);
});

test('Pauling active: revive GY monster', () => {
  const g = baseGame('pauling');
  const c = makeCard(CARDS.H2O, 0);
  c.zone = -2;
  g.players[0].gy.push(c);
  const r = g.activateSkill(0, 'resonance');
  assert(r.ok);
  assert(g.players[0].monsters[0] === c);
  assert.strictEqual(c.position, 'defense');
});

test('Pauling skill condition: no GY', () => {
  const g = baseGame('pauling');
  const r = g.activateSkill(0, 'resonance');
  assert.strictEqual(r.ok, false);
});

console.log(`\n${passed} chemist tests passed`);
