# Banner Generator — Implementation Plan

## Goal

Serve a dynamically composed PNG over HTTP so it can be embedded in a GitHub README (`<img src="…">`). Support configurable canvas, banner crop height (with transparent remainder), optional banner fade/feather/blur into transparency, circular profile avatar, multiple anchored text runs, a cycle/update endpoint that redirects back to the profile via `callback`, and a minimal HTML client to edit config and preview.

Package manager: **pnpm**. Docker deployment later — design for it, do not implement the container yet.

---

## Recommended stack

| Layer | Choice | Notes |
|-------|--------|--------|
| Runtime | **Node.js** (LTS) | Bun not required; weaker/flakier for native canvas addons |
| HTTP | **Fastify** | Fast, typed (TypeBox/zod), easy image + redirect routes |
| Image compose | **`@napi-rs/canvas`** | Canvas 2D API: clip, text, multi-font/weight, PNG alpha, filters, compositing |
| Validation | **zod** | Query/body schemas for size, positions, text array |
| Fonts | Bundled defaults + optional Google Fonts fetch | Register TTF/OTF with `GlobalFonts`; cache downloads |
| State (banner cycle) | In-memory first; **better-sqlite3** or JSON file if persistence needed | Survive restarts when Dockerized |
| Optional later | **sharp** | Only if needed for decode/resize; text/clip stay in canvas |

**Why not sharp-first:** Multiple fonts/weights and anchored text are awkward via SVG overlays. Canvas matches the control surface in `INSTRUCTIONS.md`.

**Why not Satori / `@vercel/og`:** Great for OG cards; weaker for exact pixel padding, avatar presets, and transparent bottom strips.

---

## Features (from requirements)

1. **Canvas size** — e.g. `1000×300` (width × height), configurable per request or via stored config.
2. **Banner image** — remote URL; drawn to cover a configurable **height** from the top. Remaining canvas rows stay **transparent** (PNG).
3. **Banner edge treatment (optional, configurable)**
   - **Fade / feather into transparency** — soft alpha blend into the transparent region (e.g. last N px of the banner band into the bottom strip).
   - **Feather all sides** — soft alpha on left/right/top/bottom edges of the banner.
   - **Blur** — optional gaussian-style blur (`ctx.filter`) on the banner, alone or combined with fade/feather.
   - Controls: fade length(s) in px, which edges, blur radius; all default off or to sensible zeros.
4. **Profile image** — remote URL; **circular clip**; horizontal presets **left | center | right**; vertical centering on the canvas (or on the banner band — decide in impl); **side padding in px** when left/right.
5. **Text** — multiple items; each with alignment (`left` | `center` | `right`), **anchor (x, y)**, content, and typography (family, weight, size, color, etc.).
6. **Embed URL** — `GET` returns `image/png` suitable for README `<img>`.
7. **Cycle / set banner** — link from README hits the server, updates active banner, redirects to `callback` (typically the GitHub profile) so the page refreshes and the image updates.
8. **Minimal config client** — tiny HTML UI to edit configurable variables and preview the banner (see below).

---

## HTTP surface (proposed)

### `GET /banner.png` (or `/banner`)

- Returns composed PNG.
- Cache headers: short TTL or `no-cache` so GitHub/clients pick up banner cycles; tune after testing how GitHub’s image proxy behaves.
- Inputs via query string and/or server-side stored config (see State).

### `GET /set-banner` (name TBD)

- Query: `image` (banner URL) and `callback` (redirect target).
- Side effect: persist “current banner” (and maybe advance a cycle index).
- Response: **302/303** → `callback`.
- Validate `callback` (allowlist GitHub profile hosts) to avoid open redirects.

### Config persistence (for the HTML client)

- `GET /config` — return current layout/banner settings as JSON.
- `PUT /config` (or `POST`) — validate with zod, save, return updated config.
- Client preview uses `GET /banner.png` (cache-bust query) after saves.

Exact query param names and whether layout is fully query-driven vs file/env config can be finalized during implementation. The config client assumes a **server-stored config** as the source of truth (cleaner than stuffing every text item into the README image URL).

---

## Minimal HTML config client

A **very lightweight** admin/preview page to set the configurable variables — not a design system, not a SPA framework.

### Constraints

- **No React/Vue/Svelte**, no bundler, no CSS framework.
- One (or few) static file(s): plain **HTML + a little CSS + vanilla JS**.
- Served by Fastify as static assets (e.g. `GET /` or `GET /editor`).
- Forms map 1:1 to the zod config schema / `PUT /config` body.

### UI (keep tiny)

- Live **preview**: `<img>` pointing at `/banner.png?t=…` refreshed on change/save.
- Fields for: canvas width/height, banner URL + banner height, fade/feather (per edge or shared) + blur, avatar URL + position preset + padding + diameter, text list (add/remove rows: content, align, x/y, font, weight, size, color).
- **Save** → `PUT /config`; **Reset** optional.
- Copy-friendly README snippet (`<img src="…/banner.png">`) if useful — optional, one line.

### Non-goals

- Drag-and-drop WYSIWYG on the canvas.
- Auth (add later if the editor is exposed publicly).
- Polished branding/marketing chrome.

### Implementation sketch

```
public/
  index.html      # form + preview
  editor.css      # minimal layout only
  editor.js       # fetch config, bind form, save, bust preview cache
```

Fastify: `@fastify/static` (or manual `sendFile`) for `public/`, plus JSON config routes above.

---

## Composition model

Draw order (back → front):

