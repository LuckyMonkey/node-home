import { prisma } from '../db/client.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

type Mode = 'home' | 'away' | 'auto';
type ServiceDefinition = {
  id: string;
  name: string;
  description: string;
  githubUrl: string | null;
  routePath: string | null;
  routePort?: number;
  homeUrl?: string;
  awayUrl?: string;
  preferResolvedUrl?: boolean;
  icon: string;
  containerNames?: string[];
  processNames?: string[];
};
const execFileAsync = promisify(execFile);
const ENV_TAILSCALE_ORIGIN = normalizeConfiguredOrigin(process.env.TAILSCALE_ORIGIN);
const ENV_TAILSCALE_HOSTNAME = normalizeConfiguredHostname(process.env.TAILSCALE_HOSTNAME);

const SERVICES: ServiceDefinition[] = [
  {
    id: 'printer-hub',
    name: 'Printer Hub',
    description: 'Brother/Zebra print service',
    githubUrl: 'https://github.com/LuckyMonkey/printer-hub',
    routePath: '/app/printers',
    icon: 'printer',
    containerNames: ['printer-hub']
  },
  {
    id: 'notebook',
    name: 'Notebook',
    description: 'DokuWiki notes',
    githubUrl: 'https://github.com/LuckyMonkey/dokuwiki-config',
    routePath: '/app/notes',
    icon: 'book',
    containerNames: ['dokuwiki']
  },
  {
    id: 'mbta-tracker',
    name: 'MBTA Tracker',
    description: 'Train board and API',
    githubUrl: 'https://github.com/LuckyMonkey/fridgeMbtaTracker',
    routePath: '/app/trains',
    icon: 'train',
    containerNames: ['mbta-web', 'mbta-api', 'mbta-mongo']
  },
  {
    id: 'dashboard',
    name: 'fridge.run',
    description: 'Launch page and warning host',
    githubUrl: null,
    routePath: '/',
    icon: 'house',
    containerNames: ['dashboard']
  },
  {
    id: 'pihole',
    name: 'Pi-hole',
    description: 'DNS and ad blocking',
    githubUrl: 'https://github.com/pi-hole/docker-pi-hole',
    routePath: null,
    homeUrl: 'http://192.168.1.99/admin',
    icon: 'network',
    containerNames: ['pihole']
  },
  {
    id: 'dnsmasq',
    name: 'dnsmasq',
    description: 'Local DNS forwarding',
    githubUrl: 'https://github.com/imp/dnsmasq',
    routePath: null,
    icon: 'network',
    containerNames: ['dnsmasq']
  },
  {
    id: 'charliemaps',
    name: 'CharlieMaps',
    description: 'Map workbench',
    githubUrl: 'https://github.com/LuckyMonkey/charliemaps',
    routePath: '/',
    routePort: 5173,
    icon: 'map',
    containerNames: ['charliemaps-web', 'charliemaps-api', 'charliemaps-db']
  },
  {
    id: 'snitch',
    name: 'Snitch',
    description: 'Incident scanner',
    githubUrl: null,
    routePath: '/app/incidents',
    icon: 'shield',
    containerNames: ['snitch-api-1', 'snitch-web-1', 'snitch-postgres-1']
  },
  {
    id: 'device-sentry',
    name: 'Device Sentry',
    description: 'LAN device monitor',
    githubUrl: 'https://github.com/LuckyMonkey/device-sentry',
    routePath: '/app/sentry',
    icon: 'radar',
    containerNames: ['device-sentry', 'device-sentry-viewer']
  },
  {
    id: 'photosort',
    name: 'PhotoSort',
    description: 'Photo sorting web UI',
    githubUrl: 'https://github.com/drmatt13/charlie',
    routePath: '/app/photos',
    icon: 'camera',
    containerNames: ['photosort-api', 'photosort-web']
  },
  {
    id: 'v0-lab',
    name: 'v0 Lab',
    description: 'Prompt sandbox',
    githubUrl: 'https://github.com/LuckyMonkey/v0-lab',
    routePath: '/app/v0',
    icon: 'flask',
    containerNames: ['v0-next-lab']
  },
  {
    id: 'media-stack',
    name: 'Takeout',
    description: 'Portable browser + DLNA media portal',
    githubUrl: null,
    routePath: '/',
    routePort: 32400,
    icon: 'film',
    containerNames: ['takeout-portal', 'takeout-jellyfin', 'takeout-gerbera', 'takeout-filebrowser', 'takeout-rss', 'takeout-flow', 'takeout-transmission']
  },
  {
    id: 'transmission',
    name: 'Transmission',
    description: 'Torrent daemon and web UI',
    githubUrl: 'https://github.com/transmission/transmission',
    homeUrl: 'http://fridge.local:9091/transmission/web/',
    routePath: '/transmission/web/',
    routePort: 9091,
    preferResolvedUrl: true,
    icon: 'download',
    containerNames: ['takeout-transmission']
  }
] as const;

