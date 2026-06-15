"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { parsePostLinks, tokenizeTagArguments } = require("../lib/post-link-parser");

test("tokenizes quoted post_link arguments", () => {
  assert.deepEqual(
    tokenizeTagArguments('"notes/a post#part one" | "Custom title"'),
    ["notes/a post#part one", "|", "Custom title"]
  );
});

test("parses post links and preserves optional anchors", () => {
  const source = [
    "{% post_link CS/OS/文件管理 %}",
    "{% post_link CS/LLM/ln#post-layer-normalization Post-LN %}"
  ].join("\n");

  assert.deepEqual(parsePostLinks(source), [
    {
      target: "CS/OS/文件管理",
      anchor: "",
      label: "",
      raw: "CS/OS/文件管理"
    },
    {
      target: "CS/LLM/ln",
      anchor: "post-layer-normalization",
      label: "Post-LN",
      raw: "CS/LLM/ln#post-layer-normalization Post-LN"
    }
  ]);
});

test("supports the Hexo pipe separator and quoted paths", () => {
  const links = parsePostLinks(
    '{% post_link "notes/a post#section-a" | "Readable title" %}'
  );

  assert.deepEqual(links, [
    {
      target: "notes/a post",
      anchor: "section-a",
      label: "Readable title",
      raw: '"notes/a post#section-a" | "Readable title"'
    }
  ]);
});

test("ignores examples inside fenced blocks, inline code, and HTML comments", () => {
  const source = [
    "```markdown",
    "{% post_link ignored/fenced %}",
    "```",
    "`{% post_link ignored/inline %}`",
    "<!-- {% post_link ignored/comment %} -->",
    "{% post_link included/post %}"
  ].join("\n");

  assert.deepEqual(parsePostLinks(source).map((link) => link.target), [
    "included/post"
  ]);
});

test("ignores empty and malformed post_link tags", () => {
  assert.deepEqual(
    parsePostLinks("{% post_link %}\n{% post_link \"unterminated %}"),
    []
  );
});
