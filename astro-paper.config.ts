import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    url: "https://blog.zrhe2016.cc/",
    title: "zrhe2016",
    description: "只写有意思的。技术、工具与日常记录。",
    author: "zrhe2016",
    profile: "https://github.com/i-zrhe2016",
    ogImage: "default-og.jpg",
    googleVerification: "Sw2idzCv-Au_Fz6JsU8I04rIpqa3dK6jhOqK4w_PoO0",
    lang: "en",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: { perPage: 10, perIndex: 10, scheduledPostMargin: 15 * 60 * 1000 },
  features: {
    lightAndDarkMode: true,
    dynamicOgImage: true,
    showArchives: true,
    showBackButton: false,
    editPost: { enabled: false },
    search: "pagefind",
  },
  socials: [
    { name: "github", url: "https://github.com/i-zrhe2016" },
    { name: "mail", url: "mailto:zrhe2016@gmail.com" },
  ],
  shareLinks: [],
});
