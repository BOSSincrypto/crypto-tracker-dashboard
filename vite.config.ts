// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages deploy toggle:
//   DEPLOY_TARGET=github-pages  → set Vite's base path (e.g. `/my-repo/`) so the
//   emitted client bundle + SPA shell load correctly from a sub-path.
//
//   We intentionally do NOT:
//     • switch to a static Nitro preset (e.g. "github_pages" / "static") — Nitro 3's
//       Vite plugin fails to build for static presets (nitrojs/nitro#3843:
//       "rollupOptions.input should not be an html file when building for SSR").
//     • enable TanStack Start's built-in prerender — its preview-server looks for
//       the server bundle at `dist/server/server.js`, but the Lovable/Nitro pipeline
//       builds the server into `.output/server/`, so prerender throws
//       ERR_MODULE_NOT_FOUND and aborts the build.
//   Instead the normal (non-static) build runs, the client build emits a static SPA
//   shell (`.output/public/index.html`) that hydrates client-side, and the deploy
//   workflow uploads `.output/public` as-is. That is plenty for a local-first app
//   whose data + live prices are all fetched from the browser.
//
//   Locally / in the Lovable sandbox nothing changes: the default Cloudflare preset
//   is used so dev + Lovable Publish keep working as before.
const isGithubPages = process.env.DEPLOY_TARGET === "github-pages";
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR
    // error wrapper). nitro/vite builds from this.
    server: { entry: "server" },
  },
  ...(isGithubPages && {
    vite: { base: basePath },
  }),
});