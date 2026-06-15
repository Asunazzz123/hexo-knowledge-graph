"use strict";

const DEFAULTS = Object.freeze({
  enable: true,
  autoMount: true,
  categoriesPath: "/categories/",
  targetSelector: ".collapse.wrap",
  insertPosition: "beforebegin",
  title: "知识网络",
  height: "620px",
  assetPath: "knowledge-graph/",
  dataPath: "knowledge-graph/graph.json",
  includeUncategorized: false,
  uncategorizedLabel: "Uncategorized",
  colors: {
    category: "#786395",
    post: "#e3ae63",
    visitor: "#d7dbe1",
    categoryLink: "rgba(120, 99, 149, 0.72)",
    referenceLink: "rgba(150, 158, 170, 0.42)"
  }
});

function firstDefined(source, camelName, snakeName, fallback) {
  if (source?.[camelName] !== undefined) return source[camelName];
  if (source?.[snakeName] !== undefined) return source[snakeName];
  return fallback;
}

function normalizeDirectory(value) {
  const normalized = String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "");
  return normalized ? `${normalized}/` : "";
}

function normalizePagePath(value) {
  const normalized = `/${String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\/+|\/+$/g, "")}/`;
  return normalized === "//" ? "/" : normalized;
}

function joinRoot(root, target) {
  const rootPath = normalizePagePath(root || "/");
  const targetPath = normalizePagePath(target || "/");
  if (rootPath === "/") return targetPath;
  if (targetPath === rootPath || targetPath.startsWith(rootPath)) {
    return targetPath;
  }
  return normalizePagePath(`${rootPath}/${targetPath}`);
}

function joinRootFile(root, target) {
  const rootPath = normalizePagePath(root || "/");
  const filePath = String(target || "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "");
  return `${rootPath}${filePath}`.replace(/\/{2,}/g, "/");
}

function getConfig(siteConfig = {}) {
  const source = siteConfig.knowledge_graph || siteConfig.knowledgeGraph || {};
  const assetPath = normalizeDirectory(
    firstDefined(source, "assetPath", "asset_path", DEFAULTS.assetPath)
  );
  const configuredDataPath = firstDefined(
    source,
    "dataPath",
    "data_path",
    `${assetPath}graph.json`
  );
  const colors = {
    ...DEFAULTS.colors,
    ...(source.colors || {})
  };
  const root = normalizePagePath(siteConfig.root || "/");

  return {
    enable: firstDefined(source, "enable", "enable", DEFAULTS.enable) !== false,
    autoMount: firstDefined(
      source,
      "autoMount",
      "auto_mount",
      DEFAULTS.autoMount
    ) !== false,
    categoriesPath: joinRoot(
      root,
      firstDefined(
        source,
        "categoriesPath",
        "categories_path",
        DEFAULTS.categoriesPath
      )
    ),
    targetSelector: String(firstDefined(
      source,
      "targetSelector",
      "target_selector",
      DEFAULTS.targetSelector
    )),
    insertPosition: String(firstDefined(
      source,
      "insertPosition",
      "insert_position",
      DEFAULTS.insertPosition
    )),
    title: String(firstDefined(source, "title", "title", DEFAULTS.title)),
    height: String(firstDefined(source, "height", "height", DEFAULTS.height)),
    assetPath,
    dataPath: String(configuredDataPath)
      .replaceAll("\\", "/")
      .replace(/^\/+/, ""),
    includeUncategorized: firstDefined(
      source,
      "includeUncategorized",
      "include_uncategorized",
      DEFAULTS.includeUncategorized
    ) === true,
    uncategorizedLabel: String(firstDefined(
      source,
      "uncategorizedLabel",
      "uncategorized_label",
      DEFAULTS.uncategorizedLabel
    )),
    colors,
    root,
    assetBaseUrl: joinRoot(root, assetPath),
    dataUrl: joinRootFile(root, configuredDataPath)
  };
}

module.exports = {
  DEFAULTS,
  getConfig,
  joinRoot,
  joinRootFile,
  normalizeDirectory,
  normalizePagePath
};
