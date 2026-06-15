"use strict";

const path = require("node:path");
const { parsePostLinks } = require("./post-link-parser");

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

module.exports = {
  buildGraphData,
  entityId,
  normalizeLookupKey,
  normalizeSource,
  siteUrl,
  toArray
};
