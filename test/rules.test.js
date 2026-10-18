/* Targeted rule tests for the Chemistry Duel engine */
const assert = require('assert');
const { Duel, makeCard } = require('../js/engine.js');
const CARDS = require('../js/cards.js');

function baseGame(opts = {}) {
  const g = new Duel({
    cards: CARDS,
    decks: { 0: ['H2', 'H2', 'H2', 'H2', 'H2'], 1: ['H2', 'H2', 'H2', 'H2', 'H2'] },
    extras: { 0: [], 1: [] },
    names: { 0: 'A', 1: 'B' },
    seed: 1,
    first: 0
  });
  // 清空起始手牌，改为测试用
  g.players[0].hand.length = 0;
  g.players[1].hand.length = 0;
  g.players[0].deck.length = 0;
  g.players[1].deck.length = 0;
  g.turn = opts.turn || 2;
  g.active = opts.active != null ? opts.active : 0;
  g.phase = opts.phase || 'main';
  g.winner = null;
  g.normalSummonUsed = false;
  g.fusionUsed = false;
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

function hand(g, p, id) {
  const c = makeCard(CARDS[id], p);
  c.zone = -1;
  g.players[p].hand.push(c);
  return c;
}

function trap(g, p, id, zone = 0) {
  const c = makeCard(CARDS[id], p);
  c.controller = p;
  c.zone = zone;
  c.faceUp = false;
  c.position = 'defense';
  c.setTurn = g.turn - 1;
  g.players[p].spells[zone] = c;
  return c;
}

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('FAIL  ' + name + '\n' + (e.stack || e)); process.exitCode = 1; }
}

/* 1. 腐蚀：酸攻击活泼金属 +800 */
test('corrosion bonus', () => {
  const g = baseGame({ phase: 'battle' });
  const acid = put(g, 0, 'HCl', 0);
  const metal = put(g, 1, 'Na', 0);
  assert.strictEqual(g.effectiveAtk(acid), 1600);
  const out = g.battleOutcome(acid, metal);
  assert.strictEqual(out.atk, 2400);
  const r = g.attack(0, 0, 0);
  assert(r.ok);
  assert(g.players[1].gy.includes(metal));
  assert.strictEqual(g.players[1].lp, 8000 - 900);
});

/* 2. 中和：酸碱战斗后双方破坏，各回复 500 */
test('neutralization', () => {
  const g = baseGame({ phase: 'battle' });
  const acid = put(g, 0, 'HCl', 0);
  const base = put(g, 1, 'NaOH', 1);
  const r = g.attack(0, 0, 1);
  assert(r.ok);
  assert(g.players[0].gy.includes(acid));
  assert(g.players[1].gy.includes(base));
  assert.strictEqual(g.players[0].lp, 8400); // 攻击力低于 NaOH，受 100 反伤 + 中和 500
  assert.strictEqual(g.players[1].lp, 8500); // 中和 500
});

/* 2.5 抽卡 / 融合次数随回合增加 */
test('draw schedule', () => {
  const g = baseGame();
  g.players[0].hand.length = 0;
  for (let i = 0; i < 5; i++) g.players[0].deck.push(makeCard(CARDS.H2, 0));
  const before = g.players[0].deck.length;
  g.beginTurn();
  assert.strictEqual(g.players[0].hand.length, 1); // turn 3 => 抽 1
  assert.strictEqual(g.players[0].deck.length, before - 1);
  g.turn = 4; assert.strictEqual(g.drawPerTurn(), 1);
  g.turn = 5; assert.strictEqual(g.drawPerTurn(), 2);
  g.turn = 9; assert.strictEqual(g.drawPerTurn(), 3);
  g.turn = 13; assert.strictEqual(g.drawPerTurn(), 3);
  g.turn = 6; assert.strictEqual(g.fusionLimit(), 1);
  g.turn = 7; assert.strictEqual(g.fusionLimit(), 2);
  g.turn = 13; assert.strictEqual(g.fusionLimit(), 3);
});

/* 2.6 多次融合 */
test('multiple fusion summons at turn 7', () => {
  const g = baseGame();
  g.turn = 7;
  g.phase = 'main';
  g.players[0].extra.push(makeCard(CARDS.aqua_regia_fusion, 0));
  g.players[0].extra.push(makeCard(CARDS.aqua_regia_fusion, 0));
  for (let i = 0; i < 4; i++) hand(g, 0, 'HCl');
  assert.strictEqual(g.fusionLimit(), 2);
  assert(g.fusionSummon(0, 0).ok);
  assert(g.fusionSummon(0, 0).ok);
  assert.strictEqual(g.fusionUsed, 2);
  assert.strictEqual(g.players[0].monsters.filter(Boolean).length, 2);
  assert.strictEqual(g.fusionSummon(0, 0).ok, false);
});

