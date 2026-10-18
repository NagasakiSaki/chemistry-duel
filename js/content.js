/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  content.js — 内容注册表 / 扩展入口
 *
 *  核心内容（cards.js / decks.js / chemists.js）加载后，本文件把它们汇总到
 *  ChemContent。未来的扩展包只需要在 UI 之前加载，并调用：
 *
 *    ChemContent.registerExpansion({
 *      id: 'pack-02',
 *      name: '电化学时代',
 *      cards: { NEW_CARD: {...} },
 *      decks: { new_deck: {...} },
 *      deckOrder: ['new_deck'],
 *      chemists: { new_chemist: {...} },
 *      chemistOrder: ['new_chemist']
 *    });
 *
 *  UI 和引擎都从 ChemContent 读取合并后的内容。
 * ========================================================================= */
(function (global) {
  'use strict';

  const cards = Object.assign({}, global.ChemCards || {});
  const decks = Object.assign({}, (global.ChemDecks && global.ChemDecks.DECKS) || {});
  const deckOrder = ((global.ChemDecks && global.ChemDecks.ORDER) || Object.keys(decks)).slice();
  const chemists = Object.assign({}, global.ChemChemists || {});
  const chemistOrder = (global.ChemChemistOrder || Object.keys(chemists)).slice();

  function assertUnique(map, id, kind) {
    if (map[id]) throw new Error(`[ChemContent] duplicate ${kind} id: ${id}`);
  }

  const Content = {
    version: '1.0.0',
    cards,
    decks,
    deckOrder,
    chemists,
    chemistOrder,

    getCard(id) { return cards[id] || null; },
    getDeck(id) { return decks[id] || null; },
    getChemist(id) { return chemists[id] || null; },

    registerCard(def) {
      if (!def || !def.id) throw new Error('[ChemContent] card needs id');
      assertUnique(cards, def.id, 'card');
      cards[def.id] = def;
      if (global.ChemCards) global.ChemCards[def.id] = def;
      return def;
    },

    registerCards(defs) {
      for (const def of Object.values(defs || {})) this.registerCard(def);
      return this;
    },

    registerDeck(def) {
      if (!def || !def.id) throw new Error('[ChemContent] deck needs id');
      assertUnique(decks, def.id, 'deck');
      decks[def.id] = def;
      if (global.ChemDecks) {
        global.ChemDecks.DECKS[def.id] = def;
        if (!global.ChemDecks.ORDER.includes(def.id)) global.ChemDecks.ORDER.push(def.id);
      }
      if (!deckOrder.includes(def.id)) deckOrder.push(def.id);
      return def;
    },

    registerDecks(defs) {
      for (const def of Object.values(defs || {})) this.registerDeck(def);
      return this;
    },

    registerChemist(def) {
      if (!def || !def.id) throw new Error('[ChemContent] chemist needs id');
      assertUnique(chemists, def.id, 'chemist');
      chemists[def.id] = def;
      if (global.ChemChemists) global.ChemChemists[def.id] = def;
      if (global.ChemChemistOrder && !global.ChemChemistOrder.includes(def.id)) global.ChemChemistOrder.push(def.id);
      if (!chemistOrder.includes(def.id)) chemistOrder.push(def.id);
      return def;
    },

    registerChemists(defs) {
      for (const def of Object.values(defs || {})) this.registerChemist(def);
      return this;
    },

    setDeckOrder(order) {
      const valid = (order || []).filter(id => decks[id]);
      if (valid.length) {
        deckOrder.length = 0;
        deckOrder.push(...valid);
      }
      return this;
    },

    setChemistOrder(order) {
      const valid = (order || []).filter(id => chemists[id]);
      if (valid.length) {
        chemistOrder.length = 0;
        chemistOrder.push(...valid);
      }
      return this;
    },

    registerExpansion(exp) {
      if (!exp || !exp.id) throw new Error('[ChemContent] expansion needs id');
      if (exp.cards) this.registerCards(exp.cards);
      if (exp.decks) this.registerDecks(exp.decks);
      if (exp.deckOrder) {
        for (const id of exp.deckOrder) if (decks[id] && !deckOrder.includes(id)) deckOrder.push(id);
      }
      if (exp.chemists) this.registerChemists(exp.chemists);
      if (exp.chemistOrder) {
        for (const id of exp.chemistOrder) if (chemists[id] && !chemistOrder.includes(id)) chemistOrder.push(id);
      }
      return this;
    },

    validate() {
      const errors = [];
      for (const id of deckOrder) {
        const d = decks[id];
        if (!d) { errors.push(`缺少卡组 ${id}`); continue; }
        const mainLen = (d.main || []).length;
        const extraLen = (d.extra || []).length;
        if (mainLen < 20 || mainLen > 30) errors.push(`卡组 ${id} 主卡组需为 20–30 张`);
        if (extraLen < 6 || extraLen > 10) errors.push(`卡组 ${id} 额外卡组需为 6–10 张`);
        for (const cid of [...(d.main || []), ...(d.extra || [])]) {
          if (!cards[cid]) errors.push(`卡组 ${id} 引用了不存在的卡 ${cid}`);
        }
      }
      for (const id of chemistOrder) {
        const c = chemists[id];
        if (!c) { errors.push(`缺少化学家 ${id}`); continue; }
        for (const s of (c.actives || [])) {
          if (!s.id || !s.name) errors.push(`化学家 ${id} 的技能缺少 id/name`);
        }
      }
      return { ok: errors.length === 0, errors };
    }
  };

  global.ChemContent = Content;
  if (typeof module !== 'undefined' && module.exports) module.exports = Content;
})(typeof window !== 'undefined' ? window : globalThis);
