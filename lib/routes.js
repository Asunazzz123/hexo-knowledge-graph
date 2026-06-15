"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { buildGraphData, enrichWithKnowledgeMap } = require("./graph-builder");

function defaultResolveForceGraphAsset() {
  const entry = require.resolve("force-graph");
  return path.join(path.dirname(entry), "force-graph.min.js");
}

function createRoutes(options) {
  const graph = enrichWithKnowledgeMap(
    buildGraphData(options.locals, options.config)
  );
  const resolveForceGraphAsset = (
    options.resolveForceGraphAsset || defaultResolveForceGraphAsset
  );
  const clientPath = path.join(__dirname, "..", "client", "knowledge-graph.js");
  const stylePath = path.join(__dirname, "..", "assets", "knowledge-graph.css");
  const forceGraphPath = resolveForceGraphAsset();
  const assetPath = options.config.assetPath;

  return [
    {
      path: options.config.dataPath,
      data: JSON.stringify(graph)
    },
    {
      path: `${assetPath}knowledge-graph.js`,
      data: () => fs.createReadStream(clientPath)
    },
    {
      path: `${assetPath}knowledge-graph.css`,
      data: () => fs.createReadStream(stylePath)
    },
    {
      path: `${assetPath}force-graph.min.js`,
      data: () => fs.createReadStream(forceGraphPath)
    }
  ];
}

module.exports = {
  createRoutes,
  defaultResolveForceGraphAsset
};
