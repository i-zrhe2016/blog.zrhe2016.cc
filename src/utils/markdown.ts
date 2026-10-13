import type { RemarkPlugins, RehypePlugins } from "@astrojs/markdown-remark";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import rehypeCallouts from "rehype-callouts";
import {
  transformerNotationDiff,
  transformerNotationHighlight,
  transformerNotationWordHighlight,
} from "@shikijs/transformers";
import { transformerFileName } from "./transformers/fileName";
export const remarkPlugins = [
  remarkToc,
  [remarkCollapse, { test: "Table of contents" }],
] satisfies RemarkPlugins;
export const rehypePlugins = [rehypeCallouts] satisfies RehypePlugins;
export const highlightTransformers = [
  transformerFileName({ style: "v2", hideDot: false }),
  transformerNotationHighlight(),
  transformerNotationWordHighlight(),
  transformerNotationDiff({ matchAlgorithm: "v3" }),
];
