# dashboard

Dashboard + warning/portal redirects for `http://fridge.local/` (runs in the `node-dashboard` container).

## Features

- User quick links from `links.json` (reorder, delete, add).
- Shortcut redirects (e.g. `/wiki` -> DokuWiki).
- Managed services panel with container status and one-click `Start` / `Stop` / `Restart` for optional Docker projects.
- Default warning screen on `/warning` with background video wall.
- Flat access portal on `/links` (linktree-style public links only).
- Query redirects on `/` for single-hostname navigation (for example `/?go=warning`, `/?go=notes`, `/?go=trains`, `/?go=printers`).
- Settings page at `/settings` for service hostname management with optional fallback `IP:port`.
- Hostname API with runtime DNS resolution checks and persistent JSON storage in `/data/hostnames.json`.
- Client-side profile persistence (display name, click-rank, hidden state, block order, history) synced to `/api/profiles/:name`.

## Frontend Structure

- `public/js/app-shared.js`: shared browser helpers (`localStorage` JSON wrappers, selectors, name sanitizer).
- `public/js/homepage.js`: dashboard behavior (ordering, hide/show, block move controls, icon loading/cache, sound, profile sync, MOTD).
- `public/js/settings.js`: settings page behavior (profile name save + hostname CRUD).
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
- The container runs `node --watch index.js`, so backend code changes auto-reload without rebuilding the image.
- CSS/static file updates are served directly from the bind mount and appear on refresh.

## Route Overview

- `/` -> defaults to `/warning` (unless `?go=` query redirect is used).
- `/warning` -> warning wall page.
- `/links` -> flat access portal page.
- `/dashboard` -> full dynamic dashboard view.

## links.json schema

`links.json` is a JSON array of entries:

- `name` (string, required): Card label.
- `link` (string, optional): Direct URL.
- `destination` (string, optional): Redirect target URL for a shortcut.
- `shortcut` (string, optional): Shortcut path segment (ex: `wiki` -> `http://fridge.local/wiki`).

If an entry has `destination` (or `dest`), the dashboard links to `/${shortcut}` and the server redirects to `destination`.
If `shortcut` is omitted, it is generated from `name`.

`destination`/`link` can be a full URL (`http://...`) or a bare host/path (`fridge.local:9090/`, `gmail.com`).
When no scheme is provided, the server infers a default (`http` for private IPs and internal hosts/explicit ports; otherwise `https`).

## Hostname Manager API

- `GET /api/hostnames` returns the saved hostname list with runtime resolution status.
- `POST /api/hostnames` adds or updates an entry.
- `DELETE /api/hostnames/:id` deletes an entry.
- `GET /api/health` returns `{ ok, version }`.

Entries are persisted to `HOSTNAMES_FILE` (default `/data/hostnames.json`) and written atomically with a lock file to avoid corruption.

## Query Redirects

Dashboard supports query-based redirects to local services:

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
