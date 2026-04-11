import { useEffect, useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBars,
  faChartSimple,
  faChevronLeft,
  faChevronRight,
  faGear,
  faHouse,
  faLink,
  faPersonWalking,
  faServer,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import { CharlieMapsSpotlight } from '../components/CharlieMapsSpotlight';
import { FridgeServiceGrid } from '../components/FridgeServiceGrid';
import { PagePixelField } from '../components/PagePixelField';
import { SerpentineViewport } from '../components/SerpentineViewport';
import { useDashboardVisits } from '../hooks/useDashboardVisits';
import { useLocalLinkClicks } from '../hooks/useLocalLinkClicks';
import { useStatFunctionDeploy } from '../hooks/useStatFunctionDeploy';
import { useStatFeedback } from '../hooks/useStatFeedback';
import { useUiSounds } from '../hooks/useUiSounds';
import { buildDisplayItems } from '../lib/homeLayout';
import { statFunctionRegistry } from '../lib/statFunctionRegistry';
import type { BootstrapPayload, HomepageItem, IconMode, ServiceCard } from '../lib/types';

const EMPTY: BootstrapPayload = { items: [], services: [], routeMode: 'auto', systemStats: { storage: null } };
const ICON_MODE_ORDER: IconMode[] = ['auto', 'fontawesome', 'emojistack', 'touch', 'favicon'];
const STAT_FUNCTION_AUTO_DEPLOY_KEY = 'dashboard.stat-function-auto-deploy.v1';
const ICON_MODE_LABEL: Record<IconMode, string> = {
  auto: 'Auto',
  touch: 'Touch',
  favicon: 'Favicon',
  fontawesome: 'Font Awesome',
  emojistack: 'EmojiStack'
};

const STAT_TONES = [
  'bg-[linear-gradient(180deg,rgba(254,243,199,0.98)_0%,rgba(255,251,235,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(217,249,157,0.98)_0%,rgba(240,253,224,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(191,219,254,0.98)_0%,rgba(239,246,255,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(253,230,138,0.97)_0%,rgba(254,249,195,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(254,215,170,0.97)_0%,rgba(255,237,213,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(216,180,254,0.96)_0%,rgba(243,232,255,0.98)_100%)]',
  'bg-[linear-gradient(180deg,rgba(190,242,100,0.96)_0%,rgba(236,252,203,0.98)_100%)]'
] as const;

type DashboardStat = {
  id: string;
  label: string;
  value: string;
  detail: string;
};

type MobileSection = 'services' | 'links' | 'stats' | 'settings';

const MOBILE_SECTION_OPTIONS: Array<{ id: MobileSection; label: string; icon: typeof faServer }> = [
  { id: 'services', label: 'Services', icon: faServer },
  { id: 'links', label: 'Links', icon: faLink },
  { id: 'stats', label: 'Stats', icon: faChartSimple },
  { id: 'settings', label: 'Settings', icon: faGear }
];

function formatVisitTimestamp(value: string | null) {
  if (!value) {
    return 'First time today';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatBytesCompact(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return 'Unknown';
  }
  const gib = value / (1024 ** 3);
  if (gib >= 100) {
    return `${Math.round(gib)} GB`;
  }
  return `${gib.toFixed(1)} GB`;
}

function detectAccessMode() {
  if (typeof window === 'undefined') {
    return { label: 'Unknown', detail: 'No host context' };
  }
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return { label: 'Localhost', detail: hostname };
  }
  if (hostname.endsWith('.ts.net')) {
    return { label: 'Tailscale', detail: hostname };
  }
  if (
    hostname.endsWith('.local') ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    return { label: 'LAN', detail: hostname };
  }
  return { label: 'Direct', detail: hostname };
}

function normalizeUrlInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

function formatShortDate(value: string | null) {
  if (!value) {
    return 'New';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Recent';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(value);
}

function StatCard({
  stat,
  toneClassName,
  feedback,
  onHover,
  onRate
}: {
  stat: DashboardStat;
  toneClassName: string;
  feedback: 'up' | 'down' | undefined;
  onHover: () => void;
  onRate: (value: 'up' | 'down') => void;
}) {
  return (
    <article className={`rounded-[1.3rem] border-2 border-black/15 px-4 py-3 shadow-[0_16px_32px_rgba(15,23,42,0.08),0_2px_8px_rgba(15,23,42,0.06)] ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/50">{stat.label}</div>
          <div className="mt-1 break-words text-[1.45rem] font-black leading-none tracking-[-0.04em] text-black/88">{stat.value}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onPointerEnter={onHover}
            onClick={() => onRate('up')}
            className={`rounded-full border px-2 py-1 text-[0.8rem] ${feedback === 'up' ? 'border-black/25 bg-lime-200/90' : 'border-black/10 bg-white/60'}`}
            aria-label={`Thumbs up ${stat.label}`}
          >
            👍
          </button>
          <button
            type="button"
            onPointerEnter={onHover}
            onClick={() => onRate('down')}
            className={`rounded-full border px-2 py-1 text-[0.8rem] ${feedback === 'down' ? 'border-black/25 bg-rose-200/90' : 'border-black/10 bg-white/60'}`}
            aria-label={`Thumbs down ${stat.label}`}
          >
            👎
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm font-medium text-black/65">{stat.detail}</div>
    </article>
  );
}

function RotatingFunctionCard({
  label,
  value,
  detail,
  toneClassName,
  onHover,
  onRemove
}: {
  label: string;
  value: string;
  detail: string;
  toneClassName: string;
  onHover: () => void;
  onRemove: () => void;
}) {
  return (
    <article className={`rounded-[1.3rem] border-2 border-dashed border-black/15 px-4 py-3 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/50">{label}</div>
          <div className="mt-1 break-words text-[1.15rem] font-black leading-tight tracking-[-0.03em] text-black/78">{value}</div>
        </div>
        <button
          type="button"
          onPointerEnter={onHover}
          onClick={onRemove}
          className="rounded-full border border-black/10 bg-white/70 px-2 py-1 text-[0.66rem] font-black uppercase tracking-[0.14em] text-black/58"
        >
          Remove
        </button>
      </div>
      <div className="mt-2 text-sm font-medium text-black/65">{detail}</div>
    </article>
  );
}

function PendingFunctionCard({
  label,
  value,
  detail,
  toneClassName,
  onHover,
  onDeploy
}: {
  label: string;
  value: string;
  detail: string;
  toneClassName: string;
  onHover: () => void;
  onDeploy: () => void;
}) {
  return (
    <article className={`rounded-[1.3rem] border-2 border-dashed border-black/15 px-4 py-3 shadow-[0_12px_26px_rgba(15,23,42,0.06)] ${toneClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/50">{label}</div>
          <div className="mt-1 break-words text-[1.15rem] font-black leading-tight tracking-[-0.03em] text-black/78">{value}</div>
        </div>
        <button
          type="button"
          onPointerEnter={onHover}
          onClick={onDeploy}
          className="rounded-full border border-black/10 bg-lime-200/80 px-2 py-1 text-[0.66rem] font-black uppercase tracking-[0.14em] text-black/65"
        >
          Deploy
        </button>
      </div>
      <div className="mt-2 text-sm font-medium text-black/65">{detail}</div>
    </article>
  );
}

export function Home() {
  const [bootstrap, setBootstrap] = useState<BootstrapPayload>(EMPTY);
  const [editMode, setEditMode] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('links');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [serpentineStepCommand, setSerpentineStepCommand] = useState<{ delta: number } | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());
  const sounds = useUiSounds();
  const localClicks = useLocalLinkClicks();
  const statFunctionDeploy = useStatFunctionDeploy();
  const visits = useDashboardVisits();
  const statFeedback = useStatFeedback();

  const loadBootstrap = async () => {
    const response = await fetch('/api/bootstrap');
    if (!response.ok) {
      throw new Error('Bootstrap load failed');
    }
    const payload = (await response.json()) as BootstrapPayload;
    setBootstrap(payload);
  };

  const runSettingsAction = async (action: () => Promise<void>, failureMessage: string) => {
    try {
      await action();
    } catch (error) {
      console.error(failureMessage, error);
      setSettingsMessage(failureMessage);
    }
  };

  useEffect(() => {
    loadBootstrap().catch((error) => console.error('bootstrap failed', error));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localClicks.pruneTo(bootstrap.items.map((item) => item.id));
    setSelectedItemId((current) => (current && bootstrap.items.some((item) => item.id === current) ? current : null));
  }, [bootstrap.items]);

  const items = useMemo(() => buildDisplayItems(bootstrap.items), [bootstrap.items]);
  const selectedItem = useMemo(() => bootstrap.items.find((item) => item.id === selectedItemId) ?? null, [bootstrap.items, selectedItemId]);
  const runningServices = useMemo(() => bootstrap.services.filter((service) => service.status === 'running').length, [bootstrap.services]);
  const serviceLinks = useMemo(() => bootstrap.services.filter((service) => service.resolvedUrl || service.githubUrl).length, [bootstrap.services]);
  const localServices = useMemo(() => bootstrap.services.filter((service) => service.resolvedUrl && !service.githubUrl?.includes(service.resolvedUrl)).length, [bootstrap.services]);
  const lastVisitLabel = useMemo(() => formatVisitTimestamp(visits.previousVisitedAt), [visits.previousVisitedAt]);
  const accessMode = useMemo(() => detectAccessMode(), []);
  const freeStorageLabel = useMemo(() => formatBytesCompact(bootstrap.systemStats.storage?.availableBytes ?? null), [bootstrap.systemStats.storage]);
  const storageDetail = useMemo(() => {
    const storage = bootstrap.systemStats.storage;
    if (!storage) {
      return 'Storage telemetry unavailable.';
    }
    return `${storage.usedPercent}% used on ${storage.mountPath}`;
  }, [bootstrap.systemStats.storage]);
  const routeModeLabel = bootstrap.routeMode === 'auto' ? `auto via ${accessMode.label.toLowerCase()}` : `${bootstrap.routeMode} override`;
  const totalLocalClicks = useMemo(() => Object.values(localClicks.clicks).reduce((sum, count) => sum + count, 0), [localClicks.clicks]);
  const clickedLinkCount = useMemo(() => Object.values(localClicks.clicks).filter((count) => count > 0).length, [localClicks.clicks]);
  const topClickedLinkLabel = useMemo(() => {
    const entry = Object.entries(localClicks.clicks).sort((left, right) => right[1] - left[1])[0];
    if (!entry) {
      return 'None yet';
    }
    const item = bootstrap.items.find((candidate) => candidate.id === entry[0]);
    return item ? `${item.title} · ${entry[1]}` : `${entry[1]} clicks`;
  }, [bootstrap.items, localClicks.clicks]);
  const imageIconCount = useMemo(
    () => bootstrap.items.filter((item) => item.cachedIconDataUrl || item.customIconDataUrl).length,
    [bootstrap.items]
  );
  const emojiStackCount = useMemo(() => bootstrap.items.filter((item) => Boolean(item.emojiStackClass)).length, [bootstrap.items]);
  const repoFallbackCount = useMemo(
    () => bootstrap.services.filter((service) => !service.resolvedUrl && Boolean(service.githubUrl)).length,
    [bootstrap.services]
  );
  const stoppedServices = useMemo(() => bootstrap.services.filter((service) => service.status === 'stopped').length, [bootstrap.services]);
  const degradedServices = useMemo(() => bootstrap.services.filter((service) => service.status === 'degraded').length, [bootstrap.services]);
  const charlieMapsService = useMemo(() => bootstrap.services.find((service) => service.id === 'charliemaps') ?? null, [bootstrap.services]);
  const totalContainerCount = useMemo(
    () => bootstrap.services.reduce((sum, service) => sum + (service.containerNames?.length ?? 0), 0),
    [bootstrap.services]
  );
  const firstVisitLabel = useMemo(() => formatShortDate(visits.firstVisitedAt), [visits.firstVisitedAt]);
  const averageVisitsLabel = visits.visitDays > 0 ? (visits.totalVisits / visits.visitDays).toFixed(1) : '0.0';
  const primaryStats = useMemo<DashboardStat[]>(
    () => [
      {
        id: 'quick-launches',
        label: 'Quick Launches',
        value: String(bootstrap.items.length),
        detail: 'Homepage links in the current serpentine list.'
      },
      {
        id: 'running-services',
        label: 'Running Services',
        value: `${runningServices}/${bootstrap.services.length}`,
        detail: 'Containers currently reporting as running on the fridge.'
      },
      {
        id: 'fridge-reach',
        label: 'Fridge Reach',
        value: `${localServices}/${serviceLinks}`,
        detail: `${serviceLinks} service cards have a live destination or repo fallback. Routing is ${routeModeLabel}.`
      },
      {
        id: 'last-visit',
        label: 'Last Visit',
        value: lastVisitLabel,
        detail: 'Most recent visit before this page load on this browser.'
      },
      {
        id: 'visits-today',
        label: 'Visits Today',
        value: String(visits.visitsToday),
        detail: 'Dashboard opens recorded today in local browser storage.'
      },
      {
        id: 'access-path',
        label: 'Access Path',
        value: accessMode.label,
        detail: accessMode.detail
      },
      {
        id: 'space-left',
        label: 'Space Left',
        value: freeStorageLabel,
        detail: storageDetail
      }
    ],
    [
      accessMode.detail,
      accessMode.label,
      bootstrap.items.length,
      bootstrap.services.length,
      freeStorageLabel,
      lastVisitLabel,
      localServices,
      routeModeLabel,
      runningServices,
      serviceLinks,
      storageDetail,
      visits.visitsToday
    ]
  );
  const secondaryStats = useMemo<DashboardStat[]>(
    () => [
      {
        id: 'lifetime-visits',
        label: 'Lifetime Visits',
        value: String(visits.totalVisits),
        detail: 'All recorded dashboard opens in this browser.'
      },
      {
        id: 'visit-streak',
        label: 'Visit Streak',
        value: `${visits.currentStreak} day${visits.currentStreak === 1 ? '' : 's'}`,
        detail: 'Consecutive days with at least one dashboard visit.'
      },
      {
        id: 'days-seen',
        label: 'Days Seen',
        value: String(visits.visitDays),
        detail: 'How many distinct calendar days this browser has opened the dashboard.'
      },
      {
        id: 'first-seen',
        label: 'First Seen',
        value: firstVisitLabel,
        detail: 'Earliest dashboard visit recorded in local browser storage.'
      },
      {
        id: 'avg-visits',
        label: 'Avg Visits / Day',
        value: averageVisitsLabel,
        detail: 'Average dashboard opens per active visit day on this browser.'
      },
      {
        id: 'local-clicks',
        label: 'Local Link Clicks',
        value: String(totalLocalClicks),
        detail: 'Total link launches tracked locally from this dashboard.'
      },
      {
        id: 'clicked-links',
        label: 'Clicked Links',
        value: `${clickedLinkCount}/${bootstrap.items.length}`,
        detail: 'How many homepage links have at least one local click.'
      },
      {
        id: 'top-click',
        label: 'Top Click',
        value: topClickedLinkLabel,
        detail: 'Most-used link based on local click counts in this browser.'
      },
      {
        id: 'icon-cache',
        label: 'Icon Cache',
        value: String(imageIconCount),
        detail: 'Links currently backed by a fetched touch icon, favicon, or custom image.'
      },
      {
        id: 'emoji-stack',
        label: 'EmojiStack Ready',
        value: String(emojiStackCount),
        detail: 'Links with an assigned EmojiStack prefab or class.'
      },
      {
        id: 'repo-fallbacks',
        label: 'Repo Fallbacks',
        value: String(repoFallbackCount),
        detail: 'Services still falling back to GitHub because they do not expose a live route.'
      },
      {
        id: 'stopped-services',
        label: 'Stopped Services',
        value: String(stoppedServices),
        detail: 'Known service groups currently reporting a stopped container state.'
      },
      {
        id: 'degraded-services',
        label: 'Degraded Services',
        value: String(degradedServices),
        detail: 'Service groups with mixed container states instead of fully running or stopped.'
      },
      {
        id: 'container-count',
        label: 'Tracked Containers',
        value: String(totalContainerCount),
        detail: 'Total named containers monitored across the fridge service inventory.'
      },
      {
        id: 'clock-now',
        label: 'Fridge Time',
        value: formatClock(clockNow),
        detail: 'Local time on the device rendering this dashboard.'
      },
      {
        id: 'liked-stats',
        label: 'Liked Stats',
        value: String(statFeedback.likedCount),
        detail: 'Stats you have thumbed up in this browser.'
      },
      {
        id: 'disliked-stats',
        label: 'Disliked Stats',
        value: String(statFeedback.dislikedCount),
        detail: 'Stats you have thumbed down in this browser.'
      }
    ],
    [
      averageVisitsLabel,
      bootstrap.items.length,
      clickedLinkCount,
      clockNow,
      degradedServices,
      emojiStackCount,
      firstVisitLabel,
      imageIconCount,
      repoFallbackCount,
      statFeedback.dislikedCount,
      statFeedback.likedCount,
      stoppedServices,
      topClickedLinkLabel,
      totalContainerCount,
      totalLocalClicks,
      visits.currentStreak,
      visits.totalVisits,
      visits.visitDays
    ]
  );
  const pendingStatFunctions = useMemo(() => {
    const visibleStatIds = new Set([...primaryStats, ...secondaryStats].map((stat) => stat.id));
    const deployedIds = new Set(statFunctionDeploy.deployedIds);
    return statFunctionRegistry.filter((entry) => !visibleStatIds.has(entry.id) && !deployedIds.has(entry.id));
  }, [primaryStats, secondaryStats, statFunctionDeploy.deployedIds]);
  const deployedStatFunctions = useMemo(
    () =>
      statFunctionDeploy.deployedIds
        .map((id) => statFunctionRegistry.find((entry) => entry.id === id))
        .filter((entry): entry is (typeof statFunctionRegistry)[number] => Boolean(entry)),
    [statFunctionDeploy.deployedIds]
  );

  const cycleSelectedItemIconMode = async () => {
    if (!selectedItem || selectedItem.type !== 'link') {
      return;
    }
    const currentIndex = ICON_MODE_ORDER.indexOf(selectedItem.iconMode);
    const nextMode = ICON_MODE_ORDER[(currentIndex + 1 + ICON_MODE_ORDER.length) % ICON_MODE_ORDER.length];
    sounds.playClick();
    const response = await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconMode: nextMode })
    });
    if (!response.ok) {
      throw new Error('Icon mode update failed');
    }
    setSettingsMessage(`Icon source set to ${ICON_MODE_LABEL[nextMode]}.`);
    await loadBootstrap();
  };

  const addLink = async () => {
    const title = newLinkTitle.trim();
    const url = normalizeUrlInput(newLinkUrl);
    if (!title || !url) {
      setSettingsMessage('Add a name and URL first.');
      return;
    }
    sounds.playClick();
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        url,
        type: 'link',
        iconMode: 'auto'
      })
    });
    if (!response.ok) {
      throw new Error('Link create failed');
    }
    setNewLinkTitle('');
    setNewLinkUrl('');
    setSettingsMessage(`Added ${title}.`);
    await loadBootstrap();
  };

  const openItem = async (item: HomepageItem) => {
    if (!item.url || editMode) {
      return;
    }
    sounds.playClick();
    localClicks.increment(item.id);
    fetch(`/api/items/${item.id}/click`, { method: 'POST' }).catch(() => undefined);
    window.open(item.url, '_blank', 'noopener,noreferrer');
  };

  const openService = (service: ServiceCard) => {
    const target = service.resolvedUrl || service.githubUrl;
    if (!target) {
      return;
    }
    sounds.playClick();
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const serviceAction = (serviceId: string, action: 'start' | 'stop' | 'restart') => {
    sounds.playClick();
    fetch(`/api/services/${serviceId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    })
      .then(() => loadBootstrap())
      .catch((error) => console.error('service action failed', error));
  };

  const updateRouteMode = (mode: BootstrapPayload['routeMode']) => {
    sounds.playClick();
    fetch('/api/settings/route-mode', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode })
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Route mode update failed');
        }
        setSettingsMessage(mode === 'auto' ? 'Automatic route mode restored.' : `${mode} override enabled.`);
        return loadBootstrap();
      })
      .catch((error) => {
        console.error('route mode update failed', error);
        setSettingsMessage('Could not update route mode.');
      });
  };

  const moveItem = async (item: HomepageItem, direction: 'up' | 'down') => {
    if (item.type !== 'link') {
      return;
    }
    sounds.playClick();
    const response = await fetch(`/api/items/${item.id}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction })
    });
    if (!response.ok) {
      throw new Error('Move failed');
    }
    setSettingsMessage(`Moved ${item.title} ${direction}.`);
    await loadBootstrap();
  };

  const deleteItem = async (item: HomepageItem) => {
    if (item.type !== 'link') {
      return;
    }
    sounds.playClick();
    const response = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Delete failed');
    }
    localClicks.remove(item.id);
    setSelectedItemId((current) => (current === item.id ? null : current));
    setSettingsMessage(`Deleted ${item.title}.`);
    await loadBootstrap();
  };

  const deployPendingStat = (id: string, name: string) => {
    sounds.playClick();
    statFunctionDeploy.deploy([id]);
    setSettingsMessage(`Deployed ${name}.`);
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    if (window.localStorage.getItem(STAT_FUNCTION_AUTO_DEPLOY_KEY) === '1') {
      statFunctionDeploy.reset();
      window.localStorage.removeItem(STAT_FUNCTION_AUTO_DEPLOY_KEY);
      setSettingsMessage('Pending stat functions are back to manual deploy only.');
    }
  }, [statFunctionDeploy]);

  const activeMobileSection = MOBILE_SECTION_OPTIONS.find((section) => section.id === mobileSection) ?? MOBILE_SECTION_OPTIONS[0];
  const panelClassName =
    'rounded-[1.35rem] border-2 border-black/15 bg-white/78 p-3 shadow-[0_18px_32px_rgba(15,23,42,0.08),0_4px_12px_rgba(15,23,42,0.06)] backdrop-blur-md sm:rounded-[1.6rem] sm:p-4 sm:shadow-[0_22px_42px_rgba(15,23,42,0.08),0_4px_14px_rgba(15,23,42,0.06)]';

  const toggleMobileMenu = () => {
    sounds.playClick();
    setMobileMenuOpen((current) => !current);
  };

  const navigateSection = (section: MobileSection) => {
    sounds.playClick();
    setMobileSection(section);
    setMobileMenuOpen(false);
  };

  const toggleEditMode = () => {
    sounds.playClick();
    setEditMode((current) => {
      const next = !current;
      if (next) {
        setSettingsMessage('Edit mode is on. Open Links and tap a card to manage it.');
      } else {
        setSelectedItemId(null);
        setSettingsMessage(null);
      }
      return next;
    });
  };

  const nudgeSerpentine = (delta: number) => {
    sounds.playClick();
    setSerpentineStepCommand({ delta });
  };

  const routeButtons = (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        onClick={() => updateRouteMode('auto')}
        className={`rounded-[0.95rem] border px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] ${
          bootstrap.routeMode === 'auto' ? 'border-black/25 bg-amber-100 text-black/80' : 'border-black/10 bg-white/72 text-black/58'
        }`}
      >
        Auto
      </button>
      <button
        type="button"
        onClick={() => updateRouteMode(bootstrap.routeMode === 'home' ? 'auto' : 'home')}
        className={`rounded-[0.95rem] border px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] ${
          bootstrap.routeMode === 'home' ? 'border-black/25 bg-lime-200/92 text-black/80' : 'border-black/10 bg-white/72 text-black/58'
        }`}
      >
        <span className="mr-1">
          <FontAwesomeIcon icon={faHouse} />
        </span>
        Home
      </button>
      <button
        type="button"
        onClick={() => updateRouteMode(bootstrap.routeMode === 'away' ? 'auto' : 'away')}
        className={`rounded-[0.95rem] border px-3 py-2 text-[0.7rem] font-black uppercase tracking-[0.16em] ${
          bootstrap.routeMode === 'away' ? 'border-black/25 bg-sky-200/92 text-black/80' : 'border-black/10 bg-white/72 text-black/58'
        }`}
      >
        <span className="mr-1">
          <FontAwesomeIcon icon={faPersonWalking} />
        </span>
        Away
      </button>
    </div>
  );

  const servicesPanel = (
    <section className={panelClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Services</div>
          <h2 className="mt-1 text-[1.25rem] font-black tracking-[-0.03em] text-black/88">Fridge services strip</h2>
          <div className="mt-1 text-[0.84rem] font-medium text-black/58">Open a service or send container actions from one chunk instead of mixing it into the link rail.</div>
        </div>
        <div className="rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-black/55">
          {bootstrap.services.length} total
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-[1rem] border border-black/10 bg-lime-100/80 px-3 py-2">
          <div className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-black/50">Running</div>
          <div className="mt-1 text-[1.1rem] font-black text-black/82">{runningServices}</div>
        </div>
        <div className="rounded-[1rem] border border-black/10 bg-sky-100/80 px-3 py-2">
          <div className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-black/50">Reachable</div>
          <div className="mt-1 text-[1.1rem] font-black text-black/82">{serviceLinks}</div>
        </div>
        <div className="rounded-[1rem] border border-black/10 bg-amber-100/80 px-3 py-2">
          <div className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-black/50">Degraded</div>
          <div className="mt-1 text-[1.1rem] font-black text-black/82">{degradedServices}</div>
        </div>
      </div>
      {charlieMapsService ? (
        <CharlieMapsSpotlight service={charlieMapsService} onAction={serviceAction} onHover={sounds.playHover} onOpen={openService} />
      ) : null}
      <div className="mt-3 overflow-hidden rounded-[1.2rem] border border-black/10 bg-white/55 p-2">
        <FridgeServiceGrid services={bootstrap.services} onAction={serviceAction} onHover={sounds.playHover} onOpen={openService} />
      </div>
    </section>
  );

  const linksPanel = (
    <section className={panelClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Links</div>
          <h2 className="mt-1 text-[1.25rem] font-black tracking-[-0.03em] text-black/88">Serpentine rail</h2>
          <div className="mt-1 text-[0.84rem] font-medium text-black/58">Use the buttons below if swipe feels awkward on the phone. The rail should read like a track, not a stack.</div>
        </div>
        <div className="rounded-full border border-black/10 bg-black/[0.04] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.14em] text-black/55">
          {items.length} links
        </div>
      </div>
      <div className="mt-2 h-[56vh] min-h-[420px] max-h-[680px] sm:mt-3 sm:h-[54vh] sm:min-h-[440px] sm:max-h-[660px]">
        <SerpentineViewport
          items={items}
          editMode={editMode}
          localClicks={localClicks.clicks}
          selectedItemId={selectedItemId}
          onDelete={(item) => runSettingsAction(() => deleteItem(item), 'Could not delete link.')}
          onHover={sounds.playHover}
          onMoveDown={(item) => runSettingsAction(() => moveItem(item, 'down'), 'Could not move link down.')}
          onMoveUp={(item) => runSettingsAction(() => moveItem(item, 'up'), 'Could not move link up.')}
          onOpen={openItem}
          onSelect={(item) => setSelectedItemId(item.type === 'link' ? item.id : null)}
          stepCommand={serpentineStepCommand}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => nudgeSerpentine(-1)}
          className="rounded-[0.9rem] border-2 border-black/15 bg-white/84 px-3 py-2.5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-black/72 sm:rounded-[1rem] sm:px-4 sm:py-3 sm:text-[0.78rem]"
        >
          <FontAwesomeIcon icon={faChevronLeft} className="mr-2" />
          Prev
        </button>
        <button
          type="button"
          onClick={() => nudgeSerpentine(1)}
          className="rounded-[0.9rem] border-2 border-black/15 bg-lime-200/88 px-3 py-2.5 text-[0.72rem] font-black uppercase tracking-[0.16em] text-black/78 sm:rounded-[1rem] sm:px-4 sm:py-3 sm:text-[0.78rem]"
        >
          Next
          <FontAwesomeIcon icon={faChevronRight} className="ml-2" />
        </button>
      </div>
      <div className="mt-2 rounded-[0.9rem] border border-black/10 bg-black/[0.035] px-2.5 py-2 text-[0.72rem] font-medium text-black/58 sm:rounded-[1rem] sm:px-3 sm:text-[0.78rem]">
        {editMode ? 'Edit mode is on. Tap a link card to select it, then switch to Settings for icon changes.' : 'Swipe left/right or use Prev and Next to walk the serpentine.'}
      </div>
    </section>
  );

  const statsPanel = (
    <section className={panelClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Stats</div>
          <h2 className="mt-1 text-[1.25rem] font-black tracking-[-0.03em] text-black/88">Dashboard telemetry</h2>
          <div className="mt-1 text-[0.84rem] font-medium text-black/58">Everything analytics-related lives here instead of trailing after the homepage content.</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {primaryStats.map((stat, index) => (
          <StatCard
            key={stat.id}
            stat={stat}
            toneClassName={STAT_TONES[index % STAT_TONES.length]}
            feedback={statFeedback.feedback[stat.id]}
            onHover={sounds.playHover}
            onRate={(value) => {
              sounds.playClick();
              statFeedback.rate(stat.id, value);
            }}
          />
        ))}
      </div>
      <div className="mt-4 text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/42">More Stats</div>
      <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
        {secondaryStats.map((stat, index) => (
          <StatCard
            key={stat.id}
            stat={stat}
            toneClassName={STAT_TONES[(index + 2) % STAT_TONES.length]}
            feedback={statFeedback.feedback[stat.id]}
            onHover={sounds.playHover}
            onRate={(value) => {
              sounds.playClick();
              statFeedback.rate(stat.id, value);
            }}
          />
        ))}
      </div>
      {deployedStatFunctions.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/42">Deployed Stat Functions</div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {deployedStatFunctions.map((entry, index) => (
              <RotatingFunctionCard
                key={entry.id}
                label={entry.label}
                value={entry.compute()}
                detail={entry.name}
                toneClassName={STAT_TONES[(index + 4) % STAT_TONES.length]}
                onHover={sounds.playHover}
                onRemove={() => {
                  sounds.playClick();
                  statFunctionDeploy.undeploy(entry.id);
                  setSettingsMessage(`Removed ${entry.name} from the rotation.`);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
      <div className="mt-4">
        <div className="mb-2 text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/42">Pending Stat Functions</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {pendingStatFunctions.map((entry, index) => (
            <PendingFunctionCard
              key={entry.id}
              label={entry.label}
              value={entry.compute()}
              detail={entry.name}
              toneClassName={STAT_TONES[(index + 1) % STAT_TONES.length]}
              onHover={sounds.playHover}
              onDeploy={() => deployPendingStat(entry.id, entry.name)}
            />
          ))}
        </div>
        {pendingStatFunctions.length === 0 ? <div className="mt-3 text-sm font-medium text-black/55">No pending stat functions left to deploy.</div> : null}
      </div>
    </section>
  );

  const settingsPanel = (
    <section className={panelClassName}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Settings</div>
          <h2 className="mt-1 text-[1.25rem] font-black tracking-[-0.03em] text-black/88">Controls and link editing</h2>
          <div className="mt-1 text-[0.84rem] font-medium text-black/58">Routing, edit mode, icon switching, and adding new links now live in one place.</div>
        </div>
        <button
          type="button"
          onClick={toggleEditMode}
          className={`rounded-full border-2 px-4 py-2 text-[0.72rem] font-black uppercase tracking-[0.14em] ${
            editMode ? 'border-black/25 bg-lime-200/92 text-black/78' : 'border-black/12 bg-white/78 text-black/62'
          }`}
        >
          {editMode ? 'Editing' : 'Enable Edit'}
        </button>
      </div>
      <div className="mt-3 rounded-[1.15rem] border border-black/10 bg-black/[0.035] p-3">
        <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-black/45">Route Mode</div>
        <div className="mt-1 text-[0.86rem] font-semibold text-black/78">{routeModeLabel}</div>
        <div className="mt-3">{routeButtons}</div>
      </div>
      <div className="mt-3 rounded-[1.15rem] border border-black/10 bg-black/[0.035] p-3">
        <div className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-black/45">Selected Link</div>
        {selectedItem && selectedItem.type === 'link' ? (
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[0.96rem] font-semibold text-black/85">{selectedItem.title}</div>
              <div className="text-[0.76rem] font-medium text-black/55">Icon source: {ICON_MODE_LABEL[selectedItem.iconMode]}</div>
            </div>
            <button
              type="button"
              onClick={() => runSettingsAction(cycleSelectedItemIconMode, 'Could not switch icon source.')}
              className="shrink-0 rounded-full border-2 border-black/15 bg-lime-200/90 px-3 py-2 text-[0.72rem] font-black uppercase tracking-[0.12em] text-black/75"
            >
              Switch Icon
            </button>
          </div>
        ) : (
          <div className="mt-2 text-[0.82rem] font-medium text-black/55">
            {editMode ? 'No link selected. Open the Links section and tap a card to target it.' : 'Turn on edit mode to select, reorder, or delete links.'}
          </div>
        )}
        {editMode ? (
          <button
            type="button"
            onClick={() => navigateSection('links')}
            className="mt-3 rounded-full border border-black/15 bg-white/78 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.14em] text-black/60 md:hidden"
          >
            Go To Links
          </button>
        ) : null}
      </div>
      <form
        className="mt-3 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          addLink().catch((error) => {
            console.error('link create failed', error);
            setSettingsMessage('Could not add link.');
          });
        }}
      >
        <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Add Link</div>
        <input
          value={newLinkTitle}
          onChange={(event) => setNewLinkTitle(event.target.value)}
          placeholder="Name"
          className="w-full rounded-[0.95rem] border border-black/15 bg-white/88 px-3 py-2 text-[0.92rem] font-medium text-black/80 outline-none placeholder:text-black/35 focus:border-black/30"
        />
        <input
          value={newLinkUrl}
          onChange={(event) => setNewLinkUrl(event.target.value)}
          placeholder="URL"
          className="w-full rounded-[0.95rem] border border-black/15 bg-white/88 px-3 py-2 text-[0.92rem] font-medium text-black/80 outline-none placeholder:text-black/35 focus:border-black/30"
        />
        <button
          type="submit"
          className="w-full rounded-[0.95rem] border-2 border-black/15 bg-lime-200/90 px-3 py-2 text-[0.74rem] font-black uppercase tracking-[0.14em] text-black/75"
        >
          Add Link
        </button>
      </form>
      {settingsMessage ? (
        <div className="mt-3 rounded-[1rem] border border-black/10 bg-white/70 px-3 py-2 text-[0.78rem] font-medium text-black/60">{settingsMessage}</div>
      ) : null}
    </section>
  );

  const mobileSectionContent =
    mobileSection === 'services' ? servicesPanel : mobileSection === 'links' ? linksPanel : mobileSection === 'stats' ? statsPanel : settingsPanel;

  return (
    <main
      className="relative min-h-screen overflow-x-hidden px-3 py-3 text-zinc-950 md:px-5 md:py-5"
      style={{
        backgroundColor: '#f6f6f2',
        backgroundImage: [
          'radial-gradient(circle at 1px 1px, rgba(24,24,27,0.12) 1.1px, transparent 0)',
          'linear-gradient(135deg, rgba(24,24,27,0.035) 0, rgba(24,24,27,0.035) 16px, transparent 16px, transparent 32px)',
          'linear-gradient(180deg, rgba(255,255,255,0.7), rgba(244,244,240,0.9))'
        ].join(', '),
        backgroundSize: '18px 18px, 44px 44px, 100% 100%',
        touchAction: 'pan-y pinch-zoom'
      }}
    >
      <PagePixelField />
      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-20 bg-black/25 md:hidden" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute right-3 top-3 w-[min(20rem,calc(100vw-1.5rem))] rounded-[1.4rem] border-2 border-black/15 bg-white/92 p-3 shadow-[0_24px_48px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Sections</div>
              <button type="button" onClick={toggleMobileMenu} className="rounded-full border border-black/10 bg-white/85 px-3 py-2 text-sm text-black/70">
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {MOBILE_SECTION_OPTIONS.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => navigateSection(section.id)}
                  className={`flex items-center justify-between rounded-[1rem] border px-3 py-3 text-left ${
                    section.id === mobileSection ? 'border-black/20 bg-lime-100/90' : 'border-black/10 bg-white/80'
                  }`}
                >
                  <span className="text-[0.82rem] font-black uppercase tracking-[0.16em] text-black/72">
                    <FontAwesomeIcon icon={section.icon} className="mr-2" />
                    {section.label}
                  </span>
                  <span className="text-[0.74rem] font-medium text-black/48">{section.id === mobileSection ? 'Open' : 'Go'}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1508px] flex-col gap-2.5 md:min-h-[calc(100vh-2.5rem)] md:gap-4">
        <header className="rounded-[1.25rem] border-2 border-black/15 bg-white/72 px-3 py-2.5 shadow-[0_16px_28px_rgba(15,23,42,0.06)] backdrop-blur-md sm:rounded-[1.5rem] sm:px-4 sm:py-3 sm:shadow-[0_18px_36px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[0.68rem] font-black uppercase tracking-[0.22em] text-black/45">Fridge Dashboard</div>
              <div className="mt-1 text-[1.16rem] font-black tracking-[-0.04em] text-black/88 md:text-[1.7rem]">{activeMobileSection.label}</div>
              <div className="mt-1 text-[0.74rem] font-medium text-black/58 sm:text-[0.84rem]">
                {accessMode.label} access via {accessMode.detail} • {routeModeLabel} • {formatClock(clockNow)}
              </div>
            </div>
            <button type="button" onClick={toggleMobileMenu} className="rounded-full border-2 border-black/15 bg-white/85 px-3.5 py-2.5 text-sm text-black/72 md:hidden">
              <FontAwesomeIcon icon={faBars} />
            </button>
          </div>
          <div className="mt-3 hidden flex-wrap gap-2 md:flex">
            {MOBILE_SECTION_OPTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => navigateSection(section.id)}
                className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.16em] ${
                  section.id === mobileSection ? 'border-black/20 bg-lime-100/90 text-black/78' : 'border-black/10 bg-white/70 text-black/58'
                }`}
              >
                <FontAwesomeIcon icon={section.icon} className="mr-2" />
                {section.label}
              </button>
            ))}
          </div>
        </header>

        <div className="md:hidden">{mobileSectionContent}</div>

        <div className="hidden md:grid md:grid-cols-1 md:gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="space-y-4">
            {servicesPanel}
            {linksPanel}
            {statsPanel}
          </div>
          <div className="space-y-4">{settingsPanel}</div>
        </div>
      </div>
    </main>
  );
}
