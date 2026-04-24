import { defineConfig } from "vitepress";

export default defineConfig({
  title: "hashup",
  description: "Resolves every import and produces a fully deterministic hash for any entry file.",
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/" },
      {
        text: "GitHub",
        link: "https://github.com/maastrich/hashup",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Usage", link: "/guide/usage" },
            { text: "How it Works", link: "/guide/how-it-works" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API Reference",
          items: [
            { text: "Overview", link: "/api/" },
            { text: "hashup()", link: "/api/hashup" },
            { text: "Utilities", link: "/api/utilities" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/maastrich/hashup" }],
    search: { provider: "local" },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © Mathis Pinsault",
    },
  },
});
