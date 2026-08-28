# Banner Generator

PNG banners for GitHub README embeds. Edit canvas, image, avatar, and text at [http://localhost:3000](http://localhost:3000).

## Local

```bash
pnpm install
pnpm start
```

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

3. Open [http://localhost:3000](http://localhost:3000). The editor uses Basic Auth (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`). Image routes stay public for README embeds.

Stop with `docker compose down`. Named volume `font-cache` is kept unless you pass `-v`.

## Embed

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://your-host/banner-dark.png" />
  <img src="https://your-host/banner-light.png" alt="banner" />
</picture>
```

## License

[MIT](LICENSE)
