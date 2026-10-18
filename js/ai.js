/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  ai.js — 对手 AI（也可用于 AI vs AI 压测）
 * ========================================================================= */
(function (global) {
  'use strict';

  const AI = {};

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function value(g, card) {
    if (!card) return 0;
    return g.effectiveAtk(card) + g.effectiveDef(card) * 0.55 + (card.level || 1) * 40;
  }

  function handIndexOf(g, p, card) {
    return g.getPlayer(p).hand.indexOf(card);
  }

  function weakestMonsters(g, p, n, exclude) {
    const list = g.monsters(p).filter(c => c !== exclude);
    list.sort((a, b) => value(g, a) - value(g, b));
    return list.slice(0, n);
  }

  function bestOwnMonster(g, p, filter) {
    let list = g.monsters(p, { faceUp: true });
    if (filter) list = list.filter(filter);
    if (!list.length) return null;
    list.sort((a, b) => value(g, b) - value(g, a));
    return list[0];
  }

  function bestEnemyMonster(g, p, filter) {
    let list = g.enemyMonsters(p);
    if (filter) list = list.filter(filter);
    if (!list.length) return null;
    list.sort((a, b) => value(g, b) - value(g, a));
    return list[0];
  }

  /* ---------------- 融合 ---------------- */
  function chooseFusion(g, p) {
    const list = g.availableFusions(p);
    if (!list.length) return null;
    // 优先高攻；若素材里包含高价值怪兽，稍微扣分
    let best = null, bestScore = -Infinity;
    for (const f of list) {
      let cost = 0;
      for (const m of f.materials) cost += value(g, m.card) * (m.from === 'field' ? 0.45 : 0.18);
      const score = f.fusion.atk + f.fusion.def * 0.5 + (f.fusion.level || 1) * 30 - cost;
      if (score > bestScore) { bestScore = score; best = f; }
    }
    if (!best) return null;
    // 如果融合怪兽并不比当前场面强，且素材来自场上，则跳过
    if (best.fusion.atk + best.fusion.def * 0.5 < 2200 && best.materials.every(m => m.from === 'field')) return null;
    return best;
  }

  /* ---------------- 魔法 ---------------- */
  function spellPlan(g, p, card) {
    const pl = g.getPlayer(p);
    const opp = g.opp(p);
    const id = card.id;
    const targets = g.validSpellTargets(p, card);

    function plan(target, score) { return { card, target, score }; }

    switch (id) {
      case 'flame_test':
        return plan(null, 70 + (g.getPlayer(opp).lp <= 800 ? 1000 : 0));
      case 'distill':
      case 'mole_calc':
        return pl.hand.length <= 5 ? plan(null, 55) : null;
      case 'neutralize': {
        const t = bestEnemyMonster(g, p, c => g.hasTag(c, '酸') || g.hasTag(c, '碱'));
        if (t && (g.effectiveAtk(t) >= 1800 || g.getPlayer(opp).lp < 3000)) return plan(t, 80);
        return null;
      }
      case 'crystallize': {
        if (!targets.length) return null;
        const t = targets.slice().sort((a, b) => b.def - a.def)[0];
        return plan(t, 62);
      }
      case 'filter_spell': {
        if (!targets.length) return null;
        const t = targets.slice().sort((a, b) => b.def - a.def)[0];
        return plan(t, 58);
      }
      case 'combust': {
        const t = bestOwnMonster(g, p);
        return t ? plan(t, 66 + t.atk * 0.01) : null;
      }
      case 'oxidize': {
        const t = bestEnemyMonster(g, p);
        return t ? plan(t, 60 + g.effectiveAtk(t) * 0.02) : null;
      }
      case 'reduce':
        return g.gyChoices(p, c => g.hasTag(c, '活泼金属')).length ? plan(null, 54) : null;
      case 'displacement': {
        const t = bestEnemyMonster(g, p);
        if (!t) return null;
        if (g.monsters(p, { faceUp: true }).some(c => g.hasTag(c, '活泼金属'))) return plan(t, 78);
        return null;
      }
      case 'double_decomp':
        return g.monsters(p, { faceUp: true }).some(c => g.hasTag(c, '盐')) ? plan(null, 64) : null;
      case 'passivate': {
        const t = bestOwnMonster(g, p);
        return t ? plan(t, 50) : null;
      }
      case 'aqua_regia_spell': {
        const t = bestEnemyMonster(g, p, c => g.hasAnyTag(c, ['固', '活泼金属']));
        return t ? plan(t, 92) : null;
      }
      case 'evaporate': {
        const t = bestEnemyMonster(g, p, c => g.hasTag(c, '水'));
        return t ? plan(t, 60) : null;
      }
      case 'acid_rain':
        if (g.monsters(p, { faceUp: true }).some(c => g.hasTag(c, '酸'))) return plan(null, 58);
        return null;
      case 'catalyst':
        return g.monsters(p, { faceUp: true }).length >= 2 ? plan(null, 57) : null;
      case 'buffer_spell':
        return g.monsters(p, { faceUp: true }).length >= 1 ? plan(null, 45) : null;
      case 'periodic_table':
        if (pl.field) return null;
        return g.monsters(p, { faceUp: true }).length >= 2 ? plan(null, 52) : null;
      case 'dilute_hcl':
      case 'conc_h2so4':
      case 'strong_base':
      case 'oxidizer': {
        const t = bestOwnMonster(g, p, c => c.equips.length < 2);
        return t ? plan(t, 64 + g.effectiveAtk(t) * 0.01) : null;
      }
      case 'coating': {
        const t = bestOwnMonster(g, p);
        return t ? plan(t, 48) : null;
      }
      default:
        return null;
    }
  }

  function chooseSpell(g, p) {
    const pl = g.getPlayer(p);
    let best = null;
    for (const card of pl.hand) {
      if (card.kind !== 'spell') continue;
      if (!g.canActivateSpell(p, card).ok) continue;
      const plan = spellPlan(g, p, card);
      if (plan && (!best || plan.score > best.score)) best = plan;
    }
    return best;
  }

  /* ---------------- 通常召唤 ---------------- */
  function chooseSummon(g, p) {
    if (g.normalSummonUsed) return null;
    const pl = g.getPlayer(p);
    const candidates = pl.hand.filter(c => c.kind === 'monster' && c.level <= 8);
    let best = null;
    for (const card of candidates) {
      const check = g.canNormalSummon(p, card);
      if (!check.ok) continue;
      const tributes = weakestMonsters(g, p, check.need);
      if (tributes.length < check.need) continue;

      let score = 0;
      if (check.need > 0) {
        const cost = tributes.reduce((s, c) => s + value(g, c), 0);
        score = value(g, card) - cost * 0.9;
        if (card.atk < 2200) score -= 100;
      } else {
        score = value(g, card);
      }
      // 高等级怪兽需要更有价值才值得
      if (!best || score > best.score) {
        best = { card, tributes, score, set: false };
      }
    }
    if (!best) return null;

    // 小怪：高守备低攻击时盖放
    if (best.card.level <= 4 && best.card.def >= 1800 && best.card.atk <= 1200) {
      best.set = true;
    }
    // 如果攻击力太低且不能盖放，仍然召唤（否则卡手）
    return best;
  }

  /* ---------------- 战斗 ---------------- */
  function chooseAttack(g, p, zone) {
    const attacker = g.getMonster(p, zone);
    if (!attacker) return null;
    const opp = g.opp(p);
    const enemies = g.enemyMonsters(p);
    if (!enemies.length) {
      const out = g.battleOutcome(attacker, null);
      const lethal = out.dmgDefender >= g.getPlayer(opp).lp;
      return { target: null, score: out.dmgDefender + (lethal ? 10000 : 0) };
    }

    let best = null;
    for (let z = 0; z < g.getPlayer(opp).monsters.length; z++) {
      const target = g.getPlayer(opp).monsters[z];
      if (!target) continue;
      const out = g.battleOutcome(attacker, target);
      let score = out.dmgDefender * 1.1 - out.dmgAttacker * 0.95;
      if (out.destroyDefender) score += value(g, target) * 0.55;
      if (out.destroyAttacker) score -= value(g, attacker) * 0.7;
      if (out.neutralization) {
        // 中和：双方都死，但我方回复 500
        score += 150;
      }
      if (g.getPlayer(opp).lp - out.dmgDefender <= 0) score += 10000;
      if (g.getPlayer(p).lp - out.dmgAttacker <= 0) score -= 10000;
      if (!best || score > best.score) best = { target, score, zone: z };
    }
    return best;
  }

  /* ---------------- 化学家技能 ---------------- */
  async function useSkills(g, p, timing, wait) {
    for (const skill of g.activeSkills(p)) {
      if ((skill.aiTiming || 'late') !== timing) continue;
      if (g.winner !== null) return;
      const chk = g.canActivateSkill(p, skill);
      if (!chk.ok) continue;
      let use = false;
      try { use = skill.aiUse ? !!skill.aiUse(g, p, skill) : false; } catch (_) { use = false; }
      if (!use) continue;
      const r = g.activateSkill(p, skill.id);
      if (r.ok) await wait(450);
    }
  }

  /* ---------------- 主流程 ---------------- */
  AI.takeTurn = async function (g, p, opts) {
    opts = opts || {};
    const delay = opts.delay != null ? opts.delay : 350;
    const speed = opts.speed != null ? opts.speed : 1;
    const render = opts.render || function () { };
    const wait = async (ms) => {
      render();
      if (delay > 0) await sleep((ms == null ? delay : ms) * speed);
    };

    if (g.winner !== null || p !== g.active) return;
    await wait(500);

    // 1. 融合（随回合数可多次）
    let fusionSteps = 0;
    while (g.winner === null && g.fusionUsed < g.fusionLimit() && fusionSteps < 3) {
      const fusion = chooseFusion(g, p);
      if (!fusion) break;
      const r = g.fusionSummon(p, fusion.index);
      if (!r.ok) break;
      fusionSteps++;
      await wait(650);
    }

    // 1.5 早期技能（抽卡 / 回收）
    await useSkills(g, p, 'early', wait);

    // 2. 魔法
    let guard = 0;
    while (g.winner === null && guard++ < 8) {
      const plan = chooseSpell(g, p);
      if (!plan) break;
      const idx = handIndexOf(g, p, plan.card);
      if (idx < 0) break;
      const r = g.activateSpell(p, idx, plan.target || undefined);
      if (!r.ok) break;
      await wait(500);
    }

    // 3. 通常召唤
    const summon = chooseSummon(g, p);
    if (summon && g.winner === null) {
      const idx = handIndexOf(g, p, summon.card);
      if (idx >= 0) {
        const tributeZones = summon.tributes.map(c => g.getPlayer(p).monsters.indexOf(c)).filter(z => z >= 0);
        g.normalSummon(p, idx, { tributes: tributeZones, set: summon.set });
        await wait(600);
      }
    }

    // 4. 盖陷阱
    if (g.winner === null) {
      const pl = g.getPlayer(p);
      let setCount = 0;
      for (const card of pl.hand.slice()) {
        if (setCount >= 2) break;
        if (card.kind !== 'trap') continue;
        const idx = handIndexOf(g, p, card);
        if (idx < 0) continue;
        const r = g.setTrap(p, idx);
        if (r.ok) { setCount++; await wait(400); }
      }
    }

    if (g.winner !== null) return;

    // 5. 表示形式调整
    for (let z = 0; z < 5; z++) {
      const c = g.getMonster(p, z);
      if (!c || !c.faceUp || c.positionChanged) continue;
      if (c.position === 'attack' && c.atk < c.def && c.atk < 1300) {
        g.changePosition(p, z);
        await wait(250);
      } else if (c.position === 'defense' && c.atk >= 1800 && c.atk > c.def * 1.3) {
        g.changePosition(p, z);
        await wait(250);
      }
    }

    if (g.winner !== null) return;

    // 5.5 战斗前技能（增益 / 灼烧 / 复活）
    await useSkills(g, p, 'late', wait);

    // 6. 战斗
    if (g.toBattlePhase(p)) {
      await wait(400);
      for (let z = 0; z < 5 && g.winner === null; z++) {
        const attacker = g.getMonster(p, z);
        if (!attacker || !attacker.faceUp || attacker.position !== 'attack' || attacker.hasAttacked) continue;
        const plan = chooseAttack(g, p, z);
        if (!plan) continue;
        if (plan.score <= 50) continue;
        const targetZone = plan.target ? g.getPlayer(g.opp(p)).monsters.indexOf(plan.target) : null;
        g.attack(p, z, targetZone);
        await wait(700);
      }
    }

    if (g.winner === null) {
      await wait(350);
      g.endTurn(p);
      render();
    }
  };

  AI.chooseFusion = chooseFusion;
  AI.chooseSpell = chooseSpell;
  AI.chooseSummon = chooseSummon;
  AI.chooseAttack = chooseAttack;

  global.ChemAI = AI;
  if (typeof module !== 'undefined' && module.exports) module.exports = AI;
})(typeof window !== 'undefined' ? window : globalThis);
