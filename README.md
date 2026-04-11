# Node-Homepage Dashboard

Homepage + warning/portal redirects for `http://fridge.local/` (runs in the `node-home` container).

## Features

- Homepage cards come from a flat `links.json` array only.
- Shortcut redirects (for example `/wiki` -> DokuWiki).
- Default warning screen on `/warning` with background video wall.
- Flat access portal on `/links` (linktree-style public links only).
- Markdown-backed service discovery on `/services` and `/api/service-docs`, generated from `docker/*/README.md` plus top-level inventory docs.
- Query redirects on `/` for single-hostname navigation (for example `/?go=warning`, `/?go=notes`, `/?go=trains`, `/?go=printers`, `/?go=services`).
- Settings page at `/settings` for service hostname management with optional fallback `IP:port`.
- Hostname API with runtime DNS resolution checks and persistent JSON storage in `/data/hostnames.json`.
- Client-side profile persistence (display name, click-rank, hidden state, block order, history) synced to `/api/profiles/:name`.

## Frontend Structure

- `public/js/app-shared.js`: shared browser helpers (`localStorage` JSON wrappers, selectors, name sanitizer).
- `public/js/homepage.js`: homepage behavior (ordering, hide/show, block move controls, icon loading/cache, sound, profile sync, MOTD).
- `public/js/settings.js`: settings page behavior (profile name save + hostname CRUD).
- `public/js/dashboard-homepage.bundle.js`: dashboard homepage cards rendered from the standalone `/home/fridge/serpentine-homepage` source.
- `public/js/dashboard-react.bundle.js`: dashboard control drawer bundle built from `frontend/dashboard-controls.tsx`.
- The dashboard leader card is the profile-name hero itself, with hourly greeting variants instead of a separate pinned header card.
- Cross-column dashboard moves use an elevated rail-style arc with temporary z-index lift so cards clear neighboring lanes before settling.
- `snakelet` is retired; the shared serpentine code now lives in `/home/fridge/serpentine-homepage` instead of inside this repo.
- `index.js` now renders markup and bootstrap JSON only; page logic lives in static scripts.

## Performance Notes

- Removed large inline scripts from HTML responses, reducing page parse cost and simplifying caching.
- Switched to event delegation for card activation/hover handling to reduce per-card listener overhead.
- Preserved local caches for favicons and interaction state to keep UI interactions instant.

## Service Management

The managed-services panel controls selected Docker projects using the host Docker socket.

Container requirements in compose:

- `/var/run/docker.sock` mounted
- `/home/fridge` mounted
- Docker CLI installed in the image

## Development Reload Behavior

- `docker-compose.yml` mounts the project directory into `/app`.
- The container runs `npm run dev`, which starts `node --watch index.js` plus esbuild watch processes for the dashboard bundles.
- Backend, TSX, CSS, and static-file changes now flow through the bind mount and watcher processes; refresh the page instead of rebuilding the image.

## Route Overview

- `/` -> defaults to `/dashboard` on `fridge.local`; warning mode remains available at `/warning`.
- `/warning` -> warning wall page.
- `/links` -> flat access portal page.
- `/dashboard` -> homepage built from `links.json`.
- `/services` -> markdown-derived service index.

## links.json schema

`links.json` is the homepage source of truth. It is a JSON array of entries:

- `name` (string, required): Card label.
- `link` (string, optional): Direct URL.
- `destination` (string, optional): Redirect target URL for a shortcut.
- `shortcut` (string, optional): Shortcut path segment (ex: `wiki` -> `http://fridge.local/wiki`).

If an entry has `destination` (or `dest`), the homepage links to `/${shortcut}` and the server redirects to `destination`.
If `shortcut` is omitted, it is generated from `name`.

`destination`/`link` can be a full URL (`http://...`) or a bare host/path (`fridge.local:9090/`, `gmail.com`).
When no scheme is provided, the server infers a default (`http` for private IPs and internal hosts/explicit ports; otherwise `https`).

## Markdown Service Discovery

- The service index scans `/home/fridge/docker/*/README.md`.
- It also includes `/home/fridge/docker/PROJECTS.md` and `/home/fridge/docker/PORTS.md`.
- URLs found in those markdown files are surfaced through `/services` and `/api/service-docs`.

## Hostname Manager API

- `GET /api/hostnames` returns the saved hostname list with runtime resolution status.
- `POST /api/hostnames` adds or updates an entry.
- `DELETE /api/hostnames/:id` deletes an entry.
- `GET /api/health` returns `{ ok, version }`.

Entries are persisted to `HOSTNAMES_FILE` (default `/data/hostnames.json`) and written atomically with a lock file to avoid corruption.

## Query Redirects

Homepage supports query-based redirects to local services:

- `/?go=home`
- `/?go=warning`
- `/?go=notes`
- `/?go=notes&id=tech:fridge`
- `/?go=trains`
- `/?go=printers`
- `/?go=sprite`
- `/?go=v0`
- `/?go=photos`
- `/?go=sentry`
- `/?go=chat`

## GitHub Pages

Static Pages-ready artifacts live in `docs/`:

- `docs/index.html` (default warning page)
- `docs/links.html` (flat linktree-style portal)
- `docs/media/warning-wall/*.mp4` (background video tiles)

Automatic deployment workflow:

- `.github/workflows/deploy-pages.yml` publishes `docs/` to GitHub Pages on push to `main`.
