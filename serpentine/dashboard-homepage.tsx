import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type LinkEntry = { name: string; link: string; shortcut?: string; destination?: string };
type ManagedState = { id: string; name: string; description: string; location: string; openUrl: string; state: string; detail: string };
type ExternalService = { id: string; name: string; description: string; location: string; openUrl: string };
type Boot = {
  homepageBaseUrl: string;
  serviceMessage: string;
  links: LinkEntry[];
  curatedLinks: Array<{ name: string; link: string; description?: string }>;
  managedStates: ManagedState[];
  externalServices: ExternalService[];
  dockerProjects: string[];
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
  kind?: 'hero' | 'add' | 'snakelet';
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

const computeColumnOrder = (containerWidth: number, columnWidth = 295, gap = 12) => {
  const usable = Math.max(containerWidth, columnWidth);
  const totalCols = Math.max(1, Math.floor((usable + gap) / (columnWidth + gap)));
  const left = Math.floor((totalCols - 1) / 2);
  const right = totalCols - 1 - left;
  const order: number[] = [];
  for (let i = -left; i <= right; i += 1) order.push(i);
  return order;
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

function buildSections(boot: Boot): Section[] {
  const today = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return [
    {
      id: 'pinned',
      title: 'Pinned',
      description: 'header, home, settings, serpentine, quick link, motd',
      cards: [
        { id: 'pinned:hero', sectionId: 'pinned', name: readName(), subtitle: `Today is ${today}.`, kind: 'hero' },
        { id: 'pinned:snakelet', sectionId: 'pinned', name: 'SNAKELET LAB', subtitle: 'Open snakelet test workspace', href: '/snakelet', kind: 'snakelet' },
        { id: 'pinned:fridge-home', sectionId: 'pinned', name: 'fridge.local', subtitle: 'open homepage root', href: `${boot.homepageBaseUrl}/` },
        { id: 'pinned:settings', sectionId: 'pinned', name: 'Settings', subtitle: 'profile + hostname manager', href: '/settings' },
        { id: 'pinned:serpentine', sectionId: 'pinned', name: 'Serpentine List', subtitle: 'sectioned snake layout demo', href: '/serpentine' },
        { id: 'system:add-link', sectionId: 'pinned', name: 'Add quick link', subtitle: 'add a new card quickly', kind: 'add' },
        { id: 'system:motd', sectionId: 'pinned', name: 'MBTA', subtitle: 'tap to open tracker', href: '/?go=trains' }
      ]
    },
    {
      id: 'links',
      title: 'Links',
      description: 'ordered by click frequency',
      cards: [
        ...boot.links.map((entry) => {
          const raw = String(entry.destination || entry.link || '').trim();
          const href = entry.shortcut ? `/${encodeURIComponent(entry.shortcut)}` : safeUrl(raw);
          return { id: `link:${String(entry.name || '').toLowerCase()}`, sectionId: 'links', name: entry.name, subtitle: raw, href } as Card;
        }),
        ...boot.curatedLinks.map((entry) => ({ id: `curated:${String(entry.name || '').toLowerCase()}`, sectionId: 'links', name: entry.name, subtitle: entry.description || '', href: safeUrl(entry.link) }))
      ]
    },
    {
      id: 'services',
      title: 'Fridge Services',
      description: 'project and service links',
      cards: [
        ...boot.managedStates.map((s) => ({ id: `service:${s.id}`, sectionId: 'services', name: s.name, subtitle: s.description, href: safeUrl(s.openUrl), location: s.location, state: s.state, detail: s.detail })),
        ...boot.externalServices.map((s) => ({ id: `external:${s.id}`, sectionId: 'services', name: s.name, subtitle: s.description, href: safeUrl(s.openUrl), location: s.location, state: 'running', detail: 'Always on' }))
      ]
    },
    {
      id: 'folders',
      title: 'Project Folders',
      description: 'docker workspace directories',
      cards: boot.dockerProjects.map((f) => ({ id: `folder:${String(f).toLowerCase()}`, sectionId: 'folders', name: `📁 ${f}`, subtitle: 'docker project folder', location: `/home/fridge/docker/${f}`, href: `${boot.homepageBaseUrl}/?go=notes&id=tech:docker_projects` }))
    }
  ];
}

function DashboardHomepage({ boot }: { boot: Boot }) {
  const [sections, setSections] = useState<Section[]>(() => buildSections(boot));
  const rootRef = useRef<HTMLElement | null>(null);
  const lastWheelAt = useRef(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [containerW, setContainerW] = useState(960);
  const prevRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const pendingWheelDirRef = useRef<1 | -1>(1);
  const wrappedTokenIdsRef = useRef<Set<string>>(new Set());
  const [flowTick, setFlowTick] = useState(0);

  useLayoutEffect(() => {
    type WheelToken = { kind: 'leader'; leaderSectionId: string } | { kind: 'card'; cardId: string };

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
      wrappedTokenIdsRef.current = new Set();
      prevRectsRef.current = new Map();
      const root = rootRef.current;
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((node) => {
          const id = String(node.dataset.flowId || '').trim();
          if (!id) return;
          prevRectsRef.current.set(id, node.getBoundingClientRect());
        });
      }
      setFlowTick((tick) => tick + 1);

      setSections((prev) => {
        if (prev.length < 2) return prev;

        const cardsById = new Map(prev.flatMap((s) => s.cards).map((c) => [c.id, c] as const));
        const leadersBySectionId = new Map(prev.map((s) => [s.id, { title: s.title, description: s.description }] as const));

        const flat: WheelToken[] = [];
        for (const section of prev) {
          flat.push({ kind: 'leader', leaderSectionId: section.id });
          for (const card of section.cards) flat.push({ kind: 'card', cardId: card.id });
        }
        if (flat.length <= 1) return prev;

        const pinnedCount = 1 + prev[0].cards.length;
        const pinned = flat.slice(0, pinnedCount);
        const rest = flat.slice(pinnedCount);
        if (rest.length < 2) return prev;

        const rotated = rest.slice();
        if (d > 0) {
          const wrapped = rotated.shift() as WheelToken;
          rotated.push(wrapped);
          wrappedTokenIdsRef.current = new Set([
            wrapped.kind === 'leader' ? `section:${wrapped.leaderSectionId}` : `card:${wrapped.cardId}`
          ]);
        } else {
          const wrapped = rotated.pop() as WheelToken;
          rotated.unshift(wrapped);
          wrappedTokenIdsRef.current = new Set([
            wrapped.kind === 'leader' ? `section:${wrapped.leaderSectionId}` : `card:${wrapped.cardId}`
          ]);
        }

        const merged = [...pinned, ...rotated];
        let cursor = 0;
        const next = prev.map((section, index) => {
          const slotCount = 1 + section.cards.length;
          const slice = merged.slice(cursor, cursor + slotCount);
          cursor += slotCount;

          let leader = leadersBySectionId.get(section.id) || { title: section.title, description: section.description };
          if (index > 0) {
            const movedLeader = slice.find((t) => t.kind === 'leader') as Extract<WheelToken, { kind: 'leader' }> | undefined;
            if (movedLeader) leader = leadersBySectionId.get(movedLeader.leaderSectionId) || leader;
          }

          const cards = slice
            .filter((t): t is Extract<WheelToken, { kind: 'card' }> => t.kind === 'card')
            .map((t) => cardsById.get(t.cardId))
            .filter(Boolean)
            .map((c) => ({ ...(c as Card), sectionId: section.id }));

          return { ...section, title: leader.title, description: leader.description, cards };
        });

        return next;
      });
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as EventListener);
  }, []);

  useLayoutEffect(() => {
    if (!flowTick) return;
    const before = prevRectsRef.current;
    if (!before.size) return;
    const root = rootRef.current;
    if (!root) return;
    const wrapped = wrappedTokenIdsRef.current;
    const scrollDir = pendingWheelDirRef.current;
    const overshoot = scrollDir > 0 ? -8 : 8;

    root.querySelectorAll<HTMLElement>('[data-flow-id]').forEach((node) => {
      const id = String(node.dataset.flowId || '').trim();
      const beforeRect = before.get(id);
      if (!beforeRect) return;
      const after = node.getBoundingClientRect();
      let fromX = beforeRect.left - after.left;
      let fromY = beforeRect.top - after.top;
      const crossedColumn = Math.abs(beforeRect.left - after.left) > 12;
      const wrappedWithinColumn = !crossedColumn && Math.abs(fromY) > after.height * 1.6;
      const lockToast = wrapped.has(id);

      if (crossedColumn || wrappedWithinColumn || lockToast) {
        const col = Number(node.dataset.flowCol || '0');
        const flowDir = col % 2 === 0 ? -1 : 1;
        fromX = 0;
        fromY = (after.height + 22) * flowDir;
      }
      if (Math.abs(fromX) < 1 && Math.abs(fromY) < 1) return;
      node.animate(
        [
          { transform: `translate(${fromX}px, ${fromY}px)` },
          { transform: `translate(0, ${overshoot}px)`, offset: 0.84 },
          { transform: 'translate(0, 0)', offset: 1 }
        ],
        {
          duration: 540,
          easing: 'cubic-bezier(0.2, 0.9, 0.15, 1)'
        }
      );
    });

    prevRectsRef.current = new Map();
    wrappedTokenIdsRef.current = new Set();
  }, [flowTick, sections]);

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

  const serpentineColumns = useMemo(() => {
    const tokens: RenderToken[] = [];
    sections.forEach((section) => {
      tokens.push({ kind: 'section', section });
      section.cards.forEach((card) => tokens.push({ kind: 'card', sectionId: section.id, card }));
    });
    const order = computeColumnOrder(containerW, 295, 12);
    const colCount = Math.max(1, order.length);
    const rowsPerCol = Math.max(1, Math.ceil(tokens.length / colCount));
    const chunked = Array.from({ length: colCount }, (_, colPos) => {
      const start = colPos * rowsPerCol;
      const colTokens = tokens.slice(start, start + rowsPerCol);
      return colPos % 2 === 1 ? colTokens.reverse() : colTokens;
    });
    return chunked;
  }, [containerW, sections]);

  const onCardClick = (card: Card) => {
    const href = resolveAwayHref(card.href);
    if (!href) return;
    window.location.assign(href);
  };

  return (
    <>
      {boot.repoUrl ? <a className="version-badge" href={boot.repoUrl} target="_blank" rel="noopener noreferrer">v{boot.appVersion}</a> : null}
      <main className="page" ref={rootRef as React.RefObject<HTMLElement>}>
        <section className="stack-layout">
          <section className="bookmark-grid" ref={gridRef} style={{ columnWidth: 'auto', columnGap: 0, display: 'flex', gap: '0.7rem', alignItems: 'flex-start', overflowX: 'auto', overflowY: 'hidden' }}>
            {serpentineColumns.map((column, idx) => (
              <section className="card-block" data-block-id={`column:${idx}`} key={`col:${idx}`} style={{ display: 'grid', width: '295px', minWidth: '295px', gap: '0.58rem', margin: 0 }}>
                {column.map((token) => {
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
                      <article key={card.id} className="bookmark-card hero hero-card" data-item-id={card.id} data-pinned="1" data-flow-id={`card:${card.id}`} data-flow-col={idx} role="region" style={{ margin: 0 }}>
                        <div className="bookmark-content">
                          <h1><span id="greeting-name">{card.name}</span></h1>
                          <p className="subtitle">{card.subtitle}</p>
                          <p className="subtitle">Links, tools, and query redirects for local services.</p>
                          {boot.serviceMessage ? <p className="service-message">{boot.serviceMessage}</p> : null}
                        </div>
                      </article>
                    );
                  }
                  if (card.kind === 'add') {
                    return (
                      <article key={card.id} className="bookmark-card add-card" data-item-id={card.id} data-flow-id={`card:${card.id}`} data-flow-col={idx} role="group" style={{ margin: 0 }}>
                        <div className="bookmark-content">
                          <h2>Add quick link</h2>
                          <form method="POST" action="/add-link" className="add-form" data-no-card-nav>
                            <label><span>Name</span><input type="text" name="name" placeholder="Site label" required /></label>
                            <label><span>URL</span><input type="text" name="link" placeholder="example.com or https://" required /></label>
                            <button type="submit" aria-label="Save link">💾</button>
                          </form>
                        </div>
                      </article>
                    );
                  }
                  if (card.kind === 'snakelet') {
                    return (
                      <article
                        key={card.id}
                        className="bookmark-card hero"
                        data-item-id={card.id}
                        data-flow-id={`card:${card.id}`}
                        data-flow-col={idx}
                        role="link"
                        tabIndex={0}
                        onClick={() => onCardClick(card)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(card); } }}
                        style={{ cursor: 'pointer', background: 'linear-gradient(135deg,#111827,#0b7288 56%,#34c5dd)', color: '#fff', margin: 0 }}
                        aria-label="Open Snakelet lab"
                      >
                        <div className="bookmark-content">
                          <h1 style={{ margin: '0 0 0.2rem', fontSize: 'clamp(1.1rem,4.8vw,1.7rem)', letterSpacing: '0.06em' }}>{card.name}</h1>
                          <p className="subtitle" style={{ color: '#dbeafe' }}>{card.subtitle}</p>
                          <p className="subtitle" style={{ color: '#bfdbfe' }}>serpentine prototype launcher</p>
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
