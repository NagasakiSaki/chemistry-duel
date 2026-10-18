/* =========================================================================
 *  化学怪兽决斗 / 扩展包模板
 *
 *  用法：
 *   1. 复制本文件为 js/expansions/pack-02.js
 *   2. 在 index.html 中，放在 content.js 之后、ui.js 之前加载
 *   3. 修改下面的示例内容
 *
 *  这里故意不自动注册任何内容；复制后再取消注释 / 修改。
 * ========================================================================= */
(function (global) {
  'use strict';

  const Content = global.ChemContent;
  if (!Content) {
    console.warn('[Expansion] 请先加载 js/content.js');
    return;
  }

  /*
  Content.registerExpansion({
    id: 'pack-02-electro',
    name: '电化学时代',

    cards: {
      // 示例：一张新怪兽
      NEW_MONSTER: {
        id: 'NEW_MONSTER',
        name: '示例化合物',
        formula: 'X',
        kind: 'monster',
        tags: ['盐'],
        level: 4,
        atk: 1500,
        def: 1600,
        text: '①：此卡召唤成功时，回复 300 LP。',
        onSummon(g, self) { g.heal(self.controller, 300, '示例效果'); }
      }
    },

    decks: {
      electro_deck: {
        id: 'electro_deck',
        name: '电化学时代',
        subtitle: 'ELECTROCHEMISTRY',
        icon: '🔋',
        tagline: '用电子流动撕开对手的防线。',
        desc: '示例扩展卡组。',
        color: '#55e5ff',
        main: [], // 填入 20–30 个卡牌 ID
        extra: [], // 填入 6–10 个融合怪兽 ID
      }
    },
    deckOrder: ['electro_deck'],

    chemists: {
      faraday: {
        id: 'faraday',
        name: '法拉第',
        title: '电磁感应与电化学',
        icon: '🔋',
        color: '#55e5ff',
        quote: '没有什么比一个理论更有用，除非它是一个正确的实验。',
        passive: {
          name: '电解定律',
          text: '自己场上的「盐」怪兽攻击力上升 200。',
          tagAtk: { 盐: 200 }
        },
        actives: [{
          id: 'electrolysis',
          name: '电解',
          once: 'duel',
          timing: 'main',
          aiTiming: 'early',
          text: '抽 1 张卡，回复 300 LP。',
          aiUse(g, p) { return true; },
          activate(g, p) { g.draw(p, 1); g.heal(p, 300, '电解'); }
        }]
      }
    },
    chemistOrder: ['faraday']
  });
  */

  // 扩展加载后的自检（开发时很有用）
  // console.log(Content.validate());
})(typeof window !== 'undefined' ? window : globalThis);
