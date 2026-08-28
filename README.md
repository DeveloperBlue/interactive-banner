# Banner Generator

Small private project for creating interactive, cyclable banner images for GitHub Profile READMEs.

Currently a proof-of-concept. Documentation is scarce, and control surfaces are rudimentary.

Intended to be hosted behind Cloudflare Access to prevent access to the editor.

## Docker Compose

`docker-compose.yml` builds the image. Set `PORT` in `.env` if needed (default `3000`).

## Production (Cloudflare Auth)

**Access** — one self-hosted application:
- Host: `banner.<yourdomain>.com`, path: `/editor`
- Policy: **Allow** → your email

Editor auth is handled by Cloudflare Access.

## Production (Cloudflare cache bypass)

Generated banner URLs (`/banner.png`, `/divider.png`, `/endcap.png`, etc.) must not be cached at the edge, or GitHub and browsers will keep serving stale images after you cycle or save.

In the Cloudflare dashboard for your zone:

1. Go to **Caching → Cache Rules** (or **Rules → Overview → Cache Rules**).
2. **Create rule**.
3. **Rule name:** `GitHub Generator Bypass`
4. **When incoming requests match:** Custom filter expression:

   ```
   (http.host eq "banner.<yourdomain>.com" and http.request.uri.path matches "^/(banner|divider|endcap)(-light|-dark)?(\.png)?$")
   ```

   Replace `banner.<yourdomain>.com` with your hostname. To bypass cache for the whole host, use `http.host eq "banner.<yourdomain>.com"` instead.

5. **Then → Cache eligibility:** **Bypass cache**
6. **Deploy**

After creating the rule, purge any already-cached images under **Caching → Configuration → Purge Cache → Custom Purge** (e.g. `https://banner.<yourdomain>.com/banner-dark.png`).

To verify, request a generated URL directly and check response headers: `cf-cache-status` should be `BYPASS` or `DYNAMIC`, not `HIT`.

---

# TODO
- [] Accept image masks
- [] Make preview column wider to better show github profile's size, maybe resizable column with matching min and max
- [] Better control surfaces overall