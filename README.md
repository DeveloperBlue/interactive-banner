# Banner Generator

PNG banners for GitHub README embeds. Edit canvas, image, avatar, and text at `/editor/`.

## Local

```bash
pnpm install
pnpm start
```

Open [http://localhost:3000/editor/](http://localhost:3000/editor/).

## Docker Compose

`docker-compose.yml` builds the image, binds **localhost only** (`127.0.0.1`), and mounts `./data` and `./banners` so config and uploads survive restarts.

1. Optional: copy `.env.example` to `.env` to change the host port (default `3000`).

2. Build and start:

   ```bash
   docker compose up --build -d
   ```

3. The app is reachable on the server at `http://127.0.0.1:3000` only — not on the public IP. Point Cloudflare Tunnel at that URL.

Stop with `docker compose down`. Named volume `font-cache` is kept unless you pass `-v`.

## Production (Hetzner + Cloudflare Tunnel)

1. **Tunnel** — public hostname `banner.michaelrooplall.com` → `http://127.0.0.1:3000` (or your `PORT`).
2. **Do not** publish port `3000` on the Hetzner firewall. Compose already binds to localhost.
3. **Access** — one self-hosted application:
   - Host: `banner.michaelrooplall.com`, path: `/editor` (covers `/editor/*`)
   - Policy: **Allow** → your email
   - No Access apps on `/banner.png`, `/set-banner`, `/prev-banner`, `/next-banner`, `/banners/*` — those stay public for README embeds.

Editor auth is handled by Cloudflare Access. No app-level password.

## Embed

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://your-host/banner-dark.png" />
  <img src="https://your-host/banner-light.png" alt="banner" />
</picture>
```

## License

[MIT](LICENSE)