const LAN_ORIGIN = 'http://fridge.local';
const HOSTNAME_CACHE_TTL_MS = 10 * 60_000;
let tailscaleHostnameCache: { value: string | null; expiresAt: number } = { value: null, expiresAt: 0 };

function normalizeConfiguredOrigin(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed.includes('://') ? trimmed : `http://${trimmed}`).origin;
  } catch {
    return null;
  }
}

function normalizeConfiguredHostname(value: string | undefined) {
  const trimmed = value?.trim().replace(/\.$/, '');
  return trimmed || null;
}

async function getRouteMode(): Promise<Mode> {
  const setting = await prisma.setting.findUnique({ where: { key: 'routeMode' } });
  return setting && (setting.value === 'home' || setting.value === 'away' || setting.value === 'auto') ? setting.value : 'auto';
}

export async function setRouteMode(mode: Mode) {
  await prisma.setting.upsert({
    where: { key: 'routeMode' },
    update: { value: mode },
    create: { key: 'routeMode', value: mode }
  });
}

function isPrivateOrLanHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized.endsWith('.local') ||
    /^192\.168\./.test(normalized) ||
    /^10\./.test(normalized) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)
  );
}

function joinOriginPort(origin: string, port: number | null | undefined, path: string) {
  const url = new URL(origin);
  url.port = port ? String(port) : url.port;
  url.pathname = path;
  url.search = '';
  url.hash = '';
  return url.toString();
}

async function getTailscaleHostname() {
  if (ENV_TAILSCALE_HOSTNAME) {
    return ENV_TAILSCALE_HOSTNAME;
  }
  if (ENV_TAILSCALE_ORIGIN) {
    return new URL(ENV_TAILSCALE_ORIGIN).hostname;
  }
  if (tailscaleHostnameCache.expiresAt > Date.now()) {
    return tailscaleHostnameCache.value;
  }
  try {
    const { stdout } = await execFileAsync('tailscale', ['status', '--json'], {
      timeout: 1500,
      maxBuffer: 1024 * 1024
    });
    const parsed = JSON.parse(stdout) as { Self?: { DNSName?: string | null } };
    const dnsName = parsed.Self?.DNSName?.replace(/\.$/, '') || null;
    tailscaleHostnameCache = { value: dnsName, expiresAt: Date.now() + HOSTNAME_CACHE_TTL_MS };
    return dnsName;
  } catch {
    tailscaleHostnameCache = { value: null, expiresAt: Date.now() + 60_000 };
    return null;
  }
}

type RouteContext = {
  requestOrigin: string | null;
  requestHostname: string | null;
  awayOrigin: string | null;
};

async function resolveRouteContext(requestOrigin?: string | null) {
  const origin = requestOrigin ?? null;
  const requestHostname = origin ? new URL(origin).hostname : null;
  const requestIsAway = requestHostname ? requestHostname.endsWith('.ts.net') : false;
  let awayOrigin = requestIsAway ? origin : ENV_TAILSCALE_ORIGIN;

  if (!awayOrigin) {
    const tailscaleHostname = await getTailscaleHostname();
    if (tailscaleHostname) {
      awayOrigin = `http://${tailscaleHostname}`;
    }
  }

  return {
    requestOrigin: origin,
    requestHostname,
    awayOrigin
  } satisfies RouteContext;
}

