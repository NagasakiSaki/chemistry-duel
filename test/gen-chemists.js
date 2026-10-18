/* Generate CHEMISTS.md */
const fs = require('fs');
const path = require('path');
require('../js/cards.js');
require('../js/chemists.js');
require('../js/decks.js');
const CONTENT = require('../js/content.js');
const CHEMISTS = CONTENT.chemists;
const ORDER = CONTENT.chemistOrder;

let md = '# 化学家与技能\n\n';
md += '每位化学家拥有 1 个被动能力与 1 个主动技能。主动技能默认每场决斗 1 次，通过战斗条上的「技能」按钮发动。\n\n';

for (const id of ORDER) {
  const c = CHEMISTS[id];
  if (!c) continue;
  md += `## ${c.icon} ${c.name} · ${c.title}\n\n`;
  md += `> ${c.quote || ''}\n\n`;
  if (c.passive) {
    md += `### 被动 · ${c.passive.name}\n\n${c.passive.text}\n\n`;
  }
  for (const s of c.actives || []) {
    md += `### 主动 · ${s.name}\n\n`;
    md += `${s.text}\n\n`;
    md += `- 使用次数：${s.once === 'turn' ? '每回合 1 次' : '每场决斗 1 次'}\n`;
    md += `- 时机：${s.timing === 'battle' ? '战斗阶段' : s.timing === 'any' ? '主要/战斗阶段' : '主要阶段'}\n`;
    if (s.conditionText) md += `- 条件：${s.conditionText}\n`;
    md += '\n';
  }
}

md += '---\n\n*由 `test/gen-chemists.js` 从 `js/chemists.js` 自动生成。*\n';
fs.writeFileSync(path.join(__dirname, '..', 'CHEMISTS.md'), md);
console.log('wrote CHEMISTS.md');
