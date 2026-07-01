// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages deploy toggle:
//   DEPLOY_TARGET=github-pages  → prerender the site to real static HTML under
//   `.output/public` and set Vite's base path (e.g. `/my-repo/`) so assets load
//   correctly when served from a sub-path.
//
//   IMPORTANT: we intentionally do NOT switch to a static Nitro preset here
//   (e.g. "github_pages" / "static"). Nitro 3's Vite plugin currently fails the
//   build for any static preset — see nitrojs/nitro#3843
//   ("rollupOptions.input should not be an html file when building for SSR").
//   The default (non-static) preset builds cleanly and still writes the
//   prerendered site under `.output/public`, which is all GitHub Pages needs; the
//   workflow uploads that directory and ignores the generated server bundle.
//
//   Locally / in the Lovable sandbox nothing changes: the default Cloudflare
//   preset is used so dev + Lovable Publish keep working as before.
const isGithubPages = process.env.DEPLOY_TARGET === "github-pages";
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Prerender the homepage to real HTML so GitHub Pages can serve it as a
    // static file. Client-side hydration still runs and CoinGecko fetches
    // stay live from the browser (React Query polls every 60s).
    ...(isGithubPages && {
      prerender: {
        enabled: true,
        crawlLinks: true,
        // GH Pages is static — sitemap.xml is emitted by prerendering the
        // server route, alongside the app shell.
        routes: ["/", "/sitemap.xml"],
      },
    }),
  },
  ...(isGithubPages && {
    vite: { base: basePath },
  }),
});