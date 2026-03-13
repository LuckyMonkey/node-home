import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { computeColumnOrder, computeLayout, type Token as SerpentineToken } from './SerpentineSectionList';

type LinkEntry = { name: string; link: string; shortcut?: string; destination?: string };
type Boot = {
  homepageBaseUrl: string;
  serviceMessage: string;
  links: LinkEntry[];
  appVersion: string;
  repoUrl: string;
};

type Card = {
  id: string;
  sectionId: string;
  name: string;
  subtitle: string;
  href?: string;
  location?: string;
  state?: string;
  detail?: string;
  kind?: 'hero';
};

type Section = { id: string; title: string; description: string; cards: Card[] };
type RenderToken =
  | { kind: 'section'; section: Section }
  | { kind: 'card'; sectionId: string; card: Card };

const isLanHostname = (hostname: string) => {
  const host = String(hostname || '').toLowerCase();
  return host === 'fridge.local' || host.endsWith('.fridge.local');
};

const isPrivateIp = (hostname: string) => {
  const host = String(hostname || '').trim();
  return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
};

const shouldPreferHttp = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value || value.startsWith('/')) return false;
  const hostish = value.split('/')[0].trim();
  const host = hostish.split(':')[0].trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.local') || isLanHostname(host) || isPrivateIp(host)) return true;
  return hostish.includes(':');
};

const safeUrl = (raw: string) => {
  const value = String(raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${shouldPreferHttp(value) ? 'http' : 'https'}://${value}`;
};

const emojiForName = (name: string, hint = '') => {
  const n = `${String(name || '').toLowerCase()} ${String(hint || '').toLowerCase()}`;
  if (n.includes('train') || n.includes('mbta')) return '🚆';
  if (n.includes('printer')) return '🖨️';
  if (n.includes('chat') || n.includes('slack') || n.includes('discord')) return '💬';
  if (n.includes('wiki') || n.includes('note') || n.includes('docs')) return '📒';
  if (n.includes('photo') || n.includes('image') || n.includes('gallery')) return '🖼️';
  if (n.includes('home') || n.includes('fridge')) return '🏠';
  if (n.includes('folder') || n.includes('docker') || n.includes('repo')) return '📁';
  if (n.includes('mail') || n.includes('gmail')) return '✉️';
  if (n.includes('calendar')) return '📅';
  if (n.includes('youtube') || n.includes('video')) return '📺';
  if (n.includes('github') || n.includes('gitlab')) return '🐙';
  if (n.includes('music') || n.includes('spotify')) return '🎵';
  if (n.includes('maps') || n.includes('map')) return '🗺️';
  if (n.includes('camera')) return '📷';
  if (n.includes('server') || n.includes('service')) return '🧩';
  return '🔗';
};

const iconCandidates = (urlValue: string) => {
  const fallback = '/_fridge/home-icon.png';
  try {
    const u = new URL(safeUrl(urlValue));
    return {
      domain: u.host.toLowerCase(),
      pageUrl: u.toString(),
      fallback,
      primary: `${u.protocol}//${u.host}/favicon.ico`,
      secondary: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.host)}&sz=128`,
      tertiary: `https://${u.host}/apple-touch-icon.png`
    };
  } catch {
    return { domain: '', pageUrl: '', fallback, primary: fallback, secondary: fallback, tertiary: fallback };
  }
};

