const express = require('express');
const moment = require('moment');
const fs = require('fs');
const dns = require('dns').promises;
const crypto = require('crypto');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const app = express();
const LINKS_FILE = path.join(__dirname, 'links.json');
const DEFAULT_LINKS_FILE = path.join(__dirname, 'links.defaults.json');
const DELETED_FILE = path.join(__dirname, 'deleted.json');
const HOSTNAMES_FILE = process.env.HOSTNAMES_FILE || path.join(__dirname, 'hostnames.json');
const HOSTNAMES_LOCK_FILE = `${HOSTNAMES_FILE}.lock`;
const PROFILES_FILE = process.env.PROFILES_FILE || path.join(__dirname, 'data', 'profiles.json');
const PROFILES_LOCK_FILE = `${PROFILES_FILE}.lock`;
const HOMEPAGE_BASE_URL = process.env.HOMEPAGE_BASE_URL || 'http://fridge.local';
const APP_VERSION = process.env.APP_VERSION || '1.1.0';
const PORT = Number(process.env.PORT) || 8088;
const MBTA_API_BASE = process.env.MBTA_API_BASE || 'http://mbta-api:4000';
const ICON_CACHE_DIR = path.join(__dirname, 'data', 'icon-cache');
const ICON_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SOUND_FILES = Object.freeze({
  hover1: '/home/fridge/docker/mbta-tracker/hover.wav',
  hover2: '/home/fridge/docker/mbta-tracker/hover2.wav',
  select: '/home/fridge/docker/mbta-tracker/select.wav'
});
const FRIDGE_ICON_PATH = '/home/fridge/docker/icon.png';
const MAX_FIELD_LENGTH = 255;
const MAX_HOMEPAGE_LENGTH = 512;
const MAX_ENTRIES = 500;
const MAX_PROFILE_NAME_LENGTH = 40;

app.use(express.static(__dirname));
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true }));

const MANAGED_SERVICES = [
  {
    id: 'sprite-cylinder-tagger',
    name: 'Sprite Cylinder Tagger',
    description: '3D sprite cylinder tagging UI',
    location: '/home/fridge/sprite-cylinder-tagger',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=sprite`,
    type: 'compose',
    composeFile: '/home/fridge/sprite-cylinder-tagger/docker-compose.yml',
    containers: ['sprite-cylinder-tagger']
  },
  {
    id: 'v0-lab',
    name: 'v0 Lab',
    description: 'Shared v0 sandbox app index',
    location: '/home/fridge/docker/v0-lab',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=v0`,
    type: 'container',
    containerName: 'v0-next-lab',
    startScript: '/home/fridge/docker/v0-lab/run-v0.sh',
    startArgs: ['start', '8064'],
    containers: ['v0-next-lab']
  },
  {
    id: 'mbta-tracker',
    name: 'MBTA Tracker',
    description: 'Suffolk Downs arrivals dashboard',
    location: '/home/fridge/docker/mbta-tracker',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=trains`,
    type: 'compose',
    composeFile: '/home/fridge/docker/mbta-tracker/docker-compose.yml',
    containers: ['mbta-web', 'mbta-api', 'mbta-mongo']
  },
  {
    id: 'printer-hub',
    name: 'Printer Hub',
    description: 'Brother/Zebra/HP print control service',
    location: '/home/fridge/docker/printer-hub',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=printers`,
    type: 'compose',
    composeFile: '/home/fridge/docker/printer-hub/docker-compose.yml',
    containers: ['printer-hub']
  },
  {
    id: 'device-sentry',
    name: 'Device Sentry',
    description: 'BLE/Wi-Fi proximity viewer',
    location: '/home/fridge/docker/device-sentry',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=sentry`,
    type: 'compose',
    composeFile: '/home/fridge/docker/device-sentry/docker-compose.yml',
    containers: ['device-sentry', 'device-sentry-viewer']
  },
  {
    id: 'photosort',
    name: 'PhotoSort',
    description: 'Photo sorting API + web UI',
    location: '/home/fridge/docker/photosort',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=photos`,
    type: 'compose',
    composeFile: '/home/fridge/docker/photosort/docker-compose.yml',
    containers: ['photosort-api', 'photosort-web']
  },
  {
    id: 'rocketchat',
    name: 'Rocket.Chat',
    description: 'Self-hosted team chat',
    location: '/home/fridge/docker/rocketchat',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=chat`,
    type: 'compose',
    composeFile: '/home/fridge/docker/rocketchat/docker-compose.yml',
    containers: ['rocketchat_rocketchat_1', 'rocketchat_mongo_1']
  },
  {
    id: 'media-stack',
    name: 'Media Stack',
    description: 'SMB + DLNA media services',
    location: '/home/fridge/docker/media-stack',
    openUrl: '',
    type: 'compose',
    composeFile: '/home/fridge/docker/media-stack/docker-compose.yml',
    containers: ['media-smb', 'minidlna']
  },
  {
    id: 'dokuwiki',
    name: 'DokuWiki',
    description: 'Local documentation wiki',
    location: '/home/fridge/dokuwiki',
    openUrl: `${HOMEPAGE_BASE_URL}/?go=notes`,
    type: 'container',
    containerName: 'dokuwiki',
    containers: ['dokuwiki']
  }
];

const SERVICE_BY_ID = new Map(MANAGED_SERVICES.map((service) => [service.id, service]));

const curatedLinks = [
  {
    name: 'Projects Inventory',
    link: `${HOMEPAGE_BASE_URL}/?go=notes&id=tech:docker_projects`,
    description: 'Wiki index of docker projects and notes'
  },
  {
    name: 'Fridge Server Notes',
    link: `${HOMEPAGE_BASE_URL}/?go=notes&id=tech:fridge`,
    description: 'Infrastructure and host notes'
  },
  {
    name: 'Pi-hole Admin',
    link: 'http://192.168.1.99/admin',
    description: 'Pi-hole control panel (always-on core service)'
  },
  {
    name: 'Node Home',
    link: `${HOMEPAGE_BASE_URL}/`,
    description: 'This launch page'
  }
];

const EXTERNAL_SERVICE_CARDS = [
  {
    id: 'pihole',
    name: 'Pi-hole',
    description: 'DNS filtering + admin dashboard',
    location: '/home/fridge/docker/pihole',
    openUrl: 'http://192.168.1.99/admin'
  }
];

const QUERY_REDIRECT_TARGETS = Object.freeze({
  home: `${HOMEPAGE_BASE_URL}/`,
  notes: `${HOMEPAGE_BASE_URL}/app/notes`,
  trains: `${HOMEPAGE_BASE_URL}/app/trains`,
  printers: `${HOMEPAGE_BASE_URL}/app/printers`,
  sprite: `${HOMEPAGE_BASE_URL}/app/sprite`,
  v0: `${HOMEPAGE_BASE_URL}/app/v0`,
  sentry: `${HOMEPAGE_BASE_URL}/app/sentry`,
  photos: `${HOMEPAGE_BASE_URL}/app/photos`,
  chat: `${HOMEPAGE_BASE_URL}/app/chat`,
  pihole: 'http://192.168.1.99/admin'
});

const APP_WRAPPER_TARGETS = Object.freeze({
  notes: `${HOMEPAGE_BASE_URL}:9090/`,
  trains: `${HOMEPAGE_BASE_URL}:5174/`,
  printers: `${HOMEPAGE_BASE_URL}:8088/ui/`,
  sprite: `${HOMEPAGE_BASE_URL}:5173/`,
  v0: `${HOMEPAGE_BASE_URL}:8064/`,
  sentry: `${HOMEPAGE_BASE_URL}:8089/`,
  photos: `${HOMEPAGE_BASE_URL}:8081/`,
  chat: `${HOMEPAGE_BASE_URL}:4002/`
});

const QUERY_REDIRECT_ALIASES = Object.freeze({
  wiki: 'notes',
  docs: 'notes',
  dokuwiki: 'notes',
  mbta: 'trains',
  train: 'trains',
  printer: 'printers',
  printerhub: 'printers',
  homepage: 'home',
  node: 'home'
});

const readLinks = () => {
  try {
    const defaults = fs.existsSync(DEFAULT_LINKS_FILE)
      ? JSON.parse(fs.readFileSync(DEFAULT_LINKS_FILE, 'utf8'))
      : [];
    const raw = JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      const byName = new Map();
      for (const entry of defaults) {
        if (entry && entry.name) byName.set(String(entry.name).toLowerCase(), entry);
      }
      for (const entry of raw) {
        if (entry && entry.name) byName.set(String(entry.name).toLowerCase(), entry);
      }
      return Array.from(byName.values());
    }
    if (raw && typeof raw === 'object') {
      const converted = Object.entries(raw).map(([name, link]) => ({ name, link }));
      writeLinks(converted);
      return converted;
    }
    return [];
  } catch (err) {
    console.error('Unable to read links file', err);
    return [];
  }
};

const writeLinks = (entries) => {
  fs.writeFileSync(LINKS_FILE, JSON.stringify(entries, null, 2));
};

const appendDeletedSnapshot = (entries) => {
  const payload = `${JSON.stringify({ deletedAt: new Date().toISOString(), links: entries }, null, 2)}\n`;
  fs.appendFileSync(DELETED_FILE, payload);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const badRequest = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const ensureParentDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const acquireFileLock = async (lockPath, { timeoutMs = 2500, retryMs = 40 } = {}) => {
  const startedAt = Date.now();
  while (true) {
    try {
      return fs.openSync(lockPath, 'wx');
    } catch (err) {
      if (err.code !== 'EEXIST') {
        throw err;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error(`Timed out waiting for lock: ${lockPath}`);
      }
      // Short retry loop for concurrent requests writing the same JSON file.
      // eslint-disable-next-line no-await-in-loop
      await wait(retryMs);
    }
  }
};

const withFileLock = async (lockPath, fn) => {
  ensureParentDir(lockPath);
  const fd = await acquireFileLock(lockPath);
  try {
    return await fn();
  } finally {
    try {
      fs.closeSync(fd);
    } catch (err) {
      console.error('Unable to close lock fd', err);
    }
    try {
      fs.unlinkSync(lockPath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Unable to remove lock file', err);
      }
    }
  }
};

const writeJsonAtomic = (filePath, value) => {
  ensureParentDir(filePath);
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  try {
    fs.writeFileSync(tmpPath, payload, 'utf8');
    fs.renameSync(tmpPath, filePath);
  } finally {
    if (fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath);
    }
  }
};

const isIPv4Literal = (value) => {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return false;
  return value.split('.').every((part) => Number(part) >= 0 && Number(part) <= 255);
};

const splitHostPort = (raw) => {
  const cleaned = String(raw || '').trim().replace(/^[a-z]+:\/\//i, '');
  const hostPort = cleaned.split('/')[0].trim();
  if (!hostPort) return { host: '', port: '' };
  const firstColon = hostPort.indexOf(':');
  const lastColon = hostPort.lastIndexOf(':');
  if (firstColon !== -1 && firstColon === lastColon) {
    return {
      host: hostPort.slice(0, firstColon).trim(),
      port: hostPort.slice(lastColon + 1).trim()
    };
  }
  return { host: hostPort, port: '' };
};

const isValidHostname = (value) => {
  const normalized = String(value || '').trim().toLowerCase().replace(/\.+$/, '');
  if (!normalized || normalized.length > 253) return false;
  if (normalized.includes('..')) return false;
  if (isIPv4Literal(normalized)) return false;
  const labels = normalized.split('.');
  if (labels.length < 2) return false;
  return labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
};

const validatePort = (value) => {
  if (!/^\d{1,5}$/.test(value)) return false;
  const port = Number(value);
  return port >= 1 && port <= 65535;
};

const isSafeTextValue = (value, maxLen) => {
  if (!value || typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > maxLen) return false;
  return !(/[<>"'`]/.test(trimmed));
};

