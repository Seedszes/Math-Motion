import { Router } from "express";
import { db } from "@workspace/db";
import { animationsTable } from "@workspace/db";
import { GenerateAnimationBody, GetAnimationParams, DeleteAnimationParams } from "@workspace/api-zod";
import { eq, desc, count, sql } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execFileAsync = promisify(execFile);
const router = Router();

const MANIM_SYSTEM_PROMPT = `You are a Manim expert. Generate Python code using the Manim Community library (v0.18+) to create a beautiful mathematical animation.

CRITICAL CONSTRAINT — NO LATEX: LaTeX is NOT installed in this environment. You MUST NOT use any of these classes or anything that calls them internally:
- MathTex, Tex, SingleStringMathTex, TexTemplate (all require latex binary)
- DecimalNumber (uses MathTex internally for each digit)
- Integer (uses MathTex internally)
- Axes with number labels (uses DecimalNumber internally)
- NumberLine with include_numbers=True (uses DecimalNumber internally)

Instead, use ONLY these for text and math:
- Text("any string") for all labels, titles, equations, and math notation
- Use Unicode math symbols directly inside Text(): α β γ δ ε θ λ μ π σ φ ω Σ Π Δ ∫ ∂ ∑ √ ∞ ≈ ≠ ≤ ≥ ² ³ ⁴ ½ ¼
- Example: Text("α + β + γ = 180°") — NOT MathTex(r"\\alpha + \\beta + \\gamma = 180^\\circ")
- Example: Text("f(x) = sin(x)") — NOT MathTex(r"f(x) = \\sin(x)")
- Example: Text("∫₀^π sin(x) dx = 2") — NOT MathTex(r"\\int_0^\\pi")

If you need Axes or NumberLine, ALWAYS disable number labels:
- Axes(x_range=[...], y_range=[...], x_axis_config={"include_numbers": False}, y_axis_config={"include_numbers": False})
- Then add your own Text() labels manually if needed

Rules:
1. Import only from manim: \`from manim import *\`
2. Create exactly ONE Scene class named \`MathScene\` that extends \`Scene\`
3. The animation should be clear, educational and visually appealing
4. Use a black background (default in Manim)
5. Keep the animation between 5-30 seconds
6. Use smooth animations with proper timing (self.wait(), self.play())
7. Add colors, labels, and descriptive text using Text() with Unicode symbols
8. Output ONLY the Python code with no markdown, no explanations, no backticks

Example structure:
from manim import *

class MathScene(Scene):
    def construct(self):
        title = Text("My Animation", font_size=48)
        self.play(Write(title))
        self.wait(1)`;

async function generateManimCode(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Create a Manim animation for: ${prompt}`,
      },
    ],
    system: MANIM_SYSTEM_PROMPT,
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("No text response from AI");

  // Strip markdown code blocks if present
  let code = block.text.trim();
  code = code.replace(/^```python\n?/i, "").replace(/\n?```$/, "").trim();
  return code;
}

async function renderManim(code: string, animationId: number): Promise<{ videoPath: string; duration: number }> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `manim-${animationId}-`));
  const scriptPath = path.join(tmpDir, "scene.py");
  const outputDir = path.join(process.cwd(), "public", "animations");

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(scriptPath, code, "utf-8");

  try {
    await execFileAsync("python3", [
      "-m", "manim",
      "render",
      "--media_dir", tmpDir,
      "-ql",           // low quality for speed
      "--format", "mp4",
      scriptPath,
      "MathScene",
    ], { timeout: 120000 });

    // Find the rendered mp4
    const mediaPath = path.join(tmpDir, "videos", "scene", "480p15");
    const files = await fs.readdir(mediaPath);
    const mp4 = files.find(f => f.endsWith(".mp4"));
    if (!mp4) throw new Error("Manim did not produce an mp4 file");

    const srcPath = path.join(mediaPath, mp4);
    const destName = `animation-${animationId}-${Date.now()}.mp4`;
    const destPath = path.join(outputDir, destName);
    await fs.copyFile(srcPath, destPath);

    // Clean up tmp
    await fs.rm(tmpDir, { recursive: true, force: true });

    return { videoPath: `/api/animations/video/${destName}`, duration: 0 };
  } catch (err) {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}

// GET /api/animations/stats
router.get("/animations/stats", async (req, res) => {
  try {
    const rows = await db
      .select({ status: animationsTable.status, cnt: count() })
      .from(animationsTable)
      .groupBy(animationsTable.status);

    const stats = { total: 0, completed: 0, failed: 0, pending: 0, generating: 0 };
    for (const row of rows) {
      const n = Number(row.cnt);
      stats.total += n;
      if (row.status === "completed") stats.completed += n;
      else if (row.status === "failed") stats.failed += n;
      else if (row.status === "pending") stats.pending += n;
      else if (row.status === "generating") stats.generating += n;
    }
    res.json(stats);
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

// GET /api/animations/video/:filename — serve video files
router.get("/animations/video/:filename", async (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(process.cwd(), "public", "animations", filename);
    await fs.access(filePath);
    res.sendFile(filePath);
  } catch {
    res.status(404).json({ error: "Video not found" });
  }
});

// GET /api/animations
router.get("/animations", async (req, res) => {
  try {
    const animations = await db
      .select()
      .from(animationsTable)
      .orderBy(desc(animationsTable.createdAt));
    res.json(animations);
  } catch (err) {
    req.log.error({ err }, "Failed to list animations");
    res.status(500).json({ error: "Failed to list animations" });
  }
});

// POST /api/animations
router.post("/animations", async (req, res) => {
  const parsed = GenerateAnimationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.message });
    return;
  }

  const { prompt } = parsed.data;

  const [animation] = await db
    .insert(animationsTable)
    .values({ prompt, status: "pending" })
    .returning();

  res.status(201).json(animation);

  // Generate in background
  (async () => {
    try {
      await db
        .update(animationsTable)
        .set({ status: "generating", updatedAt: new Date() })
        .where(eq(animationsTable.id, animation.id));

      const manimCode = await generateManimCode(prompt);

      await db
        .update(animationsTable)
        .set({ manimCode, updatedAt: new Date() })
        .where(eq(animationsTable.id, animation.id));

      const { videoPath, duration } = await renderManim(manimCode, animation.id);

      await db
        .update(animationsTable)
        .set({
          status: "completed",
          videoUrl: videoPath,
          durationSeconds: duration,
          updatedAt: new Date(),
        })
        .where(eq(animationsTable.id, animation.id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await db
        .update(animationsTable)
        .set({ status: "failed", errorMessage: msg, updatedAt: new Date() })
        .where(eq(animationsTable.id, animation.id))
        .catch(() => {});
    }
  })();
});

// GET /api/animations/:id
router.get("/animations/:id", async (req, res) => {
  const parsed = GetAnimationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [animation] = await db
    .select()
    .from(animationsTable)
    .where(eq(animationsTable.id, parsed.data.id));

  if (!animation) {
    res.status(404).json({ error: "Animation not found" });
    return;
  }

  res.json(animation);
});

// DELETE /api/animations/:id
router.delete("/animations/:id", async (req, res) => {
  const parsed = DeleteAnimationParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [deleted] = await db
    .delete(animationsTable)
    .where(eq(animationsTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Animation not found" });
    return;
  }

  // Try to delete video file if present
  if (deleted.videoUrl) {
    const filename = path.basename(deleted.videoUrl);
    const filePath = path.join(process.cwd(), "public", "animations", filename);
    await fs.rm(filePath, { force: true }).catch(() => {});
  }

  res.status(204).send();
});

export default router;
