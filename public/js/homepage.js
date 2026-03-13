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
  const HEADER_BLOCK_ID = 'pinned';
  const HISTORY_KEY = 'nodehome-history-v1';
  const CONTROL_MODE_KEY = 'nodehome-controls-visible-v1';

  const bootstrapEl = document.getElementById('homepage-bootstrap');
  const bootstrap = bootstrapEl ? JSON.parse(bootstrapEl.textContent || '{}') : {};
  const allLinks = Array.isArray(bootstrap.links) ? bootstrap.links : [];

  shared.writeJson(LINKS_BACKUP_KEY, { savedAt: Date.now(), links: allLinks });

  const greetingEl = shared.qs('#greeting-name');
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
  let showHidden = false;

  const blocks = () => shared.qsa('.bookmark-grid .card-block[data-block-id]');
  const visibleBlocksForSlither = () => {
    const controlsOn = !document.body.classList.contains('controls-hidden');
    return blocks().filter((block) => {
      const id = String(block.dataset.blockId || '');
      if (id !== 'deleted') return true;
      return controlsOn;
    });
  };
  const cards = () => shared.qsa('.bookmark-grid .bookmark-card[data-item-id]');
  const cardsInBlock = (blockId) => {
    const block = shared.qs('.card-block[data-block-id="' + CSS.escape(blockId) + '"]', cardListRoot);
    return block ? shared.qsa('.bookmark-card[data-item-id]', block) : [];
  };
  const isPinned = (card) => card.dataset.pinned === '1';
  const itemId = (card) => String(card?.dataset?.itemId || '').trim();
  const isLanHostname = (hostname) => {
    const host = String(hostname || '').toLowerCase();
    return host === 'fridge.local' || host.endsWith('.fridge.local');
  };
  const isPrivateIp = (hostname) => {
    const host = String(hostname || '').trim();
    return /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
      || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
  };
  const hostnameFromUrl = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    try {
      return String(new URL(value, window.location.origin).hostname || '').toLowerCase();
    } catch {
      return value.split('/')[0].split(':')[0].trim().toLowerCase();
    }
  };
  const resolveAwayHref = (rawHref) => {
    const href = String(rawHref || '').trim();
    if (!href || href.startsWith('/')) return href;
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

  const applyHiddenState = () => {
    cards().forEach((card) => {
      const id = itemId(card);
      const hidden = Boolean(hiddenMap[id]) && !isPinned(card);
      card.classList.toggle('is-hidden-item', hidden && !showHidden);
      card.classList.toggle('is-shown-hidden', false);
    });
  };

  const applyDeletedSectionState = () => {
    const deletedBlock = shared.qs('.card-block[data-block-id="deleted"]', cardListRoot);
    if (!deletedBlock) return;
    const controlsOn = !document.body.classList.contains('controls-hidden');
    showHidden = controlsOn;
    cards().forEach((card) => {
      const id = itemId(card);
      if (!id || isPinned(card) || id === 'system:add-link') return;
      const hidden = Boolean(hiddenMap[id]);
      if (hidden) {
        if (controlsOn) {
          deletedBlock.appendChild(card);
        } else {
          card.classList.add('is-hidden-item');
        }
      }
    });
  };

  const normalizeBlockOrder = (available) => {
    const source = Array.isArray(blockOrder) && blockOrder.length ? blockOrder.slice() : available.slice();
    for (const id of available) if (!source.includes(id)) source.push(id);
    const unique = source.filter((id, idx, arr) => available.includes(id) && arr.indexOf(id) === idx);
    if (!available.includes(HEADER_BLOCK_ID)) return unique;
    return [HEADER_BLOCK_ID, ...unique.filter((id) => id !== HEADER_BLOCK_ID)];
  };

  const animateBlockLayout = (beforeRects) => {
    blocks().forEach((block) => {
      const id = String(block.dataset.blockId || '');
      if (!id) return;
      const before = beforeRects.get(id);
      if (!before) return;
      const after = block.getBoundingClientRect();
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      block.animate([
        { transform: `translate(${dx}px, ${dy}px)` },
        { transform: 'translate(0, 0)' }
      ], {
        duration: 320,
        easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)'
      });
    });
  };

  const toSnakeDisplayOrder = (orderedIds) => {
    if (!orderedIds.length) return orderedIds;
    const byId = new Map();
    orderedIds.forEach((id) => {
      const el = shared.qs('.card-block[data-block-id="' + CSS.escape(id) + '"]', cardListRoot);
      if (el) byId.set(id, el);
    });
    if (byId.size < 2) return orderedIds;

    // First pass in logical order so CSS columns determine current column breaks.
    orderedIds.forEach((id) => {
      const el = byId.get(id);
      if (el) cardListRoot.appendChild(el);
    });

    const columns = [];
    const threshold = 2;
    orderedIds.forEach((id) => {
      const el = byId.get(id);
      if (!el) return;
      const left = Math.round(el.getBoundingClientRect().left);
      let col = columns.find((c) => Math.abs(c.left - left) <= threshold);
      if (!col) {
        col = { left, ids: [] };
        columns.push(col);
      }
      col.ids.push(id);
    });
    columns.sort((a, b) => a.left - b.left);
    if (columns.length < 2) return orderedIds;

    const snake = [];
    columns.forEach((col, idx) => {
      if (idx % 2 === 1) {
        snake.push(...col.ids.slice().reverse());
      } else {
        snake.push(...col.ids);
      }
    });
    return snake;
  };

  const applyOrder = () => {
    // Preserve dashboard style/layout; only behavior is serpentine wheel slither.
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
        if (idx <= 1) return;
        const prev = blockOrder[idx - 1];
        blockOrder[idx - 1] = blockOrder[idx];
        blockOrder[idx] = prev;
        applyOrder({ animate: true });
      });

      down.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = blockOrder.indexOf(id);
        if (idx < 0 || idx >= blockOrder.length - 1) return;
        if (id === HEADER_BLOCK_ID) return;
        const next = blockOrder[idx + 1];
        blockOrder[idx + 1] = blockOrder[idx];
        blockOrder[idx] = next;
        applyOrder({ animate: true });
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
    const href = resolveAwayHref(card?.dataset?.href);
    if (!href) return;
    bumpRank(itemId(card));
    pushHistory(card);
    window.location.assign(href);
  };

  const setControlsVisible = (visible) => {
    document.body.classList.toggle('controls-hidden', !visible);
    localStorage.setItem(CONTROL_MODE_KEY, visible ? '1' : '0');
    applyDeletedSectionState();
    applyHiddenState();
  };

  const controlsVisible = localStorage.getItem(CONTROL_MODE_KEY) === '1';
  setControlsVisible(controlsVisible);
  window.addEventListener('dashboard:controls-mode', (event) => {
    const detail = event && event.detail ? event.detail : {};
    setControlsVisible(Boolean(detail.visible));
  });
  window.addEventListener('dashboard:profile-name', (event) => {
    const detail = event && event.detail ? event.detail : {};
    const name = shared.safeName(detail.name || '');
    writeProfile({ name });
    applyName(name);
  });

  const rotateSerpentineTokens = (direction) => {
    const blockList = visibleBlocksForSlither();
    if (blockList.length < 2) return;
    const movableBlocks = blockList.slice(1); // first section stays pinned
    if (!movableBlocks.length) return;
    const tokens = movableBlocks.flatMap((block) => shared.qsa('.bookmark-card[data-item-id]', block));
    if (tokens.length < 2) return;

    const beforeRects = new Map();
    tokens.forEach((card) => {
      const id = itemId(card);
      if (id) beforeRects.set(id, card.getBoundingClientRect());
    });

    const rotated = tokens.slice();
    if (direction > 0) {
      rotated.push(rotated.shift());
    } else {
      rotated.unshift(rotated.pop());
    }

    // Reflow cards in strict flat order across movable blocks to mirror serpentine token rotation.
    let cursor = 0;
    movableBlocks.forEach((block) => {
      const slotCount = shared.qsa('.bookmark-card[data-item-id]', block).length;
      const nextSlice = rotated.slice(cursor, cursor + slotCount);
      cursor += slotCount;
      nextSlice.forEach((card) => block.appendChild(card));
    });

    requestAnimationFrame(() => {
      const viewportJump = Math.max(window.innerHeight * 0.58, 240);
      const overshoot = direction > 0 ? -9 : 9;
      cards().forEach((card) => {
        const id = itemId(card);
        const before = beforeRects.get(id);
        if (!before) return;
        const after = card.getBoundingClientRect();
        let fromY = before.top - after.top;
        if (Math.abs(before.left - after.left) > 10) {
          fromY = direction > 0 ? viewportJump : -viewportJump;
        }
        if (Math.abs(fromY) < 1) return;
        card.animate([
          { transform: `translateY(${fromY}px)` },
          { transform: `translateY(${overshoot}px)`, offset: 0.84 },
          { transform: 'translateY(0)', offset: 1 }
        ], {
          duration: 540,
          easing: 'cubic-bezier(0.2, 0.9, 0.15, 1)'
        });
      });
    });
  };

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => applyOrder(), 120);
  });

  let lastWheelCycleAt = 0;
  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select')) return;
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(delta) < 0.5) return;
    event.preventDefault();
    const now = Date.now();
    if (now - lastWheelCycleAt < 45) return;
    lastWheelCycleAt = now;
    const direction = delta > 0 ? 1 : -1;
    rotateSerpentineTokens(direction);
    applyHiddenState();
  }, { passive: false });

  const movableCards = () => cards().filter((card) => !isPinned(card) && itemId(card) !== 'system:add-link' && !itemId(card).startsWith('block:'));
  let draggedCard = null;
  const clearDragTargets = () => cards().forEach((c) => c.classList.remove('drag-target'));
  const allowedDrop = (targetBlock, sourceBlock) => {
    if (!targetBlock || !sourceBlock) return false;
    const controlsOn = !document.body.classList.contains('controls-hidden');
    const sourceId = String(sourceBlock.dataset.blockId || '');
    const targetId = String(targetBlock.dataset.blockId || '');
    if (sourceId === targetId) return true;
    if (!controlsOn) return false;
    if (targetId === 'deleted' || targetId === 'pinned') return true;
    return false;
  };

  const installDragReorder = () => {
    movableCards().forEach((card) => {
      if (card.dataset.dragInit === '1') return;
      card.dataset.dragInit = '1';
      card.draggable = true;
      card.addEventListener('dragstart', (event) => {
        draggedCard = card;
        card.classList.add('is-dragging');
        try { event.dataTransfer.effectAllowed = 'move'; } catch {}
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('is-dragging');
        draggedCard = null;
        clearDragTargets();
      });
    });

    cards().forEach((card) => {
      if (card.dataset.dropInit === '1') return;
      card.dataset.dropInit = '1';
      card.addEventListener('dragover', (event) => {
        if (!draggedCard || draggedCard === card) return;
        const sourceBlock = draggedCard.closest('.card-block');
        const targetBlock = card.closest('.card-block');
        if (!allowedDrop(targetBlock, sourceBlock)) return;
        event.preventDefault();
        card.classList.add('drag-target');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-target'));
      card.addEventListener('drop', (event) => {
        if (!draggedCard || draggedCard === card) return;
        const sourceBlock = draggedCard.closest('.card-block');
        const targetBlock = card.closest('.card-block');
        if (!allowedDrop(targetBlock, sourceBlock)) return;
        event.preventDefault();
        targetBlock.insertBefore(draggedCard, card);
        const id = itemId(draggedCard);
        const targetId = String(targetBlock?.dataset?.blockId || '');
        if (id) {
          if (targetId === 'deleted') hiddenMap[id] = 1;
          else delete hiddenMap[id];
          shared.writeJson(HIDDEN_ITEMS_KEY, hiddenMap);
        }
        applyDeletedSectionState();
        applyHiddenState();
        clearDragTargets();
      });
    });

    blocks().forEach((block) => {
      if (block.dataset.dropInit === '1') return;
      block.dataset.dropInit = '1';
      block.addEventListener('dragover', (event) => {
        if (!draggedCard) return;
        const sourceBlock = draggedCard.closest('.card-block');
        if (!allowedDrop(block, sourceBlock)) return;
        event.preventDefault();
      });
      block.addEventListener('drop', (event) => {
        if (!draggedCard) return;
        const sourceBlock = draggedCard.closest('.card-block');
        if (!allowedDrop(block, sourceBlock)) return;
        event.preventDefault();
        block.appendChild(draggedCard);
        const id = itemId(draggedCard);
        const targetId = String(block?.dataset?.blockId || '');
        if (id) {
          if (targetId === 'deleted') hiddenMap[id] = 1;
          else delete hiddenMap[id];
          shared.writeJson(HIDDEN_ITEMS_KEY, hiddenMap);
        }
        applyDeletedSectionState();
        applyHiddenState();
      });
    });
  };

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
    const pageHost = hostnameFromUrl(pageUrl || key);

    if (!pageUrl || pageHost === 'localhost' || isLanHostname(pageHost) || isPrivateIp(pageHost)) {
      img.style.display = 'none';
      if (emoji) emoji.style.display = 'inline-flex';
      return;
    }

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
      installDragReorder();
      applyDeletedSectionState();
    } catch {}
  };

  installHideButtons();
  installDragReorder();
  applyOrder();
  applyDeletedSectionState();

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
