/* Generate CARD_LIST.md from the card database */
const fs = require('fs');
const path = require('path');
require('../js/cards.js');
require('../js/chemists.js');
require('../js/decks.js');
const CONTENT = require('../js/content.js');
const CARDS = CONTENT.cards;

const cards = Object.values(CARDS);
const typeLabel = c => c.kind === 'fusion' ? '融合怪兽' : c.kind === 'monster' ? '怪兽' : c.kind === 'spell' ? '魔法' : '陷阱';
const tagLabel = c => (c.tags && c.tags.length) ? c.tags.join(' / ') : '—';

function line(c) {
  const st = { normal: '通常', equip: '装备', continuous: '永续', field: '场地' };
  const stats = (c.kind === 'monster' || c.kind === 'fusion')
    ? `Lv.${c.level} · ATK ${c.atk} / DEF ${c.def}`
    : c.kind === 'spell' ? (st[c.spellType] || '') + '魔法' : (st[c.trapType] || '') + '陷阱';
  const mats = c.kind === 'fusion'
    ? `\n  - 素材：${c.materials.map(m => `${m.tag} ×${m.count}`).join(' + ')}`
    : '';
  const formula = c.formula ? ` \`${c.formula}\`` : '';
  return `- **${c.name}**${formula} · ${tagLabel(c)} · ${stats}${mats}\n  - ${c.text || ''}`;
}

const groups = [
  ['融合怪兽 / 额外卡组', cards.filter(c => c.kind === 'fusion')],
  ['怪兽 / 单质与化合物', cards.filter(c => c.kind === 'monster')],
  ['魔法卡', cards.filter(c => c.kind === 'spell')],
  ['陷阱卡', cards.filter(c => c.kind === 'trap')]
];

let md = `# 化学怪兽决斗 · 全卡表\n\n`;
md += `共 **${cards.length}** 张卡：怪兽 ${cards.filter(c => c.kind === 'monster').length} 张、融合怪兽 ${cards.filter(c => c.kind === 'fusion').length} 张、魔法 ${cards.filter(c => c.kind === 'spell').length} 张、陷阱 ${cards.filter(c => c.kind === 'trap').length} 张。\n\n`;
md += `> ATK = 反应活性 / 腐蚀性 / 氧化性；DEF = 化学稳定性 / 难溶性 / 惰性。卡牌效果为对战性抽象，不等于真实化学计量。\n\n`;

for (const [title, list] of groups) {
  md += `## ${title}（${list.length}）\n\n`;
  if (title.includes('怪兽') && !title.includes('融合')) {
    const tags = ['酸', '碱', '盐', '活泼金属', '水', '气', '固'];
    for (const tag of tags) {
      const sub = list.filter(c => (c.tags || [])[0] === tag);
      if (!sub.length) continue;
      md += `### ${tag}属性（${sub.length}）\n\n`;
      md += sub.map(line).join('\n') + '\n\n';
    }
  } else {
    md += list.map(line).join('\n') + '\n\n';
  }
}

md += `---\n\n*本卡表由 \`test/gen-cards.js\` 从 \`js/cards.js\` 自动生成。*\n`;

fs.writeFileSync(path.join(__dirname, '..', 'CARD_LIST.md'), md);
console.log('wrote CARD_LIST.md', cards.length, 'cards');
