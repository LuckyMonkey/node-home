// Share-bridge configuration.
//
// `origin` is the base URL of the node's share bridge. It previously pointed at
// an ephemeral Cloudflare quick-tunnel hostname
// (train-accompanied-wonderful-porter.trycloudflare.com) which expired long ago,
// so every share link silently resolved to a dead host.
//
// Quick tunnels are randomly named and disappear when cloudflared stops, so they
// must never be committed as durable configuration. Leave `origin` empty and the
// share UI degrades to same-origin links instead of pointing somewhere dead.
//
// To enable the bridge, set `origin` to a stable hostname the node actually
// answers on (a tailnet address, a named tunnel, or a reverse proxy).
window.__FRIDGE_SHARE_CONFIG__ = Object.assign(
  {
    origin: '',
    redirectDelayMs: 650
  },
  window.__FRIDGE_SHARE_CONFIG__ || {}
);
