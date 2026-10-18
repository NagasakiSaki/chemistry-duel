# 扩展包目录

这里是后续内容的唯一入口。核心内容加载完成后，`js/content.js` 会创建全局注册表：

```js
ChemContent.registerExpansion({
  id: 'pack-02-electro',
  name: '电化学时代',
  cards: { /* id -> card definition */ },
  decks: { /* id -> deck definition */ },
  deckOrder: ['electro_deck'],
  chemists: { /* id -> chemist definition */ },
  chemistOrder: ['faraday']
});
```

## 接入新扩展包

1. 复制 `_template.js` 为 `pack-02.js`，修改内容。
2. 在 `index.html` 中，把扩展脚本放在 **`js/content.js` 之后、`js/ui.js` 之前**：

```html
<script src="js/content.js"></script>
<script src="js/expansions/pack-02.js"></script>
<script src="js/ai.js"></script>
<script src="js/ui.js"></script>
```

3. 刷新页面。新卡、新卡组、新化学家会自动出现在：

- 标题界面的卡组选择 / 化学家选择；
- 游戏内「卡池」；
- 构建 `Duel` 时的合并卡池；
- AI 的选卡与技能判断（新技能提供 `aiUse` 即可）。

## 约定

- 卡牌 ID、卡组 ID、化学家 ID 全局唯一；重复注册会直接抛错。
- 主卡组 40 张、额外卡组 6 张，同名卡最多 3 张。
- 新卡效果使用 `js/engine.js` 的公共 API（`g.draw`、`g.burn`、`g.heal`、
  `g.destroyMonster`、`g.specialSummonFromGY` 等），不要直接改 UI DOM。
- 新化学家可以在 `passive` 中使用引擎已支持的字段，或通过 `actives[].activate`
  写自定义效果。
- 扩展卡组会出现在标题界面，但不会被 AI 自动选到，除非扩展自己也提供 AI
  或把卡组加入 `deckOrder`。

## 推荐的扩展方向

- 元素周期表分区包（碱金属、卤素、过渡金属、惰性气体）。
- 有机化学包（烷烃、烯烃、醇、醛、羧酸、酯）。
- 电化学包（原电池、电解池、离子迁移）。
- 分析化学包（滴定、指示剂、光谱）。
- 新化学家：法拉第（电化学）、凯库勒（结构式）、阿伦尼乌斯（电离）、
  屠呦呦（天然产物）、卢瑟福（放射性）。
