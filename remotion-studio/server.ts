import express from "express";
import path from "path";
import fs from "fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { SceneConfigSchema } from "./src/types";

const app = express();
app.use(express.json({ limit: "10mb" }));

const PORT = parseInt(process.env.PORT || "3600");
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";

// Track active renders for cancellation
const activeRenders = new Map<string, { cancel: () => void }>();

let bundled: string | null = null;

async function getBundled(): Promise<string> {
  if (bundled) return bundled;
  console.log("Bundling Remotion project...");
  bundled = await bundle({
    entryPoint: path.resolve(__dirname, "src/index.ts"),
    onProgress: (p) => {
      if (p % 25 === 0) console.log(`  Bundle: ${p}%`);
    },
  });
  console.log("Bundle ready:", bundled);
  return bundled;
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", bundled: !!bundled });
});

// List available templates
app.get("/templates", (_req, res) => {
  res.json({
    templates: [
      {
        id: "title_reveal",
        name: "Title Reveal",
        description: "Animated title with glow, particles, and gradient background",
        props: ["title", "subtitle", "tagline", "colorScheme"],
      },
      {
        id: "fact_card",
        name: "Fact Card",
        description: "Big animated number/stat with label in a glass card",
        props: ["number", "label", "accentColor"],
      },
      {
        id: "narrative",
        name: "Narrative",
        description: "Word-by-word text reveal with cinematic styling",
        props: ["text", "style", "highlightWords"],
      },
      {
        id: "split_info",
        name: "Split Info",
        description: "Heading with bullet points in glass cards",
        props: ["heading", "points", "side", "accentColor"],
      },
      {
        id: "cta_outro",
        name: "CTA / Outro",
        description: "Call-to-action with animated ring and particles",
        props: ["headline", "subtext", "brandColor"],
      },
    ],
  });
});

// Render video from scene config
app.post("/render", async (req, res) => {
  const jobId = req.body.job_id || `render_${Date.now()}`;

  try {
    // Validate scene config
    const parsed = SceneConfigSchema.safeParse(req.body.scene_config);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid scene config",
        details: parsed.error.issues,
      });
    }
    const sceneConfig = parsed.data;

    // Compute total frames
    let totalFrames = 0;
    for (const scene of sceneConfig.scenes) {
      const end = scene.from + scene.durationInFrames;
      if (end > totalFrames) totalFrames = end;
    }

    const outputPath = path.join(OUTPUT_DIR, `remotion_${jobId}.mp4`);
    console.log(`[Render] Starting: ${jobId} (${totalFrames} frames)`);

    const serveUrl = await getBundled();

    const composition = await selectComposition({
      serveUrl,
      id: "DynamicVideo",
      inputProps: { sceneConfig },
    });

    let cancelled = false;
    const cancelFn = () => { cancelled = true; };
    activeRenders.set(jobId, { cancel: cancelFn });

    await renderMedia({
      composition: {
        ...composition,
        durationInFrames: totalFrames,
        fps: sceneConfig.fps || 30,
        width: sceneConfig.width || 1080,
        height: sceneConfig.height || 1920,
      },
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps: { sceneConfig },
      chromiumOptions: {
        args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
      },
      onProgress: ({ progress }) => {
        if (Math.round(progress * 100) % 20 === 0) {
          console.log(`[Render] ${jobId}: ${Math.round(progress * 100)}%`);
        }
      },
    });

    activeRenders.delete(jobId);

    if (cancelled) {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return res.json({ status: "cancelled" });
    }

    console.log(`[Render] Done: ${jobId} → ${outputPath}`);
    res.json({ status: "done", path: outputPath });
  } catch (err: any) {
    activeRenders.delete(jobId);
    console.error(`[Render] Failed: ${jobId}`, err.message);
    res.status(500).json({ error: err.message?.slice(0, 500) });
  }
});

// Cancel a render
app.post("/cancel/:jobId", (req, res) => {
  const render = activeRenders.get(req.params.jobId);
  if (render) {
    render.cancel();
    activeRenders.delete(req.params.jobId);
    res.json({ status: "cancelled" });
  } else {
    res.json({ status: "not_found" });
  }
});

// ══════ CODE VALIDATION ══════

