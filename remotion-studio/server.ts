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

// Pre-bundle on startup
getBundled().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Remotion render server ready on port ${PORT}`);
  });
}).catch((err) => {
  console.error("Failed to bundle:", err);
  // Start anyway — will bundle on first request
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Remotion render server started (bundle pending) on port ${PORT}`);
  });
});
