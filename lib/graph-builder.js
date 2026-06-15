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

function enrichWithKnowledgeMap(graph) {
  // Annotate real nodes with cluster info and layers.
  // Categories are the root/cluster-center nodes. Posts are leaf nodes.
  // Cross-category bridges emerge naturally from post_link references.

  const nodes = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
  const links = Array.isArray(graph.links) ? [...graph.links] : [];

  // ── Assign cluster and layer to every node ──────────────────────
  for (const node of nodes) {
    if (node.type === "category") {
      node.cluster = resolveCategoryGroup(node.name);
      // Categories are always core — they form the visible skeleton
      node.layer = "core";
      node.size = 10;
    } else if (node.type === "post") {
      // Determine cluster from the category this post belongs to
      const postLinks = links.filter(
        (link) => link.type === "category"
          && (typeof link.target === "object" ? link.target.id : link.target) === node.id
      );
      const catNames = postLinks.map((link) => {
        const srcId = typeof link.source === "object" ? link.source.id : link.source;
        const cat = nodes.find((n) => n.id === srcId && n.type === "category");
        return cat ? cat.name : "";
      });

      let assignedCluster = "core";
      for (const name of catNames) {
        assignedCluster = resolveCategoryGroup(name);
        if (assignedCluster !== "core") break;
      }
      node.cluster = assignedCluster;
      node.layer = "detail";
      node.size = 5;
    }
  }

  // ── Elevate bridge posts (posts that link to other-cluster posts) ──
  const refLinks = links.filter((link) => link.type === "reference");
  for (const link of refLinks) {
    const srcId = typeof link.source === "object" ? link.source.id : link.source;
    const tgtId = typeof link.target === "object" ? link.target.id : link.target;
    const srcNode = nodes.find((n) => n.id === srcId && n.type === "post");
    const tgtNode = nodes.find((n) => n.id === tgtId && n.type === "post");
    if (srcNode && tgtNode) {
      // A post with references is more important — show in compact view
      if (srcNode.layer !== "core") srcNode.layer = "bridge";
      if (tgtNode.layer !== "core") tgtNode.layer = "bridge";
      if (srcNode.size < 7) srcNode.size = 7;
      if (tgtNode.size < 7) tgtNode.size = 7;
    }
  }

  // ── Add inter-category links for posts that bridge clusters ────
  const interCategoryLinks = new Map();
  for (const link of refLinks) {
    const srcId = typeof link.source === "object" ? link.source.id : link.source;
    const tgtId = typeof link.target === "object" ? link.target.id : link.target;
    const srcNode = nodes.find((n) => n.id === srcId && n.type === "post");
    const tgtNode = nodes.find((n) => n.id === tgtId && n.type === "post");
    if (srcNode && tgtNode && srcNode.cluster !== tgtNode.cluster) {
      // Find the categories these posts belong to
      const srcCat = getCategoryForPost(srcId, nodes, links);
      const tgtCat = getCategoryForPost(tgtId, nodes, links);
      if (srcCat && tgtCat && srcCat.id !== tgtCat.id) {
        const key = `${srcCat.id} ${tgtCat.id}`;
        if (!interCategoryLinks.has(key)) {
          interCategoryLinks.set(key, {
            source: srcCat.id,
            target: tgtCat.id,
            type: "inter-category",
            weight: 0.6,
            dashed: true
          });
        }
      }
    }
  }

  for (const [key, interLink] of interCategoryLinks) {
    const existing = links.find((link) => {
      const s = typeof link.source === "object" ? link.source.id : link.source;
      const t = typeof link.target === "object" ? link.target.id : link.target;
      return (s === interLink.source && t === interLink.target)
        || (s === interLink.target && t === interLink.source);
    });
    if (!existing) {
      links.push(interLink);
    }
  }

  return {
    nodes,
    links,
    meta: {
      ...graph.meta,
      bridgePostCount: nodes.filter((n) => n.layer === "bridge").length,
      interCategoryLinkCount: interCategoryLinks.size
    }
  };
}

function getCategoryForPost(postId, nodes, links) {
  for (const link of links) {
    const srcId = typeof link.source === "object" ? link.source.id : link.source;
    const tgtId = typeof link.target === "object" ? link.target.id : link.target;
    if (link.type === "category" && tgtId === postId) {
      return nodes.find((n) => n.id === srcId && n.type === "category");
    }
  }
  return null;
}

module.exports = {
  buildGraphData,
  CLUSTER_COLORS,
  CLUSTER_GROUPS,
  enrichWithKnowledgeMap,
  entityId,
  normalizeLookupKey,
  normalizeSource,
  siteUrl,
  toArray
};
