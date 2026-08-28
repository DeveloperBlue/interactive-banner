# Banner Generator

Small private project for creating interactive, cyclable banner images for GitHub Profile READMEs.

Intended to be hosted behind Cloudflare Access to prevent access to the editor.

## Docker Compose

`docker-compose.yml` builds the image. Set `PORT` in `.env` if needed (default `3000`).

## Production (Cloudflare Auth)

**Access** — one self-hosted application:
- Host: `banner.<yourdomain>.com`, path: `/editor`
- Policy: **Allow** → your email

Editor auth is handled by Cloudflare Access.