const isValidHomepageUrl = (value) => {
  if (!isSafeTextValue(value, MAX_HOMEPAGE_LENGTH)) return false;
  const trimmed = value.trim();
  if (/\s/.test(trimmed)) return false;
  return /^[a-z0-9:/?#[\]@!$&()*+,;=._~-]+$/i.test(trimmed);
};

const isValidFallbackTarget = (value) => {
  if (!isSafeTextValue(value, MAX_FIELD_LENGTH)) return false;
  const { host, port } = splitHostPort(value);
  if (!host || !port) return false;
  if (!validatePort(port)) return false;
  return isIPv4Literal(host) || isValidHostname(host);
};

const normalizeId = (raw) => {
  const id = String(raw || '').trim();
  if (!id) return '';
  return /^[a-zA-Z0-9_-]{6,64}$/.test(id) ? id : '';
};

const deriveEntryId = (homepageUrl, serviceHostname) => {
  const digest = crypto
    .createHash('sha1')
    .update(`${homepageUrl}|${serviceHostname}`)
    .digest('hex')
    .slice(0, 24);
  return `h_${digest}`;
};

const normalizeHostnameEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const homepageUrl = String(entry.homepageUrl || '').trim();
  const serviceHostname = String(entry.serviceHostname || '').trim().toLowerCase().replace(/\.+$/, '');
  const fallbackTarget = String(entry.fallbackTarget || '').trim();
  const id = normalizeId(entry.id) || deriveEntryId(homepageUrl, serviceHostname);
  if (!isValidHomepageUrl(homepageUrl)) return null;
  if (!isValidHostname(serviceHostname)) return null;
  if (fallbackTarget && !isValidFallbackTarget(fallbackTarget)) return null;
  return {
    id,
    homepageUrl,
    serviceHostname,
    fallbackTarget,
    createdAt: entry.createdAt || new Date().toISOString(),
    updatedAt: entry.updatedAt || new Date().toISOString()
  };
};

const readHostnamesFromDisk = () => {
  try {
    ensureParentDir(HOSTNAMES_FILE);
    if (!fs.existsSync(HOSTNAMES_FILE)) {
      fs.writeFileSync(HOSTNAMES_FILE, '[]\n', 'utf8');
    }
    const parsed = JSON.parse(fs.readFileSync(HOSTNAMES_FILE, 'utf8'));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => normalizeHostnameEntry(entry)).filter(Boolean);
  } catch (err) {
    console.error('Unable to read hostnames file', err);
    return [];
  }
};

const writeHostnamesToDisk = async (entries) => {
  await withFileLock(HOSTNAMES_LOCK_FILE, async () => {
    writeJsonAtomic(HOSTNAMES_FILE, entries);
  });
};

const normalizeProfileName = (raw) => String(raw || '')
  .trim()
  .replace(/[^\w\s-]/g, '')
  .slice(0, MAX_PROFILE_NAME_LENGTH);

const readProfilesFromDisk = () => {
  try {
    ensureParentDir(PROFILES_FILE);
    if (!fs.existsSync(PROFILES_FILE)) fs.writeFileSync(PROFILES_FILE, '{}\n', 'utf8');
    const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.error('Unable to read profiles file', err);
    return {};
  }
};

const writeProfilesToDisk = async (profiles) => {
  await withFileLock(PROFILES_LOCK_FILE, async () => {
    writeJsonAtomic(PROFILES_FILE, profiles);
  });
};

const sanitizeProfilePayload = (payload) => {
  const displayName = normalizeProfileName(payload?.displayName || '');
  const linksRank = payload && payload.linksRank && typeof payload.linksRank === 'object' ? payload.linksRank : {};
  const hiddenItems = payload && payload.hiddenItems && typeof payload.hiddenItems === 'object' ? payload.hiddenItems : {};
  const blockOrderRaw = Array.isArray(payload?.blockOrder) ? payload.blockOrder : [];
  const allowedBlocks = new Set(['pinned', 'links', 'services', 'folders']);
  const blockOrder = blockOrderRaw
    .map((item) => String(item || '').trim())
    .filter((item, idx, arr) => allowedBlocks.has(item) && arr.indexOf(item) === idx);
  for (const block of ['pinned', 'links', 'services', 'folders']) {
    if (!blockOrder.includes(block)) blockOrder.push(block);
  }

  const cleanScoreMap = {};
  Object.entries(linksRank).slice(0, 2000).forEach(([k, v]) => {
    const key = String(k || '').trim().slice(0, 120);
    if (!key) return;
    const score = Number(v);
    if (!Number.isFinite(score) || score < 0) return;
    cleanScoreMap[key] = Math.floor(score);
  });

  const cleanHiddenMap = {};
  Object.entries(hiddenItems).slice(0, 2000).forEach(([k, v]) => {
    const key = String(k || '').trim().slice(0, 120);
    if (!key) return;
    cleanHiddenMap[key] = v ? 1 : 0;
  });

  const history = Array.isArray(payload?.history) ? payload.history : [];
  const cleanHistory = history.slice(-200).map((entry) => ({
    id: String(entry?.id || '').slice(0, 120),
    href: String(entry?.href || '').slice(0, 512),
    ts: Number(entry?.ts) || Date.now()
  })).filter((entry) => entry.id && entry.href);
  const linksSnapshotRaw = Array.isArray(payload?.linksSnapshot) ? payload.linksSnapshot : [];
  const linksSnapshot = linksSnapshotRaw.slice(0, 1000).map((entry) => ({
    name: String(entry?.name || '').trim().slice(0, 120),
    link: String(entry?.link || '').trim().slice(0, 512),
    destination: String(entry?.destination || '').trim().slice(0, 512),
    shortcut: String(entry?.shortcut || '').trim().slice(0, 80)
  })).filter((entry) => entry.name);

  return {
    displayName,
    linksRank: cleanScoreMap,
    hiddenItems: cleanHiddenMap,
    blockOrder,
    history: cleanHistory,
    linksSnapshot
  };
};

const parseHostnamePayload = (payload) => {
  const homepageUrl = String(payload?.homepageUrl || '').trim();
  const serviceHostname = String(payload?.serviceHostname || '').trim().toLowerCase().replace(/\.+$/, '');
  const fallbackTarget = String(payload?.fallbackTarget || '').trim();
  const requestedId = normalizeId(payload?.id);

  if (!isValidHomepageUrl(homepageUrl)) {
    throw badRequest('homepageUrl is invalid or too long');
  }
  if (!isSafeTextValue(serviceHostname, MAX_FIELD_LENGTH) || !isValidHostname(serviceHostname)) {
    throw badRequest('serviceHostname must be a valid hostname such as fridge.local');
  }
  if (fallbackTarget && !isValidFallbackTarget(fallbackTarget)) {
    throw badRequest('fallbackTarget must look like 192.168.1.50:631');
  }

  return {
    id: requestedId,
    homepageUrl,
    serviceHostname,
    fallbackTarget
  };
};

const resolveHostname = async (value) => {
  const { host } = splitHostPort(value);
  if (!host) {
    return { resolved: false, addresses: [], warning: 'invalid hostname' };
  }
  if (isIPv4Literal(host)) {
    return { resolved: true, addresses: [host], warning: '' };
  }
  try {
    const records = await dns.lookup(host, { all: true });
    const addresses = Array.from(new Set(records.map((item) => item.address).filter(Boolean)));
    return { resolved: addresses.length > 0, addresses, warning: '' };
  } catch (err) {
    const code = err && err.code ? err.code : 'lookup_failed';
    return { resolved: false, addresses: [], warning: code };
  }
};

const enrichHostnameEntry = async (entry) => {
  const resolution = await resolveHostname(entry.serviceHostname);
  const hasFallback = Boolean(entry.fallbackTarget);
  const effectiveTarget = resolution.resolved ? entry.serviceHostname : (hasFallback ? entry.fallbackTarget : entry.serviceHostname);
  const warning = resolution.resolved
    ? ''
    : (hasFallback
      ? `${entry.serviceHostname} did not resolve (${resolution.warning}); using fallback`
      : `${entry.serviceHostname} did not resolve (${resolution.warning})`);

  return {
    ...entry,
    resolved: resolution.resolved,
    resolvedAddresses: resolution.addresses,
    warning,
    effectiveTarget,
    effectiveUrl: formatLink(effectiveTarget, { defaultScheme: inferDefaultScheme(effectiveTarget) || 'http' })
  };
};

const inferDefaultScheme = (raw) => {
  if (!raw) return 'https';
  const value = String(raw).trim();
  if (!value) return 'https';
  if (value.startsWith('/')) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return '';
  if (/\blocalhost\b/i.test(value)) return 'http';
  if (/\b\.local\b/i.test(value)) return 'http';
  if (/^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(value)) return 'http';
  if (/:\d+(?:\/|$)/.test(value)) return 'http';
  return 'https';
};

const formatLink = (raw, { defaultScheme = 'https' } = {}) => {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value) return '';
  if (value.startsWith('/')) return value;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (!defaultScheme) return value;
  return `${defaultScheme}://${value}`;
};

const wrapKnownAppUrl = (rawHref) => {
  const href = String(rawHref || '').trim();
  if (!href) return href;
  const normalized = href
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
  if (
    normalized === 'fridge.local:8088'
    || normalized === 'fridge.local:8088/ui'
    || normalized === '192.168.1.102:8088'
    || normalized === '192.168.1.102:8088/ui'
  ) {
    return `${HOMEPAGE_BASE_URL}/app/printers`;
  }
  return href;
};

const normalizeShortcut = (raw) => {
  if (!raw) return '';
  const value = String(raw).trim();
  if (!value) return '';
  return value.replace(/^\/+/, '').replace(/\/+$/, '');
};

const getSingleQueryValue = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] || '').trim();
  }
  return String(value || '').trim();
};

const normalizeRedirectKey = (raw) => {
  const value = normalizeShortcut(raw).toLowerCase();
  if (!value) return '';
  return /^[a-z0-9_-]{1,48}$/.test(value) ? value : '';
};

const normalizeWikiPageId = (raw) => {
  const value = getSingleQueryValue(raw);
  if (!value) return '';
  return /^[a-z0-9:_-]{1,140}$/i.test(value) ? value : '';
};

const normalizeLocalPath = (raw) => {
  const value = getSingleQueryValue(raw);
  if (!value) return '';
  if (!value.startsWith('/')) return '';
  if (value.length > 240) return '';
  if (/[<>"'`\s]/.test(value)) return '';
  return value;
};

const resolveHomepageQueryRedirect = (query) => {
  const requestedRaw = getSingleQueryValue(query.go || query.to || query.service);
  if (!requestedRaw) {
    return { target: '', error: '' };
  }

  const requested = normalizeRedirectKey(requestedRaw);
  if (!requested) {
    return { target: '', error: 'Invalid redirect target' };
  }

  const key = QUERY_REDIRECT_ALIASES[requested] || requested;
  const base = QUERY_REDIRECT_TARGETS[key];
  if (!base) {
    return { target: '', error: `Unknown redirect target: ${requested}` };
  }

  if (key === 'notes') {
    const pageId = normalizeWikiPageId(query.id);
    if (pageId) {
      return {
        target: `${QUERY_REDIRECT_TARGETS.notes}doku.php?id=${encodeURIComponent(pageId)}`,
        error: ''
      };
    }
  }

  if (key === 'home') {
    const pathOnly = normalizeLocalPath(query.path);
    if (pathOnly) {
      return {
        target: `${HOMEPAGE_BASE_URL}${pathOnly}`,
        error: ''
      };
    }
  }

  return { target: base, error: '' };
};

const slugify = (raw) => {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const getShortcutForEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return '';
  const explicit = normalizeShortcut(entry.shortcut || entry.slug || entry.path);
  if (explicit) return explicit;
  if (entry.destination || entry.dest) return slugify(entry.name);
  return '';
};

const getDestinationForEntry = (entry) => {
  if (!entry || typeof entry !== 'object') return '';
  return entry.destination || entry.dest || entry.link || '';
};

const iconFor = (link) => {
  const scheme = inferDefaultScheme(link);
  const url = formatLink(link, { defaultScheme: scheme || 'https' });
  const domain = url.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  const target = domain ? `https://${domain}` : url;
  const encoded = encodeURIComponent(target);
  const fallback = `https://www.google.com/s2/favicons?sz=512&domain_url=${encoded}`;
  const apple = domain ? `https://${domain}/apple-touch-icon.png` : fallback;
  const webManifest = domain ? `https://${domain}/android-chrome-512x512.png` : fallback;
  const favicon = domain ? `https://${domain}/favicon.ico` : fallback;
  return { primary: apple, secondary: webManifest, tertiary: favicon, fallback };
};

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const emojiForName = (name) => {
  const n = String(name || '').toLowerCase();
  if (n.includes('mbta') || n.includes('train')) return '🚆';
  if (n.includes('printer')) return '🖨️';
  if (n.includes('pihole') || n.includes('pi-hole')) return '🛡️';
  if (n.includes('chat') || n.includes('rocket')) return '💬';
  if (n.includes('photo')) return '🖼️';
  if (n.includes('wiki') || n.includes('note')) return '📚';
  if (n.includes('media')) return '🎬';
  if (n.includes('sprite')) return '🧃';
  if (n.includes('sentry')) return '📡';
  if (n.includes('v0')) return '🧪';
  if (n.includes('folder') || n.includes('project')) return '📁';
  return '🔗';
};

const runCommand = async (command, args, options = {}) => {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      maxBuffer: 1024 * 1024,
      timeout: 120000,
      ...options
    });
    return { stdout: stdout || '', stderr: stderr || '' };
  } catch (err) {
    const details = [err.message, err.stdout, err.stderr].filter(Boolean).join('\n');
    throw new Error(details || 'Command failed');
  }
};

