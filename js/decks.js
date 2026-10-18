/* =========================================================================
 *  化学怪兽决斗 / Chemistry Duel
 *  decks.js — 三套预设卡组
 * ========================================================================= */
(function (global) {
  'use strict';

  function build(list) {
    const out = [];
    for (const [id, n] of list) {
      for (let i = 0; i < n; i++) out.push(id);
    }
    return out;
  }

  const DECKS = {
    acid: {
      id: 'acid',
      name: '酸雨侵蚀',
      subtitle: 'ACID RAIN',
      icon: '🧪',
      tagline: '用腐蚀与氧化压垮对手的防线。',
      style: '腐蚀 / 爆发',
      desc: '酸类怪兽拥有高攻击力与战斗后的追加伤害；「酸雨」与「强氧化剂」让每一次攻击都带腐蚀。融合「王水」可以直接溶解固体与活泼金属。',
      color: '#c6ff3d',
      main: build([
        ['H2SO4', 2], ['HCl', 3], ['HNO3', 2], ['HF', 2],
        ['H2CO3', 1], ['CH3COOH', 1],
        ['SO2', 2], ['SO3', 2], ['NO2', 2], ['Cl2', 2], ['F2', 1],
        ['H2O', 2],
        ['dilute_hcl', 2], ['conc_h2so4', 2], ['neutralize', 1],
        ['flame_test', 2], ['oxidizer', 2], ['acid_rain', 2], ['distill', 1],
        ['precipitate_trap', 2], ['redox_trap', 2], ['fume_hood', 2]
      ]),
      extra: [
        'aqua_regia_fusion', 'h2so3_fusion', 'water_fusion',
        'phosgene_fusion', 'nitroglycerin_fusion', 'so3_fusion'
      ]
    },

    base: {
      id: 'base',
      name: '碱土壁垒',
      subtitle: 'ALKALI BULWARK',
      icon: '🛡️',
      tagline: '以难溶沉淀与强碱构筑不可逾越的防线。',
      style: '防守 / 回复',
      desc: '碱与盐怪兽拥有极高的守备力，并通过回复 LP、削弱对方、自动发动陷阱来拖垮对手。融合「重晶石」与「氢氧化铯」后几乎无法被战斗突破。',
      color: '#7ad7ff',
      main: build([
        ['NaOH', 3], ['KOH', 2], ['Ca(OH)2', 2], ['Ba(OH)2', 2],
        ['Mg(OH)2', 2], ['Al(OH)3', 2], ['Fe(OH)3', 2], ['NH3', 1],
        ['NaCl', 2], ['CaCO3', 2], ['BaSO4', 1], ['AgCl', 1],
        ['neutralize', 2], ['crystallize', 2], ['filter_spell', 2],
        ['coating', 2], ['strong_base', 2], ['buffer_spell', 2],
        ['neutralization_pool', 2], ['precipitate_trap', 2], ['eyewash', 2]
      ]),
      extra: [
        'csoh_fusion', 'baso4_fusion', 'nacl_fusion',
        'soap_fusion', 'cement_fusion', 'bicarbonate_fusion'
      ]
    },

    redox: {
      id: 'redox',
      name: '氧化燃烧',
      subtitle: 'REDOX BLAZE',
      icon: '🔥',
      tagline: '活泼金属与氧气，打出最暴烈的场面。',
      style: '强攻 / 燃烧',
      desc: '以活泼金属和气体铺场，借助「氧气」的光环与「燃烧」的爆发抢血。融合「氢氧爆鸣」与「过氧化钠」可以在瞬间清场。',
      color: '#ff8a4c',
      main: build([
        ['O2', 3], ['O3', 1], ['Cl2', 2],
        ['Mg', 3], ['Al', 3], ['Fe', 2], ['Zn', 2], ['Na', 2],
        ['K', 1], ['C', 2], ['S', 1],
        ['combust', 2], ['oxidize', 2], ['catalyst', 2],
        ['displacement', 2], ['oxidizer', 2], ['distill', 2],
        ['redox_trap', 2], ['passivation_trap', 2], ['explosion_limit', 2]
      ]),
      extra: [
        'co2_fusion', 'rust_fusion', 'water_fusion',
        'alloy_fusion', 'na2o2_fusion', 'corundum_fusion'
      ]
    }
  };

  const ORDER = ['acid', 'base', 'redox'];

  global.ChemDecks = { DECKS, ORDER, build };
  if (typeof module !== 'undefined' && module.exports) module.exports = { DECKS, ORDER, build };
})(typeof window !== 'undefined' ? window : globalThis);
