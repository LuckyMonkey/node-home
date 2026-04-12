const runtimeConfig = window.__FRIDGE_SHARE_CONFIG__ || {};
const DEFAULT_PUBLIC_BRIDGE_ORIGIN = normalizeOrigin(runtimeConfig.origin || 'https://share.fridge.run');
const RECENT_STORAGE_KEY = 'fridge.run.recent-shares.v2';

function normalizeOrigin(value) {
  if (!value) return '';
  return value.trim().replace(/\/+$/, '');
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname.endsWith('.home.arpa') || hostname.endsWith('.fridge.local');
}

function isPublicFridgeHost(hostname) {
  return hostname === 'fridge.run' || hostname.endsWith('.fridge.run');
}

function isShareOriginHost(hostname) {
  return hostname === 'share.fridge.run';
}

function detectBridgeOrigin() {
  const globalOrigin = normalizeOrigin(runtimeConfig.origin || '');
  if (globalOrigin) return globalOrigin;
  const metaOrigin = normalizeOrigin(document.querySelector('meta[name="fridge-share-origin"]')?.content || '');
  if (metaOrigin) return metaOrigin;
  if (isLocalHost(window.location.hostname) || isShareOriginHost(window.location.hostname)) {
    return normalizeOrigin(window.location.origin);
  }
  if (isPublicFridgeHost(window.location.hostname)) {
    return DEFAULT_PUBLIC_BRIDGE_ORIGIN;
  }
  return DEFAULT_PUBLIC_BRIDGE_ORIGIN;
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size < 0) return 'Unknown size';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function parseShareSelector(search = window.location.search) {
  const rawQuery = search || '';
  const params = new URLSearchParams(rawQuery);
  const directQuery = rawQuery.startsWith('?') ? rawQuery.slice(1) : '';
  const bareQuery = directQuery && !directQuery.includes('=') ? decodeURIComponent(directQuery) : '';
  const shareId = (
    params.get('h') ||
    params.get('hash') ||
    params.get('share') ||
    params.get('id') ||
    (bareQuery && /^[a-z0-9]{8,24}$/i.test(bareQuery) ? bareQuery : '') ||
    ''
  ).trim().toLowerCase();
  const legacySlug = (params.get('slug') || params.get('file') || (!shareId ? bareQuery : '') || '').trim();
  return { shareId, legacySlug };
}

