/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  chemists.js — 化学家（角色）与技能数据库
 *
 *  扩展方式：新增一个 C({...}) 即可。技能分为：
 *   - passive：自动生效的被动能力（引擎支持 allAtk / tagAtk / fusionAtk /
 *     atkPerDistinctTag / allDef / tagDef / fusionDef / effectDamageReduction /
 *     endHeal / startingLP / startingHand 等字段）
 *   - actives：主动技能数组，每项包含 once、timing、condition、activate、aiUse。
 * ========================================================================= */
(function (global) {
  'use strict';

  const CHEMISTS = {};

  function C(def) {
    if (!def.id) throw new Error('chemist without id');
    if (CHEMISTS[def.id]) throw new Error('duplicate chemist id: ' + def.id);
    def.actives = def.actives || [];
    def.passive = def.passive || null;
    CHEMISTS[def.id] = def;
    return def;
  }

  /* ---------------- 门捷列夫 ---------------- */
  C({
    id: 'mendeleev',
    name: '门捷列夫',
    title: '元素周期律的建立者',
    icon: '🧬',
    color: '#b6ff4a',
    quote: '元素的性质，会随着原子量周期性地变化。',
    passive: {
      name: '元素周期律',
      text: '自己场上的怪兽攻击力上升自己场上不同化学标签数量 × 100。',
      atkPerDistinctTag: 100
    },
    actives: [{
      id: 'periodic_deduction',
      name: '周期律推演',
      once: 'duel',
      timing: 'main',
      aiTiming: 'early',
      text: '抽 2 张卡，然后随机丢弃 1 张手牌。',
      aiUse(g, p) {
        return g.getPlayer(p).deck.length >= 2 && g.getPlayer(p).hand.length <= 5;
      },
      activate(g, p) {
        g.draw(p, 2);
        g.discardRandom(p);
        g.log('门捷列夫根据周期律推演出新的元素位置。', 'skill');
      }
    }]
  });

  /* ---------------- 居里夫人 ---------------- */
  C({
    id: 'curie',
    name: '居里夫人',
    title: '放射性研究的先驱',
    icon: '☢️',
    color: '#55e5ff',
    quote: '在实验室里，我们应当关注事物，而不是人。',
    passive: {
      name: '辐射屏蔽',
      text: '自己受到的效果伤害减少 300。',
      effectDamageReduction: 300
    },
    actives: [{
      id: 'radium_glow',
      name: '镭光灼烧',
      once: 'duel',
      timing: 'main',
      aiTiming: 'late',
      text: '给予对方 900 点效果伤害，自己回复 400 LP。',
      aiUse(g, p) {
        return g.getPlayer(g.opp(p)).lp > 0;
      },
      activate(g, p) {
        g.burn(g.opp(p), 900, '镭光灼烧');
        g.heal(p, 400, '放射性研究');
        g.log('镭的幽蓝光芒灼烧了对手的防线。', 'skill');
      }
    }]
  });

  /* ---------------- 拉瓦锡 ---------------- */
  C({
    id: 'lavoisier',
    name: '拉瓦锡',
    title: '现代化学之父',
    icon: '⚖️',
    color: '#ffd166',
    quote: '自然界没有东西会消失，一切都在转化。',
    passive: {
      name: '质量守恒',
      text: '自己的结束阶段回复 300 LP。',
      endHeal: 300
    },
    actives: [{
      id: 'conservation',
      name: '定量回收',
      once: 'duel',
      timing: 'main',
      aiTiming: 'early',
      text: '从自己墓地随机回收 1 张卡加入手牌，回复 500 LP；若墓地没有卡，抽 1 张卡。',
      aiUse(g, p) {
        return g.gyChoices(p).length > 0 || g.getPlayer(p).hand.length <= 4;
      },
      activate(g, p) {
        const gy = g.gyChoices(p);
        if (gy.length) {
          const card = g.pick(gy);
          g.addGYCardToHand(p, card);
          g.heal(p, 500, '质量守恒');
          g.log(`拉瓦锡从反应体系中回收了 ${card.name}。`, 'skill');
        } else {
          g.draw(p, 1);
        }
      }
    }]
  });

  /* ---------------- 哈伯 ---------------- */
  C({
    id: 'haber',
    name: '哈伯',
    title: '合成氨的工业先驱',
    icon: '🌾',
    color: '#ff8a4c',
    quote: '氨，从空气中来，到面包里去。',
    passive: {
      name: '合成氨',
      text: '自己场上的「气」怪兽攻击力上升 300。',
      tagAtk: { 气: 300 }
    },
    actives: [{
      id: 'catalytic_synthesis',
      name: '催化合成',
      once: 'duel',
      timing: 'main',
      aiTiming: 'late',
      text: '自己场上所有表侧怪兽攻击力直到回合结束上升 600。',
      condition(g, p) {
        return g.monsters(p, { faceUp: true }).length > 0;
      },
      conditionText: '自己场上需要有表侧怪兽',
      aiUse(g, p) {
        return g.monsters(p, { faceUp: true }).length > 0;
      },
      activate(g, p) {
        g.buffOwn(p, 600, 0);
        g.log('铁催化剂启动，氨的合成反应全面加速。', 'skill');
      }
    }]
  });

  /* ---------------- 诺贝尔 ---------------- */
  C({
    id: 'nobel',
    name: '诺贝尔',
    title: '硝化甘油与诺贝尔奖',
    icon: '💥',
    color: '#ff5f9f',
    quote: '炸药本身没有善恶，使用它的人才有。',
    passive: {
      name: '硝化甘油',
      text: '自己场上的融合怪兽攻击力上升 300。',
      fusionAtk: 300
    },
    actives: [{
      id: 'nitro_detonation',
      name: '硝化引爆',
      once: 'duel',
      timing: 'main',
      aiTiming: 'late',
      text: '给予对方 1200 点效果伤害，自己受到 400 点效果伤害。',
      aiUse(g, p) {
        return g.getPlayer(p).lp > 400 &&
          (g.getPlayer(g.opp(p)).lp <= 1600 || g.getPlayer(p).lp > 2500);
      },
      activate(g, p) {
        g.burn(g.opp(p), 1200, '硝化引爆');
        g.damagePlayer(p, 400, { reason: '硝化甘油反噬' });
        g.log('硝化甘油在对手的场地上炸开。', 'skill');
      }
    }]
  });

  /* ---------------- 鲍林 ---------------- */
  C({
    id: 'pauling',
    name: '鲍林',
    title: '化学键理论的奠基人',
    icon: '🔗',
    color: '#b28dff',
    quote: '化学键，是原子之间共享电子的舞蹈。',
    passive: {
      name: '化学键',
      text: '自己场上的融合怪兽守备力上升 300。',
      fusionDef: 300
    },
    actives: [{
      id: 'resonance',
      name: '共振结构',
      once: 'duel',
      timing: 'main',
      aiTiming: 'late',
      text: '从自己墓地选择 1 只怪兽守备表示特殊召唤。',
      condition(g, p) {
        return g.gyChoices(p, c => c.kind === 'monster' || c.kind === 'fusion').length > 0 &&
          g.freeMonsterZones(p).length > 0;
      },
      conditionText: '墓地有怪兽且怪兽区有空位',
      aiUse() { return true; },
      activate(g, p) {
        const list = g.gyChoices(p, c => c.kind === 'monster' || c.kind === 'fusion');
        list.sort((a, b) => g.effectiveDef(b) - g.effectiveDef(a));
        const card = list[0];
        if (!card) return { ok: false, reason: '墓地没有怪兽' };
        const r = g.specialSummonFromGY(p, card, { position: 'defense' });
        if (!r.ok) return r;
        g.log('鲍林用共振结构稳定了墓地的化学键。', 'skill');
        return { ok: true };
      }
    }]
  });

  const ORDER = ['mendeleev', 'curie', 'lavoisier', 'haber', 'nobel', 'pauling'];

  global.ChemChemists = CHEMISTS;
  global.ChemChemistOrder = ORDER;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CHEMISTS, ORDER };
  }
})(typeof window !== 'undefined' ? window : globalThis);
