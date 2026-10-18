# 开发文档 · 化学怪兽决斗

> 面向后续开发、内容扩展与维护。运行方式和玩家规则见 [README.md](README.md)。

- 仓库：[https://github.com/NagasakiSaki/chemistry-duel](https://github.com/NagasakiSaki/chemistry-duel)
- 技术栈：原生 HTML / CSS / JavaScript，无构建步骤、无运行时依赖
- 入口：[index.html](index.html)
- 当前版本：1.0.0

---

## 1. 项目定位

《化学怪兽决斗》把《游戏王》的对战框架与化学物质结合：

- 8000 LP，5 怪兽区 / 5 魔陷区 / 1 场地 / 6 额外；
- 怪兽拥有 ATK（反应活性 / 腐蚀性）与 DEF（化学稳定性 / 难溶性）；
- 化学标签驱动融合素材与全局反应；
- 化学家提供被动能力与每场一次的主动技能；
- 自由构筑卡组与本地保存；
- 每回合抽 **2** 张（先攻第 1 回合不抽）。

项目刻意采用 **Vanilla JS + 传统 `<script>`**：直接双击 `index.html` 即可运行，也便于作为静态站点托管到 GitHub Pages。

---

## 2. 快速开始

```bash
git clone https://github.com/NagasakiSaki/chemistry-duel.git
cd chemistry-duel
# 直接打开 index.html，或
python -m http.server 8000
```

Node.js 仅用于自动化测试和文档生成：

```bash
node test/rules.test.js
node test/effects.test.js
node test/chemists.test.js
node test/simulate.js
node test/gen-cards.js
node test/gen-decks.js
node test/gen-chemists.js
```

---

## 3. 目录结构

```text
chemistry-duel/
├─ index.html                 页面骨架与脚本加载顺序
├─ css/style.css              全部界面样式（桌面 / 平板 / 手机）
├─ js/
│  ├─ engine.js               规则引擎 Duel（无 DOM）
│  ├─ cards.js                135 张核心卡
│  ├─ chemists.js             6 位化学家、被动、主动技能
│  ├─ decks.js                三套预设卡组
│  ├─ content.js              内容注册表 / 扩展入口
│  ├─ ai.js                   对手 AI
│  ├─ ui.js                   DOM 渲染、交互、卡组构筑器
│  └─ expansions/             扩展包模板与说明
├─ test/
│  ├─ rules.test.js           规则断言
│  ├─ effects.test.js         135 张卡效果冒烟
│  ├─ chemists.test.js        化学家与技能断言
│  ├─ simulate.js             AI vs AI 压测
│  ├─ gen-cards.js            CARD_LIST.md 生成
│  ├─ gen-decks.js            DECK_LISTS.md 生成
│  └─ gen-chemists.js         CHEMISTS.md 生成
├─ CARD_LIST.md
├─ DECK_LISTS.md
├─ CHEMISTS.md
├─ README.md
├─ DEVELOPMENT.md
└─ preview-*.png
```

### 脚本加载顺序

```html
engine.js
cards.js
chemists.js
decks.js
content.js
ai.js
ui.js
```

`content.js` 必须位于核心内容之后、UI 与扩展包之前。扩展包脚本应放在 `content.js` 后、`ui.js` 前。

---

## 4. 架构

```text
┌─────────────────────────────────────────────┐
│ ui.js                                       │
│  开始界面 / 对局界面 / 卡组构筑器 / 弹窗      │
│  DOM 事件 → Duel API；Duel 状态 → DOM        │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│ ai.js                                       │
│  读取 Duel 状态，选择融合 / 魔法 / 召唤 /     │
│  陷阱 / 技能 / 攻击目标                      │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│ engine.js · Duel                            │
│  LP、手牌、卡组、区域、回合、战斗、融合、     │
│  陷阱窗口、化学家技能、效果钩子               │
└───────────────────┬─────────────────────────┘
                    │
┌───────────────────▼─────────────────────────┐
│ cards.js / chemists.js / decks.js / content │
│  纯数据 + 效果函数 + 内容注册表               │
└─────────────────────────────────────────────┘
```

### 关键原则

1. **引擎不依赖 DOM**：`Duel` 可在 Node 中跑完整对局。
2. **UI 不实现规则**：只把点击翻译成 `Duel` 调用，再渲染状态。
3. **内容数据化**：卡牌、卡组、化学家都通过对象注册，不写死在 UI。
4. **效果函数只调用引擎公共 API**：不直接改 DOM、不直接改其他卡实例的内部状态。

---

## 5. 数据模型

### 5.1 卡牌定义

怪兽：

```js
{
  id: 'H2SO4',
  name: '硫酸',
  formula: 'H₂SO₄',
  kind: 'monster',           // monster | fusion | spell | trap
  tags: ['酸'],              // 酸/碱/盐/活泼金属/水/气/固
  level: 5,
  atk: 2200,
  def: 1500,
  text: '①：此卡给予对方战斗伤害时，对方再受到 500 点伤害。',
  onBattleDamage(g, self, target) {
    g.burn(g.opp(self.controller), 500, '浓硫酸脱水');
  }
}
```

融合怪兽增加 `materials`：

```js
{
  id: 'nacl_fusion',
  kind: 'fusion',
  materials: [{ tag: '酸', count: 1 }, { tag: '碱', count: 1 }],
  // ...
}
```

魔法：

```js
{
  id: 'flame_test',
  kind: 'spell',
  spellType: 'normal',       // normal | equip | continuous | field
  target: null,              // null | ownMonster | enemyMonster | anyMonster | enemyMonsterTag | deckSalt | gySalt
  text: '给予对方 800 点伤害。',
  activate(g, self, target) { g.burn(g.opp(self.controller), 800, '焰色反应'); }
}
```

陷阱：

```js
{
  id: 'precipitate_trap',
  kind: 'trap',
  trapType: 'normal',        // normal | continuous
  trigger: {
    event: 'attack',         // attack | spell | summon | damage
    condition(g, self, ctx) { /* ... */ },
    resolve(g, self, ctx) { ctx.negated = true; }
  }
}
```

### 5.2 运行时卡牌实例

`makeCard(def, controller)` 把定义浅拷贝为实例，额外字段：

| 字段 | 含义 |
|---|---|
| `uid` | 本局唯一 ID |
| `controller` | 0 / 1 |
| `zone` | `-1` 手牌、`-2` 墓地、`-3` 额外、`0..4` 场区、`'field'` 场地 |
| `position` | `attack` / `defense` |
| `faceUp` | 是否表侧 |
| `equips` | 装备魔法数组 |
| `tempAtk` / `tempDef` | 回合内修正 |
| `hasAttacked` / `positionChanged` | 回合状态 |
| `summonedTurn` | 召唤回合（用于同回合不可翻转） |
| `battleShield` | 一次性战斗破坏防护 |
| `shieldUsed` | 一次性护盾是否已用 |

### 5.3 化学家

```js
{
  id: 'mendeleev',
  name: '门捷列夫',
  title: '元素周期律的建立者',
  icon: '🧬',
  color: '#b6ff4a',
  quote: '...',
  passive: {
    name: '元素周期律',
    text: '...',
    atkPerDistinctTag: 100
  },
  actives: [{
    id: 'periodic_deduction',
    name: '周期律推演',
    once: 'duel',            // duel | turn
    timing: 'main',          // main | battle | any
    text: '抽 2 张卡，然后随机丢弃 1 张手牌。',
    condition(g, p, skill) { return true; },
    conditionText: '...',
    aiTiming: 'early',       // early | late
    aiUse(g, p, skill) { return true; },
    activate(g, p, skill) { g.draw(p, 2); g.discardRandom(p); },
    cost: { discard: 1, lp: 0 } // 可选
  }]
}
```

可用被动字段：

`allAtk`、`allDef`、`tagAtk`、`tagDef`、`fusionAtk`、`fusionDef`、`atkPerDistinctTag`、`defPerDistinctTag`、`effectDamageReduction`、`endHeal`、`startingLP`、`startingHand`。

### 5.4 卡组

```js
{
  id: 'acid',
  name: '酸雨侵蚀',
  subtitle: 'ACID RAIN',
  icon: '🧪',
  color: '#c6ff3d',
  style: '腐蚀 / 爆发',
  tagline: '...',
  desc: '...',
  main: ['H2SO4', ...],   // 40 张
  extra: ['aqua_regia_fusion', ...] // 0–6 张
}
```

### 5.5 自定义卡组

保存在 `localStorage`：

```text
key: chemistry-duel.custom-decks.v1
value: [ { id, name, main: [...], extra: [...], updatedAt, custom: true, ... } ]
```

规则：

- 主卡组必须正好 40 张；
- 额外 0–6 张，且只能放 `kind === 'fusion'`；
- 同名卡最多 3 张（主 + 额外合计）；
- 自定义卡组在标题界面可编辑 / 删除；
- AI 只从预设卡组中选择，避免使用玩家未完成的自定义卡组。

---

## 6. 规则引擎

### 6.1 对局状态

`Duel` 持有：

- `players[0/1]`：LP、deck、hand、monsters、spells、field、gy、extra；
- `turn`、`active`、`phase`；
- `chemists`、`skillUses`、`skillTurnUses`；
- `normalSummonUsed`、`fusionUsed`；
- `logs`、`winner`、`lastAction`。

### 6.2 回合与抽卡

```js
beginTurn();
// turn++
// phase = 'main'
// 先攻第 1 回合不抽卡；其余回合 draw(active, 2)
// 重置 hasAttacked / positionChanged / skillTurnUses
// 触发 onTurnStart
```

### 6.3 召唤 / 融合 / 战斗

- `normalSummon(p, handIndex, { tributes, set })`
- `fusionSummon(p, extraIndex)`：自动按标签寻找素材，优先手牌与低价值场怪。
- `attack(p, attackerZone, targetZone|null)`
- `battleOutcome(attacker, target)` 提供纯计算，可供 AI 使用。
- 战斗结果处理：腐蚀、中和、贯通、战斗免疫、战斗反伤。
- 每只怪兽每回合攻击 1 次；每回合通常召唤 1 次；融合 1 次。

### 6.4 陷阱窗口

`tryTraps(p, event, ctx)` 扫描该玩家的陷阱：

- `event: 'attack' | 'spell' | 'summon' | 'damage'`
- 盖放的陷阱需 `setTurn < turn` 才能触发；
- 一次事件最多触发 1 张；
- `ctx.negated = true` 可无效攻击 / 魔法；
- 普通陷阱结算后送入墓地，永续陷阱保留。

### 6.5 化学家技能

```js
g.activeSkills(p);              // 主动技能数组
g.canActivateSkill(p, skill);   // { ok, reason }
g.activateSkill(p, skill.id);   // 支付 cost、记录次数、执行 activate
g.skillState(p, skill);         // used / turnUsed
```

默认每个主动技能每场决斗 1 次。`once: 'turn'` 支持每回合一次；`timing` 支持 `main` / `battle` / `any`。

### 6.6 常用效果 API

| API | 用途 |
|---|---|
| `g.draw(p, n)` / `g.mill(p, n)` | 抽卡 / 堆墓 |
| `g.gainLP` / `g.damagePlayer` / `g.burn` / `g.heal` | LP |
| `g.destroyMonster(card, opts)` | 破坏（含防护判定） |
| `g.sendToGY(card, opts)` | 送入墓地（不触发破坏） |
| `g.specialSummonFromGY` / `specialSummonFromDeck` | 特殊召唤 |
| `g.addDeckCardToHand` / `addGYCardToHand` / `discardRandom` | 检索 / 回收 / 弃牌 |
| `g.monsters(p, { faceUp })` / `enemyMonsters(p)` | 场面查询 |
| `g.effectiveAtk` / `effectiveDef` | 有效数值 |
| `g.weakenEnemy` / `buffOwn` | 群体数值修正 |
| `g.deckChoices` / `gyChoices` | 卡组 / 墓地筛选 |

### 6.7 效果钩子

| 钩子 | 时机 |
|---|---|
| `onSummon(g, self)` | 通常 / 特殊 / 融合召唤成功 |
| `onDestroyed(g, self, opts)` | 被破坏送入墓地 |
| `onBattleDamage(g, self, target)` | 给予对方战斗伤害 |
| `onBattleDestroy(g, self, target)` | 战斗破坏对方怪兽 |
| `beforeDamage(g, self, target)` | 攻击宣言后、伤害前，返回 `true` 停止 |
| `battleAtk(g, self, target)` | 伤害计算时的 ATK 修正 |
| `staticAtk` / `staticDef` | 持续数值 |
| `aura` | 己方光环（可按 tags 过滤） |
| `onTurnStart` / `onEndPhase` | 回合开始 / 结束 |
| `pierce` / `immuneBattle` / `immuneEffect` / `acidProof` / `shieldOnce` | 战斗与防护 |

---

## 7. 内容注册与扩展

`js/content.js` 汇总核心内容，并提供：

```js
ChemContent.registerCard(def);
ChemContent.registerCards({ id: def, ... });
ChemContent.registerDeck(deck);
ChemContent.registerDecks({ id: deck, ... });
ChemContent.registerChemist(chemist);
ChemContent.registerChemists({ id: chemist, ... });
ChemContent.registerExpansion({
  id, name,
  cards, decks, deckOrder,
  chemists, chemistOrder
});
ChemContent.validate();
```

扩展包必须：

1. 放在 `js/expansions/`；
2. 在 `index.html` 中于 `content.js` 之后、`ui.js` 之前加载；
3. 使用全局唯一 ID；
4. 不依赖 UI DOM；
5. 卡组必须满足 40 主 + 0–6 额外。

模板：`js/expansions/_template.js`。  
详细约定：`js/expansions/README.md`。

新增内容后运行：

```bash
node test/gen-cards.js
node test/gen-decks.js
node test/gen-chemists.js
```

生成器读取 `ChemContent`，因此核心与扩展内容都会进入文档（前提是扩展脚本在 Node 侧也被加载）。

---

## 8. UI 与卡组构筑器

### 8.1 UI 状态

`ui.js` 顶部的 `S` 保存：

```js
{
  game, playerDeck, aiDeck, playerChemist, aiChemist,
  selected, pending, busy,
  modalType, customDecks, builder, deleteDeckId,
  poolKind, poolTag, pileView, ...
}
```

### 8.2 渲染

`render()` 重建：

- 双方 HUD（LP、手牌、卡组、墓地、额外、化学家）；
- 双方场地；
- 回合条（技能、战斗、融合、结束）；
- 手牌；
- 详情面板；
- 日志。

所有点击通过事件委托进入 `handleAction` / `handleZoneClick` / `handleHandClick` / `handleModalClick`。

### 8.3 卡组构筑器流程

```text
标题「新建卡组」/ 编辑
  → openDeckBuilder()
  → S.builder = { id, name, main, extra, kind, tag }
  → 左侧卡池点击：builderAdd(id)
  → 右侧列表 +/−：builderAdd / builderRemove
  → 保存：isDeckLegal 校验
  → sanitizeCustomDeck
  → localStorage
  → S.playerDeck = 新卡组
  → renderStart()
```

关键约束：

- `builderAdd` 按卡牌种类自动进主卡组或额外；
- 主卡组上限 40，额外上限 6，同名上限 3；
- `isDeckLegal` 要求主卡组正好 40；
- 保存按钮在未完成时禁用；
- 添加卡牌时通过 `rerenderBuilder()` 保留卡池/卡组滚动位置；
- 删除自定义卡组会弹出确认，若删除当前选中卡组则回退到预设「酸雨侵蚀」。

### 8.4 响应式

- ≥ 1000px 高度：大卡片；
- 821–999px：中等卡片；
- ≤ 720px / 640px：紧凑对局布局；
- ≤ 620px：移动端详情底部抽屉、卡池单列、HUD 精简；
- 卡组构筑器在 ≤ 860px 改为上下布局。

---

## 9. AI

`ai.js` 每个回合：

1. 评估融合；
2. 早期技能（抽卡 / 回收）；
3. 魔法；
4. 通常召唤；
5. 盖陷阱；
6. 表示形式调整；
7. 战斗前技能；
8. 战斗；
9. 结束回合。

### 9.1 技能决策

每个主动技能可提供：

```js
aiTiming: 'early' | 'late',
aiUse(g, p, skill) { return boolean; }
```

AI 通过 `g.canActivateSkill` 做合法性检查，因此新增技能只要复用引擎 API，就能被 AI 使用。

### 9.2 调参入口

- `js/ai.js` 中的 `value`、`chooseFusion`、`chooseSpell`、`chooseSummon`、`chooseAttack`；
- `js/cards.js` 的卡牌数值与效果；
- `js/chemists.js` 的被动字段、技能数值、`aiUse`；
- `js/decks.js` 的卡组构成。

---

## 10. 测试

```bash
node test/rules.test.js     # 13 项规则断言
node test/effects.test.js   # 135 张卡效果冒烟
node test/chemists.test.js  # 14 项化学家 / 技能
node test/simulate.js       # 120 局 AI vs AI
```

当前基线：

- 13 / 13 规则；
- 135 / 135 卡效果无异常；
- 14 / 14 化学家；
- 120 局 0 运行时错误，平均约 12 个玩家回合。

### 添加测试

- 新规则 → `test/rules.test.js`；
- 新卡 → `test/effects.test.js` 会自动覆盖所有卡；
- 新化学家 / 技能 → `test/chemists.test.js`；
- 大规模平衡 → 扩展 `test/simulate.js` 的化学家 / 卡组组合。

---

## 11. 开发规范

1. 引擎中不要出现 `document` / `window` / DOM。
2. 卡牌效果只通过 `g` API 修改状态。
3. 新内容优先通过 `ChemContent.registerExpansion` 注入，不直接改 UI。
4. 卡牌 ID、化学家 ID、卡组 ID 全局唯一。
5. 新增卡牌必须同步更新卡组或扩展文档。
6. 不要把密钥、token、个人路径写入仓库。
7. 提交前至少运行：

```bash
node test/rules.test.js
node test/effects.test.js
node test/chemists.test.js
node test/simulate.js
```

8. 修改卡牌 / 卡组 / 化学家后运行对应生成器。

---

## 12. 发布到 GitHub

仓库与在线站点：

```text
https://github.com/NagasakiSaki/chemistry-duel
https://nagasakisaki.github.io/chemistry-duel/
```

GitHub Pages 已启用，来源为 `main` 分支根目录；推送后会自动重新构建。

### 首次推送

```bash
git init
git add .
git commit -m "feat: chemistry duel with chemists and deck builder"
git branch -M main
git remote add origin https://github.com/NagasakiSaki/chemistry-duel.git
git push -u origin main
```

### 后续更新

```bash
git add .
git commit -m "feat: ..."
git push
```

### GitHub Pages

仓库是纯静态站点，Pages 已配置为 `main` 分支根目录。更新 `main` 后会自动重新构建，访问：

```text
https://nagasakisaki.github.io/chemistry-duel/
```

`file://` 与 `https://` 都能运行；`localStorage` 在两者下分别独立。

---

## 13. 已知简化

- 无连锁（Chain）；陷阱按事件自动触发，每次事件最多 1 张。
- 无主要阶段 2、无手牌上限。
- 融合素材自动选择，不提供逐张选择界面。
- 化学家技能自动结算，没有额外目标选择窗口。
- 自定义卡组保存在 `localStorage`，不跨设备同步。
- 化学数值是游戏化抽象，不保证与真实热力学 / 动力学一致。

---

## 14. 路线图

- [ ] 连锁与多陷阱窗口。
- [ ] 卡组导入 / 导出（JSON / 分享码）。
- [ ] 更多化学家与角色专属技能。
- [ ] 扩展包：电化学、有机化学、分析化学。
- [ ] 回放与战斗日志导出。
- [ ] 音效与召唤 / 攻击动画。
- [ ] 可选的 AI 难度分级。

---

*最后更新：2026-10-18*
