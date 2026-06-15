"use strict";

const path = require("node:path");
const { parsePostLinks } = require("./post-link-parser");

const CLUSTER_GROUPS = [
  { id: "ai", label: "AI / ML", color: "#7aa2f7", keywords: ["ai", "llm", "ml", "深度学习", "机器学习", "强化学习", "agent", "rag", "多模态"] },
  { id: "cs", label: "CS 基础", color: "#41a6b5", keywords: ["编程", "数据结构", "os", "计组", "计网", "网络"] },
  { id: "math", label: "数学", color: "#bb9af7", keywords: ["数学", "现代控制论", "控制", "信号", "优化"] },
  { id: "reading", label: "Reading", color: "#e0af68", keywords: ["reading", "论文", "笔记", "读书"] },
  { id: "industry", label: "工业应用", color: "#f7768e", keywords: ["工业", "诊断", "故障", "检测", "生产"] }
];

const CLUSTER_COLORS = {
  ai: "#7aa2f7",
  cs: "#41a6b5",
  math: "#bb9af7",
  reading: "#e0af68",
  industry: "#f7768e",
  core: "#8eb8f0"
};

const KNOWLEDGE_MAP = {
  topics: [
    // ── AI cluster ──
    { id: "topic:ai", label: "AI", cluster: "ai", size: 11, layer: "core" },
    { id: "topic:ml", label: "ML", cluster: "ai", size: 8, layer: "core" },
    { id: "topic:dl", label: "深度学习", cluster: "ai", size: 7 },
    { id: "topic:rl", label: "强化学习", cluster: "ai", size: 7 },
    { id: "topic:data", label: "数据处理", cluster: "ai", size: 6 },
    // ── CS cluster ──
    { id: "topic:programming", label: "编程", cluster: "cs", size: 8, layer: "core" },
    { id: "topic:ds", label: "数据结构", cluster: "cs", size: 7 },
    { id: "topic:os", label: "OS", cluster: "cs", size: 6 },
    { id: "topic:network", label: "网络", cluster: "cs", size: 6 },
    // ── Math cluster ──
    { id: "topic:math", label: "数学", cluster: "math", size: 8, layer: "core" },
    { id: "topic:control", label: "现代控制论", cluster: "math", size: 7 },
    { id: "topic:signal", label: "信号与系统", cluster: "math", size: 6 },
    { id: "topic:optimization", label: "优化", cluster: "math", size: 6 },
    // ── Reading cluster ──
    { id: "topic:reading", label: "Reading", cluster: "reading", size: 7, layer: "core" },
    { id: "topic:papers", label: "论文", cluster: "reading", size: 6 },
    { id: "topic:notes", label: "笔记", cluster: "reading", size: 5 },
    // ── Industry cluster ──
    { id: "topic:industry", label: "工业诊断", cluster: "industry", size: 8, layer: "core" },
    { id: "topic:agent", label: "Agent", cluster: "industry", size: 7 },
    { id: "topic:rag", label: "RAG", cluster: "industry", size: 7 },
    { id: "topic:multimodal", label: "多模态", cluster: "industry", size: 7 }
  ],
  links: [
    // ── Within cluster: AI ──
    { source: "topic:ai", target: "topic:ml", weight: 2 },
    { source: "topic:ml", target: "topic:dl", weight: 1.5 },
    { source: "topic:ml", target: "topic:rl", weight: 1.5 },
    { source: "topic:ai", target: "topic:data", weight: 1 },
    { source: "topic:dl", target: "topic:data", weight: 0.8 },
    // ── Within cluster: CS ──
    { source: "topic:programming", target: "topic:ds", weight: 1.8 },
    { source: "topic:programming", target: "topic:os", weight: 1.2 },
    { source: "topic:programming", target: "topic:network", weight: 1 },
    { source: "topic:ds", target: "topic:os", weight: 0.8 },
    // ── Within cluster: Math ──
    { source: "topic:math", target: "topic:control", weight: 1.8 },
    { source: "topic:math", target: "topic:optimization", weight: 1.5 },
    { source: "topic:control", target: "topic:signal", weight: 1.5 },
    { source: "topic:optimization", target: "topic:control", weight: 1 },
    // ── Within cluster: Reading ──
    { source: "topic:reading", target: "topic:papers", weight: 1.5 },
    { source: "topic:reading", target: "topic:notes", weight: 1.2 },
    { source: "topic:papers", target: "topic:notes", weight: 0.8 },
    // ── Within cluster: Industry ──
    { source: "topic:industry", target: "topic:agent", weight: 1.8 },
    { source: "topic:industry", target: "topic:rag", weight: 1.5 },
    { source: "topic:industry", target: "topic:multimodal", weight: 1.2 },
    { source: "topic:agent", target: "topic:rag", weight: 1.2 },
    { source: "topic:rag", target: "topic:multimodal", weight: 1 },
    // ── Bridge: AI ↔ Industry ──
    { source: "topic:ai", target: "topic:agent", weight: 1.5 },
    { source: "topic:ai", target: "topic:industry", weight: 1.2 },
    { source: "topic:ml", target: "topic:rag", weight: 0.8 },
    // ── Bridge: AI ↔ Math ──
    { source: "topic:ml", target: "topic:math", weight: 1.2 },
    { source: "topic:ml", target: "topic:optimization", weight: 1 },
    { source: "topic:ai", target: "topic:math", weight: 0.8 },
    // ── Bridge: CS ↔ AI ──
    { source: "topic:programming", target: "topic:ai", weight: 0.8 },
    { source: "topic:data", target: "topic:ds", weight: 0.6 },
    // ── Bridge: Math ↔ CS ──
    { source: "topic:math", target: "topic:programming", weight: 0.6 },
    // ── Bridge: Reading ↔ all ──
    { source: "topic:reading", target: "topic:ai", weight: 0.6 },
    { source: "topic:reading", target: "topic:math", weight: 0.4 },
    { source: "topic:reading", target: "topic:industry", weight: 0.4 }
  ]
};

