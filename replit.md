# Workspace

## Overview

MathAnimate — a web app that generates math animations from natural language prompts using Manim (Python) + Claude AI. User types a prompt → Claude writes Manim Python code → server executes it → returns rendered MP4 video.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: Anthropic Claude via Replit AI Integrations (`@workspace/integrations-anthropic-ai`)
- **Animation**: Manim Community v0.20.1 (Python)

## Artifacts

- `artifacts/math-animations` — React + Vite frontend at `/`
- `artifacts/api-server` — Express API server at `/api`

## Key Packages

- `lib/db` — Drizzle schema + DB client (`animationsTable`)
- `lib/api-spec` — OpenAPI spec + Orval codegen config
- `lib/api-zod` — Generated Zod schemas for API validation
- `lib/integrations-anthropic-ai` — Anthropic client (reads `AI_INTEGRATIONS_*` env vars)

## Manim Installation (Important)

Manim is installed via pip. The key challenge in this Nix environment is that `pkg-config` uses `PKG_CONFIG_PATH_x86_64_unknown_linux_gnu` (not `PKG_CONFIG_PATH`). Additionally, `manimpango` must be pre-installed from the nix store since the glib libraries in the standard env have architecture incompatibilities:

```bash
# Copy pre-built manimpango 0.6.0 from nix store and patch to 0.6.1
cp -r /nix/store/dfjddv9cgnv7p0bckivhffzx4hzwwg1i-python3.11-manimpango-0.6.0/lib/python3.11/site-packages/manimpango ~/.pythonlibs/lib/python3.11/site-packages/
cp -r /nix/store/dfjddv9cgnv7p0bckivhffzx4hzwwg1i-python3.11-manimpango-0.6.0/lib/python3.11/site-packages/ManimPango-0.6.0.dist-info ~/.pythonlibs/lib/python3.11/site-packages/ManimPango-0.6.1.dist-info
chmod -R u+w ~/.pythonlibs/lib/python3.11/site-packages/ManimPango-0.6.1.dist-info ~/.pythonlibs/lib/python3.11/site-packages/manimpango
# Patch version string
sed -i 's/Version: 0.6.0/Version: 0.6.1/' ~/.pythonlibs/lib/python3.11/site-packages/ManimPango-0.6.1.dist-info/METADATA
# Then install manim (manimpango already satisfied)
pip install manim
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Animation Pipeline

1. User submits prompt via POST `/api/animations`
2. Server inserts DB record (`status: pending`) and returns immediately
3. Background job: calls Claude to generate Manim Python code
4. Background job: runs `python3 -m manim render -ql --format mp4 scene.py MathScene`
5. MP4 saved to `artifacts/api-server/public/animations/`
6. Served via GET `/api/animations/video/:filename`
7. Frontend polls GET `/api/animations/:id` every 2s until completed/failed

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
