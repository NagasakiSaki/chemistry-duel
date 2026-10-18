/* Exercise every card effect at least once (synthetic board states). */
const { Duel, makeCard } = require('../js/engine.js');
const CARDS = require('../js/cards.js');

const DUMMY = [];
for (let i = 0; i < 40; i++) DUMMY.push('H2');

function fresh() {
  const g = new Duel({
    cards: CARDS,
    decks: { 0: DUMMY.slice(), 1: DUMMY.slice() },
    extras: { 0: [], 1: [] },
    names: { 0: 'A', 1: 'B' },
    seed: 42,
    first: 0
  });
  g.players[0].hand.length = 0;
  g.players[1].hand.length = 0;
  g.turn = 3;
  g.active = 0;
  g.phase = 'main';
  g.winner = null;
  g.normalSummonUsed = false;
  g.fusionUsed = false;
  return g;
}

function place(g, p, id, zone, position, faceUp) {
  const c = makeCard(CARDS[id], p);
  c.zone = zone;
  c.position = position || 'attack';
  c.faceUp = faceUp !== false;
  c.summonedTurn = g.turn;
  g.players[p].monsters[zone] = c;
  return c;
}

const errors = [];

function check(id, fn) {
  try { fn(); }
  catch (e) { errors.push({ id, error: e.stack || e.message }); }
}

const all = Object.values(CARDS);

// 常见测试场面
for (const c of all) {
  check(c.id, () => {
    const g = fresh();
    // 双方各放一只怪兽，保证取对象/战斗效果有目标
    const own = place(g, 0, 'HCl', 0, 'attack', true);
    const enemy = place(g, 1, 'NaCl', 0, 'defense', true);
    // 场上再放一只水/金属/盐，覆盖条件
    place(g, 0, 'H2O', 1, 'defense', true);
    place(g, 0, 'Fe', 2, 'attack', true);
    place(g, 1, 'Na2CO3', 1, 'defense', true);
    // 墓地/卡组补充常见检索目标
    g.players[0].gy.push(makeCard(CARDS.NaCl, 0));
    g.players[0].deck.push(makeCard(CARDS.NaCl, 0));
    g.players[0].deck.push(makeCard(CARDS.CaO, 0));
    g.players[0].deck.push(makeCard(CARDS.combust, 0));
    g.players[0].deck.push(makeCard(CARDS.O2, 0));

    if (c.kind === 'monster' || c.kind === 'fusion') {
      const card = makeCard(c, 0);
      g.players[0].monsters[3] = card;
      card.zone = 3;
      card.faceUp = true;
      card.controller = 0;
      if (card.onSummon) card.onSummon(g, card);
      if (card.onTurnStart) card.onTurnStart(g, card);
      if (card.onBattleDamage) card.onBattleDamage(g, card, enemy);
      if (card.onBattleDestroy) card.onBattleDestroy(g, card, enemy);
      if (card.onEndPhase) card.onEndPhase(g, card);
      if (card.staticAtk) card.staticAtk(g, card, card);
      if (card.staticDef) card.staticDef(g, card, card);
      if (card.beforeDamage) card.beforeDamage(g, card, enemy);
      if (card.battleAtk) card.battleAtk(g, card, enemy);
      if (card.aura) { g.effectiveAtk(own); g.effectiveDef(own); }
      if (card.onDestroyed) {
        // 重新放一张，避免已被召唤效果破坏
        const d = makeCard(c, 0);
        g.players[0].monsters[4] = d;
        d.zone = 4;
        d.faceUp = true;
        g.destroyMonster(d, { battle: false });
      }
    } else if (c.kind === 'spell') {
      const card = makeCard(c, 0);
      g.players[0].hand.push(card);
      card.zone = -1;
      const targets = g.validSpellTargets(0, card);
      const target = targets[0] || null;
      const can = g.canActivateSpell(0, card);
      if (can.ok) {
        g.activateSpell(0, g.players[0].hand.indexOf(card), target || undefined);
      } else if (card.activate) {
        // 直接调用效果，覆盖无法实际发动的卡
        card.activate(g, card, target || enemy);
      }
    } else if (c.kind === 'trap') {
      const card = makeCard(c, 0);
      card.controller = 0;
      card.zone = 4;
      card.faceUp = false;
      card.setTurn = 0;
      g.players[0].spells[4] = card;
      const ctx = { attacker: own, target: enemy, direct: false, amount: 900, spell: makeCard(CARDS.flame_test, 1), caster: 1, monster: enemy };
      if (card.trigger) {
        if (card.trigger.condition) card.trigger.condition(g, card, ctx);
        if (card.trigger.resolve) card.trigger.resolve(g, card, ctx);
      }
      if (card.onTurnStart) card.onTurnStart(g, card);
      if (card.aura) { g.effectiveAtk(own); g.effectiveDef(own); }
    }
  });
}

if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
} else {
  console.log(`effect smoke OK: ${all.length} cards`);
}
