/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  engine.js — 规则引擎（无 DOM，可在 Node 中直接跑测试）
 * ========================================================================= */
(function (global) {
  'use strict';

  const TAGS = ['酸', '碱', '盐', '活泼金属', '水', '气', '固'];
  const TAG_EN = {
    '酸': 'ACID', '碱': 'BASE', '盐': 'SALT', '活泼金属': 'METAL',
    '水': 'AQUA', '气': 'GAS', '固': 'SOLID'
  };
  const MAX_MONSTERS = 5;
  const MAX_SPELLS = 5;
  const START_LP = 8000;
  const HAND_LIMIT = 8;

  /* ---------- 随机数：可复现 ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  let UID = 0;

  function makeCard(def, controller) {
    if (!def) throw new Error('Unknown card definition');
    const c = Object.assign({}, def);
    c.tags = (def.tags || []).slice();
    c.uid = ++UID;
    c.controller = controller;
    c.zone = -1;              // -1 hand, -2 GY, -3 extra, 0..4 field, 'field'
    c.position = 'attack';    // attack | defense
    c.faceUp = true;
    c.tempAtk = 0;
    c.tempDef = 0;
    c.equips = [];
    c.equipTarget = null;
    c.hasAttacked = false;
    c.positionChanged = false;
    c.setTurn = 0;
    c.summonedTurn = 0;
    c.destroyed = false;
    c.shieldUsed = false;
    c.battleShield = false;
    c.fusionSummoned = false;
    return c;
  }

  function reqTributes(level) {
    if (level <= 4) return 0;
    if (level <= 6) return 1;
    return 2;
  }

  function isMonsterCard(card) {
    return card && (card.kind === 'monster' || card.kind === 'fusion');
  }

  /* =======================================================================
   *  Duel
   * ===================================================================== */
  class Duel {
    /**
     * @param {Object} opts
     *  cards  : card database keyed by id
     *  decks  : {0:[ids],1:[ids]}
     *  extras : {0:[ids],1:[ids]}
     *  names  : {0,1}
     *  chemists : {0:chemistObject,1:chemistObject}
     *  first  : 0|1
     *  seed   : number
     *  onEvent: fn(type,payload)
     */
    constructor(opts) {
      opts = opts || {};
      this.cards = opts.cards || {};
      this.rng = opts.seed != null ? mulberry32(opts.seed) : Math.random;
      this.names = opts.names || { 0: '你', 1: '对手' };
      this.chemists = opts.chemists || { 0: null, 1: null };
      this.onEvent = opts.onEvent || null;
      this.logs = [];
      this.turn = 0;
      this.active = opts.first === 1 ? 1 : 0;
      this.first = this.active;
      this.phase = 'main';
      this.winner = null;
      this.fusionUsed = 0;
      this.normalSummonUsed = false;
      this.lastAction = null;
      this.skillUses = { 0: {}, 1: {} };
      this.skillTurnUses = { 0: {}, 1: {} };

      this.players = [this._makePlayer(0), this._makePlayer(1)];

      // 化学家被动的初始修正
      for (let p = 0; p < 2; p++) {
        const pas = this.passiveOf(p);
        if (pas && pas.startingLP) this.players[p].lp += pas.startingLP;
      }

      for (let p = 0; p < 2; p++) {
        const deckIds = (opts.decks && opts.decks[p]) || [];
        const extraIds = (opts.extras && opts.extras[p]) || [];
        this.players[p].deck = deckIds.map(id => makeCard(this.cards[id], p));
        this.players[p].extra = extraIds.map(id => makeCard(this.cards[id], p));
        shuffle(this.players[p].deck, this.rng);
        shuffle(this.players[p].extra, this.rng);
      }

      this.log(`实验开始：${this.names[0]} VS ${this.names[1]}，双方 LP ${this.players[0].lp} / ${this.players[1].lp}。`, 'sys');
      if (this.chemists[0]) this.log(`你的化学家：${this.chemists[0].name}。`, 'sys');
      if (this.chemists[1]) this.log(`对手化学家：${this.chemists[1].name}。`, 'sys');
      for (let p = 0; p < 2; p++) {
        const pas = this.passiveOf(p);
        const hand = 5 + (pas && pas.startingHand ? pas.startingHand : 0);
        this.draw(p, hand, { silent: true });
      }
      this.log('起始手牌已抽取。', 'sys');
      this.beginTurn();
    }

    _makePlayer(idx) {
      return {
        idx,
        lp: START_LP,
        deck: [],
        hand: [],
        monsters: new Array(MAX_MONSTERS).fill(null),
        spells: new Array(MAX_SPELLS).fill(null),
        field: null,
        gy: [],
        extra: [],
        banished: []
      };
    }

    /* ---------------- 基础工具 ---------------- */
    opp(p) { return 1 - p; }
    nameOf(p) { return this.names[p]; }
    chemistOf(p) { return this.chemists[p] || null; }
    passiveOf(p) { const c = this.chemistOf(p); return c && c.passive ? c.passive : null; }
    isOver() { return this.winner !== null; }
    getPlayer(p) { return this.players[p]; }

    log(text, cls) {
      const entry = { text, cls: cls || '', turn: this.turn };
      this.logs.push(entry);
      if (this.logs.length > 400) this.logs.shift();
      if (this.onEvent) { try { this.onEvent('log', entry); } catch (_) { } }
      return entry;
    }

    emit(type, payload) {
      this.lastAction = { type, payload, turn: this.turn };
      if (this.onEvent) { try { this.onEvent(type, payload); } catch (_) { } }
    }

    shuffleDeck(p) { shuffle(this.players[p].deck, this.rng); }

    getMonster(p, z) { return this.players[p].monsters[z] || null; }
    getSpell(p, z) { return this.players[p].spells[z] || null; }

    monsters(p, opts) {
      const out = [];
      const arr = this.players[p].monsters;
      for (let z = 0; z < arr.length; z++) {
        const c = arr[z];
        if (!c) continue;
        if (opts && opts.faceUp && !c.faceUp) continue;
        out.push(c);
      }
      return out;
    }

    monsterZones(p) {
      const out = [];
      this.players[p].monsters.forEach((c, z) => { if (c) out.push({ card: c, zone: z }); });
      return out;
    }

    spells(p) {
      return this.players[p].spells.filter(Boolean);
    }

    spellZones(p) {
      const out = [];
      this.players[p].spells.forEach((c, z) => { if (c) out.push({ card: c, zone: z }); });
      return out;
    }

    freeMonsterZones(p) {
      const out = [];
      this.players[p].monsters.forEach((c, z) => { if (!c) out.push(z); });
      return out;
    }

    freeSpellZones(p) {
      const out = [];
      this.players[p].spells.forEach((c, z) => { if (!c) out.push(z); });
      return out;
    }

    countMonsters(p) { return this.players[p].monsters.filter(Boolean).length; }

    getTags(card) {
      if (!card) return [];
      const set = new Set(card.tags || []);
      for (const eq of (card.equips || [])) {
        for (const t of (eq.equipTags || [])) set.add(t);
      }
      return Array.from(set);
    }

    hasTag(card, tag) { return this.getTags(card).includes(tag); }

    hasPierce(card) {
      if (!card) return false;
      if (card.pierce) return true;
      return (card.equips || []).some(eq => eq.pierce);
    }

    isTag(card, tag) { return this.hasTag(card, tag); }

    hasAnyTag(card, tags) { return tags.some(t => this.hasTag(card, t)); }

    /* ---------------- 抽卡 / LP ---------------- */
    draw(p, n, opts) {
      opts = opts || {};
      const pl = this.players[p];
      for (let i = 0; i < n; i++) {
        if (this.winner !== null) return false;
        if (!pl.deck.length) {
          this.lose(p, '卡组耗尽');
          return false;
        }
        const card = pl.deck.shift();
        card.controller = p;
        card.zone = -1;
        pl.hand.push(card);
        if (!opts.silent) {
          this.log(`${this.nameOf(p)} 抽了 1 张卡。`, 'draw');
          this.emit('draw', { player: p, card });
        }
      }
      return true;
    }

    mill(p, n, opts) {
      const pl = this.players[p];
      for (let i = 0; i < n; i++) {
        if (!pl.deck.length) { this.lose(p, '卡组耗尽'); return; }
        const card = pl.deck.shift();
        card.zone = -2;
        pl.gy.push(card);
      }
      this.log(`${this.nameOf(p)} 的卡组有 ${n} 张卡送入墓地。`, 'gy');
    }

    checkWin() {
      if (this.winner !== null) return;
      const a = this.players[0].lp, b = this.players[1].lp;
      if (a <= 0 && b <= 0) {
        this.winner = 'draw';
        this.phase = 'over';
        this.log('双方 LP 同时归零，决斗平局。', 'sys');
      } else if (a <= 0) {
        this.winner = 1;
        this.phase = 'over';
        this.log(`${this.nameOf(0)} 的 LP 归零，${this.nameOf(1)} 获胜！`, 'sys');
      } else if (b <= 0) {
        this.winner = 0;
        this.phase = 'over';
        this.log(`${this.nameOf(1)} 的 LP 归零，${this.nameOf(0)} 获胜！`, 'sys');
      }
      if (this.winner !== null) this.emit('gameover', { winner: this.winner });
    }

    lose(p, reason) {
      if (this.winner !== null) return;
      this.winner = this.opp(p);
      this.phase = 'over';
      this.log(`${this.nameOf(p)} ${reason || '落败'}，${this.nameOf(this.opp(p))} 获胜！`, 'sys');
      this.emit('gameover', { winner: this.winner });
    }

    gainLP(p, n, reason) {
      if (this.winner !== null || n <= 0) return;
      this.players[p].lp += n;
      this.log(`${this.nameOf(p)} 回复 ${n} LP${reason ? `（${reason}）` : ''}。`, 'heal');
      this.emit('heal', { player: p, amount: n });
    }

    damagePlayer(p, n, opts) {
      opts = opts || {};
      if (this.winner !== null || n <= 0) return;
      let amount = n;
      const pas = this.passiveOf(p);
      if (!opts.battle && pas && pas.effectDamageReduction) {
        amount = Math.max(0, amount - pas.effectDamageReduction);
        if (amount < n) this.log(`${this.nameOf(p)} 的化学家能力减免了 ${n - amount} 点效果伤害。`, 'protect');
      }
      if (amount <= 0) return;
      this.players[p].lp -= amount;
      this.log(`${this.nameOf(p)} 受到 ${amount} 点${opts.battle ? '战斗' : '效果'}伤害${opts.reason ? `（${opts.reason}）` : ''}。`, 'damage');
      this.emit('damage', { player: p, amount, battle: !!opts.battle });
      this.checkWin();
    }

    burn(p, n, reason) { this.damagePlayer(p, n, { reason }); }

    heal(p, n, reason) { this.gainLP(p, n, reason); }

    discardRandom(p) {
      const pl = this.players[p];
      if (!pl.hand.length) return null;
      const card = this.pick(pl.hand);
      const i = pl.hand.indexOf(card);
      if (i >= 0) pl.hand.splice(i, 1);
      this.sendToGY(card, { discard: true });
      this.log(`${this.nameOf(p)} 丢弃了 ${card.name}。`, 'gy');
      return card;
    }

    /* ---------------- 化学家 / 技能 ---------------- */
    activeSkills(p) {
      const c = this.chemistOf(p);
      return c && Array.isArray(c.actives) ? c.actives : [];
    }

    skillState(p, skill) {
      if (!skill) return { used: true, turnUsed: true, reason: '技能不存在' };
      const duelUsed = (this.skillUses[p] && this.skillUses[p][skill.id]) || 0;
      const turnUsed = (this.skillTurnUses[p] && this.skillTurnUses[p][skill.id]) || 0;
      const once = skill.once || 'duel';
      return {
        used: once === 'duel' && duelUsed > 0,
        turnUsed: once === 'turn' && turnUsed > 0,
        duelUsed,
        turnUsed,
        once
      };
    }

    canActivateSkill(p, skill) {
      if (this.winner !== null) return { ok: false, reason: '决斗已结束' };
      if (!skill) return { ok: false, reason: '技能不存在' };
      if (p !== this.active) return { ok: false, reason: '不是你的回合' };
      const timing = skill.timing || 'main';
      if (timing === 'main' && this.phase !== 'main') return { ok: false, reason: '只能在主要阶段使用' };
      if (timing === 'battle' && this.phase !== 'battle') return { ok: false, reason: '只能在战斗阶段使用' };
      if (timing === 'any' && !['main', 'battle'].includes(this.phase)) return { ok: false, reason: '现在不能使用' };
      const st = this.skillState(p, skill);
      if (st.used) return { ok: false, reason: '本场决斗已使用' };
      if (st.turnUsed) return { ok: false, reason: '本回合已使用' };
      const pl = this.players[p];
      if (skill.cost) {
        if (skill.cost.discard && pl.hand.length < skill.cost.discard) {
          return { ok: false, reason: `需要 ${skill.cost.discard} 张手牌作为代价` };
        }
        if (skill.cost.lp && pl.lp <= skill.cost.lp) {
          return { ok: false, reason: `需要 ${skill.cost.lp} LP 作为代价` };
        }
      }
      if (typeof skill.condition === 'function') {
        let ok = false;
        try { ok = !!skill.condition(this, p, skill); } catch (_) { ok = false; }
        if (!ok) return { ok: false, reason: skill.conditionText || '当前条件不满足' };
      }
      return { ok: true, skill };
    }

    activateSkill(p, skillId) {
      const skill = this.activeSkills(p).find(s => s.id === skillId);
      if (!skill) return { ok: false, reason: '技能不存在' };
      const check = this.canActivateSkill(p, skill);
      if (!check.ok) return check;
      const pl = this.players[p];
      // 支付代价
      if (skill.cost) {
        if (skill.cost.discard) {
          for (let i = 0; i < skill.cost.discard; i++) this.discardRandom(p);
        }
        if (skill.cost.lp) {
          pl.lp -= skill.cost.lp;
          this.log(`${this.nameOf(p)} 支付 ${skill.cost.lp} LP 作为技能代价。`, 'damage');
          this.checkWin();
          if (this.winner !== null) return { ok: false, reason: '代价使 LP 归零' };
        }
      }
      this.skillUses[p][skill.id] = (this.skillUses[p][skill.id] || 0) + 1;
      this.skillTurnUses[p][skill.id] = (this.skillTurnUses[p][skill.id] || 0) + 1;
      this.log(`【技能】${this.nameOf(p)} 发动「${skill.name}」！`, 'skill');
      this.emit('skill', { player: p, skill });
      try {
        const r = typeof skill.activate === 'function' ? skill.activate(this, p, skill) : null;
        if (r && r.ok === false) {
          this.log(`技能未能生效：${r.reason || '条件变化'}`, 'err');
        }
      } catch (e) {
        this.log(`技能效果异常：${e.message}`, 'err');
      }
      this.checkWin();
      return { ok: true, skill };
    }

    /* ---------------- 回合 / 阶段 ---------------- */
    drawPerTurn() {
      return Math.min(3, 1 + Math.floor((this.turn - 1) / 4));
    }

    fusionLimit() {
      return Math.min(3, 1 + Math.floor((this.turn - 1) / 6));
    }

    beginTurn() {
      if (this.winner !== null) return;
      this.turn++;
      this.phase = 'main';
      this.normalSummonUsed = false;
      this.fusionUsed = 0;
      this.skillTurnUses[this.active] = {};
      for (let p = 0; p < 2; p++) {
        for (const c of this.players[p].monsters) {
          if (c) { c.hasAttacked = false; c.positionChanged = false; }
        }
      }
      this.log(`—— 第 ${this.turn} 回合 · ${this.nameOf(this.active)} 的回合 ——`, 'turn');
      if (this.turn !== 1) this.draw(this.active, this.drawPerTurn());
      this.log(this.turn === 1 ? '本回合：先攻不抽卡，可融合召唤 1 次。' : `本回合：抽 ${this.drawPerTurn()} 张，可融合召唤 ${this.fusionLimit()} 次。`, 'phase');

      // 永续陷阱在自己回合开始时自动翻开
      for (const c of this.players[this.active].spells) {
        if (c && c.kind === 'trap' && c.trapType === 'continuous' && !c.faceUp && c.setTurn < this.turn) {
          c.faceUp = true;
          this.log(`永续陷阱 ${c.name} 自动翻开。`, 'trap');
        }
      }

      // 自己的回合开始效果
      const cards = [
        ...this.monsters(this.active, { faceUp: true }),
        ...this.spells(this.active).filter(c => c.faceUp),
        this.players[this.active].field
      ].filter(c => c && c.faceUp);
      for (const c of cards) {
        if (typeof c.onTurnStart === 'function') {
          try { c.onTurnStart(this, c); } catch (e) { this.log(`效果处理异常：${e.message}`, 'err'); }
        }
        if (this.winner !== null) return;
      }
      this.checkWin();
      this.emit('turn', { player: this.active, turn: this.turn });
    }

    toBattlePhase(p) {
      if (this.winner !== null || p !== this.active || this.phase !== 'main') return false;
      this.phase = 'battle';
      this.log(`${this.nameOf(p)} 进入战斗阶段。`, 'phase');
      this.emit('phase', { phase: 'battle' });
      return true;
    }

    endTurn(p) {
      if (this.winner !== null || p !== this.active) return false;
      // 结束阶段效果
      const cards = [
        ...this.monsters(p, { faceUp: true }),
        ...this.spells(p).filter(c => c.faceUp),
        this.players[p].field
      ].filter(c => c && c.faceUp);
      for (const c of cards) {
        if (c.burnUp) {
          c.burnUp = false;
          this.destroyMonster(c, { battle: false, source: null });
        }
        if (typeof c.onEndPhase === 'function') {
          try { c.onEndPhase(this, c); } catch (e) { this.log(`效果处理异常：${e.message}`, 'err'); }
        }
        if (this.winner !== null) return false;
      }
      // 化学家被动：回合结束回复
      const pas = this.passiveOf(p);
      if (pas && pas.endHeal) this.heal(p, pas.endHeal, pas.name || '化学家被动');
      // 清理本回合临时数值
      for (let i = 0; i < 2; i++) {
        for (const c of this.players[i].monsters) {
          if (c) { c.tempAtk = 0; c.tempDef = 0; c.battleShield = false; }
        }
        for (const c of this.players[i].spells) {
          if (c) { c.tempAtk = 0; c.tempDef = 0; }
        }
      }
      this.log(`${this.nameOf(p)} 结束回合。`, 'phase');
      this.active = this.opp(p);
      this.beginTurn();
      return true;
    }

    /* ---------------- 通常召唤 / 盖放 / 表示形式 ---------------- */
    summonInfo(p, card) {
      const need = reqTributes(card.level || 1);
      const available = this.countMonsters(p);
      return { need, available, ok: available >= need };
    }

    canNormalSummon(p, card) {
      if (this.winner !== null) return { ok: false, reason: '决斗已结束' };
      if (p !== this.active) return { ok: false, reason: '不是你的回合' };
      if (this.phase !== 'main') return { ok: false, reason: '只能在主要阶段召唤' };
      if (this.normalSummonUsed) return { ok: false, reason: '本回合已进行过通常召唤' };
      if (!isMonsterCard(card) || card.kind === 'fusion') return { ok: false, reason: '融合怪兽不能通常召唤' };
      if (card.zone !== -1) return { ok: false, reason: '此卡不在手牌' };
      const need = reqTributes(card.level);
      if (this.countMonsters(p) < need) return { ok: false, reason: `需要 ${need} 只祭品` };
      if (!this.freeMonsterZones(p).length && this.countMonsters(p) === MAX_MONSTERS && need === 0) {
        return { ok: false, reason: '怪兽区域已满' };
      }
      return { ok: true, need };
    }

    normalSummon(p, handIndex, opts) {
      opts = opts || {};
      if (p !== this.active) return { ok: false, reason: '不是你的回合' };
      const pl = this.players[p];
      const card = pl.hand[handIndex];
      if (!card) return { ok: false, reason: '无效的手牌' };
      const check = this.canNormalSummon(p, card);
      if (!check.ok) return check;
      const tributes = (opts.tributes || []).slice();
      if (tributes.length !== check.need) return { ok: false, reason: `需要选择 ${check.need} 只祭品` };
      for (const z of tributes) {
        if (!pl.monsters[z]) return { ok: false, reason: '祭品区域为空' };
      }
      // 预计算目标区域
      const tributeSet = new Set(tributes);
      let zone = (opts.zone != null && pl.monsters[opts.zone] == null) ? opts.zone : -1;
      if (zone === -1) {
        for (let z = 0; z < MAX_MONSTERS; z++) {
          if (!pl.monsters[z] || tributeSet.has(z)) { zone = z; break; }
        }
      }
      if (zone === -1) return { ok: false, reason: '没有空余的怪兽区域' };

      // 解放祭品
      for (const z of tributes) {
        const t = pl.monsters[z];
        if (t) {
          this.sendToGY(t, { tribute: true });
          this.log(`解放 ${t.name} 作为祭品。`, 'summon');
        }
      }
      // 移除手牌
      pl.hand.splice(handIndex, 1);
      card.controller = p;
      card.zone = zone;
      card.position = opts.set ? 'defense' : 'attack';
      card.faceUp = !opts.set;
      card.summonedTurn = this.turn;
      card.hasAttacked = false;
      pl.monsters[zone] = card;
      this.normalSummonUsed = true;

      if (opts.set) {
        this.log(`${this.nameOf(p)} 盖放了一只怪兽。`, 'set');
      } else {
        this.log(`${this.nameOf(p)} 通常召唤 ${card.name}（${card.atk}/${card.def}）。`, 'summon');
        this.emit('summon', { player: p, card });
        this.triggerSummon(card);
      }
      return { ok: true, card, zone };
    }

    changePosition(p, zone, opts) {
      opts = opts || {};
      if (p !== this.active || this.phase !== 'main') return { ok: false, reason: '只能在主要阶段改变表示形式' };
      const card = this.getMonster(p, zone);
      if (!card) return { ok: false, reason: '该区域没有怪兽' };
      if (card.positionChanged) return { ok: false, reason: '本回合已改变过表示形式' };
      if (!card.faceUp) {
        if (card.summonedTurn === this.turn) {
          return { ok: false, reason: '盖放的怪兽本回合不能翻转' };
        }
        card.faceUp = true;
        card.position = opts.position === 'defense' ? 'defense' : 'attack';
        card.positionChanged = true;
        this.log(`${this.nameOf(p)} 将盖放的 ${card.name} 翻转为${card.position === 'attack' ? '攻击' : '守备'}表示。`, 'position');
        if (typeof card.onFlip === 'function') {
          try { card.onFlip(this, card); } catch (e) { this.log(`翻转效果异常：${e.message}`, 'err'); }
        }
        return { ok: true };
      }
      card.position = card.position === 'attack' ? 'defense' : 'attack';
      card.positionChanged = true;
      this.log(`${this.nameOf(p)} 将 ${card.name} 改为${card.position === 'attack' ? '攻击' : '守备'}表示。`, 'position');
      return { ok: true };
    }

    triggerSummon(card) {
      if (typeof card.onSummon === 'function') {
        try { card.onSummon(this, card); } catch (e) { this.log(`召唤效果异常：${e.message}`, 'err'); }
      }
      this.tryTraps(this.opp(card.controller), 'summon', { monster: card });
    }

    /* ---------------- 魔法 / 陷阱 ---------------- */
    canActivateSpell(p, card) {
      if (this.winner !== null) return { ok: false, reason: '决斗已结束' };
      if (p !== this.active) return { ok: false, reason: '不是你的回合' };
      if (this.phase !== 'main') return { ok: false, reason: '只能在主要阶段发动' };
      if (!card || card.kind !== 'spell') return { ok: false, reason: '不是魔法卡' };
      if (card.zone !== -1) return { ok: false, reason: '此卡不在手牌' };
      if (card.target && !this.validSpellTargets(p, card).length) {
        return { ok: false, reason: '没有合法的对象' };
      }
      if (card.spellType === 'equip' || card.spellType === 'continuous') {
        if (card.spellType === 'equip') {
          const targets = this.validSpellTargets(p, card);
          if (!targets.length) return { ok: false, reason: '没有可装备的怪兽' };
        }
        if (!this.freeSpellZones(p).length) return { ok: false, reason: '魔法区域已满' };
      } else if (card.spellType === 'field') {
        if (!this.canPlaceField(p, card)) return { ok: false, reason: '无法放置场地魔法' };
      }
      return { ok: true };
    }

    canPlaceField(p, card) {
      return card.spellType === 'field';
    }

    validSpellTargets(p, card) {
      if (!card) return [];
      const spec = card.target;
      if (!spec) return [];
      if (spec === 'ownMonster') return this.monsters(p, { faceUp: true });
      if (spec === 'enemyMonster') return this.monsters(this.opp(p));
      if (spec === 'anyMonster') {
        const all = [...this.monsters(p), ...this.monsters(this.opp(p))];
        return card.targetTags ? all.filter(c => this.hasAnyTag(c, card.targetTags)) : all;
      }
      if (spec === 'enemyMonsterTag') {
        return this.monsters(this.opp(p)).filter(c => this.hasAnyTag(c, card.targetTags || []));
      }
      if (spec === 'ownMonsterTag') {
        return this.monsters(p).filter(c => this.hasAnyTag(c, card.targetTags || []));
      }
      if (spec === 'deckSalt') return this.deckChoices(p, c => this.hasTag(c, '盐'));
      if (spec === 'gySalt') return this.gyChoices(p, c => this.hasTag(c, '盐'));
      return [];
    }

    activateSpell(p, handIndex, target, opts) {
      opts = opts || {};
      if (p !== this.active) return { ok: false, reason: '不是你的回合' };
      const pl = this.players[p];
      const card = pl.hand[handIndex];
      if (!card) return { ok: false, reason: '无效的手牌' };
      const check = this.canActivateSpell(p, card);
      if (!check.ok) return check;

      const targetCard = target && target.card ? target.card : target;
      if (card.target) {
        if (!targetCard) return { ok: false, reason: '需要选择对象' };
        const valid = this.validSpellTargets(p, card).includes(targetCard);
        if (!valid) return { ok: false, reason: '对象不合法' };
      }

      // 陷阱反击窗口
      const ctx = { spell: card, caster: p };
      this.tryTraps(this.opp(p), 'spell', ctx);
      if (ctx.negated) {
        pl.hand.splice(handIndex, 1);
        card.zone = -2;
        card.controller = p;
        pl.gy.push(card);
        this.log(`${card.name} 的发动被无效。`, 'trap');
        return { ok: false, reason: '发动被无效' };
      }

      // 场地 / 永续 / 装备放置
      let placedZone = null;
      if (card.spellType === 'field') {
        if (pl.field) this.sendToGY(pl.field, { replaced: true });
        pl.field = card;
        card.zone = 'field';
      } else if (card.spellType === 'equip' || card.spellType === 'continuous') {
        let z = opts.zone != null ? opts.zone : this.freeSpellZones(p)[0];
        if (z == null || pl.spells[z]) return { ok: false, reason: '没有空余魔法区域' };
        pl.spells[z] = card;
        card.zone = z;
        placedZone = z;
      }

      pl.hand.splice(handIndex, 1);
      card.controller = p;
      card.faceUp = true;
      card.position = 'attack';
      card.summonedTurn = this.turn;

      if (card.spellType === 'equip') {
        if (!targetCard || targetCard.zone == null || targetCard.zone === -1) {
          if (placedZone != null) pl.spells[placedZone] = null;
          card.zone = -1;
          pl.hand.splice(handIndex, 0, card);
          return { ok: false, reason: '装备对象已离场' };
        }
        targetCard.equips.push(card);
        card.equipTarget = targetCard;
        this.log(`${this.nameOf(p)} 发动装备魔法 ${card.name}，装备给 ${targetCard.name}。`, 'spell');
      } else {
        this.log(`${this.nameOf(p)} 发动${card.spellType === 'field' ? '场地魔法' : card.spellType === 'continuous' ? '永续魔法' : '魔法卡'} ${card.name}。`, 'spell');
      }

      this.emit('spell', { player: p, card, target: targetCard });
      try {
        if (typeof card.activate === 'function') card.activate(this, card, targetCard);
      } catch (e) {
        this.log(`魔法效果异常：${e.message}`, 'err');
      }

      if (card.spellType === 'normal') {
        card.zone = -2;
        pl.gy.push(card);
      }
      this.checkWin();
      return { ok: true, card };
    }

    setTrap(p, handIndex, zone) {
      if (this.winner !== null || p !== this.active || this.phase !== 'main') {
        return { ok: false, reason: '只能在自己的主要阶段盖放陷阱' };
      }
      const pl = this.players[p];
      const card = pl.hand[handIndex];
      if (!card || card.kind !== 'trap') return { ok: false, reason: '不是陷阱卡' };
      let z = zone != null ? zone : this.freeSpellZones(p)[0];
      if (z == null || pl.spells[z]) return { ok: false, reason: '没有空余魔法陷阱区域' };
      pl.hand.splice(handIndex, 1);
      card.controller = p;
      card.zone = z;
      card.position = 'defense';
      card.faceUp = false;
      card.setTurn = this.turn;
      pl.spells[z] = card;
      this.log(`${this.nameOf(p)} 盖放了一张陷阱卡。`, 'set');
      this.emit('set', { player: p, card });
      return { ok: true, card, zone: z };
    }

    /**
     * 自动陷阱窗口。一次事件最多发动一张。
     * ctx 可被陷阱修改；ctx.negated = true 表示无效。
     */
    tryTraps(p, event, ctx) {
      if (this.winner !== null) return false;
      ctx = ctx || {};
      const pl = this.players[p];
      for (let z = 0; z < pl.spells.length; z++) {
        const card = pl.spells[z];
        if (!card || card.kind !== 'trap') continue;
        if (!card.faceUp && card.setTurn >= this.turn) continue;
        const trig = card.trigger;
        if (!trig || trig.event !== event) continue;
        let ok = true;
        try {
          if (typeof trig.condition === 'function') ok = !!trig.condition(this, card, ctx);
        } catch (e) { ok = false; }
        if (!ok) continue;
        card.faceUp = true;
        this.log(`【陷阱】${this.nameOf(p)} 发动 ${card.name}！`, 'trap');
        this.emit('trap', { player: p, card });
        try {
          if (typeof trig.resolve === 'function') trig.resolve(this, card, ctx);
        } catch (e) {
          this.log(`陷阱效果异常：${e.message}`, 'err');
        }
        if (card.trapType !== 'continuous') this.sendToGY(card, { trap: true });
        this.checkWin();
        return true;
      }
      return false;
    }

    /* ---------------- 融合召唤 ---------------- */
    materialCost(card) {
      if (card.zone === -1) return 100 + (card.atk || 0) * 0.05;
      return 400 + (card.atk || 0) * 0.2 + (card.kind === 'fusion' ? 800 : 0);
    }

    findFusionMaterials(p, fusion) {
      const pl = this.players[p];
      const pool = [];
      pl.hand.forEach(c => { if (isMonsterCard(c) && c.kind !== 'fusion') pool.push({ card: c, from: 'hand', cost: this.materialCost(c) }); });
      pl.monsters.forEach(c => { if (c) pool.push({ card: c, from: 'field', cost: this.materialCost(c) }); });
      pool.sort((a, b) => a.cost - b.cost);

      const reqs = [];
      for (const m of (fusion.materials || [])) {
        for (let i = 0; i < (m.count || 1); i++) reqs.push(m.tag);
      }
      // 约束最紧的标签优先，减少搜索
      reqs.sort((a, b) => pool.filter(x => this.hasTag(x.card, a)).length - pool.filter(x => this.hasTag(x.card, b)).length);

      const used = new Set();
      const chosen = [];
      const self = this;
      function bt(i) {
        if (i === reqs.length) return true;
        const tag = reqs[i];
        for (const item of pool) {
          if (used.has(item.card.uid)) continue;
          if (!self.hasTag(item.card, tag)) continue;
          used.add(item.card.uid);
          chosen.push(item);
          if (bt(i + 1)) return true;
          chosen.pop();
          used.delete(item.card.uid);
        }
        return false;
      }
      if (!bt(0)) return null;

      // 至少要有空位：场上素材释放后 + 原本空位
      const fieldMats = chosen.filter(x => x.from === 'field').length;
      if (this.freeMonsterZones(p).length + fieldMats <= 0) return null;
      return chosen;
    }

    availableFusions(p) {
      if (this.winner !== null || p !== this.active || this.phase !== 'main' || this.fusionUsed >= this.fusionLimit()) return [];
      const out = [];
      this.players[p].extra.forEach((fusion, index) => {
        const mats = this.findFusionMaterials(p, fusion);
        if (mats) out.push({ index, fusion, materials: mats });
      });
      out.sort((a, b) => (b.fusion.atk + b.fusion.def) - (a.fusion.atk + a.fusion.def));
      return out;
    }

    fusionSummon(p, extraIndex) {
      if (this.winner !== null || p !== this.active || this.phase !== 'main') {
        return { ok: false, reason: '只能在主要阶段融合召唤' };
      }
      if (this.fusionUsed >= this.fusionLimit()) {
        return { ok: false, reason: `本回合融合次数已用完（${this.fusionLimit()} 次）` };
      }
      const pl = this.players[p];
      const fusion = pl.extra[extraIndex];
      if (!fusion) return { ok: false, reason: '额外卡组没有此卡' };
      const mats = this.findFusionMaterials(p, fusion);
      if (!mats) return { ok: false, reason: '融合素材不足' };
      if (this.freeMonsterZones(p).length + mats.filter(m => m.from === 'field').length <= 0) {
        return { ok: false, reason: '怪兽区域已满' };
      }

      const names = mats.map(m => m.card.name).join(' + ');
      for (const m of mats) {
        if (m.from === 'field') {
          this.sendToGY(m.card, { material: true });
        } else {
          const idx = pl.hand.indexOf(m.card);
          if (idx >= 0) pl.hand.splice(idx, 1);
          m.card.zone = -2;
          m.card.controller = p;
          pl.gy.push(m.card);
        }
      }
      pl.extra.splice(extraIndex, 1);
      const z = this.freeMonsterZones(p)[0];
      fusion.controller = p;
      fusion.zone = z;
      fusion.faceUp = true;
      fusion.position = 'attack';
      fusion.summonedTurn = this.turn;
      fusion.hasAttacked = false;
      fusion.fusionSummoned = true;
      pl.monsters[z] = fusion;
      this.fusionUsed++;
      this.log(`【融合召唤】${this.nameOf(p)} 将 ${names} 融合，召唤 ${fusion.name}！`, 'fusion');
      this.emit('fusion', { player: p, card: fusion, materials: mats });
      this.triggerSummon(fusion);
      return { ok: true, card: fusion, zone: z };
    }

    /* ---------------- 墓地 / 卡组操作 ---------------- */
    deckChoices(p, filter) { return this.players[p].deck.filter(c => !filter || filter(c)); }
    gyChoices(p, filter) { return this.players[p].gy.filter(c => !filter || filter(c)); }

    addDeckCardToHand(p, card) {
      const pl = this.players[p];
      const idx = pl.deck.indexOf(card);
      if (idx < 0) return false;
      pl.deck.splice(idx, 1);
      card.controller = p;
      card.zone = -1;
      pl.hand.push(card);
      this.shuffleDeck(p);
      this.log(`${this.nameOf(p)} 从卡组将 ${card.name} 加入手牌。`, 'search');
      this.emit('search', { player: p, card });
      return true;
    }

    addGYCardToHand(p, card) {
      const pl = this.players[p];
      const idx = pl.gy.indexOf(card);
      if (idx < 0) return false;
      pl.gy.splice(idx, 1);
      card.controller = p;
      card.zone = -1;
      pl.hand.push(card);
      this.log(`${this.nameOf(p)} 从墓地回收 ${card.name}。`, 'search');
      this.emit('search', { player: p, card });
      return true;
    }

    sendToGY(card, opts) {
      if (!card) return false;
      opts = opts || {};
      this.removeFromField(card);
      // 装备卡离场
      if (card.equipTarget) {
        const t = card.equipTarget;
        const i = t.equips.indexOf(card);
        if (i >= 0) t.equips.splice(i, 1);
        card.equipTarget = null;
      }
      // 怪兽身上的装备
      if (card.equips && card.equips.length) {
        const eqs = card.equips.slice();
        card.equips.length = 0;
        for (const eq of eqs) {
          if (eq.zone != null && eq.zone !== -2) this.sendToGY(eq, { equip: true });
        }
      }
      card.zone = -2;
      card.faceUp = true;
      if (!this.players[card.controller].gy.includes(card)) {
        this.players[card.controller].gy.push(card);
      }
      return true;
    }

    removeFromField(card) {
      const pl = this.players[card.controller];
      if (!pl) return;
      for (let z = 0; z < pl.monsters.length; z++) {
        if (pl.monsters[z] === card) { pl.monsters[z] = null; card.zone = -2; return; }
      }
      for (let z = 0; z < pl.spells.length; z++) {
        if (pl.spells[z] === card) { pl.spells[z] = null; card.zone = -2; return; }
      }
      if (pl.field === card) { pl.field = null; card.zone = -2; }
    }

    /* ---------------- 破坏 ---------------- */
    protection(card) {
      const p = { battle: false, effect: false, acid: false, shield: false };
      if (!card) return p;
      if (card.immuneBattle) p.battle = true;
      if (card.immuneEffect) p.effect = true;
      if (card.acidProof) p.acid = true;
      if (card.shieldOnce && !card.shieldUsed) p.shield = true;
      for (const eq of (card.equips || [])) {
        if (eq.immuneBattle) p.battle = true;
        if (eq.immuneEffect) p.effect = true;
        if (eq.acidProof) p.acid = true;
      }
      return p;
    }

    destroyMonster(card, opts) {
      opts = opts || {};
      if (!card || card.zone === null || card.zone === -2 || card.zone === -1) return false;
      const prot = this.protection(card);
      const byTag = opts.byTag;
      if (opts.battle && prot.battle) {
        this.log(`${card.name} 不会被战斗破坏。`, 'protect');
        return false;
      }
      if (!opts.battle && prot.effect) {
        this.log(`${card.name} 不会被效果破坏。`, 'protect');
        return false;
      }
      if (prot.acid && (byTag === '酸' || opts.acid)) {
        this.log(`${card.name} 对酸类腐蚀免疫。`, 'protect');
        return false;
      }
      if (opts.battle && card.battleShield) {
        card.battleShield = false;
        this.log(`${card.name} 的防护层挡住了这次破坏。`, 'protect');
        return false;
      }
      if (prot.shield) {
        card.shieldUsed = true;
        this.log(`${card.name} 抵抗了破坏（一次性护盾）。`, 'protect');
        return false;
      }
      this.sendToGY(card, opts);
      this.log(`${card.name} 被${opts.battle ? '战斗' : '效果'}破坏，送入墓地。`, 'destroy');
      this.emit('destroy', { card, battle: !!opts.battle });
      if (typeof card.onDestroyed === 'function') {
        try { card.onDestroyed(this, card, opts); } catch (e) { this.log(`破坏效果异常：${e.message}`, 'err'); }
      }
      return true;
    }

    /* ---------------- 有效数值 ---------------- */
    auraMatches(aura, target) {
      if (!aura) return false;
      if (aura.tags && !aura.tags.some(t => this.hasTag(target, t))) return false;
      if (aura.kinds && !aura.kinds.includes(target.kind)) return false;
      return true;
    }

    effectiveAtk(card) { return this._effective(card, 'atk'); }
    effectiveDef(card) { return this._effective(card, 'def'); }

    _effective(card, stat) {
      if (!card || !isMonsterCard(card)) return 0;
      let v = (stat === 'atk' ? card.atk : card.def) || 0;
      v += (stat === 'atk' ? card.tempAtk : card.tempDef) || 0;

      const p = card.controller;
      const pl = this.players[p];
      if (!pl) return Math.max(0, v);

      // 装备
      for (const eq of (card.equips || [])) {
        v += (stat === 'atk' ? eq.equipAtk : eq.equipDef) || 0;
        if (typeof eq.staticAtk === 'function' && stat === 'atk') {
          try { v += eq.staticAtk(this, eq, card) || 0; } catch (_) { }
        }
        if (typeof eq.staticDef === 'function' && stat === 'def') {
          try { v += eq.staticDef(this, eq, card) || 0; } catch (_) { }
        }
      }

      // 光环：怪兽
      for (const src of pl.monsters) {
        if (!src || !src.faceUp || src === card) continue;
        if (src.aura && this.auraMatches(src.aura, card)) {
          v += (stat === 'atk' ? src.aura.atk : src.aura.def) || 0;
        }
      }
      // 光环 / 静态：魔法、场地
      const spellCards = pl.spells.filter(c => c && c.faceUp);
      if (pl.field && pl.field.faceUp) spellCards.push(pl.field);
      for (const src of spellCards) {
        if (src.aura && this.auraMatches(src.aura, card)) {
          v += (stat === 'atk' ? src.aura.atk : src.aura.def) || 0;
        }
        const fn = stat === 'atk' ? src.staticAtk : src.staticDef;
        if (typeof fn === 'function') {
          try { v += fn(this, src, card) || 0; } catch (_) { }
        }
      }
      // 化学家被动
      const pas = this.passiveOf(p);
      if (pas) {
        if (stat === 'atk') {
          if (pas.allAtk) v += pas.allAtk;
          if (pas.fusionAtk && card.kind === 'fusion') v += pas.fusionAtk;
          if (pas.tagAtk) {
            for (const t of this.getTags(card)) v += pas.tagAtk[t] || 0;
          }
          if (pas.atkPerDistinctTag) {
            const tags = new Set();
            for (const c of this.monsters(p, { faceUp: true })) {
              for (const t of this.getTags(c)) tags.add(t);
            }
            v += tags.size * pas.atkPerDistinctTag;
          }
        } else {
          if (pas.allDef) v += pas.allDef;
          if (pas.fusionDef && card.kind === 'fusion') v += pas.fusionDef;
          if (pas.tagDef) {
            for (const t of this.getTags(card)) v += pas.tagDef[t] || 0;
          }
          if (pas.defPerDistinctTag) {
            const tags = new Set();
            for (const c of this.monsters(p, { faceUp: true })) {
              for (const t of this.getTags(c)) tags.add(t);
            }
            v += tags.size * pas.defPerDistinctTag;
          }
        }
      }
      // 怪兽自身静态效果
      if (stat === 'atk' && typeof card.staticAtk === 'function') {
        try { v += card.staticAtk(this, card, card) || 0; } catch (_) { }
      }
      if (stat === 'def' && typeof card.staticDef === 'function') {
        try { v += card.staticDef(this, card, card) || 0; } catch (_) { }
      }
      return Math.max(0, v);
    }

    /* ---------------- 战斗 ---------------- */
    battleOutcome(attacker, target) {
      const atk = this.effectiveAtk(attacker);
      const out = {
        atk,
        targetAtk: 0,
        targetDef: 0,
        dmgDefender: 0,
        dmgAttacker: 0,
        destroyDefender: false,
        destroyAttacker: false,
        neutralization: false,
        direct: !target
      };
      if (!target) {
        out.dmgDefender = atk;
        return out;
      }
      out.targetAtk = this.effectiveAtk(target);
      out.targetDef = this.effectiveDef(target);

      // 腐蚀：酸 vs 活泼金属
      let effectiveAtk = atk;
      if (this.hasTag(attacker, '酸') && this.hasTag(target, '活泼金属')) {
        effectiveAtk += 800;
        out.corrosion = true;
      }
      if (typeof attacker.battleAtk === 'function') {
        try { effectiveAtk += attacker.battleAtk(this, attacker, target) || 0; } catch (_) { }
      }
      out.atk = effectiveAtk;

      const targetIsAttack = target.faceUp && target.position === 'attack';
      if (targetIsAttack) {
        if (effectiveAtk > out.targetAtk) {
          out.destroyDefender = true;
          out.dmgDefender = effectiveAtk - out.targetAtk;
        } else if (effectiveAtk < out.targetAtk) {
          out.destroyAttacker = true;
          out.dmgAttacker = out.targetAtk - effectiveAtk;
        } else {
          out.destroyDefender = true;
          out.destroyAttacker = true;
        }
      } else {
        if (effectiveAtk > out.targetDef) {
          out.destroyDefender = true;
          if (this.hasPierce(attacker)) out.dmgDefender = effectiveAtk - out.targetDef;
        } else if (effectiveAtk < out.targetDef) {
          out.dmgAttacker = out.targetDef - effectiveAtk;
        }
      }
      // 中和反应
      const aAcid = this.hasTag(attacker, '酸'), aBase = this.hasTag(attacker, '碱');
      const dAcid = this.hasTag(target, '酸'), dBase = this.hasTag(target, '碱');
      if ((aAcid && dBase) || (aBase && dAcid)) out.neutralization = true;
      return out;
    }

    previewBattle(p, az, tz) {
      const attacker = this.getMonster(p, az);
      if (!attacker) return null;
      const target = tz == null ? null : this.getMonster(this.opp(p), tz);
      return this.battleOutcome(attacker, target);
    }

    canAttack(p, zone) {
      if (this.winner !== null || p !== this.active || this.phase !== 'battle') return { ok: false, reason: '现在不能攻击' };
      if (this.turn === 1) return { ok: false, reason: '先攻的首回合不能攻击' };
      const card = this.getMonster(p, zone);
      if (!card) return { ok: false, reason: '该区域没有怪兽' };
      if (!card.faceUp || card.position !== 'attack') return { ok: false, reason: '只有表侧攻击表示的怪兽可以攻击' };
      if (card.hasAttacked) return { ok: false, reason: '此怪兽本回合已攻击过' };
      return { ok: true };
    }

    attack(p, attackerZone, targetZone) {
      const chk = this.canAttack(p, attackerZone);
      if (!chk.ok) return { ok: false, reason: chk.reason };
      const attacker = this.getMonster(p, attackerZone);
      const defender = this.opp(p);
      let target = null;
      if (targetZone != null) {
        target = this.getMonster(defender, targetZone);
        if (!target) return { ok: false, reason: '攻击对象不存在' };
      } else if (this.countMonsters(defender) > 0) {
        return { ok: false, reason: '对方场上有怪兽，不能直接攻击' };
      }

      const ctx = { attacker, target, direct: !target, defender };
      this.tryTraps(defender, 'attack', ctx);
      if (ctx.negated) {
        attacker.hasAttacked = true;
        this.log(`攻击被无效。`, 'trap');
        return { ok: true, negated: true };
      }
      if (!attacker || attacker.zone === -2 || attacker.zone === null) {
        return { ok: true, attackerDestroyed: true };
      }
      if (target && (target.zone === -2 || target.zone === null)) {
        attacker.hasAttacked = true;
        return { ok: true, targetGone: true };
      }

      // 攻击宣言时效果
      if (target && typeof attacker.beforeDamage === 'function') {
        let stop = false;
        try { stop = !!attacker.beforeDamage(this, attacker, target); } catch (e) { this.log(`攻击效果异常：${e.message}`, 'err'); }
        if (stop) {
          attacker.hasAttacked = true;
          this.checkWin();
          return { ok: true, stopped: true };
        }
      }

      if (target && !target.faceUp) {
        target.faceUp = true;
        target.position = 'defense';
        this.log(`${target.name} 被翻转，显示守备力 ${this.effectiveDef(target)}。`, 'position');
        if (typeof target.onFlip === 'function') {
          try { target.onFlip(this, target); } catch (e) { this.log(`翻转效果异常：${e.message}`, 'err'); }
        }
      }

      const wasOnField = !!target;
      const neutral = target ? this.battleOutcome(attacker, target).neutralization : false;
      const out = this.battleOutcome(attacker, target);
      attacker.hasAttacked = true;

      this.log(`${attacker.name}（ATK ${out.atk}）攻击 ${target ? `${target.name}（${target.position === 'attack' ? `ATK ${out.targetAtk}` : `DEF ${out.targetDef}`}）` : '玩家'}！`, 'battle');

      if (target) {
        if (out.destroyDefender) {
          this.destroyMonster(target, { battle: true, byTag: this.getTags(attacker)[0], source: attacker });
        }
        if (out.destroyAttacker) {
          this.destroyMonster(attacker, { battle: true, byTag: this.getTags(target)[0], source: target });
        }
      }

      if (out.dmgDefender > 0) {
        this.damagePlayer(defender, out.dmgDefender, { battle: true, reason: '战斗伤害' });
        if (attacker.zone != null && attacker.zone !== -2 && typeof attacker.onBattleDamage === 'function') {
          try { attacker.onBattleDamage(this, attacker, target); } catch (e) { this.log(`战斗效果异常：${e.message}`, 'err'); }
        }
        this.tryTraps(defender, 'damage', { amount: out.dmgDefender, source: attacker });
      }
      if (out.dmgAttacker > 0) {
        this.damagePlayer(p, out.dmgAttacker, { battle: true, reason: '战斗反伤' });
      }

      if (target && out.destroyDefender && attacker.zone != null && attacker.zone !== -2) {
        if (typeof attacker.onBattleDestroy === 'function') {
          try { attacker.onBattleDestroy(this, attacker, target); } catch (e) { this.log(`战斗效果异常：${e.message}`, 'err'); }
        }
      }

      // 中和反应：双方各回复 500，且两只怪兽都被破坏
      if (neutral && wasOnField) {
        this.log('酸碱中和反应发生：双方怪兽被中和破坏，各回复 500 LP。', 'reaction');
        for (const c of [attacker, target]) {
          if (c && c.zone != null && c.zone !== -2 && c.zone !== -1) {
            this.destroyMonster(c, { battle: false, byTag: '中和', source: null });
          }
        }
        this.gainLP(p, 500, '中和反应');
        this.gainLP(defender, 500, '中和反应');
        this.emit('reaction', { type: 'neutralization', player: p });
      }

      this.emit('battle', { player: p, attacker, target, outcome: out });
      this.checkWin();
      return { ok: true, outcome: out };
    }

    /* ---------------- 特殊召唤（效果） ---------------- */
    specialSummonFromGY(p, card, opts) {
      opts = opts || {};
      const pl = this.players[p];
      const idx = pl.gy.indexOf(card);
      if (idx < 0) return { ok: false, reason: '墓地没有此卡' };
      const z = opts.zone != null && !pl.monsters[opts.zone] ? opts.zone : this.freeMonsterZones(p)[0];
      if (z == null) return { ok: false, reason: '怪兽区域已满' };
      pl.gy.splice(idx, 1);
      card.controller = p;
      card.zone = z;
      card.faceUp = true;
      card.position = opts.position || 'defense';
      card.summonedTurn = this.turn;
      card.hasAttacked = false;
      pl.monsters[z] = card;
      this.log(`${this.nameOf(p)} 从墓地特殊召唤 ${card.name}（${opts.position === 'attack' ? '攻击' : '守备'}表示）。`, 'summon');
      this.emit('summon', { player: p, card, special: true });
      this.triggerSummon(card);
      return { ok: true, card, zone: z };
    }

    specialSummonFromDeck(p, cardId, opts) {
      opts = opts || {};
      const pl = this.players[p];
      const idx = pl.deck.findIndex(c => c.id === cardId);
      if (idx < 0) return { ok: false, reason: '卡组没有此卡' };
      const z = opts.zone != null && !pl.monsters[opts.zone] ? opts.zone : this.freeMonsterZones(p)[0];
      if (z == null) return { ok: false, reason: '怪兽区域已满' };
      const card = pl.deck.splice(idx, 1)[0];
      this.shuffleDeck(p);
      card.controller = p;
      card.zone = z;
      card.faceUp = true;
      card.position = opts.position || 'defense';
      card.summonedTurn = this.turn;
      card.hasAttacked = false;
      pl.monsters[z] = card;
      this.log(`${this.nameOf(p)} 从卡组特殊召唤 ${card.name}。`, 'summon');
      this.emit('summon', { player: p, card, special: true });
      this.triggerSummon(card);
      return { ok: true, card, zone: z };
    }

    /* ---------------- 常用效果助手 ---------------- */
    pick(arr) { return arr && arr.length ? arr[Math.floor(this.rng() * arr.length)] : null; }

    enemyMonsters(p) { return this.monsters(this.opp(p)); }

    destroyRandomEnemy(p, filter) {
      let list = this.enemyMonsters(p);
      if (filter) list = list.filter(filter);
      if (!list.length) return null;
      const target = this.pick(list);
      this.destroyMonster(target, { battle: false, source: null });
      return target;
    }

    destroyWeakestEnemy(p) {
      const list = this.enemyMonsters(p);
      if (!list.length) return null;
      list.sort((a, b) => this.effectiveAtk(a) - this.effectiveAtk(b));
      const target = list[0];
      this.destroyMonster(target, { battle: false, source: null });
      return target;
    }

    weakenEnemy(p, atkDelta, defDelta) {
      for (const c of this.enemyMonsters(p)) {
        c.tempAtk += atkDelta || 0;
        c.tempDef += defDelta || 0;
      }
      this.log(`对方场上所有怪兽的攻击力${atkDelta >= 0 ? '+' : ''}${atkDelta || 0}、守备力${defDelta >= 0 ? '+' : ''}${defDelta || 0}。`, 'effect');
    }

    buffOwn(p, atkDelta, defDelta) {
      for (const c of this.monsters(p, { faceUp: true })) {
        c.tempAtk += atkDelta || 0;
        c.tempDef += defDelta || 0;
      }
    }

    acidCount(p) { return this.monsters(p, { faceUp: true }).filter(c => this.hasTag(c, '酸')).length; }
    baseCount(p) { return this.monsters(p, { faceUp: true }).filter(c => this.hasTag(c, '碱')).length; }
  }

  Duel.TAGS = TAGS;
  Duel.TAG_EN = TAG_EN;
  Duel.MAX_MONSTERS = MAX_MONSTERS;
  Duel.MAX_SPELLS = MAX_SPELLS;
  Duel.START_LP = START_LP;

  global.ChemDuel = Duel;
  global.ChemTags = TAGS;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Duel, TAGS, TAG_EN, makeCard, reqTributes, mulberry32, shuffle };
  }
})(typeof window !== 'undefined' ? window : globalThis);