function resolveCategoryGroup(categoryName) {
  const lower = String(categoryName || "").toLowerCase();
  for (const group of CLUSTER_GROUPS) {
    if (group.keywords.some((kw) => lower.includes(kw))) {
      return group.id;
    }
  }
  return "core";
}

function toArray(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection.toArray === "function") return collection.toArray();
  if (typeof collection.each === "function") {
    const result = [];
    collection.each((item) => result.push(item));
    return result;
  }
  return Array.from(collection);
}

function entityId(value) {
  if (value == null) return "";
  if (typeof value === "object" && value._id != null) {
    return entityId(value._id);
  }
  return String(value);
}

function normalizeSource(source) {
  return String(source || "")
    .replaceAll("\\", "/")
    .replace(/^source\/_posts\//, "")
    .replace(/^_posts\//, "")
    .replace(/\.[^.\/]+$/, "")
    .replace(/^\/+|\/+$/g, "");
}

function normalizeLookupKey(value) {
  const rawValue = String(value || "");
  let decodedValue = rawValue;
  try {
    decodedValue = decodeURIComponent(rawValue);
  } catch {
    // A literal percent sign is valid in a title even if it is not URI encoded.
  }
  return decodedValue
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.[^.\/]+$/, "");
}

function siteUrl(value, root = "/") {
  const pathValue = String(value || "").replace(/^\/+/, "");
  const rootValue = `/${String(root || "/").replace(/^\/+|\/+$/g, "")}`;
  const prefix = rootValue === "/" ? "/" : `${rootValue}/`;
  return `${prefix}${pathValue}`.replace(/\/{2,}/g, "/");
}

function postSource(post) {
  return post.raw || post._content || post.content || "";
}

function buildPostAliases(post, canonical) {
  const aliases = new Set([
    canonical,
    post.slug,
    post.title,
    post.path,
    path.posix.basename(canonical)
  ]);

  return Array.from(aliases)
    .map(normalizeLookupKey)
    .filter(Boolean);
}

function buildGraphData(locals, options = {}) {
  const posts = toArray(locals?.posts);
  const categories = toArray(locals?.categories);
  const categoryById = new Map(
    categories.map((category) => [entityId(category._id), category])
  );
  const rootCache = new Map();

  const findRoot = (category) => {
    const startId = entityId(category?._id);
    if (!startId) return category;
    if (rootCache.has(startId)) return rootCache.get(startId);

    let current = category;
    const visited = new Set();
    while (current?.parent != null && entityId(current.parent)) {
      const currentId = entityId(current._id);
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const parent = categoryById.get(entityId(current.parent));
      if (!parent) break;
      current = parent;
    }

    for (const id of visited) rootCache.set(id, current);
    rootCache.set(startId, current);
    return current;
  };

  const nodes = [];
  const links = [];
  const categoryNodes = new Map();
  const postNodes = new Map();
  const postAliases = new Map();
  const categoryMemberships = [];

  const ensureCategoryNode = (category) => {
    const rawId = entityId(category?._id) || normalizeLookupKey(category?.name);
    const id = `category:${rawId || "uncategorized"}`;
    if (!categoryNodes.has(id)) {
      const node = {
        id,
        type: "category",
        name: category?.name || options.uncategorizedLabel || "Uncategorized",
        url: siteUrl(category?.path || "", options.root),
        val: 18
      };
      categoryNodes.set(id, node);
      nodes.push(node);
    }
    return categoryNodes.get(id);
  };

  const syntheticCategory = {
    _id: "uncategorized",
    name: options.uncategorizedLabel || "Uncategorized",
    path: ""
  };

  posts.forEach((post, index) => {
    const canonical = normalizeSource(
      post.source || post.full_source || post.slug || post.title || `post-${index}`
    );
    const id = `post:${canonical}`;
    const node = {
      id,
      type: "post",
      name: post.title || post.slug || canonical,
      url: siteUrl(post.path || "", options.root),
      source: canonical,
      val: 7
    };
    postNodes.set(id, node);
    nodes.push(node);

    for (const alias of buildPostAliases(post, canonical)) {
      if (!postAliases.has(alias)) postAliases.set(alias, id);
    }

    const postCategories = toArray(post.categories);
    const roots = new Map();
    for (const category of postCategories) {
      const root = findRoot(category);
      if (root) roots.set(entityId(root._id) || root.name, root);
    }

    if (!roots.size && options.includeUncategorized) {
      roots.set("uncategorized", syntheticCategory);
    }

    for (const root of roots.values()) {
      const categoryNode = ensureCategoryNode(root);
      categoryMemberships.push({
        source: categoryNode.id,
        target: id,
        type: "category",
        dashed: false
      });
    }
  });

  links.push(...categoryMemberships);

  const referenceLinks = new Map();
  const unresolvedReferences = [];

  posts.forEach((post, index) => {
    const canonical = normalizeSource(
      post.source || post.full_source || post.slug || post.title || `post-${index}`
    );
    const sourceId = `post:${canonical}`;

    for (const reference of parsePostLinks(postSource(post))) {
      const targetId = postAliases.get(normalizeLookupKey(reference.target));
      if (!targetId) {
        unresolvedReferences.push({
          source: canonical,
          target: reference.target
        });
        continue;
      }
      if (targetId === sourceId) continue;

      const key = `${sourceId}\u0000${targetId}`;
      if (!referenceLinks.has(key)) {
        referenceLinks.set(key, {
          source: sourceId,
          target: targetId,
          type: "reference",
          dashed: true,
          references: []
        });
      }

      const link = referenceLinks.get(key);
      const metadata = {
        anchor: reference.anchor,
        label: reference.label
      };
      const metadataKey = `${metadata.anchor}\u0000${metadata.label}`;
      const seen = new Set(
        link.references.map((item) => `${item.anchor}\u0000${item.label}`)
      );
      if (!seen.has(metadataKey)) {
        link.references.push(metadata);
      }
    }
  });

  links.push(...referenceLinks.values());

  return {
    nodes: [
      ...nodes.filter((node) => node.type === "category"),
      ...nodes.filter((node) => node.type === "post")
    ],
    links,
    meta: {
      version: 1,
      categoryCount: categoryNodes.size,
      postCount: postNodes.size,
      referenceCount: referenceLinks.size,
      unresolvedReferences
    }
  };
}

function enrichWithKnowledgeMap(graph, options = {}) {
  const map = options.knowledgeMap || KNOWLEDGE_MAP;
  if (!map || !map.topics) return graph;

  const nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
  const links = Array.isArray(graph.links) ? [...graph.links] : [];

  // Add topic nodes
  const topicNodeMap = new Map();
  for (const topic of map.topics) {
    const node = {
      id: topic.id,
      type: "topic",
      name: topic.label,
      cluster: topic.cluster,
      size: topic.size || 6,
      layer: topic.layer || "detail",
      url: ""
    };
    topicNodeMap.set(topic.id, node);
    nodes.push(node);
  }

  // Add inter-topic links
  for (const link of map.links || []) {
    if (topicNodeMap.has(link.source) && topicNodeMap.has(link.target)) {
      links.push({
        source: link.source,
        target: link.target,
        type: "topic",
        weight: link.weight || 0.5,
        dashed: false
      });
    }
  }

  // Map real category nodes to topics via keyword matching
  const categoryKeywords = new Map();
  for (const group of CLUSTER_GROUPS) {
    for (const keyword of group.keywords) {
      categoryKeywords.set(keyword.toLowerCase(), group.id);
    }
  }

  // Connect category nodes to matching topic nodes
  for (const node of nodes) {
    if (node.type !== "category" || !node.name) continue;
    const lowerName = node.name.toLowerCase();

    for (const [keyword, clusterId] of categoryKeywords) {
      if (lowerName.includes(keyword)) {
        // Find a suitable topic node in this cluster to link to
        for (const topic of map.topics) {
          if (topic.cluster === clusterId && topic.layer === "core") {
            const existingLink = links.find((link) => {
              const srcId = typeof link.source === "object" ? link.source.id : link.source;
              const tgtId = typeof link.target === "object" ? link.target.id : link.target;
              return (srcId === topic.id && tgtId === node.id)
                || (tgtId === topic.id && srcId === node.id);
            });
            if (!existingLink) {
              links.push({
                source: topic.id,
                target: node.id,
                type: "category-topic",
                weight: 0.4,
                dashed: true
              });
            }
            break;
          }
        }
        break;
      }
    }
  }

  // Connect post nodes to topic nodes via their category links
  const postToCategory = new Map();
  for (const link of links) {
    if (link.type === "category") {
      const srcId = typeof link.source === "object" ? link.source.id : link.source;
      const tgtId = typeof link.target === "object" ? link.target.id : link.target;
      const catNode = nodes.find((n) => n.id === srcId && n.type === "category");
      if (catNode) {
        if (!postToCategory.has(tgtId)) postToCategory.set(tgtId, new Set());
        postToCategory.get(tgtId).add(catNode.name?.toLowerCase() || "");
      }
    }
  }

  for (const [postId, catNames] of postToCategory) {
    const catNamesArr = Array.from(catNames);
    for (const [keyword, clusterId] of categoryKeywords) {
      if (catNamesArr.some((cn) => cn.includes(keyword))) {
        for (const topic of map.topics) {
          if (topic.cluster === clusterId && topic.layer === "core") {
            const existingLink = links.find((link) => {
              const srcId = typeof link.source === "object" ? link.source.id : link.source;
              const tgtId = typeof link.target === "object" ? link.target.id : link.target;
              return (srcId === topic.id && tgtId === postId)
                || (tgtId === topic.id && srcId === postId);
            });
            if (!existingLink) {
              links.push({
                source: topic.id,
                target: postId,
                type: "post-topic",
                weight: 0.25,
                dashed: true
              });
            }
          }
        }
        break;
      }
    }
  }

  return {
    nodes,
    links,
    meta: {
      ...graph.meta,
      topicCount: map.topics.length,
      topicLinkCount: map.links.length
    }
  };
}

module.exports = {
  buildGraphData,
  CLUSTER_COLORS,
  CLUSTER_GROUPS,
  KNOWLEDGE_MAP,
  enrichWithKnowledgeMap,
  entityId,
  normalizeLookupKey,
  normalizeSource,
  siteUrl,
  toArray
};
