(function () {
  const shared = window.NodeHomeShared;
  if (!shared) return;

  const PROFILE_KEY = 'nodehome-profile-v1';
  const LINKS_BACKUP_KEY = 'nodehome-links-backup-v1';
  const ICON_CACHE_KEY = 'nodehome-icon-cache-v1';
  const ICON_TTL_MS = 14 * 24 * 60 * 60 * 1000;
  const CLICK_RANK_KEY = 'nodehome-click-rank-v1';
  const HIDDEN_ITEMS_KEY = 'nodehome-hidden-items-v1';
  const SHOW_HIDDEN_KEY = 'nodehome-show-hidden-v1';
  const BLOCK_ORDER_KEY = 'nodehome-block-order-v1';
  const HISTORY_KEY = 'nodehome-history-v1';
  const CONTROL_MODE_KEY = 'nodehome-controls-visible-v1';

  const bootstrapEl = document.getElementById('homepage-bootstrap');
  const bootstrap = bootstrapEl ? JSON.parse(bootstrapEl.textContent || '{}') : {};
  const allLinks = Array.isArray(bootstrap.links) ? bootstrap.links : [];

  shared.writeJson(LINKS_BACKUP_KEY, { savedAt: Date.now(), links: allLinks });

  const greetingEl = shared.qs('#greeting-name');
  const controlsToggle = shared.qs('#pageControlsToggle');
  const cardListRoot = shared.qs('.bookmark-grid');
  if (!cardListRoot) return;
  cardListRoot.setAttribute('tabindex', '0');

  const readProfile = () => {
    const profile = shared.readJson(PROFILE_KEY, {});
    return { name: shared.safeName(profile.name), updatedAt: Number(profile.updatedAt) || 0 };
  };
  const writeProfile = (next) => shared.writeJson(PROFILE_KEY, { name: shared.safeName(next.name), updatedAt: Date.now() });
  const applyName = (name) => { if (greetingEl) greetingEl.textContent = name || 'YOU'; };
  applyName(readProfile().name);

  const rankMap = shared.readJson(CLICK_RANK_KEY, {});
  const hiddenMap = shared.readJson(HIDDEN_ITEMS_KEY, {});
  const historyList = shared.readJson(HISTORY_KEY, []);
  let blockOrder = shared.readJson(BLOCK_ORDER_KEY, []);
  let showHidden = localStorage.getItem(SHOW_HIDDEN_KEY) === '1';

  const blocks = () => shared.qsa('.bookmark-grid .card-block[data-block-id]');
  const cards = () => shared.qsa('.bookmark-grid .bookmark-card[data-item-id]');
  const cardsInBlock = (blockId) => {
    const block = shared.qs('.card-block[data-block-id="' + CSS.escape(blockId) + '"]', cardListRoot);
    return block ? shared.qsa('.bookmark-card[data-item-id]', block) : [];
  };
  const isPinned = (card) => card.dataset.pinned === '1';
  const itemId = (card) => String(card?.dataset?.itemId || '').trim();

  const rankToggleBtn = document.createElement('button');
  rankToggleBtn.id = 'showHiddenToggle';
  rankToggleBtn.className = 'page-controls-toggle';
  rankToggleBtn.style.right = '46px';
  document.body.appendChild(rankToggleBtn);

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

  const applyHiddenState = () => {
    cards().forEach((card) => {
      const id = itemId(card);
      const hidden = Boolean(hiddenMap[id]) && !isPinned(card);
      card.classList.toggle('is-hidden-item', hidden && !showHidden);
      card.classList.toggle('is-shown-hidden', hidden && showHidden);
    });
  };

  const applyOrder = () => {
    const available = blocks().map((b) => b.dataset.blockId).filter(Boolean);
    if (!Array.isArray(blockOrder) || blockOrder.length === 0) blockOrder = available.slice();
    for (const id of available) if (!blockOrder.includes(id)) blockOrder.push(id);
    blockOrder = blockOrder.filter((id, idx, arr) => available.includes(id) && arr.indexOf(id) === idx);
    shared.writeJson(BLOCK_ORDER_KEY, blockOrder);

    blockOrder.forEach((id) => {
      const el = shared.qs('.card-block[data-block-id="' + CSS.escape(id) + '"]', cardListRoot);
      if (el) cardListRoot.appendChild(el);
    });

    const linkCards = cardsInBlock('links').filter((card) => !isPinned(card) && itemId(card) !== 'system:add-link');
    linkCards
      .map((card, idx) => ({ card, idx }))
      .sort((a, b) => {
        const sa = Number(rankMap[itemId(a.card)] || 0);
        const sb = Number(rankMap[itemId(b.card)] || 0);
        if (sb !== sa) return sb - sa;
        return a.idx - b.idx;
      })
      .forEach((entry) => {
        const block = shared.qs('.card-block[data-block-id="links"]', cardListRoot);
        if (block) block.appendChild(entry.card);
      });

    applyHiddenState();
  };

  const installBlockMoveButtons = () => {
    blocks().forEach((block) => {
      const titleCard = shared.qs('.block-title-card', block);
      if (!titleCard || shared.qs('.block-move-controls', titleCard)) return;
      const id = String(block.dataset.blockId || '').trim();
      if (!id) return;

      const controls = document.createElement('div');
      controls.className = 'block-move-controls admin-control';
      controls.innerHTML = '<button type="button" title="Move block up">⬆️</button><button type="button" title="Move block down">⬇️</button>';
      const [up, down] = shared.qsa('button', controls);

      up.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = blockOrder.indexOf(id);
        if (idx <= 0) return;
        const prev = blockOrder[idx - 1];
        blockOrder[idx - 1] = blockOrder[idx];
        blockOrder[idx] = prev;
        applyOrder();
      });

      down.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = blockOrder.indexOf(id);
        if (idx < 0 || idx >= blockOrder.length - 1) return;
        const next = blockOrder[idx + 1];
        blockOrder[idx + 1] = blockOrder[idx];
        blockOrder[idx] = next;
        applyOrder();
      });

      const content = shared.qs('.bookmark-content', titleCard);
      (content || titleCard).appendChild(controls);
    });
  };

  const installHideButtons = () => {
    cards().forEach((card) => {
      if (isPinned(card) || shared.qs('.hide-item-btn', card)) return;
      const wrap = document.createElement('div');
      wrap.className = 'card-hide-control admin-control';
      wrap.innerHTML = '<button type="button" class="hide-item-btn" aria-label="Hide this item" title="Hide this item">🙈</button>';
      wrap.firstElementChild.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = itemId(card);
        if (!id) return;
        hiddenMap[id] = 1;
        shared.writeJson(HIDDEN_ITEMS_KEY, hiddenMap);
        applyHiddenState();
      });
      card.appendChild(wrap);
    });
  };

  const hiddenCardsForNav = () => cards().filter((c) => Boolean(hiddenMap[itemId(c)]));
  let hiddenNavIdx = 0;
  const navHidden = (delta) => {
    const list = hiddenCardsForNav();
    if (!list.length) return;
    hiddenNavIdx = (hiddenNavIdx + delta + list.length) % list.length;
    const target = list[hiddenNavIdx];
    if (!showHidden) {
      showHidden = true;
      localStorage.setItem(SHOW_HIDDEN_KEY, '1');
      updateShowHiddenUi();
      applyHiddenState();
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  };

  const bumpRank = (id) => {
    if (!id || id.startsWith('pinned:')) return;
    rankMap[id] = Number(rankMap[id] || 0) + 1;
    shared.writeJson(CLICK_RANK_KEY, rankMap);
  };

  const pushHistory = (card) => {
    const id = itemId(card);
    const href = String(card?.dataset?.href || '').trim();
    if (!id || !href) return;
    historyList.push({ id, href, ts: Date.now() });
    while (historyList.length > 200) historyList.shift();
    shared.writeJson(HISTORY_KEY, historyList);
  };

  const activateCard = (card) => {
    const href = card?.dataset?.href;
    if (!href) return;
    bumpRank(itemId(card));
    pushHistory(card);
    window.location.assign(href);
  };

  const setControlsVisible = (visible) => {
    document.body.classList.toggle('controls-hidden', !visible);
    localStorage.setItem(CONTROL_MODE_KEY, visible ? '1' : '0');
  };

  const controlsVisible = localStorage.getItem(CONTROL_MODE_KEY) === '1';
  setControlsVisible(controlsVisible);
  if (controlsToggle) {
    controlsToggle.addEventListener('click', () => {
      setControlsVisible(document.body.classList.contains('controls-hidden'));
    });
  }

  cardListRoot.addEventListener('wheel', (event) => {
    const hasHiddenColumns = cardListRoot.scrollWidth > cardListRoot.clientWidth + 2;
    if (!hasHiddenColumns) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 0.5) return;
    event.preventDefault();
    cardListRoot.scrollLeft += delta;
  }, { passive: false });

  const updateShowHiddenUi = () => {
    rankToggleBtn.textContent = showHidden ? '🙈' : '👁️';
    rankToggleBtn.title = showHidden ? 'Hide hidden items' : 'Show hidden items';
    rankToggleBtn.setAttribute('aria-label', rankToggleBtn.title);
  };

  rankToggleBtn.addEventListener('click', () => {
    showHidden = !showHidden;
    localStorage.setItem(SHOW_HIDDEN_KEY, showHidden ? '1' : '0');
    updateShowHiddenUi();
    applyHiddenState();
  });
  hiddenNavUp.addEventListener('click', () => navHidden(-1));
  hiddenNavDown.addEventListener('click', () => navHidden(1));
  updateShowHiddenUi();

  const iconCache = shared.readJson(ICON_CACHE_KEY, {});
  const persistIconCache = () => shared.writeJson(ICON_CACHE_KEY, iconCache);
  const proxy = (url) => '/api/icon-proxy?url=' + encodeURIComponent(url);

  const averageColor = (img) => {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 24;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return '';
    ctx.drawImage(img, 0, 0, 24, 24);
    const data = ctx.getImageData(0, 0, 24, 24).data;
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 20) continue;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    if (!n) return '';
    return 'rgb(' + Math.round(r / n) + ', ' + Math.round(g / n) + ', ' + Math.round(b / n) + ')';
  };

  const loadIcon = (img) => {
    const card = img.closest('.bookmark-card');
    const emoji = card ? shared.qs('.icon-emoji', card) : null;
    const key = String(img.dataset.domain || '').toLowerCase();
    const pageUrl = String(img.dataset.pageurl || '');
    const cached = iconCache[key];
    const fresh = cached && (Date.now() - cached.updatedAt) < ICON_TTL_MS;
    if (fresh && cached.dataUrl) {
      img.src = cached.dataUrl;
      if (cached.color && card) card.style.setProperty('--icon-accent', cached.color);
      return;
    }

    const baseChain = [img.dataset.primary, img.dataset.secondary, img.dataset.tertiary, img.dataset.fallback].filter(Boolean);
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
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 48, 48);
          iconCache[key] = { dataUrl: canvas.toDataURL('image/png'), color, updatedAt: Date.now() };
          persistIconCache();
        }
      } catch {}
    };

    if (!pageUrl) {
      runChain(baseChain);
      return;
    }

    fetch('/api/icon-discover?url=' + encodeURIComponent(pageUrl))
      .then((r) => (r.ok ? r.json() : { iconUrl: '' }))
      .then((data) => {
        const discovered = String(data?.iconUrl || '').trim();
        runChain(discovered ? [discovered, ...baseChain] : baseChain);
      })
      .catch(() => runChain(baseChain));
  };

  const sound = (() => {
    const urls = { hover: ['/api/sfx/hover1', '/api/sfx/hover2'], click: '/api/sfx/select' };
    let ctx = null;
    let unlocked = false;
    const buffers = new Map();
    let hoverSource = null;
    let clickSource = null;
    let lastHoverAt = 0;

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
        const arr = await response.arrayBuffer();
        const buffer = await audioCtx.decodeAudioData(arr.slice(0));
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
      if (unlocked) return;
      unlocked = true;
      decode(urls.click);
      decode(urls.hover[0]);
      decode(urls.hover[1]);
    };

    const playBuffer = async (url, type) => {
      const audioCtx = ensureCtx();
      if (!audioCtx || audioCtx.state !== 'running') return;
      const buffer = await decode(url);
      if (!buffer) return;
      const src = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();
      src.buffer = buffer;
      gain.gain.value = type === 'click' ? 0.38 : 0.26;
      src.connect(gain);
      gain.connect(audioCtx.destination);
      if (type === 'hover' && hoverSource) { try { hoverSource.stop(); } catch {} }
      if (type === 'click' && clickSource) { try { clickSource.stop(); } catch {} }
      if (type === 'hover') hoverSource = src;
      if (type === 'click') clickSource = src;
      src.start(0);
      src.onended = () => {
        if (type === 'hover' && hoverSource === src) hoverSource = null;
        if (type === 'click' && clickSource === src) clickSource = null;
      };
    };

    return {
      init,
      playHover: () => {
        if (!unlocked) return;
        const now = Date.now();
        if (now - lastHoverAt < 90) return;
        lastHoverAt = now;
        playBuffer(Math.random() < 0.5 ? urls.hover[0] : urls.hover[1], 'hover');
      },
      playClick: () => {
        if (!unlocked) return;
        playBuffer(urls.click, 'click');
      }
    };
  })();

  const unlockSound = () => {
    sound.init();
    window.removeEventListener('pointerdown', unlockSound, true);
    window.removeEventListener('keydown', unlockSound, true);
  };
  window.addEventListener('pointerdown', unlockSound, true);
  window.addEventListener('keydown', unlockSound, true);

  document.addEventListener('pointerover', (event) => {
    const card = event.target instanceof Element ? event.target.closest('.bookmark-card[data-href]') : null;
    if (!card) return;
    sound.playHover();
  });

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    const deleteForm = target.closest('form.bookmark-delete');
    if (deleteForm) {
      event.preventDefault();
      const card = deleteForm.closest('.bookmark-card');
      const input = deleteForm.querySelector('input[name="name"]');
      const id = itemId(card);
      const name = input ? String(input.value || '').trim().toLowerCase() : '';
      const hideId = id || (name ? ('link:' + name) : '');
      if (!hideId) return;
      hiddenMap[hideId] = 1;
      shared.writeJson(HIDDEN_ITEMS_KEY, hiddenMap);
      applyHiddenState();
      return;
    }

    if (target.closest('form') || target.closest('button') || target.closest('[data-no-card-nav]')) return;
    const card = target.closest('.bookmark-card[data-href]');
    if (!card) return;
    event.preventDefault();
    sound.playClick();
    activateCard(card);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target instanceof Element ? event.target : null;
    const card = target ? target.closest('.bookmark-card[data-href]') : null;
    if (!card) return;
    if (target.closest('form') || target.closest('button') || target.closest('[data-no-card-nav]')) return;
    event.preventDefault();
    sound.playClick();
    activateCard(card);
  });

  const syncProfile = async () => {
    const current = readProfile();
    const name = shared.safeName(current.name || 'default');
    try {
      await fetch('/api/profiles/' + encodeURIComponent(name), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: shared.safeName(current.name || ''),
          linksRank: rankMap,
          hiddenItems: hiddenMap,
          blockOrder,
          history: historyList,
          linksSnapshot: allLinks
        })
      });
    } catch {}
  };

  const loadProfileState = async () => {
    const name = shared.safeName(readProfile().name || 'default');
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
      shared.writeJson(CLICK_RANK_KEY, rankMap);
      shared.writeJson(HIDDEN_ITEMS_KEY, hiddenMap);
      shared.writeJson(BLOCK_ORDER_KEY, blockOrder);
      shared.writeJson(HISTORY_KEY, historyList);
      applyOrder();
    } catch {}
  };

  installHideButtons();
  installBlockMoveButtons();
  applyOrder();

  shared.qsa('.bookmark-card img[data-primary]').forEach(loadIcon);

  const trainCard = shared.qs('#trainMOTD');
  if (trainCard) {
    fetch('/api/train-motd')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad train data'))))
      .then((data) => {
        const title = shared.qs('.train-title', trainCard);
        const leave = shared.qs('.train-leave', trainCard);
        if (title) title.textContent = data.title || 'train info unavailable';
        if (leave) leave.textContent = data.leaveText || '';
        if (data.ctaUrl) trainCard.dataset.href = data.ctaUrl;
      })
      .catch(() => {
        const title = shared.qs('.train-title', trainCard);
        const leave = shared.qs('.train-leave', trainCard);
        if (title) title.textContent = 'loading tracker summary...';
        if (leave) leave.textContent = 'tap to open tracker';
      });
  }

  loadProfileState();
  window.addEventListener('beforeunload', () => { syncProfile(); });
})();