function resolveEffectiveMode(mode: Mode, routeContext: RouteContext): Exclude<Mode, 'auto'> {
  if (mode === 'home' || mode === 'away') {
    return mode;
  }
  const hostname = routeContext.requestHostname;
  if (hostname && !isPrivateOrLanHostname(hostname)) {
    return 'away';
  }
  return 'home';
}

function resolveServiceUrl(
  service: {
    routePath: string | null;
    routePort?: number;
    homeUrl?: string;
    awayUrl?: string;
  },
  routeContext: RouteContext,
  mode: Exclude<Mode, 'auto'>
) {
  if (mode === 'home') {
    if (service.homeUrl) {
      return service.homeUrl;
    }
    if (service.routePath) {
      return joinOriginPort(LAN_ORIGIN, service.routePort, service.routePath);
    }
    return null;
  }

  if (service.awayUrl) {
    return service.awayUrl;
  }

  const { routePath } = service;
  if (!routePath) {
    return null;
  }

  if (routeContext.awayOrigin) {
    return joinOriginPort(routeContext.awayOrigin, service.routePort, routePath);
  }

  if (routeContext.requestOrigin && routeContext.requestHostname && !isPrivateOrLanHostname(routeContext.requestHostname)) {
    return joinOriginPort(routeContext.requestOrigin, service.routePort, routePath);
  }

  return null;
}

async function resolveServiceStatus(service: ServiceDefinition) {
  if (service.containerNames?.length) {
    try {
      const { stdout } = await execFileAsync('docker', ['inspect', '--format', '{{.State.Status}}', ...service.containerNames]);
      const statuses = stdout.split('\n').map((line) => line.trim()).filter(Boolean);
      if (statuses.length > 0 && statuses.every((entry) => entry === 'running')) {
        return 'running' as const;
      }
      if (statuses.length > 0 && statuses.every((entry) => entry === 'exited' || entry === 'created')) {
        return 'stopped' as const;
      }
      if (statuses.length > 0) {
        return 'degraded' as const;
      }
    } catch {
      return 'unknown' as const;
    }
    return 'unknown' as const;
  }

  if (service.processNames?.length) {
    try {
      const statuses = await Promise.all(
        service.processNames.map(async (processName: string) => {
          try {
            await execFileAsync('pgrep', ['-f', processName], { timeout: 1200 });
            return 'running';
          } catch {
            return 'stopped';
          }
        })
      );
      if (statuses.every((status: string) => status === 'running')) {
        return 'running' as const;
      }
      if (statuses.every((status: string) => status === 'stopped')) {
        return 'stopped' as const;
      }
      return 'degraded' as const;
    } catch {
      return 'unknown' as const;
    }
  }

  return 'unknown' as const;
}

export async function listServices(requestOrigin?: string | null) {
  const routeMode = await getRouteMode();
  const routeContext = await resolveRouteContext(requestOrigin);
  const services = await Promise.all(
    SERVICES.map(async (service) => {
      const resolvedMode = resolveEffectiveMode(routeMode, routeContext);
      const status = await resolveServiceStatus(service);
      const preferredUrl = resolveServiceUrl(service, routeContext, resolvedMode);
      const resolvedUrl =
        service.preferResolvedUrl ? preferredUrl ?? service.githubUrl : status === 'stopped' ? service.githubUrl ?? preferredUrl : preferredUrl ?? service.githubUrl;
      return {
        id: service.id,
        name: service.name,
        description: service.description,
        githubUrl: service.githubUrl,
        icon: service.icon,
        containerNames: service.containerNames,
        status,
        resolvedUrl
      };
    })
  );
  return { services, routeMode };
}

export async function runServiceAction(serviceId: string, action: 'start' | 'stop' | 'restart') {
  const service = SERVICES.find((entry) => entry.id === serviceId);
  if (!service) {
    throw new Error(`Unknown service ${serviceId}`);
  }
  if (!service.containerNames?.length) {
    throw new Error(`Service ${serviceId} has no container controls`);
  }
  await execFileAsync('docker', [action, ...service.containerNames]);
  const { services } = await listServices();
  return services.find((entry) => entry.id === serviceId);
}
