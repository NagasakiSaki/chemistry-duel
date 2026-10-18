/* Generate DECK_LISTS.md */
const fs = require('fs');
const path = require('path');
require('../js/cards.js');
require('../js/chemists.js');
require('../js/decks.js');
const CONTENT = require('../js/content.js');
const CARDS = CONTENT.cards;
const DECKS = CONTENT.decks;
const ORDER = CONTENT.deckOrder;

let md = '# 化学怪兽决斗 · 预设卡组\n\n';
md += '三套卡组均为 **40 张主卡组 + 6 张额外卡组**，同一张卡最多 3 张。\n\n';

for (const key of ORDER) {
  const d = DECKS[key];
  const counts = {};
  for (const id of d.main) counts[id] = (counts[id] || 0) + 1;
  md += `## ${d.name} · ${d.subtitle}\n\n`;
  md += `> ${d.desc}\n\n`;
  md += `### 主卡组（40）\n\n`;
  for (const [id, n] of Object.entries(counts)) {
    const c = CARDS[id];
    if (!c) continue;
    const stats = c.kind === 'monster' || c.kind === 'fusion'
      ? `Lv.${c.level} ${c.atk}/${c.def}`
      : (c.kind === 'spell' ? '魔法' : '陷阱');
    md += `- ${n} × **${c.name}**（${c.tags.join('/') || '—'} · ${stats}）\n`;
  }
  md += `\n### 额外卡组（6）\n\n`;
  for (const id of d.extra) {
    const c = CARDS[id];
    if (!c) continue;
    md += `- **${c.name}**（${c.atk}/${c.def}）— ${c.materials.map(m => `${m.tag}×${m.count}`).join(' + ')}\n`;
  }
  md += '\n';
}

md += '---\n\n*由 `test/gen-decks.js` 自动生成。*\n';
fs.writeFileSync(path.join(__dirname, '..', 'DECK_LISTS.md'), md);
console.log('wrote DECK_LISTS.md');
