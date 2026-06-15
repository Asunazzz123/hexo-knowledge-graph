"use strict";

const { register } = require("./lib/register");

function hexoKnowledgeGraph(hexo) {
  return register(hexo);
}

hexoKnowledgeGraph.register = register;

if (typeof hexo !== "undefined" && hexo?.extend) {
  register(hexo);
}

module.exports = hexoKnowledgeGraph;
