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

CRITICAL CONSTRAINT — VALID COLORS ONLY: Only use color constants that exist in Manim v0.20. The following are the ONLY valid named colors:
- Basic: WHITE, BLACK, GRAY, GREY, LIGHT_GRAY, LIGHT_GREY, DARK_GRAY, DARK_GREY
- Red family: RED, RED_A, RED_B, RED_C, RED_D, RED_E, MAROON, MAROON_A/B/C/D/E
- Green family: GREEN, GREEN_A, GREEN_B, GREEN_C, GREEN_D, GREEN_E
- Blue family: BLUE, BLUE_A, BLUE_B, BLUE_C, BLUE_D, BLUE_E, DARK_BLUE
- Yellow family: YELLOW, YELLOW_A, YELLOW_B, YELLOW_C, YELLOW_D, YELLOW_E
- Orange: ORANGE
- Purple family: PURPLE, PURPLE_A, PURPLE_B, PURPLE_C, PURPLE_D, PURPLE_E
- Teal family: TEAL, TEAL_A, TEAL_B, TEAL_C, TEAL_D, TEAL_E
- Gold family: GOLD, GOLD_A, GOLD_B, GOLD_C, GOLD_D, GOLD_E
- Pink: PINK, LIGHT_PINK
- Pure variants: PURE_RED, PURE_GREEN, PURE_BLUE, PURE_CYAN, PURE_YELLOW, PURE_MAGENTA
DO NOT USE: CYAN (use PURE_CYAN or TEAL instead), MAGENTA (use PURE_MAGENTA), LIME, INDIGO, VIOLET, BROWN (use DARK_BROWN or GRAY_BROWN)
NEVER build raw hex color strings manually (e.g. "#{:02x}...".format(...)) — negative or out-of-range values produce invalid strings like "#ff-f-f". Instead use Manim's built-in color interpolation:
- \`interpolate_color(BLUE, RED, alpha)\` where alpha is clamped 0–1 — this is the correct way to make gradients
- \`color_gradient([BLUE, WHITE, RED], n)\` for a list of n gradient colors

3D ANIMATIONS — When the user's prompt mentions anything 3-dimensional (3D, three-dimensional, rotating object, sphere, torus, surface, volume, 3D graph, etc.) you MUST use ThreeDScene and 3D APIs:
- \`class MathScene(ThreeDScene):\` — NOT Scene
- Set camera at start: \`self.set_camera_orientation(phi=70 * DEGREES, theta=-60 * DEGREES)\`
- 3D objects: Sphere, Cube, Cylinder, Cone, Torus, Arrow3D, Line3D
- 3D axes: ThreeDAxes (NOT Axes)
- 3D surfaces: \`Surface(lambda u, v: np.array([x, y, z]), u_range=[...], v_range=[...], resolution=(20, 20))\`
- 3D parametric curves (helices, spirals): \`ParametricFunction(lambda t: np.array([...]), t_range=[a, b])\` — NOT lists of Dot3D
- Camera rotation: \`self.begin_ambient_camera_rotation(rate=0.25)\` / \`self.stop_ambient_camera_rotation()\`
- Camera move: \`self.move_camera(phi=60*DEGREES, theta=30*DEGREES, run_time=2)\`
- 2D text overlays in 3D scenes: \`self.add_fixed_in_frame_mobjects(label)\` after creating the label

3D PERFORMANCE — MUST follow to avoid timeouts:
- Sphere resolution max: \`Sphere(resolution=(16, 16))\` — never higher than (20, 20)
- Surface resolution max: \`resolution=(24, 24)\`
- NEVER animate many objects individually in a loop — group with VGroup and animate once
- Use \`self.add(obj)\` for static objects instead of \`self.play(Create(obj))\` to save render time
- Keep total self.play() calls to 5 or fewer for 3D scenes

EDUCATIONAL DESIGN PRINCIPLES — apply these to every animation:
- Narrative arc: Start with the simplest intuition or a concrete example, build up to the key insight, end with the full picture. Never open with abstract formulas cold.
- One concept at a time: Reveal elements progressively as they become relevant. Don't show everything at once.
- The "aha moment": Design the whole animation around a single central insight. Every element should serve that moment.
- Consistent visual language: Use the same colour for the same concept throughout. If x is BLUE at the start, x is BLUE everywhere.
- Annotate key moments: Add brief Text() labels at turning points — "now differentiate", "notice the symmetry", "these are equal". Viewers can't rewind.
- Show change, not just state: Animate transformations (morphing, growing, shifting) rather than cutting between static frames. Motion is how Manim teaches.
- Contrast and comparison: Where possible show before/after, or two cases side by side, so the difference is viscerally clear.

Rules:
1. Import only from manim: \`from manim import *\`
2. Create exactly ONE Scene class named \`MathScene\` — extends \`Scene\` for 2D, \`ThreeDScene\` for 3D
3. The animation should be clear, educational and visually appealing
4. Use a black background (default in Manim)
5. Keep the animation between 5-30 seconds
6. Use smooth animations with proper timing (self.wait(), self.play())
7. Add colors, labels, and descriptive text using Text() with Unicode symbols
8. Output ONLY the Python code with no markdown, no explanations, no backticks
9. SAFE LIST INDEXING: Never use arithmetic index expressions like list[i*3] or list[i+offset] inside loops — they cause IndexError when the arithmetic exceeds the list length. Always use simple sequential iteration: \`for item in my_list\` or \`for i, item in enumerate(my_list)\`. If you need parallel lists, zip them: \`for a, b in zip(list_a, list_b)\`
10. NUMPY FLOAT ARRAYS: Always use float literals in np.array() for any coordinate or point that will have arithmetic applied to it. Write \`np.array([0.0, 0.0, 0.0])\` NOT \`np.array([0, 0, 0])\`. Integer arrays cause UFuncTypeError when you later do in-place operations like \`+= np.array([-1.5, 0.0, 0.0])\`. Rule: if the array represents a position, always use floats.

Example 2D:
from manim import *

class MathScene(Scene):
    def construct(self):
        title = Text("My Animation", font_size=48)
        self.play(Write(title))
        self.wait(1)

Example 3D:
from manim import *

class MathScene(ThreeDScene):
    def construct(self):
        self.set_camera_orientation(phi=70 * DEGREES, theta=-60 * DEGREES)
        axes = ThreeDAxes()
        surf = Surface(lambda u, v: axes.c2p(u, v, np.sin(u)*np.cos(v)),
                       u_range=[-3, 3], v_range=[-3, 3], resolution=(20, 20))
        surf.set_color_by_gradient(BLUE, GREEN, YELLOW)
        self.add(axes)
        self.play(Create(surf), run_time=3)
        self.begin_ambient_camera_rotation(rate=0.25)
        self.wait(6)
        self.stop_ambient_camera_rotation()`;

async function planAnimation(prompt: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `I want to create a Manim animation for: "${prompt}"

Before writing any code, think carefully about the best way to visually explain this concept. Answer these questions concisely:
1. What is the single most important insight or "aha moment" to convey?
2. What is the best opening scene — a concrete example, an intuition, or a familiar analogy?
3. What sequence of visual steps builds understanding most naturally?
4. What should be animated (not just shown statically) to make the concept click?
5. What consistent colour coding would help (which objects/concepts share a colour)?
6. Are there any before/after comparisons or contrasts that would be particularly illuminating?

Reply in 6–10 bullet points. No code. Be specific to this concept.`,
      },
    ],
  });

  const block = message.content[0];
  if (block.type !== "text") throw new Error("No text response from AI");
  return block.text.trim();
}

async function generateManimCode(prompt: string): Promise<string> {
  const plan = await planAnimation(prompt);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: `Create a Manim animation for: "${prompt}"

Here is a pedagogical plan for how to best illustrate this concept — follow it closely:
${plan}

Now write the Manim Python code that brings this plan to life.`,
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
    ], { timeout: 300000 });

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