const parseUrlForProxy = (raw) => {
  try {
    const parsed = new URL(String(raw || '').trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const requestHost = (req) => {
  const forwarded = String(req.headers['x-forwarded-host'] || '').trim();
  const host = forwarded || String(req.headers.host || '').trim();
  return host.split(',')[0].trim().toLowerCase();
};

const shouldInjectForHost = (req) => {
  const host = requestHost(req).split(':')[0];
  return host === 'fridge.local' || host.endsWith('.fridge.local');
};

const iconCachePathForUrl = (url) => {
  const key = crypto.createHash('sha1').update(String(url)).digest('hex');
  return {
    metaPath: path.join(ICON_CACHE_DIR, `${key}.json`),
    binPath: path.join(ICON_CACHE_DIR, `${key}.bin`)
  };
};

const readDiskIconCache = (url) => {
  try {
    const { metaPath, binPath } = iconCachePathForUrl(url);
    if (!fs.existsSync(metaPath) || !fs.existsSync(binPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (!meta || typeof meta !== 'object') return null;
    if (!meta.cachedAt || (Date.now() - Number(meta.cachedAt)) > ICON_CACHE_TTL_MS) return null;
    const payload = fs.readFileSync(binPath);
    if (!payload.length) return null;
    return { contentType: meta.contentType || 'image/png', payload };
  } catch {
    return null;
  }
};

const writeDiskIconCache = (url, contentType, payload) => {
  try {
    fs.mkdirSync(ICON_CACHE_DIR, { recursive: true });
    const { metaPath, binPath } = iconCachePathForUrl(url);
    fs.writeFileSync(binPath, payload);
    fs.writeFileSync(metaPath, JSON.stringify({ contentType, cachedAt: Date.now() }), 'utf8');
  } catch (err) {
    console.error('Unable to write icon cache', err.message || err);
  }
};

const resolvePageIconUrl = async (rawUrl) => {
  const parsed = parseUrlForProxy(rawUrl);
  if (!parsed) return '';
  const response = await fetch(parsed.toString(), {
    method: 'GET',
    redirect: 'follow',
    headers: { 'User-Agent': 'node-home-icon-discovery/1.0' }
  });
  if (!response.ok) return '';
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.includes('text/html')) return '';
  const html = await response.text();
  const relPattern = /<link[^>]*rel=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = relPattern.exec(html)) !== null) {
    const rel = String(match[1] || '').toLowerCase();
    if (!/(^|\\s)(apple-touch-icon|icon|shortcut icon)(\\s|$)/.test(rel)) continue;
    const tag = match[0];
    const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch || !hrefMatch[1]) continue;
    try {
      return new URL(hrefMatch[1], parsed).toString();
    } catch {
      continue;
    }
  }
  return '';
};

const fetchJsonWithTimeout = async (url, timeoutMs = 5000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
};

const parseMinutesUntil = (isoOrRaw, nowMs) => {
  const eventMs = isoOrRaw ? Date.parse(isoOrRaw) : NaN;
  if (!Number.isFinite(eventMs)) return null;
  return Math.max(0, Math.floor((eventMs - nowMs) / 60000));
};

const computeTrainMotdFromPublicApi = async () => {
  const now = Date.now();
  const url = 'https://api-v3.mbta.com/predictions?filter[stop]=place-sdmnl&filter[route]=Blue&sort=arrival_time&page[limit]=8';
  const payload = await fetchJsonWithTimeout(url, 6000);
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const inbound = rows
    .filter((row) => Number(row?.attributes?.direction_id) === 1)
    .map((row) => ({
      minutes: parseMinutesUntil(row?.attributes?.arrival_time || row?.attributes?.departure_time, now),
      headsign: row?.attributes?.direction_id === 1 ? 'Bowdoin' : 'Wonderland'
    }))
    .filter((row) => Number.isFinite(row.minutes))
    .sort((a, b) => a.minutes - b.minutes);
  const next = inbound[0];
  if (!next) {
    return {
      title: 'no inbound train data right now',
      leaveText: 'check tracker for live refresh',
      ctaUrl: '/?go=trains',
      ctaLabel: 'open mbta tracker'
    };
  }
  const walk = 4;
  const leaveIn = Math.max(0, next.minutes - walk);
  return {
    title: `next train ${next.minutes} min to ${next.headsign}`,
    leaveText: leaveIn <= 0 ? 'leave now' : `leave in ${leaveIn} min`,
    ctaUrl: '/?go=trains',
    ctaLabel: 'open mbta tracker'
  };
};

const computeTrainMotd = async () => {
  try {
    const [cfg, data] = await Promise.all([
      fetchJsonWithTimeout(`${MBTA_API_BASE}/api/config`, 5000),
      fetchJsonWithTimeout(`${MBTA_API_BASE}/api/suffolk-downs`, 5000)
    ]);
    const walk = Number(cfg.walkTimeMinutes || 4);
    const predictions = Array.isArray(data.predictions) ? data.predictions : [];
    const now = Date.now();
    const inbound = predictions
      .filter((p) => Number(p.directionId) === 1)
      .map((p) => {
        const minutes = Number.isFinite(p.minutes)
          ? Number(p.minutes)
          : parseMinutesUntil(p.arrivalTime || p.departureTime, now);
        return { ...p, minutes };
      })
      .filter((p) => Number.isFinite(p.minutes))
      .sort((a, b) => a.minutes - b.minutes);

    const next = inbound[0] || null;
    if (!next) {
      return {
        title: 'no inbound train data right now',
        leaveText: 'check tracker for live refresh',
        ctaUrl: '/?go=trains',
        ctaLabel: 'open mbta tracker'
      };
    }

    const leaveIn = Math.max(0, next.minutes - walk);
    const leaveText = leaveIn <= 0 ? 'leave now' : `leave in ${leaveIn} min`;
    const headsign = next.headsign || 'Bowdoin';
    return {
      title: `next train ${next.minutes} min to ${headsign}`,
      leaveText,
      ctaUrl: '/?go=trains',
      ctaLabel: 'open mbta tracker'
    };
  } catch (err) {
    console.error('Primary MBTA API unavailable, using public fallback', err.message || err);
    return computeTrainMotdFromPublicApi();
  }
};

const listDockerProjects = (rootDir = '/home/fridge/docker') => {
  try {
    return fs
      .readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error('Unable to list docker projects', err);
    return [];
  }
};

const parseDockerStatusMap = (raw) => {
  const map = new Map();
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const sep = line.indexOf('|');
    if (sep === -1) continue;
    const name = line.slice(0, sep);
    const status = line.slice(sep + 1);
    map.set(name, status);
  }
  return map;
};

const isRunningStatus = (status) => /^Up\b/.test(status);

const getManagedServiceStates = async () => {
  try {
    const { stdout } = await runCommand('docker', ['ps', '-a', '--format', '{{.Names}}|{{.Status}}']);
    const statusMap = parseDockerStatusMap(stdout);

    return MANAGED_SERVICES.map((service) => {
      const primaryNames = Array.isArray(service.containers) ? service.containers : [];
      const candidateNames = getServiceContainerCandidates(service);
      const presentNames = candidateNames.filter((name) => statusMap.has(name));
      const namesToShow = presentNames.length > 0 ? presentNames : primaryNames;

      const statuses = namesToShow
        .map((containerName) => ({
          containerName,
          status: statusMap.get(containerName) || null
        }));

      const present = statuses.filter((entry) => entry.status !== null);
      const running = present.filter((entry) => isRunningStatus(entry.status));

      let state = 'missing';
      if (present.length === 0) {
        state = 'missing';
      } else if (running.length === present.length) {
        state = 'running';
      } else if (running.length > 0) {
        state = 'partial';
      } else {
        state = 'stopped';
      }

      const detail = statuses
        .map((entry) => `${entry.containerName}: ${entry.status || 'not-created'}`)
        .join(' | ');

      return {
        service,
        state,
        detail
      };
    });
  } catch (err) {
    console.error('Unable to inspect docker services', err);
    return MANAGED_SERVICES.map((service) => ({
      service,
      state: 'error',
      detail: 'Docker status unavailable'
    }));
  }
};

const containerExists = async (containerName) => {
  const { stdout } = await runCommand('docker', ['ps', '-a', '--filter', `name=^/${containerName}$`, '--format', '{{.Names}}']);
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean).includes(containerName);
};

const containerRunning = async (containerName) => {
  const { stdout } = await runCommand('docker', ['ps', '--filter', `name=^/${containerName}$`, '--format', '{{.Names}}']);
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean).includes(containerName);
};

const runServiceAction = async (service, action) => {
  if (!service) {
    throw new Error('Unknown service');
  }

  if (!['start', 'stop', 'restart'].includes(action)) {
    throw new Error('Unsupported action');
  }

  if (service.type === 'compose') {
    const candidates = getServiceContainerCandidates(service);
    const existing = [];
    for (const name of candidates) {
      // eslint-disable-next-line no-await-in-loop
      if (await containerExists(name)) {
        existing.push(name);
      }
    }

    if (existing.length === 0) {
      if (action === 'stop') {
        return;
      }
      await runCommand('docker', ['compose', '-f', service.composeFile, 'up', '-d', '--remove-orphans']);
      return;
    }

    if (action === 'start') {
      for (const name of existing) {
        // eslint-disable-next-line no-await-in-loop
        if (!(await containerRunning(name))) {
          // eslint-disable-next-line no-await-in-loop
          await runCommand('docker', ['start', name]);
        }
      }
      return;
    }

    if (action === 'stop') {
      for (const name of existing) {
        // eslint-disable-next-line no-await-in-loop
        if (await containerRunning(name)) {
          // eslint-disable-next-line no-await-in-loop
          await runCommand('docker', ['stop', name]);
        }
      }
      return;
    }

    for (const name of existing) {
      // eslint-disable-next-line no-await-in-loop
      if (await containerRunning(name)) {
        // eslint-disable-next-line no-await-in-loop
        await runCommand('docker', ['restart', name]);
      } else {
        // eslint-disable-next-line no-await-in-loop
        await runCommand('docker', ['start', name]);
      }
    }
    return;
  }

  if (service.type === 'container') {
    const name = service.containerName;
    const exists = await containerExists(name);
    const running = await containerRunning(name);

    if (action === 'start') {
      if (running) return;
      if (exists) {
        await runCommand('docker', ['start', name]);
        return;
      }
      if (service.startScript) {
        await runCommand(service.startScript, service.startArgs || []);
        return;
      }
      throw new Error(`Container ${name} does not exist yet`);
    }

    if (action === 'stop') {
      if (!running) return;
      await runCommand('docker', ['stop', name]);
      return;
    }

    if (running) {
      await runCommand('docker', ['restart', name]);
      return;
    }

    if (exists) {
      await runCommand('docker', ['start', name]);
      return;
    }

    if (service.startScript) {
      await runCommand(service.startScript, service.startArgs || []);
      return;
    }

    throw new Error(`Container ${name} does not exist yet`);
  }

  throw new Error('Unsupported service type');
};

