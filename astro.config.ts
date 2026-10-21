import {
  defineConfig,
  envField,
  fontProviders,
  svgoOptimizer,
} from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import {
  remarkPlugins,
  rehypePlugins,
  highlightTransformers,
} from "./src/utils/markdown";
import config from "./astro-paper.config";
import remarkPlantuml from "./scripts/plantuml.mjs";

// Branch preview builds (Cloudflare Workers Builds) render `prerelease: true`
// posts; production never does. An explicit PUBLIC_PRERELEASE always wins.
process.env.PUBLIC_PRERELEASE ??= String(
  (process.env.WORKERS_CI_BRANCH ?? "main") !== "main"
);

export default defineConfig({
  site: config.site.url,
  integrations: [
    mdx(),
    sitemap({
      filter: page =>
        !new URL(page).pathname.startsWith("/admin") &&
        (config.features?.showArchives !== false ||
          !page.endsWith("/archives/")),
    }),
  ],
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
    routing: {
      prefixDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      smartypants: false,
      remarkPlugins: [remarkPlantuml, ...remarkPlugins],
      rehypePlugins,
    }),
    shikiConfig: {
      themes: { light: "min-light", dark: "night-owl" },
      defaultColor: false,
      wrap: false,
      transformers: highlightTransformers,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  fonts: [
    {
      name: "Google Sans Code",
      cssVariable: "--font-google-sans-code",
      provider: fontProviders.local(),
      options: {
        variants: [
          {
            src: ["./src/assets/fonts/GoogleSansCode-400.ttf"],
            weight: 400,
            style: "normal",
          },
          {
            src: ["./src/assets/fonts/GoogleSansCode-700.ttf"],
            weight: 700,
            style: "normal",
          },
          {
            src: ["./src/assets/fonts/GoogleSansCode-Italic-400.ttf"],
            weight: 400,
            style: "italic",
          },
          {
            src: ["./src/assets/fonts/GoogleSansCode-Italic-700.ttf"],
            weight: 700,
            style: "italic",
          },
        ],
      },
      fallbacks: ["monospace"],
      weights: [300, 400, 500, 600, 700],
      styles: ["normal", "italic"],
      formats: ["woff", "ttf"],
    },
  ],
  env: {
    schema: {
      PUBLIC_GOOGLE_SITE_VERIFICATION: envField.string({
        access: "public",
        context: "client",
        optional: true,
      }),
      // Preview-branch builds render `prerelease: true` posts; production never does.
      PUBLIC_PRERELEASE: envField.boolean({
        access: "public",
        context: "client",
        default: false,
      }),
    },
  },
  experimental: {
    svgOptimizer: svgoOptimizer(),
  },
});
