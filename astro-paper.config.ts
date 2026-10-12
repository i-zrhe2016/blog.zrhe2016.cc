import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://blog.zrhe2016.cc/",
    title: "My blog",
    description: "只写有意思的。技术、工具与日常记录。",
    author: "zrhe2016",
    profile: "https://github.com/i-zrhe2016",
    ogImage: "default-og.jpg",
    lang: "en",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: { perPage: 10, perIndex: 10, scheduledPostMargin: 15 * 60 * 1000 },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: true,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [{ name: "github", url: "https://github.com/i-zrhe2016" }],
  shareLinks: [],
});