const stateLabel = (state) => {
  if (state === 'running') return 'Running';
  if (state === 'stopped') return 'Stopped';
  if (state === 'partial') return 'Partially running';
  if (state === 'missing') return 'Not created';
  return 'Status unknown';
};

const getServiceContainerCandidates = (service) => {
  const names = Array.isArray(service.containers) ? service.containers : [];
  const set = new Set();
  for (const name of names) {
    if (!name) continue;
    set.add(name);
    set.add(name.replace(/_/g, '-'));
    set.add(name.replace(/-/g, '_'));
  }
  return Array.from(set).filter(Boolean);
};

const managedServiceCard = (state) => {
  const service = state.service;
  const openHref = formatLink(service.openUrl, { defaultScheme: inferDefaultScheme(service.openUrl) || 'https' });
  const hasOpen = Boolean(openHref);
  const icon = iconFor(openHref || service.location || service.name);
  const domainLabel = (openHref || service.name).replace(/^https?:\/\//, '');

  return `
    <article class="bookmark-card service-card managed-card ${state.state} ${hasOpen ? 'link-card' : ''}" data-item-id="service:${escapeHtml(service.id)}" data-item-group="services" ${hasOpen ? `data-href="${openHref}" role="link"` : 'role="group"'} tabindex="0" aria-label="${escapeHtml(service.name)} controls">
      <div class="bookmark-content">
        <header>
          <img src="${icon.primary}" data-primary="${icon.primary}" data-secondary="${icon.secondary}" data-tertiary="${icon.tertiary}" data-fallback="${icon.fallback}" data-domain="${escapeHtml(domainLabel.toLowerCase())}" data-pageurl="${escapeHtml(openHref)}" alt="${escapeHtml(service.name)} icon" loading="lazy" width="48" height="48" onerror="this.onerror=null; this.src=this.dataset.fallback;" />
          <span class="icon-emoji" aria-hidden="true">${emojiForName(service.name)}</span>
          <div class="bookmark-meta">
            <p class="bookmark-name">${escapeHtml(service.name)}</p>
            <p class="bookmark-url">${escapeHtml(service.description)}</p>
            <p class="service-location">${escapeHtml(service.location)}</p>
            <p class="service-state service-${state.state}">${escapeHtml(stateLabel(state.state))}</p>
            <p class="service-detail">${escapeHtml(state.detail)}</p>
          </div>
        </header>
        <form method="POST" action="/service-action" class="service-actions admin-control" data-no-card-nav>
          <input type="hidden" name="id" value="${escapeHtml(service.id)}">
          <button type="submit" name="action" value="start" aria-label="Start service">▶️</button>
          <button type="submit" name="action" value="stop" aria-label="Stop service">⏹️</button>
          <button type="submit" name="action" value="restart" aria-label="Restart service">🔁</button>
        </form>
        ${hasOpen ? '' : '<p class="no-open-link">No web endpoint</p>'}
      </div>
    </article>
  `;
};

const curatedCard = (entry) => {
  const href = formatLink(entry.link, { defaultScheme: inferDefaultScheme(entry.link) || 'https' });
  const icon = iconFor(href);
  const domainLabel = href.replace(/^https?:\/\//, '');
  return `
    <article class="bookmark-card service-card link-card" data-item-id="curated:${escapeHtml(String(entry.name).toLowerCase())}" data-item-group="links" data-href="${href}" tabindex="0" role="link" aria-label="${escapeHtml(entry.name)}">
      <div class="bookmark-content">
        <header>
          <img src="${icon.primary}" data-primary="${icon.primary}" data-secondary="${icon.secondary}" data-tertiary="${icon.tertiary}" data-fallback="${icon.fallback}" data-domain="${escapeHtml(domainLabel.toLowerCase())}" data-pageurl="${escapeHtml(href)}" alt="${escapeHtml(entry.name)} icon" loading="lazy" width="48" height="48" onerror="this.onerror=null; this.src=this.dataset.fallback;" />
          <span class="icon-emoji" aria-hidden="true">${emojiForName(entry.name)}</span>
          <div class="bookmark-meta">
            <p class="bookmark-name">${escapeHtml(entry.name)}</p>
            <p class="bookmark-url">${escapeHtml(entry.description)}</p>
          </div>
        </header>
      </div>
    </article>
  `;
};

const renderHtml = (links, managedStates, serviceMessage, dockerProjects, injectOverlayScript) => {
  const userCards = links.map((entry, index) => {
    const shortcut = getShortcutForEntry(entry);
    const destinationRaw = getDestinationForEntry(entry);
    const destination = formatLink(destinationRaw, { defaultScheme: inferDefaultScheme(destinationRaw) || 'https' });
    const hrefRaw = shortcut ? `/${encodeURIComponent(shortcut)}` : destination;
    const href = wrapKnownAppUrl(hrefRaw);
    const icon = iconFor(destination);
    const domainLabel = destination.replace(/^https?:\/\//, '');
    const allowUp = index > 0;
    const allowDown = index < links.length - 1;
    return `
      <article class="bookmark-card link-card" data-item-id="link:${escapeHtml(String(entry.name).toLowerCase())}" data-item-group="links" data-href="${href}" tabindex="0" role="link" aria-label="${escapeHtml(entry.name)}">
        <div class="bookmark-content">
          <header>
            <img src="${icon.primary}" data-primary="${icon.primary}" data-secondary="${icon.secondary}" data-tertiary="${icon.tertiary}" data-fallback="${icon.fallback}" data-domain="${escapeHtml(domainLabel.toLowerCase())}" data-pageurl="${escapeHtml(destination)}" alt="${escapeHtml(entry.name)} icon" loading="lazy" width="48" height="48" onerror="this.onerror=null; this.src=this.dataset.fallback;" />
            <span class="icon-emoji" aria-hidden="true">${emojiForName(entry.name)}</span>
            <div class="bookmark-meta">
              <p class="bookmark-name">${escapeHtml(entry.name)}</p>
              <p class="bookmark-url">${escapeHtml(domainLabel)}</p>
            </div>
            <div class="bookmark-actions admin-control">
              <form method="POST" action="/move-link">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <input type="hidden" name="direction" value="up">
                <button type="submit" ${allowUp ? '' : 'disabled'} aria-label="Move ${escapeHtml(entry.name)} up">⬆️</button>
              </form>
              <form method="POST" action="/move-link">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <input type="hidden" name="direction" value="down">
                <button type="submit" ${allowDown ? '' : 'disabled'} aria-label="Move ${escapeHtml(entry.name)} down">⬇️</button>
              </form>
              <form method="POST" action="/delete-link" class="bookmark-delete">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <button title="Delete ${escapeHtml(entry.name)}" type="submit" aria-label="Delete ${escapeHtml(entry.name)}">🗑️</button>
              </form>
            </div>
          </header>
        </div>
      </article>
    `;
  });

  const infoCards = curatedLinks.map((entry) => curatedCard(entry));
  const serviceCards = [
    ...managedStates.map((state) => managedServiceCard(state)),
    ...EXTERNAL_SERVICE_CARDS.map((service) => `
      <article class="bookmark-card service-card external-service link-card" data-item-id="service:${escapeHtml(String(service.id).toLowerCase())}" data-item-group="services" data-href="${escapeHtml(formatLink(service.openUrl, { defaultScheme: 'http' }))}" tabindex="0" role="link" aria-label="${escapeHtml(service.name)}">
        <div class="bookmark-content">
          <header>
            <img src="${iconFor(service.openUrl).primary}" data-primary="${iconFor(service.openUrl).primary}" data-secondary="${iconFor(service.openUrl).secondary}" data-tertiary="${iconFor(service.openUrl).tertiary}" data-fallback="${iconFor(service.openUrl).fallback}" data-domain="${escapeHtml(String(service.openUrl).replace(/^https?:\/\//, '').toLowerCase())}" data-pageurl="${escapeHtml(formatLink(service.openUrl, { defaultScheme: 'http' }))}" alt="${escapeHtml(service.name)} icon" loading="lazy" width="48" height="48" onerror="this.onerror=null; this.src=this.dataset.fallback;" />
            <span class="icon-emoji" aria-hidden="true">${emojiForName(service.name)}</span>
            <div class="bookmark-meta">
              <p class="bookmark-name">${escapeHtml(service.name)}</p>
              <p class="bookmark-url">${escapeHtml(service.description)}</p>
              <p class="service-location">${escapeHtml(service.location)}</p>
              <p class="service-state service-running">Always on</p>
            </div>
          </header>
        </div>
      </article>
    `)
  ];
  const folderCards = dockerProjects.map((folder) => `
    <article class="bookmark-card folder-card link-card" data-item-id="folder:${escapeHtml(String(folder).toLowerCase())}" data-item-group="folders" data-href="${escapeHtml(`${HOMEPAGE_BASE_URL}/?go=notes&id=tech:docker_projects`)}" tabindex="0" role="link" aria-label="${escapeHtml(folder)} folder">
      <div class="bookmark-content">
        <header>
          <span class="icon-emoji" aria-hidden="true">📁</span>
          <div class="bookmark-meta">
            <p class="bookmark-name">📁 ${escapeHtml(folder)}</p>
            <p class="bookmark-url">docker project folder</p>
            <p class="service-location">/home/fridge/docker/${escapeHtml(folder)}</p>
          </div>
        </header>
      </div>
    </article>
  `);

  const addLinkCard = `
  <article class="bookmark-card add-card" data-item-id="system:add-link" data-item-group="links" tabindex="0" role="group" aria-label="Add quick link">
    <div class="bookmark-content">
      <h2>Add quick link</h2>
      <form method="POST" action="/add-link" class="add-form" data-no-card-nav>
        <label>
          <span>Name</span>
          <input type="text" name="name" placeholder="Site label" required>
        </label>
        <label>
          <span>URL</span>
          <input type="text" name="link" placeholder="example.com or https://" required>
        </label>
        <button type="submit" aria-label="Save link">💾</button>
      </form>
    </div>
  </article>
  `;

  const today = moment().format('ddd, MMM D');
  const msg = `Today is ${today}.`;
  const heroCard = `
    <article class="bookmark-card hero hero-card" data-item-id="pinned:hero" data-item-group="pinned" data-pinned="1" role="region" aria-label="Homepage header">
      <div class="bookmark-content">
        <h1><span id="greeting-name">CHARLIE</span></h1>
        <p class="subtitle">${msg}</p>
        <p class="subtitle">Links, tools, and query redirects for local services.</p>
        ${serviceMessage ? `<p class="service-message">${escapeHtml(serviceMessage)}</p>` : ''}
      </div>
    </article>
  `;
  const fridgeHomeCard = `
    <article class="bookmark-card service-card link-card" data-item-id="pinned:fridge-home" data-item-group="pinned" data-pinned="1" data-href="${HOMEPAGE_BASE_URL}/" tabindex="0" role="link" aria-label="fridge.local home">
      <div class="bookmark-content">
        <header>
          <span class="icon-emoji" style="display:inline-flex;" aria-hidden="true">🏠</span>
          <div class="bookmark-meta">
            <p class="bookmark-name">fridge.local</p>
            <p class="bookmark-url">open homepage root</p>
          </div>
        </header>
      </div>
    </article>
  `;
  const settingsCard = `
    <article class="bookmark-card service-card link-card" data-item-id="pinned:settings" data-item-group="pinned" data-pinned="1" data-href="/settings" tabindex="0" role="link" aria-label="Open settings">
      <div class="bookmark-content">
        <header>
          <span class="icon-emoji" style="display:inline-flex;" aria-hidden="true">⚙️</span>
          <div class="bookmark-meta">
            <p class="bookmark-name">Settings</p>
            <p class="bookmark-url">profile + hostname manager</p>
          </div>
        </header>
      </div>
    </article>
  `;
  const motdCard = `
    <article class="bookmark-card motd-card link-card" data-item-id="system:motd" data-item-group="pinned" id="trainMOTD" data-href="/?go=trains" tabindex="0" role="link" aria-label="Train MOTD">
      <div class="bookmark-content">
        <header>
          <div class="bookmark-meta">
            <p class="bookmark-name"><span class="train-pill">🚆 mbta</span> <span class="train-title">loading train timing...</span></p>
            <p class="train-leave">tap to open tracker</p>
          </div>
        </header>
      </div>
    </article>
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>fridge homepage</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0f172a">
        <link rel="stylesheet" href="d.css">
        ${injectOverlayScript ? '<script defer src="/_fridge/home-overlay.js"></script>' : ''}
      </head>
      <body>
        <button id="pageControlsToggle" class="page-controls-toggle" type="button" aria-label="Toggle controls" title="Toggle controls">⚙️</button>
        <main class="page">
          <section class="stack-layout">
            <section class="bookmark-grid">
              <section class="card-block" data-block-id="pinned">
                <article class="bookmark-card block-title-card" data-item-id="block:pinned" data-pinned="1" role="region" aria-label="Pinned section">
                  <div class="bookmark-content">
                    <p class="bookmark-name">Pinned</p>
                    <p class="bookmark-url">header, home, settings, motd</p>
                  </div>
                </article>
                ${heroCard}
                ${fridgeHomeCard}
                ${settingsCard}
                ${motdCard}
              </section>
              <section class="card-block" data-block-id="links">
                <article class="bookmark-card block-title-card" data-item-id="block:links" data-pinned="1" role="region" aria-label="Links section">
                  <div class="bookmark-content">
                    <p class="bookmark-name">Links</p>
                    <p class="bookmark-url">ordered by click frequency</p>
                  </div>
                </article>
                ${addLinkCard}
                ${userCards.join('')}
                ${infoCards.join('')}
              </section>
              <section class="card-block" data-block-id="services">
                <article class="bookmark-card block-title-card" data-item-id="block:services" data-pinned="1" role="region" aria-label="Services section">
                  <div class="bookmark-content">
                    <p class="bookmark-name">Fridge Services</p>
                    <p class="bookmark-url">project and service links</p>
                  </div>
                </article>
                ${serviceCards.join('')}
              </section>
              <section class="card-block" data-block-id="folders">
                <article class="bookmark-card block-title-card" data-item-id="block:folders" data-pinned="1" role="region" aria-label="Folders section">
                  <div class="bookmark-content">
                    <p class="bookmark-name">Project Folders</p>
                    <p class="bookmark-url">docker workspace directories</p>
                  </div>
                </article>
                ${folderCards.join('')}
              </section>
            </section>
          </section>
      </main>
      <script>
        (function() {
          const PROFILE_KEY = 'nodehome-profile-v1';
          const LINKS_BACKUP_KEY = 'nodehome-links-backup-v1';
          const ICON_CACHE_KEY = 'nodehome-icon-cache-v1';
          const ICON_TTL_MS = 14 * 24 * 60 * 60 * 1000;
          const allLinks = ${JSON.stringify(links)};

          try {
            localStorage.setItem(LINKS_BACKUP_KEY, JSON.stringify({
              savedAt: Date.now(),
              links: allLinks
            }));
          } catch {}

          const greetingEl = document.getElementById('greeting-name');
          const controlsToggle = document.getElementById('pageControlsToggle');
          const rankToggleBtn = document.createElement('button');
          rankToggleBtn.id = 'showHiddenToggle';
          rankToggleBtn.className = 'page-controls-toggle';
          rankToggleBtn.style.right = '46px';
          rankToggleBtn.title = 'Show hidden items';
          rankToggleBtn.setAttribute('aria-label', 'Show hidden items');
          rankToggleBtn.textContent = '👁️';
          document.body.appendChild(rankToggleBtn);
          const safeName = (raw) => String(raw || '').trim().replace(/[^\\w\\s-]/g, '').slice(0, 24);
          const readProfile = () => {
            try {
              const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
              return {
                name: safeName(profile.name),
                updatedAt: Number(profile.updatedAt) || 0
              };
            } catch {
              return { name: '', updatedAt: 0 };
            }
          };
          const writeProfile = (next) => {
            try {
              localStorage.setItem(PROFILE_KEY, JSON.stringify({
                name: safeName(next.name),
                updatedAt: Date.now()
              }));
            } catch {}
          };
          const applyName = (name) => {
            greetingEl.textContent = name || 'YOU';
          };
          const profile = readProfile();
          applyName(profile.name);
          const CLICK_RANK_KEY = 'nodehome-click-rank-v1';
          const HIDDEN_ITEMS_KEY = 'nodehome-hidden-items-v1';
          const SHOW_HIDDEN_KEY = 'nodehome-show-hidden-v1';
          const BLOCK_ORDER_KEY = 'nodehome-block-order-v1';
          const HISTORY_KEY = 'nodehome-history-v1';
          const readObj = (key) => {
            try {
              const value = JSON.parse(localStorage.getItem(key) || '{}');
              return value && typeof value === 'object' ? value : {};
            } catch {
              return {};
            }
          };
          const writeObj = (key, obj) => {
            try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
          };
          const rankMap = readObj(CLICK_RANK_KEY);
          const hiddenMap = readObj(HIDDEN_ITEMS_KEY);
          const historyList = (() => {
            try {
              const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
              return Array.isArray(raw) ? raw : [];
            } catch {
              return [];
            }
          })();
          let blockOrder = (() => {
            try {
              const raw = JSON.parse(localStorage.getItem(BLOCK_ORDER_KEY) || '[]');
              return Array.isArray(raw) ? raw : [];
            } catch {
              return [];
            }
          })();
          let showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === '1';
          const cardListRoot = document.querySelector('.bookmark-grid');
          const blocks = () => Array.from(document.querySelectorAll('.bookmark-grid .card-block[data-block-id]'));
          const cards = () => Array.from(document.querySelectorAll('.bookmark-grid .bookmark-card[data-item-id]'));
          const cardsInBlock = (blockId) => {
            const block = cardListRoot ? cardListRoot.querySelector('.card-block[data-block-id="' + CSS.escape(blockId) + '"]') : null;
            return block ? Array.from(block.querySelectorAll('.bookmark-card[data-item-id]')) : [];
          };
          const isPinned = (card) => card.dataset.pinned === '1';
          const itemId = (card) => String(card.dataset.itemId || '').trim();
          const applyHiddenState = () => {
            cards().forEach((card) => {
              const id = itemId(card);
              const hidden = Boolean(hiddenMap[id]) && !isPinned(card);
              card.classList.toggle('is-hidden-item', hidden && !showHidden);
              card.classList.toggle('is-shown-hidden', hidden && showHidden);
            });
          };
          const applyOrder = () => {
            if (!cardListRoot) return;
            const availableBlocks = blocks().map((b) => b.dataset.blockId).filter(Boolean);
            if (!Array.isArray(blockOrder) || blockOrder.length === 0) blockOrder = availableBlocks.slice();
            for (const key of availableBlocks) if (!blockOrder.includes(key)) blockOrder.push(key);
            blockOrder = blockOrder.filter((key, idx, arr) => availableBlocks.includes(key) && arr.indexOf(key) === idx);
            localStorage.setItem(BLOCK_ORDER_KEY, JSON.stringify(blockOrder));
            blockOrder.forEach((key) => {
              const el = cardListRoot.querySelector('.card-block[data-block-id="' + CSS.escape(key) + '"]');
              if (el) cardListRoot.appendChild(el);
            });
            const linkCards = cardsInBlock('links').filter((card) => !isPinned(card) && itemId(card) !== 'system:add-link');
            const withIndex = linkCards.map((card, idx) => ({ card, idx }));
            withIndex.sort((a, b) => {
              const sa = Number(rankMap[itemId(a.card)] || 0);
              const sb = Number(rankMap[itemId(b.card)] || 0);
              if (sb !== sa) return sb - sa;
              return a.idx - b.idx;
            });
            const linksBlock = cardListRoot.querySelector('.card-block[data-block-id="links"]');
            if (linksBlock) {
              withIndex.forEach((entry) => linksBlock.appendChild(entry.card));
            }
            applyHiddenState();
          };
          const installBlockMoveButtons = () => {
            blocks().forEach((block) => {
              const titleCard = block.querySelector('.block-title-card');
              if (!titleCard || titleCard.querySelector('.block-move-controls')) return;
              const id = String(block.dataset.blockId || '').trim();
              if (!id) return;
              const controls = document.createElement('div');
              controls.className = 'block-move-controls admin-control';
              const up = document.createElement('button');
              const down = document.createElement('button');
              up.type = 'button'; down.type = 'button';
              up.textContent = '⬆️'; down.textContent = '⬇️';
              up.title = 'Move block up'; down.title = 'Move block down';
              up.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const idx = blockOrder.indexOf(id);
                if (idx <= 0) return;
                const tmp = blockOrder[idx - 1]; blockOrder[idx - 1] = blockOrder[idx]; blockOrder[idx] = tmp;
                applyOrder();
              });
              down.addEventListener('click', (e) => {
                e.preventDefault(); e.stopPropagation();
                const idx = blockOrder.indexOf(id);
                if (idx === -1 || idx >= blockOrder.length - 1) return;
                const tmp = blockOrder[idx + 1]; blockOrder[idx + 1] = blockOrder[idx]; blockOrder[idx] = tmp;
                applyOrder();
              });
              controls.appendChild(up);
              controls.appendChild(down);
              const content = titleCard.querySelector('.bookmark-content');
              (content || titleCard).appendChild(controls);
            });
          };
          const installHideButtons = () => {
            cards().forEach((card) => {
              if (isPinned(card) || card.querySelector('.hide-item-btn')) return;
              const controlWrap = document.createElement('div');
              controlWrap.className = 'card-hide-control admin-control';
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'hide-item-btn';
              btn.textContent = '🙈';
              btn.title = 'Hide this item';
              btn.setAttribute('aria-label', 'Hide this item');
              btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const id = itemId(card);
                if (!id) return;
                hiddenMap[id] = 1;
                writeObj(HIDDEN_ITEMS_KEY, hiddenMap);
                applyHiddenState();
              });
              controlWrap.appendChild(btn);
              card.appendChild(controlWrap);
            });
          };
          const bumpRank = (id) => {
            if (!id || id.startsWith('pinned:')) return;
            rankMap[id] = Number(rankMap[id] || 0) + 1;
            writeObj(CLICK_RANK_KEY, rankMap);
          };
          const pushHistory = (card) => {
            const id = itemId(card);
            const href = String(card?.dataset?.href || '').trim();
            if (!id || !href) return;
            historyList.push({ id, href, ts: Date.now() });
            while (historyList.length > 200) historyList.shift();
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(historyList)); } catch {}
          };
          rankToggleBtn.addEventListener('click', () => {
            showHidden = !showHidden;
            localStorage.setItem(SHOW_HIDDEN_KEY, showHidden ? '1' : '0');
            rankToggleBtn.textContent = showHidden ? '🙈' : '👁️';
            rankToggleBtn.title = showHidden ? 'Hide hidden items' : 'Show hidden items';
            applyHiddenState();
          });
          if (showHidden) {
            rankToggleBtn.textContent = '🙈';
            rankToggleBtn.title = 'Hide hidden items';
          }
          installHideButtons();
          installBlockMoveButtons();
          applyOrder();
          const CONTROL_MODE_KEY = 'nodehome-controls-visible-v1';
          const setControlsVisible = (visible) => {
            if (visible) document.body.classList.remove('controls-hidden');
            else document.body.classList.add('controls-hidden');
            try {
              localStorage.setItem(CONTROL_MODE_KEY, visible ? '1' : '0');
            } catch {}
          };
          const controlsVisible = (() => {
            try {
              return localStorage.getItem(CONTROL_MODE_KEY) === '1';
            } catch {
              return false;
            }
          })();
          setControlsVisible(controlsVisible);
          if (controlsToggle) {
            controlsToggle.addEventListener('click', () => {
              setControlsVisible(document.body.classList.contains('controls-hidden'));
            });
          }

          const iconCache = (() => {
            try {
              return JSON.parse(localStorage.getItem(ICON_CACHE_KEY) || '{}');
            } catch {
              return {};
            }
          })();
          const persistIconCache = () => {
            try {
              localStorage.setItem(ICON_CACHE_KEY, JSON.stringify(iconCache));
            } catch {}
          };
          const proxy = (url) => '/api/icon-proxy?url=' + encodeURIComponent(url);
          const averageColor = (img) => {
            const c = document.createElement('canvas');
            c.width = 24; c.height = 24;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            if (!ctx) return '';
            ctx.drawImage(img, 0, 0, 24, 24);
            const data = ctx.getImageData(0, 0, 24, 24).data;
            let r = 0, g = 0, b = 0, n = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i + 3] < 20) continue;
              r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
            }
            if (!n) return '';
            return 'rgb(' + Math.round(r / n) + ', ' + Math.round(g / n) + ', ' + Math.round(b / n) + ')';
          };
          const loadIcon = (img) => {
            const card = img.closest('.bookmark-card');
            const emoji = card ? card.querySelector('.icon-emoji') : null;
            const key = (img.dataset.domain || '').toLowerCase();
            const pageUrl = img.dataset.pageurl || '';
            const cached = iconCache[key];
            const fresh = cached && (Date.now() - cached.updatedAt) < ICON_TTL_MS;
            if (fresh && cached.dataUrl) {
              img.src = cached.dataUrl;
              if (cached.color && card) card.style.setProperty('--icon-accent', cached.color);
              return;
            }
            const primary = img.dataset.primary;
            const secondary = img.dataset.secondary;
            const tertiary = img.dataset.tertiary;
            const fallback = img.dataset.fallback;
            const baseChain = [primary, secondary, tertiary, fallback].filter(Boolean);
            const runChain = (urls) => {
              const chain = urls.map(proxy);
              let idx = 0;
              const next = () => {
                if (idx >= chain.length) {
                  img.style.display = 'none';
                  if (emoji) emoji.style.display = 'inline-flex';
                  return;
                }
                img.src = chain[idx++];
              };
              img.onerror = next;
              next();
            };
            img.crossOrigin = 'anonymous';
            img.onload = () => {
              img.style.display = 'block';
              if (emoji) emoji.style.display = 'none';
              const color = averageColor(img);
              if (color && card) card.style.setProperty('--icon-accent', color);
              try {
                const c = document.createElement('canvas');
                c.width = 48; c.height = 48;
                const ctx = c.getContext('2d');
                if (ctx) {
                  ctx.drawImage(img, 0, 0, 48, 48);
                  iconCache[key] = {
                    dataUrl: c.toDataURL('image/png'),
                    color,
                    updatedAt: Date.now()
                  };
                  persistIconCache();
                }
              } catch {}
            };
            if (pageUrl) {
              fetch('/api/icon-discover?url=' + encodeURIComponent(pageUrl))
                .then((r) => r.ok ? r.json() : Promise.resolve({ iconUrl: '' }))
                .then((data) => {
                  const discovered = String((data && data.iconUrl) || '').trim();
                  const chain = discovered ? [discovered, ...baseChain] : baseChain;
                  runChain(chain);
                })
                .catch(() => runChain(baseChain));
            } else {
              runChain(baseChain);
            }
          };

          const activateCard = (card) => {
            const href = card.dataset.href;
            if (!href) return;
            bumpRank(itemId(card));
            pushHistory(card);
            window.location.assign(href);
          };

          const sound = (() => {
            const urls = {
              hover: ['/api/sfx/hover1', '/api/sfx/hover2'],
              click: '/api/sfx/select'
            };
            let ctx = null;
            let unlocked = false;
            const buffers = new Map();
            let hoverSource = null;
            let clickSource = null;
            let lastHoverAt = 0;
            const HOVER_MIN_MS = 90;

            const ensureCtx = () => {
              if (!ctx) {
                const Ctx = window.AudioContext || window.webkitAudioContext;
                if (!Ctx) return null;
                ctx = new Ctx({ latencyHint: 'interactive' });
              }
              return ctx;
            };

            const decode = async (url) => {
              if (buffers.has(url)) return buffers.get(url);
              const audioCtx = ensureCtx();
              if (!audioCtx) return null;
              try {
                const response = await fetch(url, { cache: 'force-cache' });
                if (!response.ok) return null;
                const arrayBuffer = await response.arrayBuffer();
                const buffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
                buffers.set(url, buffer);
                return buffer;
              } catch {
                return null;
              }
            };

            const init = async () => {
              const audioCtx = ensureCtx();
              if (!audioCtx) return;
              if (audioCtx.state === 'suspended') {
                try { await audioCtx.resume(); } catch {}
              }
              if (!unlocked) {
                unlocked = true;
                decode(urls.click);
                decode(urls.hover[0]);
                decode(urls.hover[1]);
              }
            };

            const playBuffer = async (url, type) => {
              const audioCtx = ensureCtx();
              if (!audioCtx || audioCtx.state !== 'running') return;
              const buffer = await decode(url);
              if (!buffer) return;
              const src = audioCtx.createBufferSource();
              src.buffer = buffer;
              const gain = audioCtx.createGain();
              gain.gain.value = type === 'click' ? 0.38 : 0.26;
              src.connect(gain);
              gain.connect(audioCtx.destination);
              if (type === 'hover' && hoverSource) {
                try { hoverSource.stop(); } catch {}
              }
              if (type === 'click' && clickSource) {
                try { clickSource.stop(); } catch {}
              }
              if (type === 'hover') hoverSource = src;
              if (type === 'click') clickSource = src;
              src.start(0);
              src.onended = () => {
                if (type === 'hover' && hoverSource === src) hoverSource = null;
                if (type === 'click' && clickSource === src) clickSource = null;
              };
            };

            const playHover = async () => {
              if (!unlocked) return;
              const now = Date.now();
              if ((now - lastHoverAt) < HOVER_MIN_MS) return;
              lastHoverAt = now;
              const pick = urls.hover[Math.random() < 0.5 ? 0 : 1];
              playBuffer(pick, 'hover');
            };

            const playClick = async () => {
              if (!unlocked) return;
              playBuffer(urls.click, 'click');
            };

            return { init, playHover, playClick };
          })();

          const unlockSound = () => {
            sound.init();
            window.removeEventListener('pointerdown', unlockSound, true);
            window.removeEventListener('keydown', unlockSound, true);
          };
          window.addEventListener('pointerdown', unlockSound, true);
          window.addEventListener('keydown', unlockSound, true);

          document.querySelectorAll('.bookmark-card').forEach((card) => {
            card.addEventListener('pointerenter', () => {
              if (!card.dataset.href) return;
              sound.playHover();
            });
            card.addEventListener('click', (event) => {
              if (event.target.closest('form') || event.target.closest('button') || event.target.closest('[data-no-card-nav]')) {
                return;
              }
              if (!card.dataset.href) return;
              event.preventDefault();
              sound.playClick();
              activateCard(card);
            });

            card.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                if (event.target.closest('form') || event.target.closest('button') || event.target.closest('[data-no-card-nav]')) {
                  return;
                }
                if (!card.dataset.href) return;
                event.preventDefault();
                sound.playClick();
                activateCard(card);
              }
            });
          });

          document.querySelectorAll('form.bookmark-delete').forEach((form) => {
            form.addEventListener('submit', async (event) => {
              event.preventDefault();
              const card = form.closest('.bookmark-card');
              const input = form.querySelector('input[name="name"]');
              const name = input ? String(input.value || '').trim().toLowerCase() : '';
              const id = card ? itemId(card) : '';
              const hideId = id || (name ? ('link:' + name) : '');
              if (!hideId) return;
              hiddenMap[hideId] = 1;
              writeObj(HIDDEN_ITEMS_KEY, hiddenMap);
              applyHiddenState();
            });
          });

          const hiddenNavUp = document.createElement('button');
          hiddenNavUp.className = 'page-controls-toggle';
          hiddenNavUp.style.right = '82px';
          hiddenNavUp.title = 'Previous hidden';
          hiddenNavUp.textContent = '⬆️';
          const hiddenNavDown = document.createElement('button');
          hiddenNavDown.className = 'page-controls-toggle';
          hiddenNavDown.style.right = '118px';
          hiddenNavDown.title = 'Next hidden';
          hiddenNavDown.textContent = '⬇️';
          document.body.appendChild(hiddenNavUp);
          document.body.appendChild(hiddenNavDown);
          let hiddenNavIdx = 0;
          const hiddenCardsForNav = () => cards().filter((c) => Boolean(hiddenMap[itemId(c)]));
          const navHidden = (delta) => {
            const list = hiddenCardsForNav();
            if (!list.length) return;
            hiddenNavIdx = (hiddenNavIdx + delta + list.length) % list.length;
            const target = list[hiddenNavIdx];
            if (!showHidden) {
              showHidden = true;
              localStorage.setItem(SHOW_HIDDEN_KEY, '1');
              rankToggleBtn.textContent = '🙈';
              rankToggleBtn.title = 'Hide hidden items';
              applyHiddenState();
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
          };
          hiddenNavUp.addEventListener('click', () => navHidden(-1));
          hiddenNavDown.addEventListener('click', () => navHidden(1));

          const syncProfile = async () => {
            const name = safeName(readProfile().name || 'default');
            const payload = {
              displayName: safeName(readProfile().name || ''),
              linksRank: rankMap,
              hiddenItems: hiddenMap,
              blockOrder,
              history: historyList,
              linksSnapshot: allLinks
            };
            try {
              await fetch('/api/profiles/' + encodeURIComponent(name), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
              });
            } catch {}
          };

          const loadProfileState = async () => {
            const name = safeName(readProfile().name || 'default');
            try {
              const response = await fetch('/api/profiles/' + encodeURIComponent(name), { cache: 'no-store' });
              if (!response.ok) return;
              const data = await response.json();
              const state = data && data.state && typeof data.state === 'object' ? data.state : {};
              if (state.displayName) {
                writeProfile({ name: state.displayName });
                applyName(state.displayName);
              }
              Object.assign(rankMap, state.linksRank || {});
              Object.assign(hiddenMap, state.hiddenItems || {});
              if (Array.isArray(state.blockOrder)) blockOrder = state.blockOrder;
              if (Array.isArray(state.history)) {
                historyList.length = 0;
                state.history.slice(-200).forEach((entry) => historyList.push(entry));
              }
              localStorage.setItem(CLICK_RANK_KEY, JSON.stringify(rankMap));
              localStorage.setItem(HIDDEN_ITEMS_KEY, JSON.stringify(hiddenMap));
              localStorage.setItem(BLOCK_ORDER_KEY, JSON.stringify(blockOrder));
              localStorage.setItem(HISTORY_KEY, JSON.stringify(historyList));
              applyOrder();
            } catch {}
          };
          loadProfileState();
          window.addEventListener('beforeunload', () => { syncProfile(); });

          document.querySelectorAll('.bookmark-card img[data-primary]').forEach(loadIcon);

          const trainCard = document.getElementById('trainMOTD');
          if (trainCard) {
            fetch('/api/train-motd')
              .then((r) => r.ok ? r.json() : Promise.reject(new Error('bad train data')))
              .then((data) => {
                const title = trainCard.querySelector('.train-title');
                const leave = trainCard.querySelector('.train-leave');
                if (title) title.textContent = data.title || 'train info unavailable';
                if (leave) leave.textContent = data.leaveText || '';
                if (data.ctaUrl) trainCard.dataset.href = data.ctaUrl;
              })
              .catch(() => {
                const title = trainCard.querySelector('.train-title');
                const leave = trainCard.querySelector('.train-leave');
                if (title) title.textContent = 'loading tracker summary...';
                if (leave) leave.textContent = 'tap to open tracker';
              });
          }
        })();
      </script>
    </body>
  </html>
  `;
};

const renderSettingsHtml = (injectOverlayScript) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Hostname Settings</title>
      ${injectOverlayScript ? '<script defer src="/_fridge/home-overlay.js"></script>' : ''}
      <style>
        :root {
          color-scheme: light;
          --bg: #f8fafc;
          --panel: #ffffff;
          --border: #0f172a;
          --muted: #475569;
          --warn: #9a3412;
          --warn-bg: #ffedd5;
          --accent: #2563eb;
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 1rem;
          background: linear-gradient(180deg, #f8fafc, #e2e8f0);
          font-family: "Space Grotesk", system-ui, sans-serif;
          color: #0f172a;
        }
        .wrap {
          max-width: 860px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
        }
        .panel {
          background: var(--panel);
          border: 2px solid var(--border);
          box-shadow: 4px 4px 0 #000;
          padding: 1rem;
        }
        .topline {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .topline a {
          color: var(--accent);
          font-weight: 700;
          text-decoration: none;
        }
        form {
          display: grid;
          gap: 0.8rem;
        }
        .row {
          display: grid;
          gap: 0.8rem;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        label {
          display: grid;
          gap: 0.35rem;
          font-weight: 600;
        }
        input {
          width: 100%;
          padding: 0.65rem 0.75rem;
          border: 2px solid var(--border);
          font: inherit;
        }
        button {
          width: fit-content;
          border: 2px solid var(--border);
          background: #facc15;
          color: #0f172a;
          font-weight: 700;
          padding: 0.5rem 0.95rem;
          cursor: pointer;
        }
        button:hover { background: #eab308; }
        .message {
          min-height: 1.1rem;
          margin: 0;
          color: var(--muted);
          font-size: 0.95rem;
        }
        .list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 0.75rem;
        }
        .entry {
          border: 2px solid var(--border);
          padding: 0.75rem;
          display: grid;
          gap: 0.5rem;
          background: #f8fafc;
        }
        .entry-head {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: start;
        }
        .entry h3 {
          margin: 0;
          font-size: 1rem;
        }
        .meta {
          margin: 0;
          font-size: 0.9rem;
          color: var(--muted);
          word-break: break-all;
        }
        .warning {
          margin: 0;
          padding: 0.35rem 0.5rem;
          border: 1px solid var(--warn);
          color: var(--warn);
          background: var(--warn-bg);
          font-size: 0.82rem;
        }
        .delete-btn {
          border: 2px solid #7f1d1d;
          background: #fee2e2;
          color: #7f1d1d;
          width: 2rem;
          height: 2rem;
          line-height: 1;
          padding: 0;
          font-size: 1.05rem;
        }
        @media (max-width: 680px) {
          .row { grid-template-columns: 1fr; }
          body { padding: 0.75rem; }
        }
      </style>
    </head>
    <body>
      <main class="wrap">
        <section class="panel topline">
          <div>
            <h1 style="margin:0;">Service Hostname Manager</h1>
            <p style="margin:0.25rem 0 0;color:#475569;">Store fridge.local hostnames (the query redirect host) and optional fallback targets.</p>
          </div>
          <a href="/">Back to homepage</a>
        </section>

        <section class="panel">
          <h2 style="margin-top:0;">Profile</h2>
          <form id="profile-form">
            <label>
              Display Name
              <input id="profileName" name="profileName" maxlength="24" placeholder="type your name">
            </label>
            <button type="submit" aria-label="Save display name">Save name</button>
            <p id="profile-message" class="message"></p>
          </form>
        </section>

        <section class="panel">
          <form id="hostname-form">
            <div class="row">
              <label>
                Homepage URL
                <input id="homepageUrl" name="homepageUrl" required placeholder="fridge.local:8088" value="fridge.local:8088" maxlength="512">
              </label>
              <label>
                Service Hostname
                <input id="serviceHostname" name="serviceHostname" required placeholder="fridge.local" maxlength="255">
              </label>
            </div>
            <label>
              Fallback IP:Port (optional)
              <input id="fallbackTarget" name="fallbackTarget" placeholder="192.168.1.50:631" maxlength="255">
            </label>
            <button type="submit" aria-label="Save hostname">💾</button>
            <p id="message" class="message"></p>
          </form>
        </section>

        <section class="panel">
          <h2 style="margin-top:0;">Saved entries</h2>
          <ul id="hostname-list" class="list"></ul>
        </section>
      </main>

      <script>
        (function () {
          const PROFILE_KEY = 'nodehome-profile-v1';
          const form = document.getElementById('hostname-form');
          const profileForm = document.getElementById('profile-form');
          const profileNameInput = document.getElementById('profileName');
          const profileMessageEl = document.getElementById('profile-message');
          const homepageInput = document.getElementById('homepageUrl');
          const hostnameInput = document.getElementById('serviceHostname');
          const fallbackInput = document.getElementById('fallbackTarget');
          const messageEl = document.getElementById('message');
          const listEl = document.getElementById('hostname-list');
          const safeName = (raw) => String(raw || '').trim().replace(/[^\\w\\s-]/g, '').slice(0, 24);

          const escapeHtml = (value) => String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

          const setMessage = (text, isError) => {
            messageEl.textContent = text || '';
            messageEl.style.color = isError ? '#991b1b' : '#334155';
          };
          const setProfileMessage = (text, isError) => {
            if (!profileMessageEl) return;
            profileMessageEl.textContent = text || '';
            profileMessageEl.style.color = isError ? '#991b1b' : '#334155';
          };
          const readProfile = () => {
            try {
              const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
              return {
                name: safeName(profile.name)
              };
            } catch {
              return { name: '' };
            }
          };
          const writeProfile = (next) => {
            try {
              localStorage.setItem(PROFILE_KEY, JSON.stringify({
                name: safeName(next.name),
                updatedAt: Date.now()
              }));
              return true;
            } catch {
              return false;
            }
          };

          const renderEntries = (entries) => {
            if (!Array.isArray(entries) || entries.length === 0) {
              listEl.innerHTML = '<li class="entry"><p class="meta">No entries saved yet.</p></li>';
              return;
            }

            const items = entries.map((entry) => {
              const warningHtml = entry.warning
                ? '<p class="warning">' + escapeHtml(entry.warning) + '</p>'
                : '';
              const fallbackLine = entry.fallbackTarget
                ? '<p class="meta"><strong>Fallback:</strong> ' + escapeHtml(entry.fallbackTarget) + '</p>'
                : '';
              const activeLine = '<p class="meta"><strong>Active target:</strong> ' + escapeHtml(entry.effectiveTarget || entry.serviceHostname) + '</p>';

              return ''
                + '<li class="entry">'
                +   '<div class="entry-head">'
                +     '<div>'
                +       '<h3>' + escapeHtml(entry.serviceHostname) + '</h3>'
                +       '<p class="meta"><strong>Homepage:</strong> ' + escapeHtml(entry.homepageUrl) + '</p>'
                +       fallbackLine
                +       activeLine
                +     '</div>'
                +     '<button class="delete-btn" data-id="' + escapeHtml(entry.id) + '" title="Delete entry" aria-label="Delete entry">X</button>'
                +   '</div>'
                +   warningHtml
                + '</li>';
            });

            listEl.innerHTML = items.join('');
          };

          const loadEntries = async () => {
            try {
              const response = await fetch('/api/hostnames', { cache: 'no-store' });
              if (!response.ok) {
                throw new Error('Unable to load hostnames');
              }
              const data = await response.json();
              renderEntries(data);
            } catch (error) {
              setMessage(error.message || 'Unable to load hostnames', true);
            }
          };

          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            setMessage('Saving...', false);

            try {
              const response = await fetch('/api/hostnames', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  homepageUrl: homepageInput.value,
                  serviceHostname: hostnameInput.value,
                  fallbackTarget: fallbackInput.value
                })
              });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data.error || 'Save failed');
              }
              hostnameInput.value = '';
              fallbackInput.value = '';
              setMessage('Saved.', false);
              await loadEntries();
            } catch (error) {
              setMessage(error.message || 'Save failed', true);
            }
          });

          listEl.addEventListener('click', async (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) return;
            const id = target.getAttribute('data-id');
            if (!id) return;

            try {
              const response = await fetch('/api/hostnames/' + encodeURIComponent(id), { method: 'DELETE' });
              const data = await response.json();
              if (!response.ok) {
                throw new Error(data.error || 'Delete failed');
              }
              setMessage('Deleted.', false);
              await loadEntries();
            } catch (error) {
              setMessage(error.message || 'Delete failed', true);
            }
          });

          if (profileForm && profileNameInput) {
            const currentProfile = readProfile();
            profileNameInput.value = currentProfile.name || '';
            profileForm.addEventListener('submit', async (event) => {
              event.preventDefault();
              const nextName = safeName(profileNameInput.value);
              const ok = writeProfile({
                name: nextName
              });
              if (!ok || !nextName) {
                setProfileMessage(ok ? 'Enter a valid name.' : 'Save failed', true);
                return;
              }
              try {
                const response = await fetch('/api/profiles/' + encodeURIComponent(nextName), {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ displayName: nextName })
                });
                if (!response.ok) throw new Error('Profile sync failed');
                setProfileMessage('Saved.', false);
              } catch {
                setProfileMessage('Saved locally; server sync failed.', true);
              }
            });
          }

          loadEntries();
        })();
      </script>
    </body>
  </html>
