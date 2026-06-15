# hexo-knowledge-graph

面向 Hexo 的分类知识网络插件。它读取文章分类和
`{% post_link ... %}`，在分类页生成可拖拽的 2D 力导向图。

## 特性

- 顶层分类作为根节点。
- 点击分类后，仅展示该分类、所属文章和引用上下文。
- 分类与文章之间使用实线。
- `post_link` 形成的文章关系使用浅色虚线。
- 跨分类引用目标以淡色访客节点保留。
- 标签暂不生成节点或连线。
- 支持拖拽、缩放、平移和 PJAX 页面切换。
- `force-graph` 作为本地依赖发布，不依赖 CDN。
- 使用 Hexo 标准 Injector，主题无需修改 `node_modules`。

## 安装

```bash
npm install hexo-knowledge-graph --save
```

Hexo 会自动加载依赖中的插件。默认配置适用于分类页路径
`/categories/`，并针对 ShokaX 的 `.collapse.wrap` 插入图谱。

## 配置

在站点 `_config.yml` 中添加：

```yaml
knowledge_graph:
  enable: true
  auto_mount: true
  categories_path: /categories/
  target_selector: .collapse.wrap
  insert_position: beforebegin
  title: 知识网络
  height: 620px

  include_uncategorized: false
  uncategorized_label: 未分类

  colors:
    category: "#786395"
    post: "#e3ae63"
    visitor: "#d7dbe1"
    categoryLink: "rgba(120, 99, 149, 0.72)"
    referenceLink: "rgba(150, 158, 170, 0.42)"
```

其他主题只需把 `target_selector` 改为分类列表或分类页正文容器的
CSS 选择器。

## 链接规则

插件直接读取 Markdown 源文件中的 Hexo 内部链接：

```markdown
{% post_link CS/OS/文件管理 %}
{% post_link CS/OS/文件管理 文件管理 %}
{% post_link CS/OS/文件管理#文件目录的实现 文件目录实现 %}
```

章节锚点会保存在关系元数据中，但不会单独生成章节节点。代码围栏、
行内代码和 HTML 注释中的示例不会进入图谱。

## 交互规则

1. 初始视图仅显示顶层分类。
2. 点击分类后，显示该分类的文章。
3. 当前分类文章引用的外部文章会以淡色访客节点显示。
4. 其他分类根节点和无关文章会被隐藏。
5. 再次点击当前分类、点击空白处或点击“返回分类总览”恢复总览。
6. 点击文章节点进入文章页面。

所有可见节点均可拖拽，拖拽会重新激活力导向布局。

## 手动挂载

自动挂载之外，也可以在 Markdown 页面中使用标签：

```markdown
{% knowledge_graph 700px %}
```

主题模板可以使用 Helper：

```ejs
<%- knowledge_graph({ height: '700px', title: '知识网络' }) %>
```

## 生成文件

插件在 Hexo 构建时生成：

```text
knowledge-graph/
├── graph.json
├── knowledge-graph.js
├── knowledge-graph.css
└── force-graph.min.js
```

路径可通过 `asset_path` 和 `data_path` 调整。

## 开发

```bash
npm install
npm test
npm run check
npm pack --dry-run
```

要求 Node.js 20 或更高版本，兼容 Hexo 4 至 Hexo 8。

## License

MIT