function loadRecentShares() {
  try {
    const entries = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function saveRecentShares(entries) {
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function deleteRecentShare(shareId) {
  const normalizedShareId = String(shareId || '').trim().toLowerCase();
  if (!normalizedShareId) return loadRecentShares();
  const next = loadRecentShares().filter((entry) => String(entry?.shareId || '').trim().toLowerCase() !== normalizedShareId);
  saveRecentShares(next);
  return next;
}

function rememberShare(entry) {
  const shareId = String(entry.shareId || '').trim().toLowerCase();
  if (!shareId) return;
  const normalized = {
    shareId,
    slug: entry.slug || '',
    fileName: entry.fileName || entry.slug || shareId,
    mimeType: entry.mimeType || '',
    sizeBytes: Number(entry.sizeBytes) || 0,
    sizeLabel: entry.sizeLabel || formatBytes(Number(entry.sizeBytes)),
    bridgeUrl: entry.bridgeUrl || '',
    redirectUrl: entry.redirectUrl || '',
    seenAt: entry.seenAt || new Date().toISOString()
  };
  const next = [normalized, ...loadRecentShares().filter((item) => item.shareId !== shareId)].slice(0, 12);
  saveRecentShares(next);
}

function buildBridgeFileUrl(bridgeOrigin, shareId) {
  return `${normalizeOrigin(bridgeOrigin)}/file?h=${encodeURIComponent(shareId)}`;
}

function buildBridgePathUrl(bridgeOrigin, slug) {
  return `${normalizeOrigin(bridgeOrigin)}/f/${encodeURIComponent(String(slug || '').trim())}`;
}

function buildRedirectUrl(baseOrigin, shareId) {
  return `${normalizeOrigin(baseOrigin)}/redirect/?h=${encodeURIComponent(shareId)}`;
}

function normalizeRecentEntry(entry, options = {}) {
  const shareId = String(entry?.shareId || '').trim().toLowerCase();
  if (!shareId) return null;
  const bridgeOrigin = normalizeOrigin(options.bridgeOrigin || '');
  return {
    ...entry,
    shareId,
    slug: entry.slug || '',
    fileName: entry.fileName || entry.slug || shareId,
    mimeType: entry.mimeType || '',
    sizeBytes: Number(entry.sizeBytes) || 0,
    sizeLabel: entry.sizeLabel || formatBytes(Number(entry.sizeBytes)),
    bridgeUrl: entry.bridgeUrl || (bridgeOrigin ? buildBridgeFileUrl(bridgeOrigin, shareId) : `/file?h=${encodeURIComponent(shareId)}`),
    redirectUrl: entry.redirectUrl || (bridgeOrigin ? buildRedirectUrl(bridgeOrigin, shareId) : `/redirect/?h=${encodeURIComponent(shareId)}`),
    seenAt: entry.seenAt || entry.updatedAt || entry.createdAt || new Date().toISOString()
  };
}

function mergeRecentShares(remoteEntries, options = {}) {
  const merged = new Map();
  for (const entry of [...(Array.isArray(remoteEntries) ? remoteEntries : []), ...loadRecentShares()]) {
    const normalized = normalizeRecentEntry(entry, options);
    if (!normalized || merged.has(normalized.shareId)) continue;
    merged.set(normalized.shareId, normalized);
  }
  return Array.from(merged.values());
}

async function fetchShareMetadata(bridgeOrigin, shareId) {
  const response = await window.fetch(`${normalizeOrigin(bridgeOrigin)}/api/public-shares/${encodeURIComponent(shareId)}`, { mode: 'cors', credentials: 'omit' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'share lookup failed');
  return payload;
}

async function fetchRecentShares(bridgeOrigin, limit = 20) {
  const response = await window.fetch(`${normalizeOrigin(bridgeOrigin)}/api/recent-shares?limit=${encodeURIComponent(String(limit))}`, { mode: 'cors', credentials: 'omit' });
  const payload = await response.json().catch(() => ({}));
  const results = Array.isArray(payload.results) ? payload.results : Array.isArray(payload.shares) ? payload.shares : null;
  if (!response.ok || !results) throw new Error(payload.error || 'recent share lookup failed');
  return results.map((entry) => normalizeRecentEntry(entry, { bridgeOrigin })).filter(Boolean);
}

function setNotice(element, message, isError = false) {
  if (!element) return;
  if (!message) {
    element.hidden = true;
    element.textContent = '';
    element.classList.remove('error');
    return;
  }
  element.hidden = false;
  element.textContent = message;
  element.classList.toggle('error', Boolean(isError));
}

function renderRecentShares(container, entries, options = {}) {
  const items = Array.isArray(entries) ? entries : [];
  const emptyState = options.emptyState || null;
  if (!container) return;
  container.textContent = '';
  if (!items.length) {
    if (emptyState) emptyState.hidden = false;
    return;
  }
  if (emptyState) emptyState.hidden = true;
  for (const entry of items) {
    const shareId = String(entry.shareId || '').trim().toLowerCase();
    if (!shareId) continue;
    const row = document.createElement('article');
    row.className = 'share-row';
    const meta = document.createElement('div');
    meta.className = 'share-meta';
    const name = document.createElement('div');
    name.className = 'share-name';
    name.textContent = entry.fileName || entry.slug || shareId;
    const detail = document.createElement('div');
    detail.className = 'share-detail';
    const sizeLabel = entry.sizeLabel || formatBytes(Number(entry.sizeBytes));
    const updatedLabel = entry.updatedLabel || entry.createdLabel || '';
    detail.textContent = updatedLabel ? `${shareId} • ${sizeLabel} • ${updatedLabel}` : `${shareId} • ${sizeLabel}`;
    meta.append(name, detail);
    const actions = document.createElement('div');
    actions.className = 'share-actions';
    const download = document.createElement('a');
    download.className = 'button primary';
    download.href = entry.bridgeUrl || `/file?h=${encodeURIComponent(shareId)}`;
    download.textContent = 'Download';
    const redirect = document.createElement('a');
    redirect.className = 'button';
    redirect.href = entry.redirectUrl || `/redirect/?h=${encodeURIComponent(shareId)}`;
    redirect.textContent = 'Redirect';
    actions.append(download, redirect);
    if (typeof options.onDeleteLocal === 'function') {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ghost';
      remove.textContent = 'Remove';
      remove.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        options.onDeleteLocal(entry);
      });
      actions.append(remove);
    }
    row.append(meta, actions);
    container.appendChild(row);
  }
}

window.FridgeShareBridge = {
  RECENT_STORAGE_KEY,
  buildBridgeFileUrl,
  buildBridgePathUrl,
  buildRedirectUrl,
  detectBridgeOrigin,
  deleteRecentShare,
  fetchRecentShares,
  fetchShareMetadata,
  formatBytes,
  loadRecentShares,
  mergeRecentShares,
  normalizeOrigin,
  normalizeRecentEntry,
  parseShareSelector,
  rememberShare,
  renderRecentShares,
  saveRecentShares,
  setNotice
};
