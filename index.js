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
const HOMEPAGE_BASE_URL = process.env.HOMEPAGE_BASE_URL || 'http://fridge.local';
const APP_VERSION = process.env.APP_VERSION || '1.1.0';
const PORT = Number(process.env.PORT) || 8088;
const MAX_FIELD_LENGTH = 255;
const MAX_HOMEPAGE_LENGTH = 512;
const MAX_ENTRIES = 500;

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

const QUERY_REDIRECT_TARGETS = Object.freeze({
  home: `${HOMEPAGE_BASE_URL}/`,
  notes: `${HOMEPAGE_BASE_URL}:9090/`,
  trains: `${HOMEPAGE_BASE_URL}:5174/`,
  printers: `${HOMEPAGE_BASE_URL}:8088/ui/`,
  sprite: `${HOMEPAGE_BASE_URL}:5173/`,
  v0: `${HOMEPAGE_BASE_URL}:8064/`,
  sentry: `${HOMEPAGE_BASE_URL}:8089/`,
  photos: `${HOMEPAGE_BASE_URL}:8081/`,
  chat: `${HOMEPAGE_BASE_URL}:4002/`,
  pihole: 'http://192.168.1.99/admin'
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
  const fallback = `https://www.google.com/s2/favicons?sz=256&domain_url=${encoded}`;
  const apple = domain ? `https://${domain}/apple-touch-icon.png` : fallback;
  const webManifest = domain ? `https://${domain}/android-chrome-192x192.png` : fallback;
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

  return `
    <article class="bookmark-card service-card managed-card ${state.state}" tabindex="0" role="group" aria-label="${escapeHtml(service.name)} controls">
      <div class="bookmark-content">
        <header>
          <div class="bookmark-meta">
            <p class="bookmark-name">${escapeHtml(service.name)}</p>
            <p class="bookmark-url">${escapeHtml(service.description)}</p>
            <p class="service-location">${escapeHtml(service.location)}</p>
            <p class="service-state service-${state.state}">${escapeHtml(stateLabel(state.state))}</p>
            <p class="service-detail">${escapeHtml(state.detail)}</p>
          </div>
        </header>
        <form method="POST" action="/service-action" class="service-actions" data-no-card-nav>
          <input type="hidden" name="id" value="${escapeHtml(service.id)}">
          <button type="submit" name="action" value="start">▶️ start</button>
          <button type="submit" name="action" value="stop">⏹️ stop</button>
          <button type="submit" name="action" value="restart">🔁 restart</button>
        </form>
        ${hasOpen ? `<a class="bookmark-link" href="${openHref}">🚀 open</a>` : '<p class="no-open-link">No web endpoint</p>'}
      </div>
    </article>
  `;
};

const curatedCard = (entry) => {
  const href = formatLink(entry.link, { defaultScheme: inferDefaultScheme(entry.link) || 'https' });
  return `
    <article class="bookmark-card service-card" data-href="${href}" tabindex="0" role="link" aria-label="${escapeHtml(entry.name)}">
      <div class="bookmark-content">
        <header>
          <div class="bookmark-meta">
            <p class="bookmark-name">${escapeHtml(entry.name)}</p>
            <p class="bookmark-url">${escapeHtml(entry.description)}</p>
          </div>
        </header>
        <a class="bookmark-link" href="${href}">Open</a>
      </div>
    </article>
  `;
};

const renderHtml = (links, managedStates, serviceMessage, dockerProjects) => {
  const managedProjectIds = new Set(managedStates.map((state) => state.service.id));
  const userCards = links.map((entry, index) => {
    const shortcut = getShortcutForEntry(entry);
    const destinationRaw = getDestinationForEntry(entry);
    const destination = formatLink(destinationRaw, { defaultScheme: inferDefaultScheme(destinationRaw) || 'https' });
    const href = shortcut ? `/${encodeURIComponent(shortcut)}` : destination;
    const icon = iconFor(destination);
    const domainLabel = destination.replace(/^https?:\/\//, '');
    const allowUp = index > 0;
    const allowDown = index < links.length - 1;
    return `
      <article class="bookmark-card" data-href="${href}" tabindex="0" role="link" aria-label="${escapeHtml(entry.name)}">
        <div class="bookmark-content">
          <header>
            <img src="${icon.primary}" data-primary="${icon.primary}" data-secondary="${icon.secondary}" data-tertiary="${icon.tertiary}" data-fallback="${icon.fallback}" data-domain="${escapeHtml(domainLabel.toLowerCase())}" alt="${escapeHtml(entry.name)} icon" loading="lazy" width="48" height="48" onerror="this.onerror=null; this.src=this.dataset.fallback;" />
            <div class="bookmark-meta">
              <p class="bookmark-name">${escapeHtml(entry.name)}</p>
              <p class="bookmark-url">${escapeHtml(domainLabel)}</p>
            </div>
            <div class="bookmark-actions">
              <form method="POST" action="/move-link">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <input type="hidden" name="direction" value="up">
                <button type="submit" ${allowUp ? '' : 'disabled'} aria-label="Move ${escapeHtml(entry.name)} up">↑</button>
              </form>
              <form method="POST" action="/move-link">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <input type="hidden" name="direction" value="down">
                <button type="submit" ${allowDown ? '' : 'disabled'} aria-label="Move ${escapeHtml(entry.name)} down">↓</button>
              </form>
              <form method="POST" action="/delete-link" class="bookmark-delete">
                <input type="hidden" name="name" value="${escapeHtml(entry.name)}">
                <button title="Delete ${escapeHtml(entry.name)}" type="submit">×</button>
              </form>
            </div>
          </header>
          <a class="bookmark-link" href="${href}">Visit</a>
        </div>
      </article>
    `;
  });

  const managedCards = managedStates.map((state) => managedServiceCard(state));
  const infoCards = curatedLinks.map((entry) => curatedCard(entry));
  const projectList = dockerProjects.map((name) => {
    const managed = managedProjectIds.has(name);
    const emoji = managed ? '🧩' : '📦';
    const state = managed ? 'managed' : 'unmanaged';
    return `<li class="project-item ${state}"><span class="project-emoji">${emoji}</span><span class="project-name">${escapeHtml(name)}</span><span class="project-state">${managed ? 'managed service' : 'manual'}</span></li>`;
  });

  const cards = [
    ...userCards,
    ...infoCards,
    `
    <article class="bookmark-card add-card" data-href="/" tabindex="0" role="link" aria-label="Add quick link">
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
          <button type="submit">Save</button>
        </form>
      </div>
    </article>
    `
  ];

  const today = moment().format('ddd, MMM D');
  const msg = `Hello YOU today is ${today}.`;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>fridge homepage</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="theme-color" content="#0f172a">
        <link rel="stylesheet" href="d.css">
      </head>
      <body>
        <main class="page">
          <section class="hero">
            <p class="tag">fridge.local</p>
            <h1><span id="greeting-name">YOU</span>, ${msg.replace('Hello YOU ', '')}</h1>
            <p class="subtitle">Links, tools, and query redirects for local services (example: <code>?go=notes</code>).</p>
            <form class="name-form" data-no-card-nav>
              <label for="displayName">name</label>
              <input id="displayName" type="text" maxlength="24" placeholder="type your name">
              <button type="button" id="saveDisplayName">save</button>
            </form>
            <p class="settings-nav"><a href="/settings">Settings</a></p>
            ${serviceMessage ? `<p class="service-message">${escapeHtml(serviceMessage)}</p>` : ''}
          </section>

          <section>
            <h2 class="section-title">Managed Services</h2>
            <p class="section-subtitle">Start/stop/restart optional containers so they do not run all the time.</p>
            <section class="bookmark-grid managed-grid">
              ${managedCards.join('')}
            </section>
          </section>

          <section>
            <h2 class="section-title">Projects + Links</h2>
            <div class="stack-layout">
              <section class="bookmark-grid">
                ${cards.join('')}
              </section>
              <article class="project-list-card">
                <h3>Docker Projects</h3>
                <p class="section-subtitle">All folders under <code>/home/fridge/docker</code></p>
                <ul class="project-list">
                  ${projectList.join('')}
                </ul>
              </article>
            </div>
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
          const nameInput = document.getElementById('displayName');
          const saveBtn = document.getElementById('saveDisplayName');
          const safeName = (raw) => String(raw || '').trim().replace(/[^\\w\\s-]/g, '').slice(0, 24);
          const applyName = (name) => {
            greetingEl.textContent = name || 'YOU';
            nameInput.value = name || '';
          };
          try {
            const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
            applyName(safeName(profile.name));
          } catch {
            applyName('');
          }
          saveBtn.addEventListener('click', () => {
            const name = safeName(nameInput.value);
            applyName(name);
            try {
              localStorage.setItem(PROFILE_KEY, JSON.stringify({ name, updatedAt: Date.now() }));
            } catch {}
          });

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
            const key = (img.dataset.domain || '').toLowerCase();
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
            const chain = [primary, secondary, tertiary, fallback].filter(Boolean).map(proxy);
            let idx = 0;
            const next = () => {
              if (idx >= chain.length) return;
              img.src = chain[idx++];
            };
            img.crossOrigin = 'anonymous';
            img.onerror = next;
            img.onload = () => {
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
            next();
          };

          const activateCard = (card) => {
            const href = card.dataset.href;
            if (!href) return;
            window.location.assign(href);
          };

          document.querySelectorAll('.bookmark-card').forEach((card) => {
            card.addEventListener('click', (event) => {
              if (event.target.closest('form') || event.target.closest('button') || event.target.closest('[data-no-card-nav]')) {
                return;
              }
              activateCard(card);
            });

            card.addEventListener('keydown', (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                if (event.target.closest('form') || event.target.closest('button') || event.target.closest('[data-no-card-nav]')) {
                  return;
                }
                event.preventDefault();
                activateCard(card);
              }
            });
          });

          document.querySelectorAll('.bookmark-card img[data-primary]').forEach(loadIcon);
        })();
      </script>
    </body>
  </html>
  `;
};

const renderSettingsHtml = () => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Hostname Settings</title>
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
            <button type="submit">Save</button>
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
          const form = document.getElementById('hostname-form');
          const homepageInput = document.getElementById('homepageUrl');
          const hostnameInput = document.getElementById('serviceHostname');
          const fallbackInput = document.getElementById('fallbackTarget');
          const messageEl = document.getElementById('message');
          const listEl = document.getElementById('hostname-list');

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
  res.send(renderHtml(links, managedStates, serviceMessage, dockerProjects));
});

app.get('/settings', (req, res) => {
  res.send(renderSettingsHtml());
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
    res.set('content-type', contentType);
    res.set('cache-control', 'public, max-age=1209600, immutable');
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Icon proxy error', err);
    return res.status(500).send('Icon fetch failed');
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