`;

app.get('/', async (req, res) => {
  const redirect = resolveHomepageQueryRedirect(req.query || {});
  if (redirect.target) {
    return res.redirect(302, redirect.target);
  }

  const links = readLinks();
  const managedStates = await getManagedServiceStates();
  const dockerProjects = listDockerProjects();
  const serviceMessageRaw = typeof req.query.serviceMsg === 'string' ? req.query.serviceMsg : '';
  const serviceMessage = [serviceMessageRaw, redirect.error].filter(Boolean).join(' | ');
  res.send(renderHtml(links, managedStates, serviceMessage, dockerProjects, shouldInjectForHost(req)));
});

app.get('/settings', (req, res) => {
  res.send(renderSettingsHtml(shouldInjectForHost(req)));
});

app.get('/app/:key', (req, res) => {
  const key = String(req.params.key || '').trim().toLowerCase();
  const targetBase = APP_WRAPPER_TARGETS[key];
  if (!targetBase) return res.status(404).send('Unknown app');
  const forwardPath = normalizeLocalPath(req.query.path) || '/';
  const target = `${targetBase.replace(/\/+$/, '')}${forwardPath}`;
  const inject = shouldInjectForHost(req);
  const overlayScript = inject ? '<script defer src="/_fridge/home-overlay.js"></script>' : '';
  return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>fridge app: ${escapeHtml(key)}</title>
  ${overlayScript}
  <style>
    html, body { margin:0; padding:0; width:100%; height:100%; background:#0b0b0f; }
    iframe { width:100%; height:100%; border:0; display:block; background:#fff; }
  </style>
</head>
<body>
  <iframe src="${escapeHtml(target)}" referrerpolicy="no-referrer-when-downgrade" allow="clipboard-read; clipboard-write; fullscreen"></iframe>
</body>
</html>`);
});