function IconImg(props: { url: string; name: string }) {
  const [src, setSrc] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const c = useMemo(() => iconCandidates(props.url), [props.url]);

  useLayoutEffect(() => {
    let cancelled = false;
    if (!c.pageUrl || isLanHostname(c.domain) || c.domain === 'localhost' || isPrivateIp(c.domain)) {
      setShowEmoji(true);
      setSrc('');
      return () => { cancelled = true; };
    }

    const key = `icon-cache:${c.domain}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.src && Date.now() - Number(parsed.ts || 0) < 14 * 24 * 3600 * 1000) {
          setSrc(parsed.src);
          return;
        }
      }
    } catch {}

    const run = async () => {
      const tryList: string[] = [];
      if (c.pageUrl) {
        try {
          const found = await fetch(`/api/icon-discover?url=${encodeURIComponent(c.pageUrl)}`).then((r) => (r.ok ? r.json() : { iconUrl: '' }));
          if (found?.iconUrl) tryList.push(found.iconUrl);
        } catch {}
      }
      tryList.push(c.tertiary, c.primary, c.secondary, c.fallback);
      for (const raw of tryList) {
        const proxied = `/api/icon-proxy?url=${encodeURIComponent(raw)}`;
        try {
          const ok = await fetch(proxied, { method: 'HEAD' }).then((r) => r.ok);
          if (!ok) continue;
          if (!cancelled) {
            setSrc(proxied);
            try { localStorage.setItem(key, JSON.stringify({ src: proxied, ts: Date.now() })); } catch {}
          }
          return;
        } catch {}
      }
      if (!cancelled) setShowEmoji(true);
    };
    run();
    return () => { cancelled = true; };
  }, [c.domain, c.fallback, c.pageUrl, c.primary, c.secondary, c.tertiary]);

  if (!src || showEmoji) {
    return <span className="icon-emoji" style={{ display: 'inline-flex' }} aria-hidden="true">{emojiForName(props.name, props.url)}</span>;
  }
  return <img src={src} alt={`${props.name} icon`} loading="lazy" width={48} height={48} onError={() => setShowEmoji(true)} />;
}

const readName = () => {
  try {
    const raw = localStorage.getItem('nodehome-profile-v1');
    if (!raw) return 'YOU';
    return String(JSON.parse(raw)?.name || 'YOU').trim() || 'YOU';
  } catch { return 'YOU'; }
};

const flowIdForToken = (token: RenderToken) => (
  token.kind === 'section'
    ? `section:${token.section.id}`
    : `card:${token.card.id}`
);

const asSerpentineToken = (token: RenderToken): SerpentineToken => (
  token.kind === 'section'
    ? { kind: 'sectionHeader', sectionId: token.section.id }
    : { kind: 'item', itemId: token.card.id, sectionId: token.sectionId }
);

const columnFlowDir = (colPos: number) => (colPos % 2 === 0 ? -1 : 1);

const GREETING_VARIANTS = [
  (name: string) => `Still up, ${name}?`,
  (name: string) => `Night owl hours, ${name}.`,
  (name: string) => `Easy there, ${name}.`,
  (name: string) => `Quiet night, ${name}.`,
  (name: string) => `Early start, ${name}.`,
  (name: string) => `Good morning, ${name}.`,
  (name: string) => `Morning, ${name}. Ready when you are.`,
  (name: string) => `Rise and shine, ${name}.`,
  (name: string) => `Hope you're well this morning, ${name}.`,
  (name: string) => `Hey ${name}, how is it?`,
  (name: string) => `Good morning, ${name}. Let's make it count.`,
  (name: string) => `Almost noon, ${name}.`,
  (name: string) => `Good afternoon, ${name}.`,
  (name: string) => `Hope your afternoon's going smoothly, ${name}.`,
  (name: string) => `Hey ${name}, hope you're well.`,
  (name: string) => `Afternoon check-in, ${name}.`,
  (name: string) => `Good evening, ${name}.`,
  (name: string) => `Hope the day treated you well, ${name}.`,
  (name: string) => `Easy evening, ${name}.`,
  (name: string) => `Hope you're winding down well, ${name}.`
] as const;

const GREETING_INDEX_BY_HOUR = [
  0, 1, 2, 3,
  4, 5, 6, 7, 8, 9, 10, 11,
  12, 13, 14, 15,
  16, 17, 18, 19,
  16, 17, 18, 19
] as const;

const SLITHER_ANIMATION_MS = 760;
const RAIL_CAR_ANIMATION_MS = 760;

const buildLeaderGreeting = (name: string, now: Date) => {
  const safeName = String(name || 'YOU').trim() || 'YOU';
  const hour = now.getHours();
  const greetingIndex = GREETING_INDEX_BY_HOUR[hour] ?? 5;
  return GREETING_VARIANTS[greetingIndex](safeName);
};

const buildLeaderSubtitle = (now: Date) => now.toLocaleString(undefined, {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  hour: 'numeric'
});

const buildRailCarKeyframes = (fromX: number, fromY: number, cardHeight: number) => {
  const lift = -Math.max(74, Math.round(cardHeight * 1.28));
  const settleDip = Math.max(10, Math.round(cardHeight * 0.2));
  const bank = fromX < 0 ? -1.2 : 1.2;
  return [
    { transform: `translate(${fromX}px, ${fromY}px) rotate(${bank * -0.45}deg)` },
    { transform: `translate(${fromX * 0.96}px, ${lift * 0.46}px) rotate(${bank * -0.95}deg)`, offset: 0.16 },
    { transform: `translate(${fromX * 0.74}px, ${lift}px) rotate(${bank * -1.35}deg)`, offset: 0.36 },
    { transform: `translate(${fromX * 0.34}px, ${lift * 0.9}px) rotate(${bank * -0.42}deg)`, offset: 0.7 },
    { transform: `translate(${fromX * 0.08}px, ${settleDip}px) rotate(${bank * 0.22}deg)`, offset: 0.9 },
    { transform: 'translate(0, 0) rotate(0deg)', offset: 1 }
  ];
};

function buildSections(boot: Boot, profileName: string, now: Date): Section[] {
  return [
    {
      id: 'pinned',
      title: 'Pinned',
      description: 'leader, home, settings, motd',
      cards: [
        { id: 'pinned:hero', sectionId: 'pinned', name: buildLeaderGreeting(profileName, now), subtitle: buildLeaderSubtitle(now), kind: 'hero' },
        { id: 'pinned:fridge-home', sectionId: 'pinned', name: 'fridge.local', subtitle: 'open homepage root', href: `${boot.homepageBaseUrl}/` },
        { id: 'pinned:settings', sectionId: 'pinned', name: 'Settings', subtitle: 'profile + hostname manager', href: '/settings' },
        { id: 'system:motd', sectionId: 'pinned', name: 'MBTA', subtitle: 'tap to open tracker', href: '/?go=trains' }
      ]
    },
    {
      id: 'links',
      title: 'Links',
      description: 'flat source from links.json',
      cards: boot.links.map((entry) => {
        const raw = String(entry.destination || entry.link || '').trim();
        const href = entry.shortcut ? `/${encodeURIComponent(entry.shortcut)}` : safeUrl(raw);
        return { id: `link:${String(entry.name || '').toLowerCase()}`, sectionId: 'links', name: entry.name, subtitle: raw, href } as Card;
      })
    }
  ];
}

function DashboardHomepage({ boot }: { boot: Boot }) {
  const [profileName, setProfileName] = useState(() => readName());
  const [now, setNow] = useState(() => new Date());
  const [slitherStep, setSlitherStep] = useState(0);
  const [isSlithering, setIsSlithering] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const lastWheelAt = useRef(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(960);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const pendingWheelDirRef = useRef<1 | -1>(1);
  const slitherResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const syncClock = () => setNow(new Date());
    const intervalId = window.setInterval(syncClock, 60 * 1000);

    const onProfileName = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string }>).detail;
      const nextName = String(detail?.name || '').trim();
      setProfileName(nextName || 'YOU');
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'nodehome-profile-v1') {
        setProfileName(readName());
      }
    };

    window.addEventListener('dashboard:profile-name', onProfileName as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.clearInterval(intervalId);
      if (slitherResetTimerRef.current !== null) {
        window.clearTimeout(slitherResetTimerRef.current);
      }
      window.removeEventListener('dashboard:profile-name', onProfileName as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const sections = useMemo(() => buildSections(boot, profileName, now), [boot, now, profileName]);

  const baseTokens = useMemo(() => {
    const tokens: RenderToken[] = [];
    sections.forEach((section) => {
      if (section.id !== 'pinned') {
        tokens.push({ kind: 'section', section });
      }
      section.cards.forEach((card) => tokens.push({ kind: 'card', sectionId: section.id, card }));
    });
    return tokens;
  }, [sections]);

  const slitheredTokens = useMemo(() => {
    if (!baseTokens.length || baseTokens.length === 1) return baseTokens;
    const k = ((slitherStep % baseTokens.length) + baseTokens.length) % baseTokens.length;
    if (k === 0) return baseTokens;
    return [...baseTokens.slice(k), ...baseTokens.slice(0, k)];
  }, [baseTokens, slitherStep]);

  const renderTokenByFlowId = useMemo(
    () => new Map(slitheredTokens.map((token) => [flowIdForToken(token), token])),
    [slitheredTokens]
  );

  const serpentineTokens = useMemo(
    () => slitheredTokens.map((token) => asSerpentineToken(token)),
    [slitheredTokens]
  );

  const rowsPerColumn = useMemo(() => {
    const colCount = Math.max(1, computeColumnOrder(containerW, 295, 12).length);
    return Math.max(1, Math.ceil(Math.max(1, serpentineTokens.length) / colCount));
  }, [containerW, serpentineTokens.length]);

  const serpentineLayout = useMemo(
    () => computeLayout({
      tokens: serpentineTokens,
      rowsPerColumn,
      containerWidth: containerW,
      columnWidth: 295,
      gap: 12,
      mode: 'promptExamples'
    }),
    [containerW, rowsPerColumn, serpentineTokens]
  );

  const edgeTokenIds = useMemo(() => {
    const first = serpentineTokens[0];
    const last = serpentineTokens[serpentineTokens.length - 1];
    const ids = [
      first ? (first.kind === 'sectionHeader' ? `section:${first.sectionId}` : `card:${first.itemId}`) : '',
      last ? (last.kind === 'sectionHeader' ? `section:${last.sectionId}` : `card:${last.itemId}`) : ''
    ].filter(Boolean);
    return new Set(ids);
  }, [serpentineTokens]);

  useLayoutEffect(() => {
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) return;
      if (ev.target instanceof Element && ev.target.closest('input, textarea, select')) return;
      const d = Math.abs(ev.deltaY) >= Math.abs(ev.deltaX) ? ev.deltaY : ev.deltaX;
      if (Math.abs(d) < 0.5) return;
      const now = Date.now();
      if (now - lastWheelAt.current < 45) return;
      lastWheelAt.current = now;
      ev.preventDefault();
      pendingWheelDirRef.current = d > 0 ? 1 : -1;
      setIsSlithering(true);
      if (slitherResetTimerRef.current !== null) {
        window.clearTimeout(slitherResetTimerRef.current);
      }
      slitherResetTimerRef.current = window.setTimeout(() => {
        setIsSlithering(false);
        slitherResetTimerRef.current = null;
      }, SLITHER_ANIMATION_MS + 80);
      prevRectsRef.current = new Map();
      const root = rootRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((node) => {
          const id = String(node.dataset.flowId || '').trim();
          if (!id) return;
          prevRectsRef.current.set(id, node.getBoundingClientRect());
        });
      }
      setSlitherStep((step) => step + (d > 0 ? 1 : -1));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      if (slitherResetTimerRef.current !== null) {
        window.clearTimeout(slitherResetTimerRef.current);
      }
      window.removeEventListener('wheel', onWheel as EventListener);
    };
  }, []);

  useLayoutEffect(() => {
    const before = prevRectsRef.current;
    if (!before.size) return;
    const root = rootRef.current;
    if (!root) return;
    const scrollDir = pendingWheelDirRef.current;
    const overshoot = scrollDir > 0 ? -10 : 10;

    root.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((node) => {
      const id = String(node.dataset.flowId || '').trim();
      const beforeRect = before.get(id);
      if (!beforeRect) return;
      const after = node.getBoundingClientRect();
      let fromX = beforeRect.left - after.left;
      let fromY = beforeRect.top - after.top;
      const crossedColumn = Math.abs(beforeRect.left - after.left) > 10;
      const wrappedWithinColumn = !crossedColumn && Math.abs(fromY) > after.height * 1.6;
      const lockToast = edgeTokenIds.has(id);

      if (crossedColumn || wrappedWithinColumn) {
        const colPos = Number(node.dataset.flowCol || '0');
        fromY = (after.height + 22) * columnFlowDir(colPos);
      }
      if (lockToast) {
        const colPos = Number(node.dataset.flowCol || '0');
        fromX = 0;
        fromY = (after.height + 22) * columnFlowDir(colPos);
      }
      if (Math.abs(fromX) < 1 && Math.abs(fromY) < 1) return;

      if (crossedColumn && !lockToast) {
        const previousZIndex = node.style.zIndex;
        node.style.zIndex = '8';
        const animation = node.animate(
          buildRailCarKeyframes(fromX, fromY, after.height),
          { duration: RAIL_CAR_ANIMATION_MS, easing: 'cubic-bezier(0.18, 0.78, 0.24, 1)' }
        );
        const resetZIndex = () => {
          node.style.zIndex = previousZIndex;
        };
        animation.addEventListener('finish', resetZIndex, { once: true });
        animation.addEventListener('cancel', resetZIndex, { once: true });
        return;
      }

      node.animate(
        [
          { transform: `translate(${fromX}px, ${fromY}px)` },
          { transform: `translate(0, ${overshoot}px)`, offset: 0.84 },
          { transform: 'translate(0, 0)', offset: 1 }
        ],
        {
          duration: 560,
          easing: 'cubic-bezier(0.2, 0.9, 0.15, 1)'
        }
      );
    });

    prevRectsRef.current = new Map();
  }, [edgeTokenIds, slitherStep]);

  useLayoutEffect(() => {
    const update = () => {
      const node = gridRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setContainerW(Math.max(rect.width, 295));
    };
    update();
    const ro = new ResizeObserver(update);
    if (gridRef.current) ro.observe(gridRef.current);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const resolveAwayHref = (rawHref?: string) => {
    const href = String(rawHref || '').trim();
    if (!href) return '';
    if (href.startsWith('/')) return href;
    try {
      const currentHost = String(window.location.hostname || '').toLowerCase();
      if (isLanHostname(currentHost)) return href;
      const parsed = new URL(href, window.location.origin);
      if (!isLanHostname(parsed.hostname)) return parsed.toString();
      parsed.protocol = window.location.protocol;
      parsed.host = window.location.host;
      return parsed.toString();
    } catch {
      return href;
    }
  };

  const onCardClick = (card: Card) => {
    const href = resolveAwayHref(card.href);
    if (!href) return;
    window.location.assign(href);
  };

  return (
    <>
      {boot.repoUrl ? <a className="version-badge" href={boot.repoUrl} target="_blank" rel="noopener noreferrer">v{boot.appVersion}</a> : null}
      <main className="page" data-slithering={isSlithering ? '1' : '0'} ref={rootRef as React.RefObject<HTMLElement>}>
        <section className="stack-layout">
          <section className="bookmark-grid" ref={gridRef} style={{ columnWidth: 'auto', columnGap: 0, display: 'flex', gap: '0.7rem', alignItems: 'flex-start', overflowX: 'auto', overflowY: 'hidden' }}>
            {serpentineLayout.columnOrder.map((columnId, idx) => (
              <section className="card-block" data-block-id={`column:${idx}`} key={`col:${columnId}`} style={{ display: 'grid', width: '295px', minWidth: '295px', gap: '0.58rem', margin: 0 }}>
                {serpentineLayout.columns[columnId].rows.flatMap((layoutToken) => {
                  if (!layoutToken) return [];
                  const token = renderTokenByFlowId.get(
                    layoutToken.kind === 'sectionHeader'
                      ? `section:${layoutToken.sectionId}`
                      : `card:${layoutToken.itemId}`
                  );
                  if (!token) return [];
                  if (token.kind === 'section') {
                    const section = token.section;
                    return (
                      <article className="bookmark-card block-title-card" data-item-id={`block:${section.id}`} data-pinned="1" data-flow-id={`section:${section.id}`} data-flow-col={idx} role="region" key={`section:${section.id}`} style={{ margin: 0 }}>
                        <div className="bookmark-content">
                          <p className="bookmark-name">{section.title}</p>
                          <p className="bookmark-url">{section.description}</p>
                        </div>
                      </article>
                    );
                  }
                  const card = token.card;
                  if (card.kind === 'hero') {
                    return (
                      <article key={card.id} className="bookmark-card hero hero-card leader-card" data-item-id={card.id} data-pinned="1" data-flow-id={`card:${card.id}`} data-flow-col={idx} role="region" style={{ margin: 0 }}>
                        <div className="bookmark-content">
                          <h1><span id="greeting-name">{card.name}</span></h1>
                          <p className="subtitle">{card.subtitle}</p>
                          <p className="subtitle">Homepage leader card.</p>
                          {boot.serviceMessage ? <p className="service-message">{boot.serviceMessage}</p> : null}
                        </div>
                      </article>
                    );
                  }
                  const clickable = Boolean(card.href);
                  return (
                    <article
                      key={card.id}
                      className="bookmark-card link-card"
                      data-item-id={card.id}
                      data-flow-id={`card:${card.id}`}
                      data-flow-col={idx}
                      role={clickable ? 'link' : 'group'}
                      tabIndex={clickable ? 0 : -1}
                      onClick={() => onCardClick(card)}
                      onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onCardClick(card); } }}
                      style={{ margin: 0 }}
                    >
                      <div className="bookmark-content">
                        <header>
                          <IconImg url={resolveAwayHref(card.href) || card.subtitle || ''} name={card.name} />
                          <div className="bookmark-meta">
                            <p className="bookmark-name">{card.name}</p>
                            <p className="bookmark-url">{card.subtitle}</p>
                            {card.location ? <p className="service-location">{card.location}</p> : null}
                            {card.state ? <p className={`service-state service-${card.state}`}>{card.state}</p> : null}
                            {card.detail ? <p className="service-detail">{card.detail}</p> : null}
                          </div>
                        </header>
                      </div>
                    </article>
                  );
                })}
              </section>
            ))}
          </section>
        </section>
      </main>
    </>
  );
}

const bootEl = document.getElementById('homepage-bootstrap');
const boot = bootEl ? (JSON.parse(bootEl.textContent || '{}') as Boot) : null;
const mount = document.getElementById('dashboard-homepage-root');
if (mount && boot) createRoot(mount).render(<DashboardHomepage boot={boot} />);