1. Clear canvas to **transparent**.
2. Draw **banner** on an offscreen layer, scaled/cropped to `canvasWidth × bannerHeight`.
3. Apply optional **blur** (`ctx.filter = 'blur(…px)'`) on that layer.
4. Apply optional **fade/feather** via alpha mask: `destination-in` / `destination-out` with linear (or multi-edge) gradients from opaque → transparent. Bottom fade is the primary case (blend into the transparent strip); all-sides feather uses the same compositing pattern.
5. Composite the treated banner onto the main canvas at `(0, 0)`.
6. Draw **avatar**: load image, circle clip, size TBD (config; e.g. diameter or % of height), position from preset + padding, vertically centered.
7. Draw each **text** item at anchor with the given alignment (`textAlign` + fillText).

Avatar diameter, text defaults, and whether “vertically aligned” means canvas center vs banner-band center should be explicit config defaults in code.

**Note:** Fade-to-transparent needs a gradient alpha mask, not blur alone. Blur softens pixels; the mask creates real PNG transparency for README-friendly edges.

---

## Fonts

### Requirements

- Variety of **families and weights**.
- `@napi-rs/canvas` needs real **TTF/OTF** files registered locally — not browser-style CSS links to `fonts.googleapis.com`.

### Strategy (hybrid)

1. **Ship a small default set** in-repo / in the future image (`/fonts/...`) for zero-network renders.
2. **Optional dynamic Google Fonts:**
   - Resolve family + weight → TTF/OTF URL (CSS API often returns WOFF2; request TTF or use known gstatic TTF URLs).
   - Download → **disk cache** keyed by `family-weight-style`.
   - `GlobalFonts.registerFromPath(...)` then draw with e.g. `"600 42px Inter"`.
3. **Allowlist** font family names (or pin to Google Fonts catalog). Do not accept arbitrary font URLs from query params.
4. Prefer **static weight files** over variable fonts for simpler registration.

### Operational notes

- Warm cache for common fonts at startup if dynamic fetch is enabled.
- README embeds must stay reliable: avoid fetching Google on every single image request (cache hit path only after first download).
- Respect font licenses (most Google Fonts are OFL; still document which faces are bundled).

---

## State & README cycling UX

Intended flow:

1. README shows `<img src="https://your-host/banner.png">`.
2. README also has markdown links to `/set-banner?image=…&callback=https://github.com/<user>`.
3. Click → server updates stored banner → redirect to profile → image URL refetched → new banner visible.

Implementation details to decide:

- Single “current banner URL” vs ordered list + index.
- Layout (avatar, texts, sizes) in env/JSON config vs fully in query string (query strings get long for many text items; config file + cycle-only query is likely cleaner).

---

## Docker

Alpine multi-stage image. `pnpm install` runs **inside** the Linux build so **musl** native bindings for `@napi-rs/canvas` match runtime.

- Install **fontconfig** (+ bundled/cached fonts). Do not rely on Alpine having useful default faces.
- Persist `data/` (config + starred) and optionally `banners/` via compose bind mounts; font downloads use a named volume.
- Protect the editor and mutate routes with HTTP Basic Auth (`DASHBOARD_PASSWORD` required in production). Leave image + `/set-banner` public.

True scratch/distroless-without-libc is a poor fit for native `.node` addons.

---

## Project layout (suggested)

```
src/
  index.ts          # Fastify app entry
  routes/
    banner.ts       # GET image
    set-banner.ts   # update + redirect
    config.ts       # GET/PUT config JSON
  compose/
    render.ts       # canvas draw pipeline
    banner.ts       # draw, blur, fade/feather masks
    avatar.ts
    text.ts
  fonts/
    registry.ts     # register + Google fetch/cache
  state/
    banner-store.ts
    config-store.ts
  schemas.ts        # zod
public/
  index.html        # minimal config client
  editor.css
  editor.js
fonts/              # default TTF/OTF
cache/fonts/        # runtime Google cache (gitignored)
```

---

## Implementation phases

1. **Scaffold** — pnpm, TypeScript, Fastify, `@napi-rs/canvas`, zod; hello `GET /banner.png` solid color PNG.
2. **Compose** — canvas size, banner height + transparency, banner fade/feather/blur, circular avatar presets + padding, multi text + anchors.
3. **Fonts** — register bundled fonts; then optional Google fetch + disk cache + allowlist.
4. **Cycle API** — store + `/set-banner` + safe `callback` redirect; document README snippet.
5. **Config client** — static `public/` HTML form + preview; `GET`/`PUT /config`.
6. **Hardening** — timeouts on remote image fetches, size limits, allowlisted hosts if needed, sensible cache headers.
7. **Docker** — Alpine multi-stage, volume mounts for `data/` + `banners/`, Basic Auth on the editor.

---

## Open decisions

- Avatar default diameter and vertical reference (full canvas vs banner band).
- Layout entirely query-driven vs config file + cycle endpoint only → **config store + HTML client** preferred for layout; image URL stays simple for README embeds.
- Whether the editor needs any auth before public deploy.
- Image URL cache headers vs GitHub proxy behavior.
- Persist cycle state or accept reset on process restart until Docker volumes exist.
- Default fade length / blur radius (off vs small bottom fade).
- Whether all-sides feather shares one `featherPx` or per-edge controls (`featherTop`, `featherBottom`, etc.).

---

## Out of scope for first cut

- Docker/Compose files (explicitly deferred).
- Bun runtime.
- sharp as primary compositor.
- Arbitrary remote font URLs without allowlist.
- Heavy frontend frameworks or a full visual design tool for the config client.
