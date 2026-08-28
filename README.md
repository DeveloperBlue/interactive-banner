# Banner Generator

PNG banners for GitHub README embeds. Edit canvas, image, avatar, and text at `/editor/`.

## Local

```bash
pnpm install
pnpm start
```

Open [http://localhost:3000/editor/](http://localhost:3000/editor/).

## Docker Compose

`docker-compose.yml` builds the image, maps the host port, and mounts `./data` and `./banners` so config and uploads survive restarts.

1. Copy `.env.example` to `.env` and set a password:

   ```bash
   cp .env.example .env
   ```

   ```
   PORT=3000
   DASHBOARD_USER=admin
   DASHBOARD_PASSWORD=change-me
   ```

   `DASHBOARD_PASSWORD` is required; Compose will not start without it. `PORT` and `DASHBOARD_USER` are optional (`3000` and `admin`).

2. Build and start:

   ```bash
   docker compose up --build
   ```

   Detached:

   ```bash
   docker compose up --build -d
   ```

3. Open [http://localhost:3000/editor/](http://localhost:3000/editor/). `/editor` uses Basic Auth (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`). Banner and cycle routes stay public for README embeds.

Stop with `docker compose down`. Named volume `font-cache` is kept unless you pass `-v`.

## Cloudflare Access

Gate only the editor with one self-hosted application:

1. Zero Trust → **Access** → **Applications** → **Add an application** → **Self-hosted**.
2. Hostname: `banner.michaelrooplall.com` (or your host), path: `/editor` (covers `/editor/*`).
3. Policy: **Allow** → your email (or GitHub / one-time PIN).
4. Leave banner routes (`/banner.png`, `/set-banner`, `/prev-banner`, `/next-banner`, `/banners/*`) **without** an Access app — they stay public.

Optional: remove `DASHBOARD_PASSWORD` once Access is live, or keep it as a fallback on the origin.

## Embed

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://your-host/banner-dark.png" />
  <img src="https://your-host/banner-light.png" alt="banner" />
</picture>
```

## License

[MIT](LICENSE)
