(function () {
  const safeName = (raw, maxLen) => String(raw || '').trim().replace(/[^\w\s-]/g, '').slice(0, maxLen || 24);

  const readJson = (key, fallback) => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '');
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  window.NodeHomeShared = {
    safeName,
    readJson,
    writeJson,
    qs,
    qsa
  };
})();
