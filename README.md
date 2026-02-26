# node-homepage

Homepage + shortcut redirects for `http://fridge.local/` (runs in the `node-home` container).

## Features

- User quick links from `links.json` (reorder, delete, add).
- Shortcut redirects (e.g. `/wiki` -> DokuWiki).
- Managed services panel with container status and one-click `Start` / `Stop` / `Restart` for optional Docker projects.
- Query redirects on `/` for single-hostname navigation (for example `/?go=notes`, `/?go=trains`, `/?go=printers`).
- Settings page at `/settings` for service hostname management with optional fallback `IP:port`.
- Hostname API with runtime DNS resolution checks and persistent JSON storage in `/data/hostnames.json`.

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

## links.json schema

`links.json` is a JSON array of entries:

- `name` (string, required): Card label.
- `link` (string, optional): Direct URL.
- `destination` (string, optional): Redirect target URL for a shortcut.
- `shortcut` (string, optional): Shortcut path segment (ex: `wiki` -> `http://fridge.local/wiki`).

If an entry has `destination` (or `dest`), the homepage links to `/${shortcut}` and the server redirects to `destination`.
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

Homepage supports query-based redirects to local services:

- `/?go=home`
- `/?go=notes`
- `/?go=notes&id=tech:fridge`
- `/?go=trains`
- `/?go=printers`
- `/?go=sprite`
- `/?go=v0`
- `/?go=photos`
- `/?go=sentry`
- `/?go=chat`