// Validate agent-generated React/Remotion code in a sandboxed VM
app.post("/validate-code", async (req, res) => {
  const { code } = req.body;
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ valid: false, error: "No code provided" });
  }

  try {
    // Step 1: Syntax check with esbuild
    const esbuild = await import("esbuild");
    try {
      await esbuild.transform(
        `(function(React,AbsoluteFill,spring,interpolate,useCurrentFrame,useVideoConfig,frame,fps,width,height){${code}})`,
        { loader: "js" }
      );
    } catch (syntaxErr: any) {
      const msg = syntaxErr.errors?.[0]?.text || syntaxErr.message || String(syntaxErr);
      return res.json({ valid: false, error: `Syntax error: ${msg}`, phase: "parse" });
    }

    // Step 2: Sandboxed execution with mocked React/Remotion
    const vm = await import("vm");

    const mockCreateElement = (...args: any[]) => ({
      $$typeof: Symbol.for("react.element"),
      type: args[0] || "div",
      props: args[1] || {},
      children: args.slice(2),
    });
    const mockReact = {
      createElement: mockCreateElement,
      Fragment: Symbol.for("react.fragment"),
    };

    const sandbox = {
      React: mockReact,
      AbsoluteFill: "div",
      spring: (_opts: any) => 1,
      interpolate: (_val: number, _input: number[], output: number[]) => output?.[0] ?? 0,
      useCurrentFrame: () => 0,
      useVideoConfig: () => ({ fps: 30, width: 1080, height: 1920, durationInFrames: 150 }),
      frame: 0,
      fps: 30,
      width: 1080,
      height: 1920,
      Math, Array, Object, String, Number, Boolean, JSON, parseInt, parseFloat,
      console: { log: () => {}, warn: () => {}, error: () => {} },
      undefined, null: null, true: true, false: false, Infinity, NaN,
    };

    const context = vm.createContext(sandbox);
    const wrappedCode = `(function(React,AbsoluteFill,spring,interpolate,useCurrentFrame,useVideoConfig,frame,fps,width,height){${code}})(React,AbsoluteFill,spring,interpolate,useCurrentFrame,useVideoConfig,frame,fps,width,height)`;

    const result = vm.runInContext(wrappedCode, context, { timeout: 1000 });

    if (result === null || result === undefined) {
      return res.json({ valid: false, error: "Code returned null/undefined. Must return a React element via React.createElement().", phase: "runtime" });
    }

    if (typeof result === "object" && (result.type || result.$$typeof)) {
      return res.json({ valid: true });
    }

    return res.json({ valid: false, error: `Code returned ${typeof result} instead of a React element. Use React.createElement().`, phase: "runtime" });

  } catch (err: any) {
    return res.json({ valid: false, error: (err.message || String(err)).slice(0, 500), phase: "runtime" });
  }
});

// ══════ LIVE PREVIEW ══════

// Serve the preview page with Remotion Player (client-side, no Chromium)
app.get("/preview", (_req, res) => {
  res.type("html").send(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #0a0a0f; overflow: hidden; }
  #root { width: 100vw; height: 100vh; }
</style>
</head><body>
<div id="root"></div>
<script src="/api/preview-bundle.js"></script>
</body></html>`);
});

// Serve the preview JS bundle
app.use("/preview-bundle.js", express.static(path.resolve(__dirname, "dist/preview.js")));

// Build preview bundle on startup
async function buildPreview() {
  const outfile = path.resolve(__dirname, "dist/preview.js");
  const distDir = path.dirname(outfile);
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  try {
    const esbuild = await import("esbuild");
    await esbuild.build({
      entryPoints: [path.resolve(__dirname, "src/preview-entry.tsx")],
      bundle: true,
      outfile,
      format: "iife",
      jsx: "automatic",
      loader: { ".tsx": "tsx", ".ts": "ts" },
      define: { "process.env.NODE_ENV": '"production"' },
      external: ["@remotion/renderer", "@remotion/bundler", "@remotion/cli"],
      minify: true,
      sourcemap: false,
    });
    console.log("Preview bundle built successfully");
  } catch (err) {
    console.error("Failed to build preview bundle:", err);
  }
}

// Startup: bundle Remotion (for server render) + build preview (for client preview)
Promise.all([
  getBundled().catch(err => console.error("Remotion bundle failed:", err)),
  buildPreview().catch(err => console.error("Preview build failed:", err)),
]).then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Remotion server ready on port ${PORT} (render + preview)`);
  });
}).catch(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Remotion server started (some bundles pending) on port ${PORT}`);
  });
});
