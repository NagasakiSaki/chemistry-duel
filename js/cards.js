/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  cards.js — 卡牌数据库（单质、化合物、魔法、陷阱、融合怪兽）
 *
 *  设计口径：
 *   ATK = 反应活性 / 腐蚀性 / 氧化性
 *   DEF = 化学稳定性 / 难溶性 / 惰性
 *   TAG = 酸 / 碱 / 盐 / 活泼金属 / 水 / 气 / 固
 * ========================================================================= */
(function (global) {
  'use strict';

  const CARDS = {};

  function C(def) {
    if (!def.id) throw new Error('card without id');
    if (CARDS[def.id]) throw new Error('duplicate card id: ' + def.id);
    def.tags = def.tags || [];
    CARDS[def.id] = def;
    return def;
  }

  function M(id, name, formula, tags, level, atk, def, text, hooks) {
    return C(Object.assign({
      id, name, formula, kind: 'monster', tags, level, atk, def, text
    }, hooks || {}));
  }

  function F(id, name, formula, tags, level, atk, def, materials, text, hooks) {
    return C(Object.assign({
      id, name, formula, kind: 'fusion', tags, level, atk, def, materials, text
    }, hooks || {}));
  }

  function S(id, name, spellType, target, text, activate, extra) {
    return C(Object.assign({
      id, name, formula: '', kind: 'spell', spellType, target, text, activate
    }, extra || {}));
  }

  function T(id, name, trapType, text, trigger, extra) {
    return C(Object.assign({
      id, name, formula: '', kind: 'trap', trapType, text, trigger
    }, extra || {}));
  }

  function weakenOne(g, p, atk, def, why) {
    const list = g.enemyMonsters(p);
    if (!list.length) return null;
    const t = g.pick(list);
    t.tempAtk += atk || 0;
    t.tempDef += def || 0;
    g.log(`${t.name} 的攻击力${atk ? `${atk > 0 ? '+' : ''}${atk}` : ''}、守备力${def ? `${def > 0 ? '+' : ''}${def}` : ''}${why ? `（${why}）` : ''}。`, 'effect');
    return t;
  }

  function hasWaterOnField(g) {
    return [...g.monsters(0, { faceUp: true }), ...g.monsters(1, { faceUp: true })]
      .some(c => g.hasTag(c, '水'));
  }

  function ownMetals(g, p) {
    return g.monsters(p, { faceUp: true }).filter(c => g.hasTag(c, '活泼金属'));
  }

  /* =======================================================================
   *  单质
   * ===================================================================== */
  M('H2', '氢气', 'H₂', ['气'], 2, 800, 500,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('O2', '氧气', 'O₂', ['气'], 3, 1200, 1000,
    '①：只要此卡在场上表侧表示存在，自己场上的「活泼金属」怪兽攻击力上升 300（助燃）。',
    { aura: { atk: 300, tags: ['活泼金属'] } });

  M('O3', '臭氧', 'O₃', ['气'], 5, 2000, 1200,
    '①：此卡召唤成功时，对方场上所有怪兽攻击力下降 400。',
    { onSummon(g, self) { g.weakenEnemy(self.controller, -400, 0); } });

  M('F2', '氟气', 'F₂', ['气'], 7, 2800, 1800,
    '①：此卡与「活泼金属」怪兽战斗时，攻击力上升 1000。②：此卡给予对方战斗伤害时，对方再受到 500 点伤害。',
    {
      battleAtk(g, self, target) {
        return target && g.hasTag(target, '活泼金属') ? 1000 : 0;
      },
      onBattleDamage(g, self) { g.burn(g.opp(self.controller), 500, '氟的强氧化性'); }
    });

  M('Cl2', '氯气', 'Cl₂', ['气'], 5, 2100, 1400,
    '①：此卡召唤成功时，对方场上所有怪兽攻击力下降 500。',
    { onSummon(g, self) { g.weakenEnemy(self.controller, -500, 0); } });

  M('Br2', '溴', 'Br₂', ['气'], 4, 1700, 1200,
    '①：此卡战斗破坏对方怪兽时，给予对方 300 点伤害。',
    { onBattleDestroy(g, self) { g.burn(g.opp(self.controller), 300, '溴的腐蚀'); } });

  M('I2', '碘', 'I₂', ['固'], 3, 1300, 1000,
    '①：此卡召唤成功时，回复 500 LP。',
    { onSummon(g, self) { g.heal(self.controller, 500, '碘的升华'); } });

  M('N2', '氮气', 'N₂', ['气'], 4, 1000, 2000,
    '①：此卡不会被效果破坏（惰性气体保护）。',
    { immuneEffect: true });

  M('He', '氦', 'He', ['气'], 2, 300, 2000,
    '①：此卡不会被效果破坏（惰性）。',
    { immuneEffect: true });

  M('Ne', '氖', 'Ne', ['气'], 2, 200, 1800,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('Ar', '氩', 'Ar', ['气'], 3, 500, 2200,
    '①：只要此卡在场上表侧表示存在，自己场上的「固」怪兽守备力上升 300。',
    { aura: { def: 300, tags: ['固'] } });

  M('Na', '钠', 'Na', ['活泼金属'], 3, 1500, 800,
    '①：此卡召唤成功时，若场上有表侧「水」怪兽，给予对方 600 点伤害，此卡攻击力上升 500。',
    {
      onSummon(g, self) {
        if (hasWaterOnField(g)) {
          g.burn(g.opp(self.controller), 600, '钠与水剧烈反应');
          self.tempAtk += 500;
          g.log('钠与水反应，攻击力上升 500。', 'reaction');
        }
      }
    });

  M('K', '钾', 'K', ['活泼金属'], 4, 1700, 900,
    '①：此卡攻击力上升自己场上其他「活泼金属」怪兽数量 × 200。',
    {
      staticAtk(g, self, target) {
        if (target !== self) return 0;
        return g.monsters(self.controller).filter(c => c !== self && g.hasTag(c, '活泼金属')).length * 200;
      }
    });

  M('Ca', '钙', 'Ca', ['活泼金属'], 4, 1600, 1200,
    '①：此卡召唤成功时，回复 800 LP。',
    { onSummon(g, self) { g.heal(self.controller, 800, '钙的活泼性'); } });

  M('Mg', '镁', 'Mg', ['活泼金属'], 3, 1400, 1000,
    '①：此卡与「气」怪兽战斗时，攻击力上升 600（燃烧）。',
    { battleAtk(g, self, target) { return target && g.hasTag(target, '气') ? 600 : 0; } });

  M('Al', '铝', 'Al', ['活泼金属'], 4, 1400, 1800,
    '①：此卡第一次被破坏时，破坏无效（致密氧化膜）。',
    { shieldOnce: true });

  M('Zn', '锌', 'Zn', ['活泼金属'], 3, 1200, 1300,
    '①：此卡与「酸」怪兽战斗时，攻击力上升 500（置换反应）。',
    { battleAtk(g, self, target) { return target && g.hasTag(target, '酸') ? 500 : 0; } });

  M('Fe', '铁', 'Fe', ['活泼金属'], 4, 1500, 1600,
    '①：此卡攻击力上升自己墓地中「活泼金属」怪兽数量 × 100。',
    {
      staticAtk(g, self, target) {
        if (target !== self) return 0;
        return g.getPlayer(self.controller).gy.filter(c => g.hasTag(c, '活泼金属')).length * 100;
      }
    });

  M('Cu', '铜', 'Cu', ['固'], 3, 1000, 1800,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('Ag', '银', 'Ag', ['固'], 3, 900, 1900,
    '①：此卡召唤成功时，回复 500 LP。',
    { onSummon(g, self) { g.heal(self.controller, 500, '银的稳定'); } });

  M('Au', '金', 'Au', ['固'], 4, 800, 2100,
    '①：此卡不受「酸」怪兽的效果影响，也不会被「酸」怪兽战斗破坏（惰性金属）。',
    { acidProof: true });

  M('Hg', '汞', 'Hg', ['固'], 4, 1100, 1700,
    '①：此卡召唤成功时，对方场上所有「活泼金属」怪兽攻击力下降 500（汞齐化）。',
    {
      onSummon(g, self) {
        for (const c of g.enemyMonsters(self.controller)) {
          if (g.hasTag(c, '活泼金属')) c.tempAtk -= 500;
        }
        g.log('汞齐化：对方活泼金属怪兽攻击力下降。', 'effect');
      }
    });

  M('Pb', '铅', 'Pb', ['固'], 4, 1000, 2000,
    '①：此卡不受「酸」怪兽的效果影响，也不会被「酸」怪兽战斗破坏（铅耐硫酸）。',
    { acidProof: true });

  M('C', '碳', 'C', ['固'], 3, 1200, 1400,
    '①：此卡被破坏时，从卡组把 1 张「燃烧」加入手牌；若没有，回复 500 LP。',
    {
      onDestroyed(g, self) {
        const c = g.deckChoices(self.controller, x => x.id === 'combust')[0];
        if (c) g.addDeckCardToHand(self.controller, c);
        else g.heal(self.controller, 500, '碳的余烬');
      }
    });

  M('Si', '硅', 'Si', ['固'], 4, 900, 2000,
    '①：此卡不会被效果破坏（半导体晶格稳定）。',
    { immuneEffect: true });

  M('S', '硫', 'S', ['固'], 3, 1100, 1200,
    '①：此卡给予对方战斗伤害时，对方再受到 300 点伤害。',
    { onBattleDamage(g, self) { g.burn(g.opp(self.controller), 300, '硫的燃烧'); } });

  M('P', '磷', 'P', ['固'], 3, 1300, 900,
    '①：结束阶段，给予对方 500 点伤害（白磷自燃）。',
    { onEndPhase(g, self) { g.burn(g.opp(self.controller), 500, '白磷自燃'); } });

  M('Sn', '锡', 'Sn', ['活泼金属'], 4, 1300, 1700,
    '①：此卡召唤成功时，抽 1 张卡。',
    { onSummon(g, self) { g.draw(self.controller, 1); } });

  /* =======================================================================
   *  化合物
   * ===================================================================== */
  M('H2O', '水', 'H₂O', ['水'], 3, 1000, 1500,
    '①：只要此卡在场上表侧表示存在，自己场上的「酸」「碱」怪兽攻击力上升 300（溶剂化）。',
    { aura: { atk: 300, tags: ['酸', '碱'] } });

  M('H2O2', '过氧化氢', 'H₂O₂', ['水'], 4, 1300, 1200,
    '①：此卡召唤成功时，给予对方 500 点伤害。②：结束阶段此卡破坏（分解）。',
    {
      onSummon(g, self) { g.burn(g.opp(self.controller), 500, '过氧化氢分解'); },
      onEndPhase(g, self) { g.destroyMonster(self, { battle: false }); }
    });

  M('HCl', '盐酸', 'HCl', ['酸'], 4, 1600, 1200,
    '①：此卡召唤成功时，对方随机 1 只怪兽守备力下降 700。',
    { onSummon(g, self) { weakenOne(g, self.controller, 0, -700, '盐酸腐蚀'); } });

  M('H2SO4', '硫酸', 'H₂SO₄', ['酸'], 5, 2200, 1500,
    '①：此卡给予对方战斗伤害时，对方再受到 500 点伤害（脱水腐蚀）。',
    { onBattleDamage(g, self) { g.burn(g.opp(self.controller), 500, '浓硫酸脱水'); } });

  M('HNO3', '硝酸', 'HNO₃', ['酸'], 5, 2100, 1300,
    '①：此卡攻击守备表示怪兽时，给予贯通伤害（强氧化性）。',
    { pierce: true });

  M('H2CO3', '碳酸', 'H₂CO₃', ['酸'], 3, 1200, 1000,
    '①：此卡被破坏时，抽 1 张卡（分解）。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('HF', '氢氟酸', 'HF', ['酸'], 5, 1900, 1700,
    '①：此卡与「固」怪兽战斗时，攻击力上升 1200（腐蚀玻璃）。',
    { battleAtk(g, self, target) { return target && g.hasTag(target, '固') ? 1200 : 0; } });

  M('HBr', '氢溴酸', 'HBr', ['酸'], 4, 1700, 1100,
    '①：此卡召唤成功时，回复 300 LP。',
    { onSummon(g, self) { g.heal(self.controller, 300, '氢溴酸'); } });

  M('HI', '氢碘酸', 'HI', ['酸'], 4, 1800, 1000,
    '①：此卡给予对方战斗伤害时，对方再受到 300 点伤害。',
    { onBattleDamage(g, self) { g.burn(g.opp(self.controller), 300, '氢碘酸的还原性'); } });

  M('CH3COOH', '醋酸', 'CH₃COOH', ['酸'], 3, 1300, 1100,
    '①：此卡召唤成功时，回复 500 LP。',
    { onSummon(g, self) { g.heal(self.controller, 500, '醋酸'); } });

  M('H3PO4', '磷酸', 'H₃PO₄', ['酸'], 4, 1500, 1600,
    '①：只要此卡在场上表侧表示存在，自己场上的「酸」怪兽守备力上升 300。',
    { aura: { def: 300, tags: ['酸'] } });

  M('H2S', '硫化氢', 'H₂S', ['气'], 3, 1400, 900,
    '①：此卡召唤成功时，对方场上所有怪兽攻击力下降 300（剧毒）。',
    { onSummon(g, self) { g.weakenEnemy(self.controller, -300, 0); } });

  M('SO2', '二氧化硫', 'SO₂', ['气'], 4, 1600, 1100,
    '①：此卡召唤成功时，给予对方 500 点伤害（酸雨）。',
    { onSummon(g, self) { g.burn(g.opp(self.controller), 500, '二氧化硫'); } });

  M('SO3', '三氧化硫', 'SO₃', ['气'], 5, 2000, 1300,
    '①：此卡召唤成功时，若场上有表侧「水」怪兽，给予对方 800 点伤害。',
    {
      onSummon(g, self) {
        if (hasWaterOnField(g)) g.burn(g.opp(self.controller), 800, '三氧化硫溶于水');
      }
    });

  M('CO2', '二氧化碳', 'CO₂', ['气'], 3, 900, 1600,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('CO', '一氧化碳', 'CO', ['气'], 4, 1500, 1000,
    '①：此卡给予对方战斗伤害时，对方再受到 400 点伤害（中毒）。',
    { onBattleDamage(g, self) { g.burn(g.opp(self.controller), 400, '一氧化碳中毒'); } });

  M('NO2', '二氧化氮', 'NO₂', ['气'], 4, 1700, 1000,
    '①：此卡召唤成功时，对方随机 1 只怪兽攻击力下降 700。',
    { onSummon(g, self) { weakenOne(g, self.controller, -700, 0, '二氧化氮腐蚀'); } });

  M('NH3', '氨', 'NH₃', ['碱'], 3, 1200, 1300,
    '①：此卡召唤成功时，回复 500 LP。',
    { onSummon(g, self) { g.heal(self.controller, 500, '氨'); } });

  M('NaOH', '氢氧化钠', 'NaOH', ['碱'], 4, 1700, 1400,
    '①：此卡召唤成功时，对方场上所有怪兽守备力下降 400（强碱腐蚀）。',
    { onSummon(g, self) { g.weakenEnemy(self.controller, 0, -400); } });

  M('KOH', '氢氧化钾', 'KOH', ['碱'], 4, 1800, 1500,
    '①：此卡召唤成功时，回复 500 LP。',
    { onSummon(g, self) { g.heal(self.controller, 500, '氢氧化钾'); } });

  M('Ca(OH)2', '氢氧化钙', 'Ca(OH)₂', ['碱'], 4, 1500, 1900,
    '①：自己的准备阶段，回复 300 LP。',
    { onTurnStart(g, self) { g.heal(self.controller, 300, '氢氧化钙'); } });

  M('Ba(OH)2', '氢氧化钡', 'Ba(OH)₂', ['碱'], 5, 1900, 2200,
    '①：此卡召唤成功时，对方场上所有怪兽攻击力下降 400。',
    { onSummon(g, self) { g.weakenEnemy(self.controller, -400, 0); } });

  M('Mg(OH)2', '氢氧化镁', 'Mg(OH)₂', ['碱'], 3, 1000, 1800,
    '①：此卡守备表示时，守备力上升 300（难溶的碱）。',
    { staticDef(g, self, target) { return target === self && self.position === 'defense' ? 300 : 0; } });

  M('Al(OH)3', '氢氧化铝', 'Al(OH)₃', ['碱', '酸'], 4, 800, 2100,
    '①：此卡同时视为「碱」与「酸」（两性氢氧化物）。',
    {});

  M('Fe(OH)3', '氢氧化铁', 'Fe(OH)₃', ['碱'], 4, 1100, 2000,
    '①：此卡被破坏时，对方场上所有怪兽攻击力下降 500（红褐色沉淀）。',
    { onDestroyed(g, self) { g.weakenEnemy(self.controller, -500, 0); } });

  M('Cu(OH)2', '氢氧化铜', 'Cu(OH)₂', ['碱'], 3, 900, 1700,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('NaCl', '氯化钠', 'NaCl', ['盐'], 3, 1000, 1500,
    '①：此卡召唤成功时，回复 500 LP（生理盐水）。',
    { onSummon(g, self) { g.heal(self.controller, 500, '氯化钠'); } });

  M('KCl', '氯化钾', 'KCl', ['盐'], 3, 900, 1400,
    '①：此卡召唤成功时，回复 300 LP。',
    { onSummon(g, self) { g.heal(self.controller, 300, '氯化钾'); } });

  M('CaCO3', '碳酸钙', 'CaCO₃', ['盐'], 4, 800, 2200,
    '①：此卡被破坏时，从卡组把 1 张「氧化钙」加入手牌；若没有，回复 500 LP。',
    {
      onDestroyed(g, self) {
        const c = g.deckChoices(self.controller, x => x.id === 'CaO')[0];
        if (c) g.addDeckCardToHand(self.controller, c);
        else g.heal(self.controller, 500, '碳酸钙分解');
      }
    });

  M('Na2CO3', '碳酸钠', 'Na₂CO₃', ['盐'], 3, 1000, 1600,
    '①：此卡召唤成功时，给予对方 300 点伤害。',
    { onSummon(g, self) { g.burn(g.opp(self.controller), 300, '碳酸钠'); } });

  M('NaHCO3', '碳酸氢钠', 'NaHCO₃', ['盐'], 3, 800, 1700,
    '①：此卡召唤成功时，回复 800 LP（中和胃酸）。',
    { onSummon(g, self) { g.heal(self.controller, 800, '碳酸氢钠'); } });

  M('BaSO4', '硫酸钡', 'BaSO₄', ['盐'], 6, 1000, 3000,
    '①：此卡不会被战斗破坏。②：此卡不受「酸」怪兽的效果影响（难溶沉淀）。',
    { immuneBattle: true, acidProof: true });

  M('AgCl', '氯化银', 'AgCl', ['盐'], 4, 900, 2400,
    '①：此卡不受「酸」怪兽的效果影响（难溶沉淀）。',
    { acidProof: true });

  M('CaSO4', '硫酸钙', 'CaSO₄', ['盐'], 4, 700, 2100,
    '①：此卡第一次被破坏时，破坏无效（石膏固化）。',
    { shieldOnce: true });

  M('CuSO4', '硫酸铜', 'CuSO₄', ['盐'], 4, 1400, 1300,
    '①：此卡召唤成功时，对方随机 1 只怪兽攻击力下降 500。②：若场上有表侧「水」，抽 1 张卡（无水硫酸铜遇水变蓝）。',
    {
      onSummon(g, self) {
        weakenOne(g, self.controller, -500, 0, '重金属毒性');
        if (hasWaterOnField(g)) g.draw(self.controller, 1);
      }
    });

  M('FeCl3', '氯化铁', 'FeCl₃', ['盐'], 4, 1600, 1200,
    '①：此卡召唤成功时，对方随机 1 只怪兽守备力下降 800。',
    { onSummon(g, self) { weakenOne(g, self.controller, 0, -800, '氯化铁腐蚀'); } });

  M('KMnO4', '高锰酸钾', 'KMnO₄', ['盐'], 5, 1900, 1600,
    '①：此卡召唤成功时，破坏对方 1 只攻击力 1500 以下的怪兽；若没有，给予对方 500 点伤害。',
    {
      onSummon(g, self) {
        const t = g.destroyRandomEnemy(self.controller, c => g.effectiveAtk(c) <= 1500);
        if (!t) g.burn(g.opp(self.controller), 500, '高锰酸钾强氧化');
      }
    });

  M('K2Cr2O7', '重铬酸钾', 'K₂Cr₂O₇', ['盐'], 5, 2000, 1500,
    '①：此卡召唤成功时，给予对方 800 点伤害（强氧化性/剧毒）。',
    { onSummon(g, self) { g.burn(g.opp(self.controller), 800, '重铬酸钾'); } });

  M('Na2S', '硫化钠', 'Na₂S', ['盐'], 3, 1100, 1300,
    '①：此卡召唤成功时，对方随机 1 只怪兽守备力下降 500。',
    { onSummon(g, self) { weakenOne(g, self.controller, 0, -500, '硫化钠'); } });

  M('Na2SiO3', '硅酸钠', 'Na₂SiO₃', ['盐'], 4, 900, 2000,
    '①：只要此卡在场上表侧表示存在，自己场上的「固」怪兽守备力上升 300（水玻璃）。',
    { aura: { def: 300, tags: ['固'] } });

  M('CaO', '氧化钙', 'CaO', ['固'], 4, 1300, 1800,
    '①：此卡召唤成功时，若场上有表侧「水」怪兽，给予对方 800 点伤害（放热）。',
    {
      onSummon(g, self) {
        if (hasWaterOnField(g)) g.burn(g.opp(self.controller), 800, '氧化钙与水反应');
      }
    });

  M('CaCl2', '氯化钙', 'CaCl₂', ['盐'], 3, 800, 1600,
    '①：此卡召唤成功时，对方场上所有「水」怪兽攻击力下降 500（干燥剂）。',
    {
      onSummon(g, self) {
        for (const c of g.enemyMonsters(self.controller)) {
          if (g.hasTag(c, '水')) c.tempAtk -= 500;
        }
        g.log('氯化钙吸水：对方水属性怪兽攻击力下降。', 'effect');
      }
    });

  M('SiO2', '二氧化硅', 'SiO₂', ['固'], 4, 900, 2300,
    '①：此卡守备表示时，守备力上升 200（石英晶格）。',
    { staticDef(g, self, target) { return target === self && self.position === 'defense' ? 200 : 0; } });

  M('Fe2O3', '氧化铁', 'Fe₂O₃', ['固'], 4, 1200, 1900,
    '①：此卡被破坏时，给予对方 500 点伤害（锈蚀）。',
    { onDestroyed(g, self) { g.burn(g.opp(self.controller), 500, '铁锈'); } });

  M('CuO', '氧化铜', 'CuO', ['固'], 3, 1000, 1500,
    '①：此卡召唤成功时，回复 300 LP。',
    { onSummon(g, self) { g.heal(self.controller, 300, '氧化铜'); } });

  M('MnO2', '二氧化锰', 'MnO₂', ['固'], 4, 1200, 1700,
    '①：只要此卡在场上表侧表示存在，自己场上所有怪兽攻击力上升 200（催化剂）。',
    { aura: { atk: 200 } });

  M('P2O5', '五氧化二磷', 'P₂O₅', ['固'], 5, 1500, 2200,
    '①：此卡召唤成功时，若对方场上有「水」怪兽，破坏其中 1 只；否则给予对方 500 点伤害（强吸水）。',
    {
      onSummon(g, self) {
        const t = g.destroyRandomEnemy(self.controller, c => g.hasTag(c, '水'));
        if (!t) g.burn(g.opp(self.controller), 500, '五氧化二磷吸水');
      }
    });

  M('Na2O2', '过氧化钠', 'Na₂O₂', ['固'], 5, 1800, 1700,
    '①：此卡召唤成功时，若场上有表侧「水」怪兽，从卡组特殊召唤 1 只「氧气」；否则给予对方 500 点伤害。',
    {
      onSummon(g, self) {
        if (hasWaterOnField(g)) {
          const r = g.specialSummonFromDeck(self.controller, 'O2', { position: 'defense' });
          if (!r.ok) g.burn(g.opp(self.controller), 500, '过氧化钠');
        } else {
          g.burn(g.opp(self.controller), 500, '过氧化钠');
        }
      }
    });

  M('CH4', '甲烷', 'CH₄', ['气'], 3, 1100, 900,
    '①：此卡召唤成功时，给予对方 400 点伤害（可燃气体）。',
    { onSummon(g, self) { g.burn(g.opp(self.controller), 400, '甲烷燃烧'); } });

  M('C2H5OH', '乙醇', 'C₂H₅OH', ['水'], 3, 1000, 1200,
    '①：此卡召唤成功时，回复 300 LP。',
    { onSummon(g, self) { g.heal(self.controller, 300, '乙醇'); } });

  M('C6H12O6', '葡萄糖', 'C₆H₁₂O₆', ['固'], 3, 600, 1800,
    '①：自己的准备阶段，回复 800 LP（细胞呼吸）。',
    { onTurnStart(g, self) { g.heal(self.controller, 800, '葡萄糖供能'); } });

  M('C12H22O11', '蔗糖', 'C₁₂H₂₂O₁₁', ['固'], 2, 500, 1500,
    '①：此卡被破坏时，抽 1 张卡。',
    { onDestroyed(g, self) { g.draw(self.controller, 1); } });

  M('starch', '淀粉', '(C₆H₁₀O₅)ₙ', ['固'], 4, 500, 2200,
    '①：此卡召唤成功时，回复 500 LP（能量储备）。',
    { onSummon(g, self) { g.heal(self.controller, 500, '淀粉'); } });

  M('protein', '蛋白质', '蛋白质', ['固'], 4, 1000, 2000,
    '①：此卡被破坏时，回复 800 LP（氨基酸回收）。',
    { onDestroyed(g, self) { g.heal(self.controller, 800, '蛋白质分解'); } });

  /* =======================================================================
   *  魔法卡
   * ===================================================================== */
  S('dilute_hcl', '稀盐酸', 'equip', 'ownMonster',
    '装备怪兽攻击力上升 500，并视为「酸」怪兽。',
    function (g, self, target) {
      g.log(`${target.name} 被稀盐酸活化，获得「酸」标签。`, 'spell');
    },
    { equipAtk: 500, equipTags: ['酸'] });

  S('conc_h2so4', '浓硫酸', 'equip', 'ownMonster',
    '装备怪兽攻击力上升 800，守备力下降 300。',
    function (g, self, target) {
      g.log(`${target.name} 被浓硫酸强化。`, 'spell');
    },
    { equipAtk: 800, equipDef: -300 });

  S('neutralize', '中和反应', 'normal', 'anyMonster',
    '以场上 1 只「酸」或「碱」怪兽为对象发动。那只怪兽破坏，回复 1000 LP。若场上同时有「酸」与「碱」，抽 1 张卡。',
    function (g, self, target) {
      if (!target) return;
      const p = self.controller;
      if (g.hasTag(target, '酸') || g.hasTag(target, '碱')) {
        g.destroyMonster(target, { battle: false, byTag: '中和' });
        g.heal(p, 1000, '中和反应');
        const all = [...g.monsters(0, { faceUp: true }), ...g.monsters(1, { faceUp: true })];
        if (all.some(c => g.hasTag(c, '酸')) && all.some(c => g.hasTag(c, '碱'))) {
          g.draw(p, 1);
        }
      } else {
        g.burn(g.opp(p), 300, '无效的中和');
      }
    },
    { targetTags: ['酸', '碱'] });

  S('flame_test', '焰色反应', 'normal', null,
    '给予对方 800 点伤害（钠的黄色焰色）。',
    function (g, self) { g.burn(g.opp(self.controller), 800, '焰色反应'); });

  S('oxidizer', '强氧化剂', 'equip', 'ownMonster',
    '装备怪兽攻击力上升 700，攻击守备表示怪兽时给予贯通伤害。',
    function (g, self, target) { g.log(`${target.name} 被强氧化剂点燃。`, 'spell'); },
    { equipAtk: 700, pierce: true });

  S('acid_rain', '酸雨', 'continuous', null,
    '自己场上的「酸」怪兽攻击力上升 400。',
    function (g, self) { g.log('酸雨降下，酸类怪兽被强化。', 'spell'); },
    { aura: { atk: 400, tags: ['酸'] } });

  S('catalyst', '催化剂', 'continuous', null,
    '自己场上所有怪兽攻击力上升 300。',
    function (g, self) { g.log('催化剂加速了反应。', 'spell'); },
    { aura: { atk: 300 } });

  S('distill', '蒸馏', 'normal', null,
    '抽 2 张卡，然后随机丢弃 1 张手牌。',
    function (g, self) {
      const p = self.controller;
      g.draw(p, 2);
      const hand = g.getPlayer(p).hand;
      if (hand.length) {
        const c = g.pick(hand);
        const i = hand.indexOf(c);
        if (i >= 0) hand.splice(i, 1);
        g.sendToGY(c, { discard: true });
        g.log(`蒸馏后丢弃了 ${c.name}。`, 'spell');
      }
    });

  S('crystallize', '结晶', 'normal', 'deckSalt',
    '从卡组把 1 只「盐」怪兽加入手牌。',
    function (g, self, target) {
      if (target && g.addDeckCardToHand(self.controller, target)) return;
      const c = g.deckChoices(self.controller, x => g.hasTag(x, '盐'))[0];
      if (c) g.addDeckCardToHand(self.controller, c);
      else g.heal(self.controller, 500, '结晶失败');
    });

  S('filter_spell', '过滤', 'normal', 'gySalt',
    '从墓地选择 1 只「盐」怪兽加入手牌，回复 300 LP。',
    function (g, self, target) {
      if (target) g.addGYCardToHand(self.controller, target);
      g.heal(self.controller, 300, '过滤');
    });

  S('combust', '燃烧', 'normal', 'ownMonster',
    '自己场上 1 只怪兽攻击力直到回合结束上升 1000，结束阶段破坏。',
    function (g, self, target) {
      target.tempAtk += 1000;
      target.burnUp = true;
      g.log(`${target.name} 剧烈燃烧，攻击力上升 1000。`, 'spell');
    });

  S('oxidize', '氧化', 'normal', 'enemyMonster',
    '对方 1 只怪兽攻击力、守备力直到回合结束下降 700。',
    function (g, self, target) {
      target.tempAtk -= 700;
      target.tempDef -= 700;
      g.log(`${target.name} 被氧化，数值下降。`, 'spell');
    });

  S('reduce', '还原', 'normal', null,
    '从自己墓地选择 1 只「活泼金属」怪兽守备表示特殊召唤；若没有，回复 500 LP。',
    function (g, self) {
      const p = self.controller;
      const c = g.gyChoices(p, x => g.hasTag(x, '活泼金属'))[0];
      if (c) g.specialSummonFromGY(p, c, { position: 'defense' });
      else g.heal(p, 500, '还原');
    });

  S('displacement', '置换反应', 'normal', 'enemyMonster',
    '若自己场上有「活泼金属」怪兽，破坏对方 1 只怪兽，给予对方 500 点伤害；否则给予对方 300 点伤害。',
    function (g, self, target) {
      const p = self.controller;
      if (g.monsters(p, { faceUp: true }).some(c => g.hasTag(c, '活泼金属'))) {
        g.destroyMonster(target, { battle: false, byTag: '置换' });
        g.burn(g.opp(p), 500, '置换反应');
      } else {
        g.burn(g.opp(p), 300, '置换失败');
      }
    });

  S('double_decomp', '复分解反应', 'normal', null,
    '自己场上所有「盐」怪兽攻击力上升 1000、守备力上升 500，直到回合结束；抽 1 张卡。',
    function (g, self) {
      const p = self.controller;
      for (const c of g.monsters(p, { faceUp: true })) {
        if (g.hasTag(c, '盐')) { c.tempAtk += 1000; c.tempDef += 500; }
      }
      g.log('复分解反应发生，盐类怪兽得到强化。', 'reaction');
      g.draw(p, 1);
    });

  S('passivate', '钝化', 'normal', 'ownMonster',
    '自己场上 1 只怪兽本回合不会被战斗破坏，守备力上升 500。',
    function (g, self, target) {
      target.battleShield = true;
      target.tempDef += 500;
      g.log(`${target.name} 表面形成钝化膜。`, 'spell');
    });

  S('aqua_regia_spell', '王水', 'normal', 'enemyMonsterTag',
    '以对方 1 只「固」或「活泼金属」怪兽为对象发动。那只怪兽破坏，给予对方 500 点伤害。',
    function (g, self, target) {
      g.destroyMonster(target, { battle: false, byTag: '王水' });
      g.burn(g.opp(self.controller), 500, '王水溶解');
    },
    { targetTags: ['固', '活泼金属'] });

  S('periodic_table', '元素周期表', 'field', null,
    '自己场上每有 1 种不同的化学标签，自己所有怪兽攻击力上升 200（最多 1000）。',
    function (g, self) { g.log('元素周期表展开，元素规律显现。', 'spell'); },
    {
      staticAtk(g, self, target) {
        const tags = new Set();
        for (const c of g.monsters(self.controller, { faceUp: true })) {
          for (const t of g.getTags(c)) tags.add(t);
        }
        return Math.min(1000, tags.size * 200);
      }
    });

  S('evaporate', '蒸发', 'normal', 'enemyMonster',
    '以对方 1 只怪兽为对象发动。若它是「水」怪兽，破坏并回复 1000 LP；否则给予对方 500 点伤害。',
    function (g, self, target) {
      if (g.hasTag(target, '水')) {
        g.destroyMonster(target, { battle: false, byTag: '蒸发' });
        g.heal(self.controller, 1000, '蒸发');
      } else {
        g.burn(g.opp(self.controller), 500, '蒸发');
      }
    });

  S('mole_calc', '摩尔计算', 'normal', null,
    '抽 2 张卡。',
    function (g, self) { g.draw(self.controller, 2); });

  S('strong_base', '强碱腐蚀', 'equip', 'ownMonster',
    '装备怪兽攻击力上升 700，守备力上升 300。',
    function (g, self, target) { g.log(`${target.name} 被强碱腐蚀性强化。`, 'spell'); },
    { equipAtk: 700, equipDef: 300 });

  S('buffer_spell', '缓冲溶液', 'continuous', null,
    '自己场上所有怪兽守备力上升 300；自己的准备阶段回复 200 LP。',
    function (g, self) { g.log('缓冲体系建立。', 'spell'); },
    {
      aura: { def: 300 },
      onTurnStart(g, self) { g.heal(self.controller, 200, '缓冲溶液'); }
    });

  S('coating', '防腐涂层', 'equip', 'ownMonster',
    '装备怪兽守备力上升 700，不受「酸」怪兽的效果影响。',
    function (g, self, target) { g.log(`${target.name} 被防腐涂层保护。`, 'spell'); },
    { equipDef: 700, acidProof: true });

  /* =======================================================================
   *  陷阱卡
   * ===================================================================== */
  T('precipitate_trap', '沉淀反应', 'normal',
    '对方怪兽攻击宣言时，若自己场上有表侧「盐」怪兽，攻击无效，回复 800 LP。',
    {
      event: 'attack',
      condition(g, self, ctx) {
        return g.monsters(self.controller, { faceUp: true }).some(c => g.hasTag(c, '盐'));
      },
      resolve(g, self, ctx) {
        ctx.negated = true;
        g.heal(self.controller, 800, '沉淀反应');
        g.log('难溶沉淀阻挡了攻击。', 'trap');
      }
    });

  T('redox_trap', '氧化还原', 'normal',
    '对方怪兽攻击宣言时，攻击怪兽攻击力直到伤害计算时下降 1000。',
    {
      event: 'attack',
      resolve(g, self, ctx) {
        if (ctx.attacker) {
          ctx.attacker.tempAtk -= 1000;
          g.log(`${ctx.attacker.name} 被氧化还原反应削弱。`, 'trap');
        }
      }
    });

  T('fume_hood', '通风橱', 'normal',
    '对方发动魔法卡时，那个发动无效。',
    {
      event: 'spell',
      resolve(g, self, ctx) {
        ctx.negated = true;
        g.log('通风橱抽走了反应气体，魔法被无效。', 'trap');
      }
    });

  T('explosion_limit', '爆炸极限', 'normal',
    '对方直接攻击宣言时，攻击无效，给予对方 1000 点伤害。',
    {
      event: 'attack',
      condition(g, self, ctx) { return !!ctx.direct; },
      resolve(g, self, ctx) {
        ctx.negated = true;
        g.burn(g.opp(self.controller), 1000, '爆炸极限');
      }
    });

  T('eyewash', '紧急洗眼器', 'normal',
    '自己受到 500 点以上战斗伤害时，回复 1200 LP。',
    {
      event: 'damage',
      condition(g, self, ctx) { return (ctx.amount || 0) >= 500; },
      resolve(g, self, ctx) {
        g.heal(self.controller, 1200, '紧急洗眼器');
      }
    });

  T('buffer_trap', '缓冲溶液·永续', 'continuous',
    '自己的准备阶段回复 300 LP。',
    null,
    { onTurnStart(g, self) { g.heal(self.controller, 300, '缓冲溶液'); } });

  T('anti_corrosion', '防腐蚀涂层', 'continuous',
    '自己场上的「活泼金属」怪兽守备力上升 500。',
    null,
    { aura: { def: 500, tags: ['活泼金属'] } });

  T('double_decomp_trap', '复分解', 'normal',
    '对方召唤攻击力 2000 以上的怪兽时，那只怪兽破坏，回复 500 LP。',
    {
      event: 'summon',
      condition(g, self, ctx) {
        return ctx.monster && g.effectiveAtk(ctx.monster) >= 2000;
      },
      resolve(g, self, ctx) {
        if (ctx.monster) g.destroyMonster(ctx.monster, { battle: false, byTag: '复分解' });
        g.heal(self.controller, 500, '复分解');
      }
    });

  T('passivation_trap', '钝化膜', 'normal',
    '对方攻击自己怪兽时，那只怪兽本回合不会被战斗破坏，守备力上升 800。',
    {
      event: 'attack',
      condition(g, self, ctx) {
        return ctx.target && ctx.target.controller === self.controller;
      },
      resolve(g, self, ctx) {
        ctx.target.battleShield = true;
        ctx.target.tempDef += 800;
        g.log(`${ctx.target.name} 形成钝化膜。`, 'trap');
      }
    });

  T('neutralization_pool', '中和池', 'normal',
    '对方怪兽攻击宣言时，若自己场上有表侧「碱」怪兽，攻击无效，回复 800 LP。',
    {
      event: 'attack',
      condition(g, self) {
        return g.monsters(self.controller, { faceUp: true }).some(c => g.hasTag(c, '碱'));
      },
      resolve(g, self, ctx) {
        ctx.negated = true;
        g.heal(self.controller, 800, '中和池');
      }
    });

  /* =======================================================================
   *  融合怪兽 / 额外卡组
   * ===================================================================== */
  F('aqua_regia_fusion', '王水·强腐蚀之王', '王水', ['酸'], 8, 3500, 2500,
    [{ tag: '酸', count: 2 }],
    '「酸」×2。①：此卡攻击「固」或「活泼金属」怪兽时，伤害计算前将那只怪兽破坏，并给予对方 500 点伤害。',
    {
      beforeDamage(g, self, target) {
        if (!target) return false;
        if (g.hasTag(target, '固') || g.hasTag(target, '活泼金属')) {
          g.log('王水瞬间溶解了目标！', 'reaction');
          g.destroyMonster(target, { battle: false, byTag: '王水' });
          g.burn(g.opp(self.controller), 500, '王水溶解');
          return true;
        }
        return false;
      }
    });

  F('nacl_fusion', '中和产物·氯化钠', 'NaCl', ['盐'], 6, 2400, 2200,
    [{ tag: '酸', count: 1 }, { tag: '碱', count: 1 }],
    '「酸」+「碱」。①：此卡融合召唤成功时，回复 1000 LP，抽 1 张卡。',
    {
      onSummon(g, self) {
        g.heal(self.controller, 1000, '中和反应放热');
        g.draw(self.controller, 1);
      }
    });

  F('baso4_fusion', '重晶石·硫酸钡', 'BaSO₄', ['盐'], 7, 1800, 3200,
    [{ tag: '盐', count: 2 }],
    '「盐」×2。①：此卡不会被战斗破坏。②：此卡不受「酸」怪兽的效果影响。',
    { immuneBattle: true, acidProof: true });

  F('csoh_fusion', '强碱之王·氢氧化铯', 'CsOH', ['碱'], 7, 2600, 2400,
    [{ tag: '碱', count: 2 }],
    '「碱」×2。①：此卡融合召唤成功时，回复 1500 LP。②：自己场上的「碱」怪兽守备力上升 500。',
    {
      aura: { def: 500, tags: ['碱'] },
      onSummon(g, self) { g.heal(self.controller, 1500, '氢氧化铯'); }
    });

  F('water_fusion', '氢氧爆鸣·水', 'H₂O', ['水'], 6, 2800, 1800,
    [{ tag: '气', count: 2 }],
    '「气」×2。①：此卡融合召唤成功时，破坏对方 1 只怪兽，给予对方 500 点伤害。',
    {
      onSummon(g, self) {
        g.destroyRandomEnemy(self.controller);
        g.burn(g.opp(self.controller), 500, '氢氧爆鸣');
      }
    });

  F('co2_fusion', '充分燃烧·二氧化碳', 'CO₂', ['气'], 6, 2200, 2000,
    [{ tag: '气', count: 1 }, { tag: '固', count: 1 }],
    '「气」+「固」。①：此卡融合召唤成功时，给予对方 800 点伤害，抽 1 张卡。',
    {
      onSummon(g, self) {
        g.burn(g.opp(self.controller), 800, '充分燃烧');
        g.draw(self.controller, 1);
      }
    });

  F('rust_fusion', '锈蚀·氧化铁', 'Fe₂O₃', ['固'], 6, 2000, 2800,
    [{ tag: '活泼金属', count: 1 }, { tag: '气', count: 1 }],
    '「活泼金属」+「气」。①：此卡融合召唤成功时，对方场上所有怪兽守备力下降 500。',
    {
      onSummon(g, self) { g.weakenEnemy(self.controller, 0, -500); }
    });

  F('alloy_fusion', '金属间化合物·不锈钢', '不锈钢', ['活泼金属'], 7, 2800, 2600,
    [{ tag: '活泼金属', count: 2 }],
    '「活泼金属」×2。①：此卡不会被战斗破坏。',
    { immuneBattle: true });

  F('chlorine_fusion', '电解产物·氯气', 'Cl₂', ['气'], 6, 2600, 1800,
    [{ tag: '盐', count: 1 }, { tag: '水', count: 1 }],
    '「盐」+「水」。①：此卡融合召唤成功时，对方场上所有怪兽攻击力下降 700。',
    {
      onSummon(g, self) {
        g.weakenEnemy(self.controller, -700, 0);
        g.log('电解食盐水，氯气弥漫。', 'reaction');
      }
    });

  F('glucose_fusion', '光合作用·葡萄糖', 'C₆H₁₂O₆', ['固'], 6, 2000, 2600,
    [{ tag: '水', count: 1 }, { tag: '气', count: 1 }],
    '「水」+「气」。①：自己的准备阶段，回复 800 LP。',
    { onTurnStart(g, self) { g.heal(self.controller, 800, '光合作用'); } });

  F('glass_fusion', '硅酸盐·玻璃', 'SiO₂', ['固'], 6, 1600, 3000,
    [{ tag: '固', count: 1 }, { tag: '盐', count: 1 }],
    '「固」+「盐」。①：此卡不会被效果破坏。',
    { immuneEffect: true });

  F('h2so3_fusion', '酸雨·亚硫酸', 'H₂SO₃', ['酸'], 6, 2600, 1800,
    [{ tag: '酸', count: 1 }, { tag: '气', count: 1 }],
    '「酸」+「气」。①：此卡融合召唤成功时，给予对方 800 点伤害。②：自己场上的「酸」怪兽攻击力上升 300。',
    {
      aura: { atk: 300, tags: ['酸'] },
      onSummon(g, self) { g.burn(g.opp(self.controller), 800, '酸雨'); }
    });

  F('phosgene_fusion', '光气·COCl₂', 'COCl₂', ['气'], 6, 2400, 2000,
    [{ tag: '气', count: 2 }],
    '「气」×2。①：此卡融合召唤成功时，对方场上所有怪兽攻击力下降 500，给予对方 300 点伤害。',
    {
      onSummon(g, self) {
        g.weakenEnemy(self.controller, -500, 0);
        g.burn(g.opp(self.controller), 300, '光气中毒');
      }
    });

  F('nitroglycerin_fusion', '硝化甘油', 'C₃H₅N₃O₉', ['酸'], 7, 3000, 1000,
    [{ tag: '酸', count: 1 }, { tag: '气', count: 1 }],
    '「酸」+「气」。①：此卡融合召唤成功时，给予对方 1200 点伤害。②：结束阶段此卡破坏。',
    {
      onSummon(g, self) { g.burn(g.opp(self.controller), 1200, '硝化甘油爆炸'); },
      onEndPhase(g, self) { g.destroyMonster(self, { battle: false }); }
    });

  F('so3_fusion', '酸酐·三氧化硫', 'SO₃', ['气'], 6, 2400, 2200,
    [{ tag: '气', count: 2 }],
    '「气」×2。①：此卡融合召唤成功时，给予对方 600 点伤害，对方场上所有怪兽守备力下降 400。',
    {
      onSummon(g, self) {
        g.burn(g.opp(self.controller), 600, '三氧化硫');
        g.weakenEnemy(self.controller, 0, -400);
      }
    });

  F('soap_fusion', '皂化反应·硬脂酸钠', 'C₁₇H₃₅COONa', ['盐'], 6, 2300, 2500,
    [{ tag: '碱', count: 1 }, { tag: '盐', count: 1 }],
    '「碱」+「盐」。①：此卡融合召唤成功时，回复 800 LP，对方场上所有怪兽攻击力下降 300。',
    {
      onSummon(g, self) {
        g.heal(self.controller, 800, '皂化反应');
        g.weakenEnemy(self.controller, -300, 0);
      }
    });

  F('cement_fusion', '水化硅酸钙·水泥', '3CaO·SiO₂', ['盐'], 6, 2000, 3000,
    [{ tag: '盐', count: 2 }],
    '「盐」×2。①：此卡不会被效果破坏。',
    { immuneEffect: true });

  F('bicarbonate_fusion', '缓冲体系·碳酸氢钠', 'NaHCO₃', ['盐'], 5, 2200, 2600,
    [{ tag: '碱', count: 1 }, { tag: '盐', count: 1 }],
    '「碱」+「盐」。①：此卡融合召唤成功时，回复 1000 LP。',
    { onSummon(g, self) { g.heal(self.controller, 1000, '碳酸氢钠缓冲'); } });

  F('na2o2_fusion', '过氧化钠·强氧化', 'Na₂O₂', ['固'], 6, 2400, 2400,
    [{ tag: '活泼金属', count: 1 }, { tag: '气', count: 1 }],
    '「活泼金属」+「气」。①：此卡融合召唤成功时，破坏对方 1 只怪兽，给予对方 500 点伤害。',
    {
      onSummon(g, self) {
        g.destroyRandomEnemy(self.controller);
        g.burn(g.opp(self.controller), 500, '过氧化钠');
      }
    });

  F('corundum_fusion', '刚玉·氧化铝', 'Al₂O₃', ['固'], 6, 2200, 3000,
    [{ tag: '活泼金属', count: 1 }, { tag: '气', count: 1 }],
    '「活泼金属」+「气」。①：此卡不会被效果破坏。',
    { immuneEffect: true });

  global.ChemCards = CARDS;
  if (typeof module !== 'undefined' && module.exports) module.exports = CARDS;
})(typeof window !== 'undefined' ? window : globalThis);