app.get('/_fridge/home-icon.png', (req, res) => {
  if (!shouldInjectForHost(req)) return res.status(404).send('Not found');
  if (!fs.existsSync(FRIDGE_ICON_PATH)) return res.status(404).send('Icon not found');
  res.set('cache-control', 'public, max-age=86400');
  res.set('content-type', 'image/png');
  return res.sendFile(FRIDGE_ICON_PATH);
});

app.get('/_fridge/home-overlay.js', (req, res) => {
  if (!shouldInjectForHost(req)) return res.status(404).send('Not found');
  res.set('content-type', 'application/javascript; charset=utf-8');
  res.set('cache-control', 'public, max-age=3600');
  return res.send(`(() => {
  try {
    const host = String(window.location.hostname || '').toLowerCase();
    if (!(host === 'fridge.local' || host.endsWith('.fridge.local'))) return;
    if (document.getElementById('fridge-home-overlay')) return;
    const a = document.createElement('a');
    a.id = 'fridge-home-overlay';
    a.href = 'http://fridge.local/';
    a.setAttribute('aria-label', 'Back to fridge homepage');
    a.title = 'Back to fridge homepage';
    a.style.cssText = [
      'position:fixed','right:14px','bottom:14px','z-index:2147483647',
      'width:46px','height:46px','display:flex','align-items:center','justify-content:center',
      'border-radius:12px','background:rgba(0,0,0,0.18)','backdrop-filter:blur(2px)',
      'box-shadow:0 2px 8px rgba(0,0,0,.25)','opacity:.9','transition:transform .15s ease,opacity .15s ease'
    ].join(';');
    const img = document.createElement('img');
    img.src = '/_fridge/home-icon.png';
    img.alt = 'Home';
    img.style.cssText = [
      'width:36px','height:36px','display:block','object-fit:cover',
      'border:0','border-radius:10px','clip-path:inset(1px round 10px)',
      'mask-image:radial-gradient(circle at center, rgba(0,0,0,1) 84%, rgba(0,0,0,.65) 94%, rgba(0,0,0,0) 100%)'
    ].join(';');
    a.addEventListener('mouseenter', () => { a.style.opacity = '1'; a.style.transform = 'translateY(-1px) scale(1.03)'; });
    a.addEventListener('mouseleave', () => { a.style.opacity = '.9'; a.style.transform = 'none'; });
    a.appendChild(img);
    document.addEventListener('DOMContentLoaded', () => document.body.appendChild(a), { once: true });
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      document.body.appendChild(a);
    }
  } catch {}
})();`);
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION
  });
});

