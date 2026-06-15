"use strict";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function renderMount(options) {
  const id = escapeHtml(options.id);
  const title = escapeHtml(options.title);
  const dataUrl = escapeHtml(options.dataUrl);
  const height = escapeHtml(options.height);

  return [
    `<section id="${id}" class="hexo-knowledge-graph"`,
    ` data-knowledge-graph data-data-url="${dataUrl}"`,
    ` data-title="${title}" style="--hexo-knowledge-graph-height:${height}">`,
    `<div class="hexo-knowledge-graph__header">`,
    `<h2 class="hexo-knowledge-graph__title">${title}</h2>`,
    `<button class="hexo-knowledge-graph__reset" type="button" hidden>返回分类总览</button>`,
    `</div>`,
    `<div class="hexo-knowledge-graph__canvas" role="img" aria-label="${title}"></div>`,
    `<p class="hexo-knowledge-graph__status" aria-live="polite">正在加载知识网络...</p>`,
    `</section>`
  ].join("");
}

function renderHeadInjection(config) {
  return `<link rel="stylesheet" href="${escapeHtml(config.assetBaseUrl)}knowledge-graph.css">`;
}

function renderBodyInjection(config) {
  const bootstrap = {
    autoMount: config.autoMount,
    categoriesPath: config.categoriesPath,
    targetSelector: config.targetSelector,
    insertPosition: config.insertPosition,
    title: config.title,
    height: config.height,
    dataUrl: config.dataUrl,
    colors: config.colors
  };
  const assetBaseUrl = escapeHtml(config.assetBaseUrl);

  return [
    `<script src="${assetBaseUrl}force-graph.min.js"></script>`,
    `<script src="${assetBaseUrl}knowledge-graph.js"></script>`,
    `<script>(function(){`,
    `var options=${safeJson(bootstrap)};`,
    `var run=function(){if(window.HexoKnowledgeGraph){window.HexoKnowledgeGraph.boot(options);}};`,
    `if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",run,{once:true});}else{run();}`,
    `document.addEventListener("pjax:complete",run);`,
    `document.addEventListener("pjax:success",run);`,
    `})();</script>`
  ].join("");
}

module.exports = {
  escapeHtml,
  renderBodyInjection,
  renderHeadInjection,
  renderMount,
  safeJson
};
