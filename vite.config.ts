// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// GitHub Pages deploy toggle:
//   DEPLOY_TARGET=github-pages  → set Vite's base path (e.g. `/my-repo/`) and build
//   the server with the non-static `node-server` Nitro preset.
//
//   Why node-server + a custom prerender (scripts/prerender.mjs)?
//     • Static Nitro presets are broken on Vite 8 (nitrojs/nitro#3843).
//     • TanStack Start's own prerender is incompatible with the Lovable/Nitro pipeline:
//       its preview-server imports `dist/server/server.js`, but Nitro builds the server
//       into `.output/server/`, so prerender throws ERR_MODULE_NOT_FOUND.
//     • There is no SPA build mode in this plugin version.
//   So the normal build runs (client bundle + a Node-runnable server), then the deploy
//   workflow starts that server and renders the homepage to real SSR HTML — complete
//   with the `window.$_TSR` bootstrap TanStack needs to hydrate.
//
//   Locally / in the Lovable sandbox nothing changes: the default Cloudflare preset is
//   used so dev + Lovable Publish keep working as before.
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
    nitro: { preset: "node-server" },
  }),
});