app.get('/api/icon-proxy', async (req, res) => {
  const parsed = parseUrlForProxy(req.query.url);
  if (!parsed) {
    return res.status(400).send('Invalid icon url');
  }

  const cached = readDiskIconCache(parsed.toString());
  if (cached) {
    res.set('content-type', cached.contentType);
    res.set('cache-control', 'public, max-age=1209600, immutable');
    return res.send(cached.payload);
  }

  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'node-home-icon-proxy/1.0' }
    });
    if (!response.ok) {
      return res.status(404).send('Icon not found');
    }
    const contentType = response.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return res.status(415).send('Not an image');
    }
    const arrayBuffer = await response.arrayBuffer();
    const payload = Buffer.from(arrayBuffer);
    writeDiskIconCache(parsed.toString(), contentType, payload);
    res.set('content-type', contentType);
    res.set('cache-control', 'public, max-age=1209600, immutable');
    return res.send(payload);
  } catch (err) {
    console.error('Icon proxy error', err);
    return res.status(500).send('Icon fetch failed');
  }
});

app.get('/api/sfx/:id', (req, res) => {
  const id = String(req.params.id || '').trim().toLowerCase();
  const filePath = SOUND_FILES[id];
  if (!filePath) return res.status(404).send('sound not found');
  try {
    if (!fs.existsSync(filePath)) return res.status(404).send('sound not found');
    res.set('content-type', 'audio/wav');
    res.set('cache-control', 'public, max-age=604800');
    return res.sendFile(filePath);
  } catch (err) {
    console.error('Unable to serve sound', err);
    return res.status(500).send('sound unavailable');
  }
});

