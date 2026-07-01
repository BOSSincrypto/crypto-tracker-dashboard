// Static prerender for the GitHub Pages deploy.
//
// TanStack Start's built-in prerender can't be used here: its preview-server
// imports `dist/server/server.js`, but the Lovable/Nitro pipeline builds the
// server into `.output/server/` (different path AND filename), so prerender
// throws ERR_MODULE_NOT_FOUND and aborts the build. There is also no SPA mode
// in this plugin version.
//
// Instead we run the actual built Nitro server (node-server preset), fetch the
// homepage over plain HTTP and persist the SSR'd HTML — complete with the
// `window.$_TSR` bootstrap TanStack needs to hydrate — as .output/public/index.html.
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const PORT = "4399";
const HOST = "127.0.0.1";
const ROOT = process.cwd();
const SERVER = join(ROOT, ".output", "server", "index.mjs");
const OUT = join(ROOT, ".output", "public", "index.html");
// The path the site is served under (matches Vite's base / the router basepath).
const BASE = process.env.VITE_BASE_PATH || "/";

let stderr = "";

async function waitForServer(url, timeoutMs = 25000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  throw new Error(`server did not answer within ${timeoutMs}ms (${lastErr})\n--- server stderr ---\n${stderr}`);
}

const child = spawn("node", [SERVER], {
  env: { ...process.env, PORT, HOST, NITRO_PORT: PORT, NITRO_HOST: HOST },
  stdio: ["ignore", "pipe", "pipe"],
});
child.stderr.on("data", (d) => (stderr += d.toString()));

try {
  const res = await waitForServer(`http://${HOST}:${PORT}${BASE}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET ${BASE} -> ${res.status} ${res.statusText}\n${body.slice(0, 1500)}\n--- server stderr ---\n${stderr}`);
  }
  const html = await res.text();
  if (!html.includes("$_TSR")) {
    throw new Error(`rendered HTML is missing the TanStack bootstrap (window.$_TSR) — hydration would fail\n--- head ---\n${html.slice(0, 1500)}`);
  }
  await mkdir(join(ROOT, ".output", "public"), { recursive: true });
  await writeFile(OUT, html, "utf8");
  console.log(`[prerender] wrote ${OUT} (${html.length} bytes)`);
} finally {
  child.kill("SIGTERM");
}