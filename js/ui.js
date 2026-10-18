/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  ui.js — 浏览器界面、交互与 AI 驱动
 * ========================================================================= */
(function () {
  'use strict';

  const CONTENT = window.ChemContent;
  const CARDS = CONTENT.cards;
  const DECKS = CONTENT.decks;
  const ORDER = CONTENT.deckOrder;
  const CHEMISTS = CONTENT.chemists;
  const CHEMIST_ORDER = CONTENT.chemistOrder;
  const Duel = window.ChemDuel;
  const AI = window.ChemAI;
  try {
    const v = CONTENT.validate();
    if (!v.ok) console.warn('[ChemContent] 内容校验失败：', v.errors);
  } catch (e) { console.warn('[ChemContent] 内容校验异常：', e.message); }

  const SPELL_LABEL = { normal: '通常魔法', equip: '装备魔法', continuous: '永续魔法', field: '场地魔法' };
  const TRAP_LABEL = { normal: '通常陷阱', continuous: '永续陷阱' };
  const PHASE_LABEL = { main: '主要阶段', battle: '战斗阶段', over: '决斗结束' };
  const TAG_GLYPH = { 酸: '🧪', 碱: '🧼', 盐: '🧂', 活泼金属: '⚙️', 水: '💧', 气: '☁️', 固: '💎' };
  const KIND_LABEL = { monster: '怪兽', fusion: '融合怪兽', spell: '魔法', trap: '陷阱' };

  const S = {
    game: null,
    playerDeck: 'acid',
    aiDeck: null,
    playerChemist: 'mendeleev',
    aiChemist: null,
    selected: null,
    pending: null,
    busy: false,
    modalType: null,
    poolKind: 'all',
    poolTag: '全部',
    poolSelected: null,
    poolBack: null,
    pileView: null,
    tribute: null,
    choice: null,
    gameOverShown: false,
    logSig: '',
    customDecks: {},
    builder: null,
    deleteDeckId: null
  };

  const CUSTOM_DECKS_KEY = 'chemistry-duel.custom-decks.v1';

  const $ = (sel) => document.querySelector(sel);

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function tagClass(tag) { return 'tag-' + tag; }

  function symbolFor(card) {
    if (card.kind === 'spell') {
      return card.spellType === 'equip' ? '🔗' : card.spellType === 'field' ? '🧭' : '📜';
    }
    if (card.kind === 'trap') return card.trapType === 'continuous' ? '🛡️' : '⚠️';
    return TAG_GLYPH[(card.tags && card.tags[0]) || '固'] || '⚗';
  }

  function cardTypeLabel(card) {
    if (card.kind === 'monster') return '效果怪兽';
    if (card.kind === 'fusion') return '融合怪兽';
    if (card.kind === 'spell') return SPELL_LABEL[card.spellType] || '魔法';
    return TRAP_LABEL[card.trapType] || '陷阱';
  }

  function cardHTML(card, opts) {
    opts = opts || {};
    if (!card) return '';
    const g = S.game;
    const faceDown = !!opts.faceDown;
    const tags = card.tags || [];
    const primary = tags[0] || '固';
    const kindClass = card.kind === 'fusion' ? 'card-fusion' :
      card.kind === 'spell' ? 'card-spell' :
        card.kind === 'trap' ? 'card-trap' : '';
    const isMonster = card.kind === 'monster' || card.kind === 'fusion';
    const selected = S.selected && S.selected.card && S.selected.card.uid === card.uid;

    if (faceDown) {
      return `<div class="card card-back ${kindClass}" title="${card.kind === 'monster' ? '盖放的怪兽' : '盖放的卡'}">
        <div class="back-logo">⚗</div>
        <div class="back-label">${card.kind === 'monster' ? 'SET' : 'TRAP'}</div>
      </div>`;
    }

    let atk = card.atk;
    let def = card.def;
    let atkClass = '';
    let defClass = '';
    if (opts.onField && g && isMonster) {
      atk = g.effectiveAtk(card);
      def = g.effectiveDef(card);
      if (atk > card.atk) atkClass = 'buffed';
      if (atk < card.atk) atkClass = 'debuffed';
      if (def > card.def) defClass = 'buffed';
      if (def < card.def) defClass = 'debuffed';
    }

    const level = isMonster && card.level
      ? `<div class="card-level">${'★'.repeat(clamp(card.level, 1, 8))}</div>` : '';
    const stats = isMonster
      ? `<div class="card-stats">
           <span class="atk ${atkClass}">ATK ${atk != null ? atk : '?'}</span>
           <span class="def ${defClass}">DEF ${def != null ? def : '?'}</span>
         </div>`
      : `<div class="card-type">${cardTypeLabel(card)}</div>`;
    const posBadge = opts.onField && isMonster
      ? `<span class="pos-badge ${card.position === 'attack' ? 'atk' : ''}">${card.faceUp ? (card.position === 'attack' ? 'ATK' : 'DEF') : 'SET'}</span>` : '';
    const equipDot = opts.onField && card.equips && card.equips.length ? '<span class="equip-dot" title="有装备魔法"></span>' : '';
    const fusionMark = card.kind === 'fusion' ? '<span class="fusion-mark">FUSION</span>' : '';
    const handAttr = opts.handIndex != null ? ` data-hand-index="${opts.handIndex}"` : '';
    const tagPills = tags.slice(0, 2).map(t => `<span class="tag-pill">${esc(t)}</span>`).join('');

    return `<div class="card ${kindClass} ${tagClass(primary)} ${opts.onField && card.position === 'defense' ? 'position-def' : ''} ${selected ? 'selected' : ''}" data-uid="${card.uid}"${handAttr} title="${esc(card.name)} ${esc(card.formula || '')}">
      ${fusionMark}${posBadge}${equipDot}
      <div class="card-head">
        <span class="card-name">${esc(card.name)}</span>
        <span class="card-formula">${esc(card.formula || '')}</span>
      </div>
      <div class="card-art">
        <span class="glyph">${symbolFor(card)}</span>
        <span class="ghost-formula">${esc(card.formula || '')}</span>
      </div>
      <div class="card-tags">${tagPills}</div>
      ${level}
      ${stats}
    </div>`;
  }

  /* ============================ 自定义卡组 ============================ */
  function newCustomDeckId() {
    return 'custom_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function sanitizeCustomDeck(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const main = [];
    const extra = [];
    const counts = {};
    for (const id of Array.isArray(raw.main) ? raw.main : []) {
      const c = CARDS[id];
      if (!c || c.kind === 'fusion') continue;
      if ((counts[id] || 0) >= 3) continue;
      if (main.length >= 40) break;
      counts[id] = (counts[id] || 0) + 1;
      main.push(id);
    }
    for (const id of Array.isArray(raw.extra) ? raw.extra : []) {
      const c = CARDS[id];
      if (!c || c.kind !== 'fusion') continue;
      if ((counts[id] || 0) >= 3) continue;
      if (extra.length >= 6) break;
      counts[id] = (counts[id] || 0) + 1;
      extra.push(id);
    }
    const id = typeof raw.id === 'string' && raw.id.startsWith('custom_') ? raw.id : newCustomDeckId();
    return {
      ...raw,
      id,
      name: String(raw.name || '未命名卡组').slice(0, 24),
      subtitle: raw.subtitle || 'CUSTOM DECK',
      icon: raw.icon || '🧪',
      color: raw.color || '#b6ff4a',
      style: raw.style || '自由构筑',
      tagline: raw.tagline || '自己选择每一种试剂。',
      desc: raw.desc || '自由构筑卡组。',
      main,
      extra,
      custom: true,
      updatedAt: Number(raw.updatedAt) || Date.now()
    };
  }

  function loadCustomDecks() {
    try {
      const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
      for (const item of list) {
        const d = sanitizeCustomDeck(item);
        if (d) S.customDecks[d.id] = d;
      }
    } catch (e) {
      console.warn('[DeckBuilder] 读取自定义卡组失败：', e.message);
    }
  }

  function saveCustomDecks() {
    try {
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(Object.values(S.customDecks)));
      return true;
    } catch (e) {
      console.warn('[DeckBuilder] 保存自定义卡组失败：', e.message);
      toast('浏览器无法写入本地存储，本次卡组只在当前页面有效。');
      return false;
    }
  }

  function deckById(id) {
    return S.customDecks[id] || DECKS[id] || null;
  }

  function customDeckIds() {
    return Object.keys(S.customDecks).sort((a, b) =>
      (S.customDecks[b].updatedAt || 0) - (S.customDecks[a].updatedAt || 0));
  }

  function isDeckLegal(deck) {
    if (!deck || !Array.isArray(deck.main) || !Array.isArray(deck.extra)) return false;
    if (deck.main.length !== 40) return false;
    if (deck.extra.length > 6) return false;
    const counts = {};
    for (const id of deck.main) {
      const c = CARDS[id];
      if (!c || c.kind === 'fusion') return false;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > 3) return false;
    }
    for (const id of deck.extra) {
      const c = CARDS[id];
      if (!c || c.kind !== 'fusion') return false;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > 3) return false;
    }
    return true;
  }

  function deckCountLabel(deck) {
    if (!deck) return '';
    return `${deck.main.length}/40 主卡组 · ${deck.extra.length}/6 额外`;
  }

  /* ============================ 开始界面 ============================ */
  function renderStart() {
    const grid = $('#deck-grid');
    if (!grid) return;
    const entries = [];
    for (const id of ORDER) {
      const d = DECKS[id];
      if (!d) continue;
      entries.push({ id, d, custom: false });
    }
    for (const id of customDeckIds()) {
      const d = S.customDecks[id];
      if (d) entries.push({ id, d, custom: true });
    }
    grid.innerHTML = entries.map(({ id, d, custom }) => {
      const selected = S.playerDeck === id;
      const legal = isDeckLegal(d);
      return `<article class="deck-card ${custom ? 'custom-deck' : ''} ${selected ? 'selected' : ''} ${legal ? '' : 'invalid'}" data-deck="${id}" style="--deck-color:${d.color || '#b6ff4a'}">
        <span class="selected-mark">✓</span>
        ${custom ? `<div class="deck-tools">
          <button class="deck-tool" data-edit-deck="${id}" title="编辑卡组">✎</button>
          <button class="deck-tool danger" data-delete-deck="${id}" title="删除卡组">×</button>
        </div>` : ''}
        <div class="deck-icon">${d.icon || '⚗'}</div>
        <div class="deck-sub">${esc(d.subtitle || '')}</div>
        <h3>${esc(d.name || id)}</h3>
        <p>${esc(d.tagline || '')}</p>
        <div class="deck-composition">
          <span class="${d.main.length === 40 ? '' : 'warn'}">主卡组 ${d.main.length}/40</span>
          <span class="${d.extra.length <= 6 ? '' : 'warn'}">额外 ${d.extra.length}/6</span>
          <span>${esc(d.style || '实验路线')}</span>
          ${legal ? '' : '<span class="warn">未完成</span>'}
        </div>
      </article>`;
    }).join('') + `<article class="deck-card new-deck-card" data-new-deck>
      <div class="deck-icon">＋</div>
      <div class="deck-sub">DECK BUILDER</div>
      <h3>新建卡组</h3>
      <p>自由选择 40 张主卡组与最多 6 张额外卡组。</p>
      <div class="deck-composition"><span>自由构筑</span><span>本地保存</span></div>
    </article>`;

    const cg = $('#chemist-grid');
    if (cg) {
      cg.innerHTML = CHEMIST_ORDER.map(id => {
        const c = CHEMISTS[id];
        if (!c) return '';
        const selected = S.playerChemist === id;
        const active = (c.actives && c.actives[0]) || null;
        return `<article class="chemist-card ${selected ? 'selected' : ''}" data-chemist="${id}" style="--chem-color:${c.color}">
          <span class="selected-mark">✓</span>
          <div class="chemist-head">
            <div class="chemist-icon">${c.icon}</div>
            <div class="chemist-title-wrap">
              <div class="chemist-sub">${esc(c.title)}</div>
              <h3>${esc(c.name)}</h3>
            </div>
          </div>
          <div class="chemist-skill">
            <span class="skill-kind passive">被动</span>
            <b>${esc(c.passive ? c.passive.name : '—')}</b>
            <p>${esc(c.passive ? c.passive.text : '')}</p>
          </div>
          <div class="chemist-skill active">
            <span class="skill-kind active">主动</span>
            <b>${esc(active ? active.name : '—')}</b>
            <p>${esc(active ? active.text : '')}</p>
          </div>
        </article>`;
      }).join('');
    }
    const btn = $('#start-btn');
    const selectedDeck = deckById(S.playerDeck);
    const legal = isDeckLegal(selectedDeck);
    if (btn) {
      btn.disabled = !selectedDeck || !legal || !S.playerChemist;
      btn.title = !selectedDeck ? '请选择卡组' : !legal ? '当前卡组未完成：需要 40 张主卡组，额外最多 6 张' : '';
    }
  }

  function pickAIDeck(playerDeck) {
    const options = ORDER.filter(x => x !== playerDeck);
    return options[Math.floor(Math.random() * options.length)] || ORDER[0];
  }

  function pickAIChemist(playerChemist) {
    const options = CHEMIST_ORDER.filter(x => x !== playerChemist);
    return options[Math.floor(Math.random() * options.length)] || CHEMIST_ORDER[0];
  }

  function startGame() {
    if (!S.playerDeck || !S.playerChemist) return;
    const aiDeck = ORDER.includes(S.aiDeck) && S.aiDeck !== S.playerDeck ? S.aiDeck : pickAIDeck(S.playerDeck);
    const aiChemistId = S.aiChemist && S.aiChemist !== S.playerChemist ? S.aiChemist : pickAIChemist(S.playerChemist);
    S.aiDeck = aiDeck;
    S.aiChemist = aiChemistId;
    const pd = deckById(S.playerDeck), ad = DECKS[aiDeck];
    const pc = CHEMISTS[S.playerChemist], ac = CHEMISTS[aiChemistId];
    if (!pd || !ad) { toast('卡组数据缺失。'); return; }
    if (!isDeckLegal(pd)) { toast('当前卡组未完成：需要 40 张主卡组，额外最多 6 张。'); return; }
    if (!pc || !ac) { toast('化学家数据缺失。'); return; }
    const seed = (Date.now() + Math.floor(Math.random() * 100000)) % 2147483647;
    S.game = new Duel({
      cards: CARDS,
      decks: { 0: pd.main, 1: ad.main },
      extras: { 0: pd.extra, 1: ad.extra },
      names: { 0: '你', 1: '对手' },
      chemists: { 0: pc, 1: ac },
      first: 0,
      seed
    });
    S.game.deckLabels = { 0: pd.name, 1: ad.name };
    S.game.log(`你的卡组：${pd.name}；对手卡组：${ad.name}。`, 'sys');
    S.selected = null;
    S.pending = null;
    S.busy = false;
    S.gameOverShown = false;
    S.modalType = null;
    S.pileView = null;
    S.logSig = '';
    document.body.classList.remove('has-selection');
    $('#start').classList.add('hidden');
    $('#game').classList.remove('hidden');
    closeModal();
    render();
    setTimeout(() => toast(`你的回合 · 对手：${ac.name} / ${ad.name}`), 250);
  }

  function returnToStart() {
    S.game = null;
    S.selected = null;
    S.pending = null;
    S.busy = false;
    S.modalType = null;
    S.pileView = null;
    S.gameOverShown = false;
    closeModal();
    document.body.classList.remove('has-selection');
    $('#game').classList.add('hidden');
    $('#start').classList.remove('hidden');
    renderStart();
  }

  /* ============================ 渲染 ============================ */
  function isTargetable(card) {
    return !!(S.pending && S.pending.type === 'spell' && card && S.pending.targets.includes(card));
  }

  function isAttackable(side, card) {
    return !!(S.pending && S.pending.type === 'attack' && side === 'opponent' && card);
  }

  function hudHTML(side) {
    const g = S.game;
    const p = side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const chem = g.chemistOf(p);
    const deckLabel = g.deckLabels ? g.deckLabels[p] : '';
    const shownLp = Math.max(0, pl.lp);
    const pct = clamp(shownLp / 8000 * 100, 0, 100);
    const low = shownLp <= 2000 ? 'low' : '';
    const cls = side === 'player' ? 'player' : 'opp';
    const id = side === 'player' ? 'player-hud' : 'opp-hud';
    return `<div class="hud ${cls}" id="${id}">
      <div class="avatar" title="${esc(chem ? chem.title : '')}">${chem ? chem.icon : (side === 'player' ? '🧑‍🔬' : '☣️')}</div>
      <div class="identity">
        <div class="name-line">
          <span class="name" title="${esc(deckLabel)}">${esc(g.nameOf(p))}</span>
          ${chem ? `<span class="chemist-chip" title="${esc(chem.quote || '')}">${chem.icon} ${esc(chem.name)}</span>` : ''}
          <span class="lp-number">${shownLp} LP</span>
        </div>
        <div class="lp-bar"><div class="lp-fill ${low}" style="width:${pct}%"></div></div>
      </div>
      <div class="piles">
        <div class="pile"><b>${pl.hand.length}</b><span>手牌</span></div>
        <div class="pile clickable" data-side="${side}" data-pile="deck"><b>${pl.deck.length}</b><span>卡组</span></div>
        <div class="pile clickable" data-side="${side}" data-pile="gy"><b>${pl.gy.length}</b><span>墓地</span></div>
        <div class="pile clickable" data-side="${side}" data-pile="extra"><b>${pl.extra.length}</b><span>额外</span></div>
      </div>
    </div>`;
  }

  function zoneHTML(side, kind, z) {
    const g = S.game;
    const p = side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const card = kind === 'monster' ? pl.monsters[z] : pl.spells[z];
    const classes = ['zone'];
    if (card) classes.push('occupied');
    if (side === 'player') classes.push('player-zone');
    if (card && isTargetable(card)) classes.push('targetable');
    if (card && isAttackable(side, card)) classes.push('attackable');
    let inner = '';
    if (card) {
      const faceDown = !card.faceUp;
      inner = cardHTML(card, { onField: true, faceDown });
    }
    return `<div class="${classes.join(' ')}" data-side="${side}" data-kind="${kind}" data-z="${z}">${inner}</div>`;
  }

  function boardHTML(side) {
    const g = S.game;
    const p = side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const card = pl.field;
    const fieldClasses = ['field-slot'];
    if (card) fieldClasses.push('occupied');
    if (side === 'player') fieldClasses.push('player-zone');
    if (card && isTargetable(card)) fieldClasses.push('targetable');
    const fieldInner = card
      ? cardHTML(card, { onField: true, faceDown: !card.faceUp })
      : '<div class="slot-label">场地</div>';
    return `<div class="board-inner">
      <div class="${fieldClasses.join(' ')}" data-side="${side}" data-kind="field" data-z="field">${fieldInner}</div>
      <div class="zone-rows">
        <div class="zone-row">${[0, 1, 2, 3, 4].map(z => zoneHTML(side, 'monster', z)).join('')}</div>
        <div class="zone-row">${[0, 1, 2, 3, 4].map(z => zoneHTML(side, 'spell', z)).join('')}</div>
      </div>
    </div>`;
  }

  function handHTML() {
    if (!S.game) return '';
    const pl = S.game.players[0];
    if (!pl.hand.length) return '<div class="hand-empty">手牌为空 · 结束回合让对手行动</div>';
    return pl.hand.map((c, i) => cardHTML(c, { handIndex: i })).join('');
  }

  function turnbarHTML() {
    const g = S.game;
    const fusionCount = g.active === 0 && g.phase === 'main' && !S.busy ? g.availableFusions(0).length : 0;
    const myTurn = g.active === 0 && !S.busy && g.winner === null;
    const canBattle = myTurn && g.phase === 'main' && g.turn > 1;
    const endDisabled = !myTurn || g.phase === 'over';
    const chem = g.chemistOf(0);
    const skills = chem ? g.activeSkills(0) : [];
    const usableSkills = skills.filter(s => g.canActivateSkill(0, s).ok).length;
    const skillBtn = chem && skills.length
      ? `<button class="btn btn-tiny btn-skill" data-action="skills" ${myTurn ? '' : 'disabled'} title="化学家技能">${chem.icon} 技能${usableSkills ? ` ${usableSkills}` : ''}</button>`
      : '';
    const chips = [];
    chips.push('<span class="reaction-chip hot">腐蚀 +800</span>');
    const all = [...g.monsters(0, { faceUp: true }), ...g.monsters(1, { faceUp: true })];
    if (all.some(c => g.hasTag(c, '酸')) && all.some(c => g.hasTag(c, '碱'))) {
      chips.push('<span class="reaction-chip hot">中和反应</span>');
    }
    if (all.some(c => g.hasTag(c, '水'))) chips.push('<span class="reaction-chip">溶剂化 +300</span>');
    chips.push('<span class="reaction-chip">陷阱自动触发</span>');

    return `<div class="turn-left">
      <span class="turn-num">TURN ${String(g.turn).padStart(2, '0')}</span>
      <span class="turn-phase">${PHASE_LABEL[g.phase] || g.phase}</span>
      <span class="turn-owner">${g.winner !== null ? '决斗结束' : g.active === 0 ? '你的行动' : '对手行动中…'}</span>
      <div class="reaction-chips">${chips.join('')}</div>
    </div>
    <div class="turn-actions">
      ${S.pending ? '<button class="btn btn-ghost btn-tiny" data-action="cancel">取消选择</button>' : ''}
      ${skillBtn}
      <button class="btn btn-tiny" data-action="battle" ${canBattle ? '' : 'disabled'} title="${g.turn <= 1 ? '先攻首回合不能攻击' : '进入战斗阶段'}">战斗阶段</button>
      <button class="btn btn-tiny btn-primary" data-action="fusion" ${myTurn && g.phase === 'main' && fusionCount > 0 ? '' : 'disabled'}>融合召唤 ${fusionCount > 0 ? `(${fusionCount})` : ''}</button>
      <button class="btn btn-tiny" data-action="end" ${endDisabled ? 'disabled' : ''}>结束回合</button>
    </div>`;
  }

  function detailActions(card, sel) {
    if (!S.game || S.busy || S.game.winner !== null) {
      return '<div class="detail-note">对手行动中，暂时无法操作。</div>';
    }
    if (S.game.active !== 0) {
      return '<div class="detail-note">现在是对手的回合。你可以点击卡牌查看信息。</div>';
    }
    const g = S.game;
    const p = 0;

    if (sel.type === 'hand') {
      if (card.kind === 'monster') {
        const info = g.canNormalSummon(p, card);
        const need = info.need || 0;
        return `<div class="btn-row">
          <button class="btn btn-primary" data-action="summon" ${info.ok ? '' : 'disabled'} title="${esc(info.reason || '')}">通常召唤${need ? `（${need} 祭品）` : ''}</button>
          <button class="btn" data-action="set-monster" ${info.ok ? '' : 'disabled'} title="${esc(info.reason || '')}">盖放</button>
        </div>${info.ok ? '' : `<div class="detail-note">${esc(info.reason)}</div>`}`;
      }
      if (card.kind === 'spell') {
        const info = g.canActivateSpell(p, card);
        return `<div class="btn-row">
          <button class="btn btn-primary" data-action="activate" ${info.ok ? '' : 'disabled'} title="${esc(info.reason || '')}">发动</button>
        </div>${info.ok ? '' : `<div class="detail-note">${esc(info.reason)}</div>`}`;
      }
      if (card.kind === 'trap') {
        const ok = g.active === p && g.phase === 'main' && g.freeSpellZones(p).length > 0 && !S.busy;
        return `<div class="btn-row">
          <button class="btn btn-primary" data-action="set-trap" ${ok ? '' : 'disabled'}>盖放陷阱</button>
        </div><div class="detail-note">陷阱盖放后，在满足条件时自动发动。</div>`;
      }
    }

    if (sel.type === 'monster' && sel.p === 0) {
      const attackInfo = g.canAttack(0, sel.z);
      const canChange = g.active === 0 && g.phase === 'main' && !card.positionChanged && !(card.faceUp === false && card.summonedTurn === g.turn);
      return `<div class="btn-row">
        <button class="btn btn-primary" data-action="attack" ${attackInfo.ok ? '' : 'disabled'} title="${esc(attackInfo.reason || '')}">攻击</button>
        <button class="btn" data-action="change" ${canChange ? '' : 'disabled'}>${card.faceUp ? '改变表示' : '翻转召唤'}</button>
      </div>${attackInfo.ok ? '' : `<div class="detail-note">${esc(attackInfo.reason)}</div>`}`;
    }

    if (sel.type === 'spell' && sel.p === 0) {
      if (card.kind === 'trap') {
        return `<div class="detail-note">${card.faceUp ? '永续陷阱正在生效。' : '盖放中 · 满足条件时自动发动。'}</div>`;
      }
      if (card.kind === 'spell' && card.spellType === 'equip') {
        return `<div class="detail-note">装备于：${esc(card.equipTarget ? card.equipTarget.name : '已离场')}</div>`;
      }
      return '<div class="detail-note">此卡正在持续生效。</div>';
    }

    return '';
  }

  function detailHTML() {
    if (!S.game) return '';
    const g = S.game;
    const sel = S.selected;
    if (!sel || !sel.card) {
      return `<div class="detail-empty">
        <b>${g.active === 0 ? '轮到你了。' : '对手正在行动。'}</b><br>
        点击手牌查看召唤 / 发动选项；点击场上怪兽查看攻击与表示形式。<br><br>
        <span style="color:#7f9588">按「融合召唤」可查看当前可用的反应融合。</span>
      </div>`;
    }
    const card = sel.card;
    const onField = sel.type === 'monster' || sel.type === 'spell' || sel.type === 'field';
    if (onField && !card.faceUp) {
      return `<div class="detail-head"><div><div class="detail-name">盖放的卡</div><div class="detail-formula">SET</div></div></div>
        <div class="detail-text">${card.kind === 'monster' ? '盖放的怪兽。攻击时翻开并计算守备力。' : card.kind === 'trap' ? '盖放的陷阱。满足条件时会自动发动。' : '盖放的魔法。'}</div>
        ${detailActions(card, sel)}`;
    }

    const tags = (card.tags || []).map(t => `<span class="tag-pill ${tagClass(t)}">${esc(t)}</span>`).join('');
    const isMonster = card.kind === 'monster' || card.kind === 'fusion';
    const atk = onField && isMonster ? g.effectiveAtk(card) : card.atk;
    const def = onField && isMonster ? g.effectiveDef(card) : card.def;
    const atkMark = onField && isMonster && atk !== card.atk ? (atk > card.atk ? ' ↑' : ' ↓') : '';
    const defMark = onField && isMonster && def !== card.def ? (def > card.def ? ' ↑' : ' ↓') : '';
    const kinds = `${KIND_LABEL[card.kind] || ''}${isMonster ? ` · Lv.${card.level}` : ' · ' + cardTypeLabel(card)}`;

    let extra = '';
    if (card.kind === 'fusion' && card.materials) {
      const mats = card.materials.map(m => `<span class="material-chip"><b>${esc(m.tag)}</b> ×${m.count || 1}</span>`).join('');
      extra += `<div class="detail-section-label">融合素材</div><div class="material-list">${mats}</div>`;
    }
    if (sel.type === 'monster' && sel.p === 0) {
      const pos = card.faceUp ? (card.position === 'attack' ? '攻击表示' : '守备表示') : '盖放';
      extra += `<div class="detail-section-label">场上状态</div><div class="detail-note">${pos}${card.equips.length ? ` · 装备 ${card.equips.length} 张` : ''}${card.hasAttacked ? ' · 已攻击' : ''}</div>`;
    }
    if (sel.type === 'hand') {
      const info = card.kind === 'monster' ? g.canNormalSummon(0, card) : card.kind === 'spell' ? g.canActivateSpell(0, card) : null;
      if (info && info.ok && g.active === 0) extra += `<div class="detail-hint">可进行操作：${card.kind === 'monster' ? `通常召唤${info.need ? `（需 ${info.need} 祭品）` : ''}` : '发动魔法'}。</div>`;
    }

    return `<div class="detail-head">
      <div><div class="detail-name">${esc(card.name)}</div><div class="detail-formula">${esc(card.formula || '')}</div></div>
      <div class="detail-kind">${esc(kinds)}</div>
    </div>
    <div class="detail-tags">${tags}</div>
    ${isMonster ? `<div class="detail-stats">
      <div class="stat-box atk"><span>ATK / 反应活性</span><b>${atk != null ? atk : '?'}${atkMark}</b></div>
      <div class="stat-box def"><span>DEF / 化学稳定性</span><b>${def != null ? def : '?'}${defMark}</b></div>
    </div>` : ''}
    ${card.rarity ? `<div class="detail-note">${esc(card.rarity)}</div>` : ''}
    <div class="detail-text">${esc(card.text || '')}</div>
    ${extra}
    ${detailActions(card, sel)}`;
  }

  function logHTML() {
    if (!S.game) return '';
    return S.game.logs.slice(-120).map(l =>
      `<div class="log-entry ${esc(l.cls || '')}">${esc(l.text)}</div>`
    ).join('');
  }

  function renderLog() {
    if (!S.game) return;
    const sig = `${S.game.logs.length}:${S.game.turn}:${S.game.winner}`;
    if (sig === S.logSig) return;
    S.logSig = sig;
    const el = $('#log');
    if (!el) return;
    el.innerHTML = logHTML();
    el.scrollTop = el.scrollHeight;
  }

  function render() {
    if (!S.game) return;
    const g = S.game;
    const hudO = $('#opp-hud'), hudP = $('#player-hud');
    if (hudO) hudO.outerHTML = hudHTML('opponent');
    if (hudP) hudP.outerHTML = hudHTML('player');
    const bo = $('#opp-board'), bp = $('#player-board');
    if (bo) bo.innerHTML = boardHTML('opponent');
    if (bp) bp.innerHTML = boardHTML('player');
    const tb = $('#turnbar');
    if (tb) tb.innerHTML = turnbarHTML();
    const hand = $('#player-hand');
    if (hand) hand.innerHTML = handHTML();
    const detail = $('#detail');
    if (detail) detail.innerHTML = detailHTML();
    const badge = $('#detail-badge');
    if (badge) {
      badge.textContent = S.selected ? (S.selected.type === 'hand' ? '手牌' : '场上') : '';
    }
    const status = $('#match-status');
    if (status) status.textContent = `第 ${g.turn} 回合 · ${g.active === 0 ? '你的回合' : '对手回合'}`;
    document.body.classList.toggle('has-selection', !!S.selected);
    renderLog();
  }

  /* ============================ 交互动作 ============================ */
  function toast(msg) {
    const t = $('#toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function finishAction() {
    S.pending = null;
    render();
    checkGameOver();
  }

  function selectedHandCard() {
    if (S.selected && S.selected.type === 'hand') return S.selected.card;
    return null;
  }

  function doSummon(set) {
    const g = S.game;
    if (!g || S.busy) return;
    const card = selectedHandCard();
    if (!card) return;
    const info = g.canNormalSummon(0, card);
    if (!info.ok) { toast(info.reason); return; }
    const idx = g.players[0].hand.indexOf(card);
    if (idx < 0) return;
    if (info.need > 0) {
      openTributeModal(card, set);
      return;
    }
    const r = g.normalSummon(0, idx, { set });
    if (!r.ok) { toast(r.reason); return; }
    S.selected = null;
    finishAction();
  }

  function doSetTrap() {
    const g = S.game;
    if (!g || S.busy) return;
    const card = selectedHandCard();
    if (!card) return;
    const idx = g.players[0].hand.indexOf(card);
    const r = g.setTrap(0, idx);
    if (!r.ok) { toast(r.reason); return; }
    S.selected = null;
    finishAction();
  }

  function doActivate() {
    const g = S.game;
    if (!g || S.busy) return;
    const card = selectedHandCard();
    if (!card) return;
    const info = g.canActivateSpell(0, card);
    if (!info.ok) { toast(info.reason); return; }
    if (!card.target) {
      const idx = g.players[0].hand.indexOf(card);
      const r = g.activateSpell(0, idx);
      if (!r.ok) { toast(r.reason); return; }
      S.selected = null;
      finishAction();
      return;
    }
    if (card.target === 'deckSalt' || card.target === 'gySalt') {
      openChoiceModal(card);
      return;
    }
    const targets = g.validSpellTargets(0, card);
    if (!targets.length) { toast('没有合法的对象。'); return; }
    S.pending = { type: 'spell', card, targets };
    S.selected = null;
    render();
    toast('请点击高亮的目标。');
  }

  function doAttack() {
    const g = S.game;
    if (!g || S.busy) return;
    if (!S.selected || S.selected.type !== 'monster') return;
    const z = S.selected.z;
    const info = g.canAttack(0, z);
    if (!info.ok) { toast(info.reason); return; }
    if (g.countMonsters(1) === 0) {
      const r = g.attack(0, z, null);
      if (!r.ok) toast(r.reason);
      S.selected = null;
      finishAction();
      return;
    }
    S.pending = { type: 'attack', zone: z };
    S.selected = null;
    render();
    toast('选择攻击目标。');
  }

  function doChange() {
    const g = S.game;
    if (!g || S.busy || !S.selected || S.selected.type !== 'monster') return;
    const r = g.changePosition(0, S.selected.z);
    if (!r.ok) { toast(r.reason); return; }
    render();
  }

  function executeAttack(zone, targetZone) {
    const g = S.game;
    const r = g.attack(0, zone, targetZone);
    S.pending = null;
    S.selected = null;
    if (!r.ok) toast(r.reason);
    finishAction();
  }

  function executeSpell(card, target) {
    const g = S.game;
    const idx = g.players[0].hand.indexOf(card);
    if (idx < 0) { toast('此卡已不在手牌。'); S.pending = null; render(); return; }
    const r = g.activateSpell(0, idx, target);
    S.pending = null;
    S.selected = null;
    closeModal();
    if (!r.ok) toast(r.reason);
    finishAction();
  }

  function handleHandClick(index) {
    if (!S.game || S.busy) return;
    const card = S.game.players[0].hand[index];
    if (!card) return;
    S.pending = null;
    S.selected = { type: 'hand', card };
    render();
  }

  function handleZoneClick(side, kind, z) {
    const g = S.game;
    if (!g || S.busy) return;
    const p = side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const card = kind === 'monster' ? pl.monsters[z] : kind === 'spell' ? pl.spells[z] : pl.field;

    if (S.pending && S.pending.type === 'attack') {
      if (side === 'opponent' && kind === 'monster' && card) executeAttack(S.pending.zone, z);
      else toast('请选择对方场上的怪兽作为攻击目标，或点击取消。');
      return;
    }
    if (S.pending && S.pending.type === 'spell') {
      if (card && S.pending.targets.includes(card)) executeSpell(S.pending.card, card);
      else toast('请选择高亮的合法目标，或点击取消。');
      return;
    }
    if (!card) { S.selected = null; render(); return; }
    S.selected = { type: kind === 'monster' ? 'monster' : kind === 'spell' ? 'spell' : 'field', p, z, card };
    render();
  }

  function handleAction(action) {
    if (!action) return;
    if (action === 'cancel') { S.pending = null; S.selected = null; if (S.modalType === 'tribute' || S.modalType === 'fusion' || S.modalType === 'choice') closeModal(); render(); return; }
    if (action === 'close-detail') { S.selected = null; S.pending = null; render(); return; }
    if (action === 'battle') { S.pending = null; S.game.toBattlePhase(0); S.selected = null; S.pending = null; render(); return; }
    if (action === 'end') { endPlayerTurn(); return; }
    if (action === 'fusion') { openFusionModal(); return; }
    if (action === 'skills') { openSkillModal(); return; }
    if (action === 'summon') { doSummon(false); return; }
    if (action === 'set-monster') { doSummon(true); return; }
    if (action === 'activate') { doActivate(); return; }
    if (action === 'set-trap') { doSetTrap(); return; }
    if (action === 'attack') { doAttack(); return; }
    if (action === 'change') { doChange(); return; }
  }

  function endPlayerTurn() {
    const g = S.game;
    if (!g || S.busy || g.winner !== null || g.active !== 0) return;
    S.selected = null;
    S.pending = null;
    const ok = g.endTurn(0);
    if (!ok) { toast('现在不能结束回合。'); return; }
    render();
    if (checkGameOver()) return;
    runAI();
  }

  async function runAI() {
    const g = S.game;
    if (!g || g.winner !== null) return;
    S.busy = true;
    S.selected = null;
    S.pending = null;
    render();
    try {
      await AI.takeTurn(g, 1, {
        delay: 420,
        speed: 0.72,
        render: () => { if (S.game === g) render(); }
      });
    } catch (e) {
      console.error(e);
      toast('对手行动出现异常：' + e.message);
      try {
        if (S.game === g && g.winner === null && g.active === 1) g.endTurn(1);
      } catch (_) { }
    }
    if (S.game !== g) return;
    S.busy = false;
    if (g.winner === null && g.active === 1) {
      // 防御性兜底：AI 若因异常未结束回合，则强制交还
      try { g.endTurn(1); } catch (_) { }
    }
    render();
    checkGameOver();
    if (S.game && S.game.winner === null && S.game.active === 0) {
      toast('你的回合');
    }
  }

  /* ============================ 卡组构筑 ============================ */
  function openDeckBuilder(deckId) {
    const base = deckId ? S.customDecks[deckId] : null;
    S.builder = {
      id: base ? base.id : newCustomDeckId(),
      name: base ? base.name : '新卡组',
      main: base ? base.main.slice() : [],
      extra: base ? base.extra.slice() : [],
      kind: 'all',
      tag: '全部',
      editing: !!base
    };
    S.pending = null;
    S.selected = null;
    render();
    openModal('builder');
  }

  function builderPoolCards() {
    const b = S.builder;
    if (!b) return [];
    let list = Object.values(CARDS);
    if (b.kind !== 'all') {
      list = b.kind === 'fusion' ? list.filter(c => c.kind === 'fusion') : list.filter(c => c.kind === b.kind);
    }
    if (b.tag !== '全部') list = list.filter(c => (c.tags || []).includes(b.tag));
    return list;
  }

  function builderGroups(ids) {
    const map = new Map();
    for (const id of ids) map.set(id, (map.get(id) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => String(CARDS[a[0]].name).localeCompare(String(CARDS[b[0]].name), 'zh'));
  }

  function builderRows(ids) {
    const rows = builderGroups(ids);
    if (!rows.length) return '<div class="builder-empty">还没有卡牌，点击左侧卡池加入。</div>';
    return rows.map(([id, n]) => {
      const c = CARDS[id];
      return `<div class="builder-row">
        <div class="builder-row-name"><span class="builder-x">${n}×</span> ${esc(c.name)}</div>
        <div class="builder-row-actions">
          <button class="builder-mini" data-builder-remove="${id}" title="移除 1 张">−</button>
          <button class="builder-mini" data-builder-add="${id}" title="再放 1 张">＋</button>
        </div>
      </div>`;
    }).join('');
  }

  function builderModalHTML() {
    const b = S.builder;
    if (!b) return '';
    const pool = builderPoolCards();
    const counts = {};
    for (const id of [...b.main, ...b.extra]) counts[id] = (counts[id] || 0) + 1;
    const legal = isDeckLegal(b);
    const kinds = [['all', '全部'], ['monster', '怪兽'], ['spell', '魔法'], ['trap', '陷阱'], ['fusion', '融合']];
    const tags = ['全部', '酸', '碱', '盐', '活泼金属', '水', '气', '固'];
    const deckStatus = legal ? '<span class="ok">卡组合法</span>' : '<span class="warn">尚未完成</span>';

    const body = `<div class="builder">
      <div class="builder-pool">
        <div class="builder-topline">
          <label class="builder-name-label">卡组名称
            <input id="builder-name" class="builder-name" maxlength="24" value="${esc(b.name)}" placeholder="输入卡组名称">
          </label>
          <span class="builder-deck-status">${deckStatus}</span>
        </div>
        <div class="pool-filters builder-filters">
          ${kinds.map(([k, label]) => `<button class="filter-btn ${b.kind === k ? 'active' : ''}" data-builder-kind="${k}">${label}</button>`).join('')}
          <span style="width:1px;height:18px;background:rgba(255,255,255,.1);margin:0 3px;align-self:center"></span>
          ${tags.map(t => `<button class="filter-btn ${b.tag === t ? 'active' : ''}" data-builder-tag="${t}">${t}</button>`).join('')}
        </div>
        <div class="builder-pool-count">${pool.length} 张可加入 · 点击卡牌加入卡组</div>
        <div class="builder-grid">
          ${pool.map(c => `<div class="builder-card" data-builder-add="${c.id}" title="加入 ${esc(c.name)}">
            ${cardHTML(c, {})}
            <span class="builder-plus">＋</span>
            ${counts[c.id] ? `<span class="builder-owned">×${counts[c.id]}</span>` : ''}
          </div>`).join('')}
        </div>
      </div>
      <aside class="builder-deck">
        <div class="builder-deck-head">
          <div><b>主卡组</b><span class="${b.main.length === 40 ? 'ok' : 'warn'}">${b.main.length}/40</span></div>
          <button class="builder-clear" data-builder-clear="main">清空</button>
        </div>
        <div class="builder-list">${builderRows(b.main)}</div>
        <div class="builder-deck-head extra-head">
          <div><b>额外卡组</b><span class="${b.extra.length <= 6 ? 'ok' : 'warn'}">${b.extra.length}/6</span></div>
          <button class="builder-clear" data-builder-clear="extra">清空</button>
        </div>
        <div class="builder-list extra-list">${builderRows(b.extra)}</div>
        <div class="builder-note">主卡组必须正好 40 张；额外卡组 0–6 张；同名卡最多 3 张。融合怪兽只能放入额外卡组。</div>
        <div class="builder-actions">
          <button class="btn" data-modal-action="builder-cancel">取消</button>
          <button class="btn ${legal ? 'btn-primary' : ''}" data-modal-action="builder-save" ${legal ? '' : 'disabled'}>保存卡组</button>
        </div>
      </aside>
    </div>`;
    return baseModal('卡组构筑', '自由选择卡牌；保存后可在标题界面直接使用。', body, '', { wide: true });
  }

  function rerenderBuilder() {
    const pool = document.querySelector('.builder-grid');
    const deck = document.querySelector('.builder-deck');
    const poolTop = pool ? pool.scrollTop : 0;
    const deckTop = deck ? deck.scrollTop : 0;
    renderModal();
    const pool2 = document.querySelector('.builder-grid');
    const deck2 = document.querySelector('.builder-deck');
    if (pool2) pool2.scrollTop = poolTop;
    if (deck2) deck2.scrollTop = deckTop;
    const name = document.getElementById('builder-name');
    if (name && S.builder) name.value = S.builder.name;
  }

  function builderAdd(id) {
    const b = S.builder;
    const c = CARDS[id];
    if (!b || !c) return;
    const fusion = c.kind === 'fusion';
    const target = fusion ? b.extra : b.main;
    const total = [...b.main, ...b.extra].filter(x => x === id).length;
    if (total >= 3) { toast('同名卡最多放入 3 张。'); return; }
    if (fusion && b.extra.length >= 6) { toast('额外卡组最多 6 张。'); return; }
    if (!fusion && b.main.length >= 40) { toast('主卡组已满 40 张。'); return; }
    target.push(id);
    rerenderBuilder();
  }

  function builderRemove(id) {
    const b = S.builder;
    if (!b) return;
    const arr = b.main.includes(id) ? b.main : b.extra;
    const i = arr.lastIndexOf(id);
    if (i >= 0) arr.splice(i, 1);
    rerenderBuilder();
  }

  function builderClear(section) {
    if (!S.builder) return;
    if (section === 'main') S.builder.main = [];
    if (section === 'extra') S.builder.extra = [];
    renderModal();
  }

  function saveBuilderDeck() {
    const b = S.builder;
    if (!b) return;
    const name = String(b.name || '').trim();
    if (!name) { toast('请给卡组起一个名字。'); return; }
    if (!isDeckLegal(b)) {
      toast(`卡组尚未完成：主卡组 ${b.main.length}/40，额外 ${b.extra.length}/6。`);
      return;
    }
    const deck = sanitizeCustomDeck({ ...b, name, updatedAt: Date.now(), custom: true });
    S.customDecks[deck.id] = deck;
    saveCustomDecks();
    S.playerDeck = deck.id;
    S.builder = null;
    closeModal();
    renderStart();
    toast(`卡组「${deck.name}」已保存。`);
  }

  function openDeleteDeck(deckId) {
    if (!S.customDecks[deckId]) return;
    S.deleteDeckId = deckId;
    openModal('delete-deck');
  }

  function deleteDeckModalHTML() {
    const d = S.customDecks[S.deleteDeckId];
    if (!d) return '';
    return baseModal('删除卡组', '此操作无法撤销。',
      `<div class="modal-section"><p>确定删除自定义卡组 <b>${esc(d.name)}</b> 吗？</p></div>`,
      `<button class="btn" data-modal-action="close">取消</button>
       <button class="btn btn-danger" data-modal-action="confirm-delete-deck">删除</button>`,
      { narrow: true });
  }

  /* ============================ 弹窗 ============================ */
  function closeModal() {
    S.modalType = null;
    S.tribute = null;
    S.choice = null;
    S.pileView = null;
    S.builder = null;
    S.deleteDeckId = null;
    const m = $('#modal');
    if (m) { m.classList.remove('open'); m.innerHTML = ''; }
  }

  function openModal(type) {
    S.modalType = type;
    renderModal();
  }

  function baseModal(title, sub, body, actions, opts) {
    opts = opts || {};
    return `<div class="modal-backdrop" data-close-modal></div>
      <div class="modal-box ${opts.narrow ? 'narrow' : opts.wide ? 'wide' : ''}">
        <div class="modal-head">
          <div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>
          <button class="modal-close" data-close-modal>×</button>
        </div>
        ${body}
        ${actions ? `<div class="modal-actions">${actions}</div>` : ''}
      </div>`;
  }

  function renderModal() {
    const m = $('#modal');
    if (!m) return;
    if (!S.modalType) { m.classList.remove('open'); m.innerHTML = ''; return; }
    let html = '';
    if (S.modalType === 'rules') html = rulesModalHTML();
    else if (S.modalType === 'pool') html = poolModalHTML();
    else if (S.modalType === 'tribute') html = tributeModalHTML();
    else if (S.modalType === 'fusion') html = fusionModalHTML();
    else if (S.modalType === 'choice') html = choiceModalHTML();
    else if (S.modalType === 'pile') html = pileModalHTML();
    else if (S.modalType === 'skills') html = skillModalHTML();
    else if (S.modalType === 'builder') html = builderModalHTML();
    else if (S.modalType === 'delete-deck') html = deleteDeckModalHTML();
    else if (S.modalType === 'restart') html = restartModalHTML();
    else if (S.modalType === 'gameover') html = gameoverModalHTML();
    m.innerHTML = html;
    m.classList.add('open');
  }

  function rulesModalHTML() {
    const body = `<div class="rules">
      <div class="modal-section">
        <h3>胜利条件</h3>
        <ul>
          <li>双方初始 <b>8000 LP</b>。将对方 LP 降至 0，或让对方卡组耗尽无法抽卡，即可获胜。</li>
          <li>场上各有 <b>5 个怪兽区</b>、<b>5 个魔法／陷阱区</b>、1 个场地魔法区，以及 6 张额外卡组。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>回合流程</h3>
        <ul>
          <li><b>抽卡</b>：回合开始时抽 2 张（先攻第 1 回合不抽）。</li>
          <li><b>主要阶段</b>：通常召唤／盖放 1 次、发动魔法、盖放陷阱、融合召唤 1 次、改变表示形式。</li>
          <li><b>战斗阶段</b>：每只表侧攻击表示怪兽可攻击 1 次。先攻第 1 回合不能攻击。</li>
          <li><b>结束阶段</b>：处理结束阶段效果，然后交给对手。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>召唤与表示形式</h3>
        <ul>
          <li>Lv.1–4 可直接通常召唤；<b>Lv.5–6 需要 1 只祭品</b>；<b>Lv.7–8 需要 2 只祭品</b>。</li>
          <li>盖放怪兽算作当回合的通常召唤，守备表示且背面朝上；被攻击时翻开。</li>
          <li>每只怪兽每回合可以改变 1 次表示形式。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>自由构筑</h3>
        <ul>
          <li>标题界面点击「新建卡组」进入构筑器：主卡组必须正好 40 张，额外卡组 0–6 张，同名卡最多 3 张。</li>
          <li>融合怪兽只能放入额外卡组；自定义卡组保存在浏览器本地，可编辑或删除。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>融合召唤 · 化学反应</h3>
        <ul>
          <li>每回合 1 次，不需要「融合」魔法卡。把满足<b>标签素材</b>的怪兽从手牌／场上送入墓地，从额外卡组特殊召唤融合怪兽。</li>
          <li>示例：「酸」+「碱」→ <b>中和产物·氯化钠</b>；「盐」×2 → <b>重晶石·硫酸钡</b>；「气」×2 → <b>氢氧爆鸣·水</b>。</li>
          <li>融合素材只看化学标签，不看具体卡名；一只双标签怪兽（如氢氧化铝）可以充当其中一种素材。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>战斗与化学标签</h3>
        <ul>
          <li>攻击表示对攻击表示：攻击力低的一方被破坏，差值成为战斗伤害；相等则双方破坏。</li>
          <li>攻击守备表示：攻击力高于守备力则破坏，通常不造成伤害；低于守备力则攻击方受到差值反伤。</li>
          <li>对方场上没有怪兽时可以直接攻击。</li>
          <li><b>腐蚀</b>：「酸」怪兽攻击「活泼金属」怪兽时，攻击力 +800。</li>
          <li><b>中和</b>：「酸」与「碱」怪兽战斗后，双方破坏，双方各回复 500 LP。</li>
          <li><b>溶剂化</b>：自己场上有表侧「水」怪兽时，自己的「酸」「碱」怪兽攻击力 +300。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>魔法与陷阱</h3>
        <ul>
          <li>魔法卡只能在自己的主要阶段从手牌发动。装备魔法附着在怪兽上，怪兽离场时装备送入墓地。</li>
          <li>陷阱卡先盖放，<b>从下一个回合开始</b>在满足条件时自动发动；每次触发事件最多发动 1 张陷阱。</li>
          <li>永续陷阱会在自己下一个回合开始时自动翻开。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>化学家与技能</h3>
        <ul>
          <li>开局时选择 1 位化学家。每位化学家有 1 个自动生效的<b>被动能力</b>和 1 个每场决斗限 1 次的<b>主动技能</b>。</li>
          <li>主动技能通过战斗条上的「技能」按钮查看和发动；技能会影响 LP、卡差、场面或融合怪兽。</li>
          <li>对手也会使用自己的化学家技能，且不会与你选择同一位化学家。</li>
        </ul>
      </div>
      <div class="modal-section">
        <h3>数值设计说明</h3>
        <p>这是一款以化学性质为灵感的卡牌游戏，不是化学考试：ATK 表示反应活性、腐蚀性与氧化性；DEF 表示化学稳定性、难溶性与惰性。部分效果为了对战节奏做了夸张与简化。例如金、铅、硫酸钡拥有「耐酸」防护，而王水可以绕过它。</p>
      </div>
    </div>`;
    return baseModal('规则手册', '快速了解实验室的运转方式', body,
      '<button class="btn btn-primary" data-modal-action="close">关闭</button>', { wide: true });
  }

  function poolCards() {
    let list = Object.values(CARDS);
    if (S.poolKind !== 'all') {
      if (S.poolKind === 'fusion') list = list.filter(c => c.kind === 'fusion');
      else list = list.filter(c => c.kind === S.poolKind);
    }
    if (S.poolTag !== '全部') list = list.filter(c => (c.tags || []).includes(S.poolTag));
    return list;
  }

  function poolModalHTML() {
    const kinds = [['all', '全部'], ['monster', '怪兽'], ['spell', '魔法'], ['trap', '陷阱'], ['fusion', '融合']];
    const tags = ['全部', '酸', '碱', '盐', '活泼金属', '水', '气', '固'];
    if (S.poolSelected) {
      const c = S.poolSelected;
      return baseModal(esc(c.name), esc(c.formula || cardTypeLabel(c)), `<div style="display:flex;gap:16px;flex-wrap:wrap">
        <div style="width:190px;height:264px;flex:0 0 auto">${cardHTML(c, {})}</div>
        <div style="flex:1;min-width:250px">
          <div class="detail-tags">${(c.tags || []).map(t => `<span class="tag-pill ${tagClass(t)}">${esc(t)}</span>`).join('')}</div>
          ${(c.kind === 'monster' || c.kind === 'fusion') ? `<div class="detail-stats"><div class="stat-box atk"><span>ATK</span><b>${c.atk}</b></div><div class="stat-box def"><span>DEF</span><b>${c.def}</b></div></div>` : ''}
          ${c.kind === 'fusion' ? `<div class="detail-section-label">融合素材</div><div class="material-list">${c.materials.map(m => `<span class="material-chip"><b>${esc(m.tag)}</b> ×${m.count}</span>`).join('')}</div>` : ''}
          <div class="detail-text" style="margin-top:12px">${esc(c.text || '')}</div>
          <div class="detail-note">${esc(cardTypeLabel(c))}${c.level ? ` · Lv.${c.level}` : ''}</div>
        </div>
      </div>`, `<button class="btn" data-modal-action="pool-back">返回卡池</button><button class="btn btn-primary" data-modal-action="close">关闭</button>`, { wide: true });
    }
    const list = poolCards();
    const body = `<div class="pool-filters">
      ${kinds.map(([k, label]) => `<button class="filter-btn ${S.poolKind === k ? 'active' : ''}" data-pool-kind="${k}">${label}</button>`).join('')}
      <span style="width:1px;height:18px;background:rgba(255,255,255,.1);margin:0 3px;align-self:center"></span>
      ${tags.map(t => `<button class="filter-btn ${S.poolTag === t ? 'active' : ''}" data-pool-tag="${t}">${t}</button>`).join('')}
    </div>
    <div class="pool-count">共 ${list.length} 张卡 · 点击查看详情</div>
    <div class="pool-grid" style="margin-top:8px">${list.map(c => `<div data-pool-id="${c.id}">${cardHTML(c, {})}</div>`).join('')}</div>`;
    return baseModal('全卡池', '所有单质、化合物与实验战术', body,
      '<button class="btn btn-primary" data-modal-action="close">关闭</button>', { wide: true });
  }

  function openPool() {
    S.poolKind = 'all';
    S.poolTag = '全部';
    S.poolSelected = null;
    openModal('pool');
  }

  function openRules() { openModal('rules'); }

  function openRestart() { openModal('restart'); }

  function openSkillModal() {
    const g = S.game;
    if (!g || S.busy || g.winner !== null) return;
    if (g.active !== 0) { toast('只能在自己的回合使用技能。'); return; }
    S.pending = null;
    S.selected = null;
    render();
    openModal('skills');
  }

  function skillModalHTML() {
    const g = S.game;
    const chem = g.chemistOf(0);
    if (!chem) return '';
    const passive = chem.passive;
    const skills = g.activeSkills(0);
    const rows = skills.map(s => {
      const chk = g.canActivateSkill(0, s);
      const st = g.skillState(0, s);
      const status = st.used ? '本场已使用' : st.turnUsed ? '本回合已使用' : chk.ok ? '可发动' : chk.reason;
      return `<div class="skill-row">
        <div class="skill-row-head">
          <div><b>${esc(s.name)}</b><span class="skill-once">${s.once === 'turn' ? '每回合 1 次' : '每场决斗 1 次'}</span></div>
          <span class="skill-status ${chk.ok ? 'ok' : ''}">${esc(status)}</span>
        </div>
        <p>${esc(s.text)}</p>
        <button class="btn ${chk.ok ? 'btn-primary' : ''}" data-modal-action="use-skill" data-skill-id="${esc(s.id)}" ${chk.ok ? '' : 'disabled'}>发动技能</button>
      </div>`;
    }).join('');
    const body = `<div class="chemist-sheet">
      <div class="chemist-sheet-head" style="--chem-color:${chem.color}">
        <div class="chemist-sheet-icon">${chem.icon}</div>
        <div><div class="chemist-sheet-title">${esc(chem.title)}</div><h3>${esc(chem.name)}</h3><p>${esc(chem.quote || '')}</p></div>
      </div>
      ${passive ? `<div class="skill-passive"><span class="skill-kind passive">被动</span><b>${esc(passive.name)}</b><p>${esc(passive.text)}</p></div>` : ''}
      ${rows || '<div class="detail-note">此化学家没有主动技能。</div>'}
    </div>`;
    return baseModal('化学家技能', '每个化学家都有被动的实验风格与一次性主动技能', body,
      '<button class="btn" data-modal-action="close">关闭</button>', { wide: true });
  }

  function openPileView(side, pile) {
    const g = S.game;
    if (!g) return;
    const p = side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const cards = pile === 'gy' ? pl.gy : pile === 'extra' ? pl.extra : pl.deck;
    if (!cards.length) { toast('这个区域目前是空的。'); return; }
    S.pending = null;
    S.selected = null;
    render();
    S.pileView = { side, pile };
    openModal('pile');
  }

  function pileModalHTML() {
    const v = S.pileView;
    if (!v) return '';
    const g = S.game;
    const p = v.side === 'player' ? 0 : 1;
    const pl = g.players[p];
    const who = v.side === 'player' ? '你的' : '对手的';
    const label = v.pile === 'deck' ? '卡组' : v.pile === 'gy' ? '墓地' : '额外卡组';
    const cards = v.pile === 'gy' ? pl.gy : v.pile === 'extra' ? pl.extra : pl.deck;
    const hidden = v.pile === 'deck' && v.side === 'opponent';
    let body;
    if (hidden) {
      body = `<div class="modal-section"><p>${esc(who)}${label}共有 <b>${cards.length}</b> 张。对手的卡组顺序与内容不公开。</p></div>`;
    } else {
      const shown = v.pile === 'deck' ? cards.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'zh')) : cards;
      body = `<div class="pool-count">${esc(who)}${label} · ${cards.length} 张${v.pile === 'deck' ? ' · 按卡名排序展示，不改变卡组顺序' : ''}</div>
        <div class="choice-grid" style="margin-top:8px">${shown.map(c => `<div>${cardHTML(c, {})}</div>`).join('')}</div>`;
    }
    return baseModal(esc(who + label), '查看区域内容', body,
      '<button class="btn btn-primary" data-modal-action="close">关闭</button>', { wide: true });
  }

  function restartModalHTML() {
    return baseModal('重新开始', '当前决斗进度会丢失。',
      '<div class="modal-section"><p>要放弃当前实验，返回卡组选择界面吗？</p></div>',
      '<button class="btn" data-modal-action="close">继续决斗</button><button class="btn btn-danger" data-modal-action="confirm-restart">返回标题</button>',
      { narrow: true });
  }

  function openTributeModal(card, set) {
    S.tribute = { card, set, need: S.game.summonInfo(0, card).need, selected: new Set() };
    openModal('tribute');
  }

  function tributeModalHTML() {
    const t = S.tribute;
    if (!t) return '';
    const g = S.game;
    const monsters = g.monsterZones(0);
    const body = `<div class="modal-section">
      <p>召唤 <b>${esc(t.card.name)}</b> 需要解放 <b>${t.need}</b> 只怪兽。当前已选择 <span class="tribute-count">${t.selected.size}</span> 只。</p>
    </div>
    <div class="tribute-grid">
      ${monsters.map(({ card, zone }) => {
        const checked = t.selected.has(zone);
        return `<div class="tribute-option ${checked ? 'checked' : ''}" data-tribute-zone="${zone}">
          <div class="to-name">${esc(card.name)}</div>
          <div class="to-stats">ATK ${g.effectiveAtk(card)} / DEF ${g.effectiveDef(card)}</div>
          <div class="to-stats">${card.faceUp ? (card.position === 'attack' ? '攻击表示' : '守备表示') : '盖放'}</div>
        </div>`;
      }).join('') || '<div class="detail-empty">场上没有可以解放的怪兽。</div>'}
    </div>`;
    return baseModal('解放祭品', '选择送入墓地的怪兽', body,
      `<button class="btn" data-modal-action="close">取消</button>
       <button class="btn btn-primary" data-modal-action="confirm-tribute" ${t.selected.size === t.need ? '' : 'disabled'}>确认召唤</button>`,
      { narrow: true });
  }

  function openFusionModal() {
    if (!S.game || S.game.winner !== null || S.game.active !== 0 || S.game.phase !== 'main') {
      toast('只能在你的主要阶段融合召唤。'); return;
    }
    S.pending = null;
    S.selected = null;
    render();
    openModal('fusion');
  }

  function fusionModalHTML() {
    const g = S.game;
    const list = g.availableFusions(0);
    let body;
    if (!list.length) {
      body = `<div class="modal-section"><p>当前没有可用的融合。你需要手牌或场上有满足标签组合的怪兽。</p></div>`;
    } else {
      body = `<div class="fusion-list">${list.map(f => {
        const mats = f.materials.map(m => `<span class="material-chip">${esc(m.card.name)} <b>${esc(g.getTags(m.card).join('/'))}</b> · ${m.from === 'hand' ? '手牌' : '场上'}</span>`).join('');
        return `<div class="fusion-option">
          <div class="fusion-card-wrap">${cardHTML(f.fusion, {})}</div>
          <div class="fusion-info">
            <h4>${esc(f.fusion.name)}</h4>
            <div class="fstats">ATK ${f.fusion.atk} / DEF ${f.fusion.def} · Lv.${f.fusion.level}</div>
            <div class="fmats">素材：${mats}</div>
            <div class="fmats">${esc(f.fusion.text || '')}</div>
          </div>
          <button class="btn btn-primary" data-modal-action="fuse" data-index="${f.index}">融合召唤</button>
        </div>`;
      }).join('')}</div>`;
    }
    return baseModal('融合召唤', '把标签素材送入墓地，从额外卡组特殊召唤。每回合 1 次。', body,
      '<button class="btn" data-modal-action="close">取消</button>', { wide: true });
  }

  function openChoiceModal(card) {
    const g = S.game;
    const targets = g.validSpellTargets(0, card);
    if (!targets.length) { toast('没有可选择的卡。'); return; }
    S.choice = { card, targets };
    openModal('choice');
  }

  function choiceModalHTML() {
    const c = S.choice;
    if (!c) return '';
    return baseModal(`选择对象 · ${esc(c.card.name)}`, '从以下卡牌中选择 1 张',
      `<div class="choice-grid">${c.targets.map(t => `<div data-choice-uid="${t.uid}">${cardHTML(t, { onField: false })}</div>`).join('')}</div>`,
      '<button class="btn" data-modal-action="close">取消</button>', { wide: true });
  }

  function checkGameOver() {
    const g = S.game;
    if (!g || g.winner === null || S.gameOverShown) return false;
    S.gameOverShown = true;
    setTimeout(() => {
      if (S.game !== g) return;
      S.modalType = 'gameover';
      renderModal();
    }, 650);
    return true;
  }

  function gameoverModalHTML() {
    const g = S.game;
    if (!g) return '';
    const win = g.winner === 0;
    const draw = g.winner === 'draw';
    const title = draw ? '平局' : win ? '实验成功' : '实验失败';
    const cls = draw ? '' : win ? 'win' : 'lose';
    const sub = draw ? '双方同时失去了全部 LP。' : win ? '你击穿了对手的防线。' : '你的 LP 归零，或卡组已经耗尽。';
    const pc = CHEMISTS[S.playerChemist], ac = CHEMISTS[S.aiChemist];
    const body = `<div class="gameover-box">
      <div class="gameover-title ${cls}">${title}</div>
      <div class="gameover-sub">${sub}</div>
      <div class="detail-stats" style="max-width:520px;margin:0 auto">
        <div class="stat-box lp"><span>你的 LP</span><b>${Math.max(0, g.players[0].lp)}</b></div>
        <div class="stat-box lp"><span>对手 LP</span><b>${Math.max(0, g.players[1].lp)}</b></div>
        <div class="stat-box"><span>回合数</span><b>${g.turn}</b></div>
      </div>
      <div class="detail-note" style="margin-top:12px">你：${esc(pc ? pc.name : '—')} / ${esc(deckById(S.playerDeck) ? deckById(S.playerDeck).name : '—')} · 对手：${esc(ac ? ac.name : '—')} / ${esc(deckById(S.aiDeck) ? deckById(S.aiDeck).name : '未知')}</div>
    </div>`;
    return baseModal('决斗结束', '', body,
      `<button class="btn" data-modal-action="play-again">返回标题</button>
       <button class="btn btn-primary" data-modal-action="rematch">再战一局</button>`, { narrow: true });
  }

  function rematch() {
    const player = S.playerDeck;
    const ai = S.aiDeck;
    closeModal();
    S.playerDeck = player;
    S.aiDeck = ai;
    startGame();
  }

  /* ============================ 事件绑定 ============================ */
  function handleModalClick(e) {
    if (e.target.closest('[data-close-modal]') || e.target.classList.contains('modal-backdrop')) {
      closeModal();
      return;
    }
    const kindBtn = e.target.closest('[data-pool-kind]');
    if (kindBtn) {
      S.poolKind = kindBtn.dataset.poolKind;
      S.poolSelected = null;
      renderModal();
      return;
    }
    const tagBtn = e.target.closest('[data-pool-tag]');
    if (tagBtn) {
      S.poolTag = tagBtn.dataset.poolTag;
      S.poolSelected = null;
      renderModal();
      return;
    }
    const pool = e.target.closest('[data-pool-id]');
    if (pool && S.modalType === 'pool') {
      const id = pool.dataset.poolId;
      if (CARDS[id]) { S.poolSelected = CARDS[id]; renderModal(); }
      return;
    }
    const choiceCard = e.target.closest('[data-choice-uid]');
    if (choiceCard && S.modalType === 'choice' && S.choice) {
      const uid = Number(choiceCard.dataset.choiceUid);
      const target = S.choice.targets.find(t => t.uid === uid);
      if (target) executeSpell(S.choice.card, target);
      return;
    }
    const tribute = e.target.closest('[data-tribute-zone]');
    if (tribute && S.modalType === 'tribute' && S.tribute) {
      const z = Number(tribute.dataset.tributeZone);
      if (S.tribute.selected.has(z)) S.tribute.selected.delete(z);
      else if (S.tribute.selected.size < S.tribute.need) S.tribute.selected.add(z);
      renderModal();
      return;
    }
    if (S.modalType === 'builder') {
      const bKind = e.target.closest('[data-builder-kind]');
      if (bKind) { S.builder.kind = bKind.dataset.builderKind; renderModal(); return; }
      const bTag = e.target.closest('[data-builder-tag]');
      if (bTag) { S.builder.tag = bTag.dataset.builderTag; renderModal(); return; }
      const bAdd = e.target.closest('[data-builder-add]');
      if (bAdd) { builderAdd(bAdd.dataset.builderAdd); return; }
      const bRemove = e.target.closest('[data-builder-remove]');
      if (bRemove) { builderRemove(bRemove.dataset.builderRemove); return; }
      const bClear = e.target.closest('[data-builder-clear]');
      if (bClear) { builderClear(bClear.dataset.builderClear); return; }
    }
    const act = e.target.closest('[data-modal-action]');
    if (!act) return;
    const action = act.dataset.modalAction;
    if (action === 'close') { closeModal(); return; }
    if (action === 'builder-cancel') { closeModal(); renderStart(); return; }
    if (action === 'builder-save') { saveBuilderDeck(); return; }
    if (action === 'confirm-delete-deck') {
      const id = S.deleteDeckId;
      if (id && S.customDecks[id]) {
        delete S.customDecks[id];
        saveCustomDecks();
        if (S.playerDeck === id) S.playerDeck = 'acid';
      }
      closeModal();
      renderStart();
      return;
    }
    if (action === 'pool-back') { S.poolSelected = null; renderModal(); return; }
    if (action === 'confirm-restart') { closeModal(); returnToStart(); return; }
    if (action === 'play-again') { closeModal(); returnToStart(); return; }
    if (action === 'rematch') { rematch(); return; }
    if (action === 'use-skill') {
      const id = act.dataset.skillId;
      const g = S.game;
      const r = g.activateSkill(0, id);
      if (!r.ok) { toast(r.reason); return; }
      closeModal();
      S.selected = null;
      S.pending = null;
      render();
      checkGameOver();
      return;
    }
    if (action === 'fuse') {
      const idx = Number(act.dataset.index);
      const g = S.game;
      const r = g.fusionSummon(0, idx);
      if (!r.ok) { toast(r.reason); return; }
      closeModal();
      S.selected = null;
      S.pending = null;
      render();
      checkGameOver();
      return;
    }
    if (action === 'confirm-tribute') {
      const t = S.tribute;
      if (!t || t.selected.size !== t.need) return;
      const g = S.game;
      const handIdx = g.players[0].hand.indexOf(t.card);
      const zones = Array.from(t.selected);
      const r = g.normalSummon(0, handIdx, { tributes: zones, set: t.set });
      if (!r.ok) { toast(r.reason); return; }
      closeModal();
      S.selected = null;
      render();
      checkGameOver();
      return;
    }
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#modal')) { handleModalClick(e); return; }

    const openRulesBtn = e.target.closest('[data-open-rules]');
    if (openRulesBtn) { openRules(); return; }
    const openPoolBtn = e.target.closest('[data-open-pool]');
    if (openPoolBtn) { openPool(); return; }
    const restartBtn = e.target.closest('[data-restart]');
    if (restartBtn) { openRestart(); return; }
    const startBtn = e.target.closest('#start-btn');
    if (startBtn) { startGame(); return; }
    const newDeckBtn = e.target.closest('[data-new-deck]');
    if (newDeckBtn) { openDeckBuilder(); return; }
    const editDeckBtn = e.target.closest('[data-edit-deck]');
    if (editDeckBtn) { openDeckBuilder(editDeckBtn.dataset.editDeck); return; }
    const deleteDeckBtn = e.target.closest('[data-delete-deck]');
    if (deleteDeckBtn) { openDeleteDeck(deleteDeckBtn.dataset.deleteDeck); return; }
    const deckCard = e.target.closest('[data-deck]');
    if (deckCard) {
      S.playerDeck = deckCard.dataset.deck;
      renderStart();
      return;
    }
    const chemistCard = e.target.closest('[data-chemist]');
    if (chemistCard) {
      S.playerChemist = chemistCard.dataset.chemist;
      renderStart();
      return;
    }
    const pileEl = e.target.closest('[data-pile]');
    if (pileEl) { openPileView(pileEl.dataset.side, pileEl.dataset.pile); return; }
    const actionEl = e.target.closest('[data-action]');
    if (actionEl) { handleAction(actionEl.dataset.action); return; }
    const handEl = e.target.closest('[data-hand-index]');
    if (handEl && !S.busy) { handleHandClick(Number(handEl.dataset.handIndex)); return; }
    const zoneEl = e.target.closest('[data-side][data-kind]');
    if (zoneEl) {
      handleZoneClick(zoneEl.dataset.side, zoneEl.dataset.kind, zoneEl.dataset.z === 'field' ? 'field' : Number(zoneEl.dataset.z));
      return;
    }
  });

  document.addEventListener('input', (e) => {
    if (S.modalType === 'builder' && e.target && e.target.id === 'builder-name' && S.builder) {
      S.builder.name = e.target.value.slice(0, 24);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (S.modalType) { closeModal(); return; }
      if (S.pending) { S.pending = null; render(); return; }
      S.selected = null;
      render();
    }
  });

  /* ============================ 启动 ============================ */
  window.ChemUI = S; // 调试/自动化接口
  window.ChemRender = render;
  window.ChemRenderModal = renderModal;
  loadCustomDecks();
  renderStart();
})();