app.get('/api/icon-discover', async (req, res) => {
  const pageUrl = String(req.query.url || '').trim();
  const parsed = parseUrlForProxy(pageUrl);
  if (!parsed) return res.json({ iconUrl: '' });
  try {
    const iconUrl = await resolvePageIconUrl(parsed.toString());
    return res.json({ iconUrl: iconUrl || '' });
  } catch (err) {
    console.error('Icon discovery error', err.message || err);
    return res.json({ iconUrl: '' });
  }
});

app.get('/api/train-motd', async (_req, res) => {
  try {
    const motd = await computeTrainMotd();
    return res.json(motd);
  } catch (err) {
    console.error('Train MOTD error', err);
    return res.status(200).json({
      title: 'train motd unavailable',
      leaveText: 'open tracker for details',
      ctaUrl: '/?go=trains',
      ctaLabel: 'open mbta tracker',
    });
  }
});

app.get('/api/hostnames', async (req, res) => {
  try {
    const entries = readHostnamesFromDisk();
    const resolved = await Promise.all(entries.map((entry) => enrichHostnameEntry(entry)));
    return res.json(resolved);
  } catch (err) {
    console.error('Error listing hostnames', err);
    return res.status(500).json({ error: 'Unable to read hostnames' });
  }
});

app.post('/api/hostnames', async (req, res) => {
  try {
    const payload = parseHostnamePayload(req.body || {});
    const entries = readHostnamesFromDisk();
    let index = -1;
    if (payload.id) {
      index = entries.findIndex((entry) => entry.id === payload.id);
    }
    if (index === -1) {
      index = entries.findIndex((entry) => entry.serviceHostname.toLowerCase() === payload.serviceHostname.toLowerCase());
    }

    const now = new Date().toISOString();
    let saved;
    if (index >= 0) {
      const existing = entries[index];
      saved = {
        ...existing,
        homepageUrl: payload.homepageUrl,
        serviceHostname: payload.serviceHostname,
        fallbackTarget: payload.fallbackTarget,
        updatedAt: now
      };
      entries[index] = saved;
    } else {
      if (entries.length >= MAX_ENTRIES) {
        throw badRequest(`Maximum of ${MAX_ENTRIES} entries reached`);
      }
      saved = {
        id: payload.id || crypto.randomUUID(),
        homepageUrl: payload.homepageUrl,
        serviceHostname: payload.serviceHostname,
        fallbackTarget: payload.fallbackTarget,
        createdAt: now,
        updatedAt: now
      };
      entries.push(saved);
    }

    await writeHostnamesToDisk(entries);
    const enriched = await enrichHostnameEntry(saved);
    return res.status(index >= 0 ? 200 : 201).json(enriched);
  } catch (err) {
    const code = err.status || 500;
    console.error('Error saving hostname entry', err);
    return res.status(code).json({ error: err.message || 'Unable to save entry' });
  }
});

app.delete('/api/hostnames/:id', async (req, res) => {
  try {
    const id = normalizeId(req.params.id);
    if (!id) {
      throw badRequest('Invalid id');
    }
    const entries = readHostnamesFromDisk();
    const filtered = entries.filter((entry) => entry.id !== id);
    if (filtered.length === entries.length) {
      return res.status(404).json({ error: 'Entry not found' });
    }
    await writeHostnamesToDisk(filtered);
    return res.json({ ok: true });
  } catch (err) {
    const code = err.status || 500;
    console.error('Error deleting hostname entry', err);
    return res.status(code).json({ error: err.message || 'Unable to delete entry' });
  }
});

app.get('/api/profiles/:name', (req, res) => {
  try {
    const name = normalizeProfileName(req.params.name);
    if (!name) return res.status(400).json({ error: 'Invalid profile name' });
    const profiles = readProfilesFromDisk();
    const state = profiles[name] && typeof profiles[name] === 'object' ? profiles[name] : {};
    return res.json({ name, state });
  } catch (err) {
    console.error('Error reading profile', err);
    return res.status(500).json({ error: 'Unable to read profile' });
  }
});

app.put('/api/profiles/:name', async (req, res) => {
  try {
    const name = normalizeProfileName(req.params.name);
    if (!name) return res.status(400).json({ error: 'Invalid profile name' });
    const profiles = readProfilesFromDisk();
    profiles[name] = sanitizeProfilePayload(req.body || {});
    profiles[name].updatedAt = new Date().toISOString();
    await writeProfilesToDisk(profiles);
    return res.json({ ok: true, name });
  } catch (err) {
    console.error('Error writing profile', err);
    return res.status(500).json({ error: 'Unable to write profile' });
  }
});

app.get('/:shortcut', (req, res) => {
  const requested = normalizeShortcut(req.params.shortcut);
  if (!requested) {
    return res.redirect('/');
  }

  const requestedLower = requested.toLowerCase();
  const links = readLinks();

  const match = links.find((entry) => {
    const shortcut = getShortcutForEntry(entry);
    return shortcut && shortcut.toLowerCase() === requestedLower;
  });

  if (!match) {
    return res.status(404).send('Unknown shortcut');
  }

  const destinationRaw = getDestinationForEntry(match);
  const destination = formatLink(destinationRaw, { defaultScheme: inferDefaultScheme(destinationRaw) || 'https' });
  if (!destination) {
    return res.status(500).send('Shortcut destination is empty');
  }

  return res.redirect(302, destination);
});

app.post('/service-action', async (req, res) => {
  try {
    const serviceId = String(req.body.id || '').trim();
    const action = String(req.body.action || '').trim();
    const service = SERVICE_BY_ID.get(serviceId);
    if (!service) {
      return res.redirect('/?serviceMsg=Unknown%20service');
    }

    await runServiceAction(service, action);
    return res.redirect(`/?serviceMsg=${encodeURIComponent(`${service.name}: ${action} complete`)}`);
  } catch (err) {
    console.error('Service action error', err);
    const message = err && err.message ? err.message : 'Service action failed';
    return res.redirect(`/?serviceMsg=${encodeURIComponent(message)}`);
  }
});

app.post('/add-link', (req, res) => {
  try {
    const { name, link } = req.body;
    if (!name || !link) {
      return res.status(400).send('Name and link are required');
    }
    const links = readLinks();
    const trimmedName = name.trim();
    const formattedLink = link.trim();
    const existingIndex = links.findIndex(
      (entry) => entry.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (existingIndex > -1) {
      links[existingIndex] = { ...links[existingIndex], name: links[existingIndex].name, link: formattedLink };
    } else {
      links.push({ name: trimmedName, link: formattedLink });
    }
    writeLinks(links);
    return res.redirect('/');
  } catch (err) {
    console.error('Error adding link', err);
    return res.status(500).send('Error adding link');
  }
});

app.post('/delete-link', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).send('Name is required');
    }
    const links = readLinks();
    const updated = links.filter((entry) => entry.name !== name);
    writeLinks(updated);
    appendDeletedSnapshot(updated);
    return res.redirect('/');
  } catch (err) {
    console.error('Error deleting link', err);
    return res.status(500).send('Error deleting link');
  }
});

app.delete('/api/links/:name', (req, res) => {
  try {
    const name = String(req.params.name || '').trim();
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const links = readLinks();
    const updated = links.filter((entry) => String(entry.name || '').toLowerCase() !== name.toLowerCase());
    if (updated.length === links.length) {
      return res.status(404).json({ error: 'Link not found' });
    }
    writeLinks(updated);
    appendDeletedSnapshot(links);
    return res.json({ ok: true, deleted: name });
  } catch (err) {
    console.error('Error deleting link via API', err);
    return res.status(500).json({ error: 'Error deleting link' });
  }
});

app.post('/move-link', (req, res) => {
  try {
    const { name, direction } = req.body;
    if (!name || !direction) {
      return res.status(400).send('Name and direction are required');
    }
    const links = readLinks();
    const index = links.findIndex((entry) => entry.name === name);
    if (index === -1) {
      return res.redirect('/');
    }
    const delta = direction === 'down' ? 1 : -1;
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= links.length) {
      return res.redirect('/');
    }
    const temp = links[index];
    links[index] = links[targetIndex];
    links[targetIndex] = temp;
    writeLinks(links);
    return res.redirect('/');
  } catch (err) {
    console.error('Error moving link', err);
    return res.status(500).send('Error moving link');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