/* 3. 融合：手牌酸 + 碱 */
test('fusion summon', () => {
  const g = baseGame();
  g.players[0].extra.push(makeCard(CARDS.nacl_fusion, 0));
  hand(g, 0, 'HCl');
  hand(g, 0, 'NaOH');
  const avail = g.availableFusions(0);
  assert.strictEqual(avail.length, 1);
  const r = g.fusionSummon(0, 0);
  assert(r.ok, r.reason);
  assert.strictEqual(g.players[0].monsters[0].id, 'nacl_fusion');
  assert(g.players[0].gy.some(c => c.id === 'HCl'));
  assert(g.players[0].gy.some(c => c.id === 'NaOH'));
});

/* 4. 祭品：Lv5 需要 1 只祭品 */
test('tribute summon', () => {
  const g = baseGame();
  const t = put(g, 0, 'H2', 0);
  const c = hand(g, 0, 'H2SO4');
  const r = g.normalSummon(0, g.players[0].hand.indexOf(c), { tributes: [0] });
  assert(r.ok, r.reason);
  assert(g.players[0].gy.includes(t));
  assert.strictEqual(g.players[0].monsters[0].id, 'H2SO4');
});

/* 5. 陷阱：沉淀反应无效攻击并回复 */
test('precipitate trap', () => {
  const g = baseGame({ phase: 'battle' });
  const attacker = put(g, 0, 'H2SO4', 0);
  put(g, 1, 'NaCl', 0);
  trap(g, 1, 'precipitate_trap', 0);
  const r = g.attack(0, 0, 0);
  assert(r.negated);
  assert.strictEqual(g.players[1].lp, 8800);
  assert.strictEqual(g.players[0].monsters[0], attacker);
});

/* 6. 装备赋予酸标签，触发腐蚀 */
test('equip grants acid tag', () => {
  const g = baseGame();
  const monster = put(g, 0, 'Fe', 0);
  const eq = hand(g, 0, 'dilute_hcl');
  assert.strictEqual(g.hasTag(monster, '酸'), false);
  const r = g.activateSpell(0, g.players[0].hand.indexOf(eq), monster);
  assert(r.ok, r.reason);
  assert(g.hasTag(monster, '酸'));
  assert.strictEqual(g.effectiveAtk(monster), 2000);
});

/* 7. 战斗免疫 */
test('battle immunity', () => {
  const g = baseGame({ phase: 'battle' });
  put(g, 0, 'aqua_regia_fusion', 0);
  const wall = put(g, 1, 'BaSO4', 0, 'defense');
  g.attack(0, 0, 0);
  assert(g.players[1].monsters[0] === wall);
  assert.strictEqual(g.players[1].lp, 8000);
});

/* 8. 场地魔法静态加成 */
test('field spell static bonus', () => {
  const g = baseGame();
  put(g, 0, 'HCl', 0);
  put(g, 0, 'NaCl', 1);
  g.players[0].field = makeCard(CARDS.periodic_table, 0);
  g.players[0].field.zone = 'field';
  g.players[0].field.faceUp = true;
  // 酸 + 盐 = 2 种标签 -> +400
  assert.strictEqual(g.effectiveAtk(g.players[0].monsters[0]), 2000);
});

/* 9. 卡组检索 */
test('deck search', () => {
  const g = baseGame();
  g.players[0].deck.push(makeCard(CARDS.NaCl, 0));
  const spell = hand(g, 0, 'crystallize');
  const target = g.players[0].deck[0];
  const r = g.activateSpell(0, g.players[0].hand.indexOf(spell), target);
  assert(r.ok, r.reason);
  assert(g.players[0].hand.some(c => c.id === 'NaCl'));
  assert.strictEqual(g.players[0].deck.length, 0);
});

/* 10. 直接攻击 */
test('direct attack', () => {
  const g = baseGame({ phase: 'battle' });
  put(g, 0, 'H2SO4', 0);
  g.attack(0, 0, null);
  assert.strictEqual(g.players[1].lp, 5300); // 2200 战斗伤害 + 硫酸 500 追加
});

/* 11. 陷阱无效魔法 */
test('counter spell trap', () => {
  const g = baseGame();
  trap(g, 1, 'fume_hood', 0);
  const spell = hand(g, 0, 'flame_test');
  const r = g.activateSpell(0, g.players[0].hand.indexOf(spell));
  assert.strictEqual(r.ok, false);
  assert.strictEqual(g.players[1].lp, 8000);
  assert(g.players[0].gy.some(c => c.id === 'flame_test'));
});

/* 12. 贯通 */
test('piercing damage', () => {
  const g = baseGame({ phase: 'battle' });
  put(g, 0, 'HNO3', 0);
  put(g, 1, 'Na2CO3', 0, 'defense');
  g.attack(0, 0, 0);
  assert.strictEqual(g.players[1].lp, 7500);
});

console.log(`\n${passed} tests passed`);
