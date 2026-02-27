(function () {
  const shared = window.NodeHomeShared;
  if (!shared) return;

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

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const setMessage = (text, isError) => {
    if (!messageEl) return;
    messageEl.textContent = text || '';
    messageEl.style.color = isError ? '#991b1b' : '#334155';
  };

  const setProfileMessage = (text, isError) => {
    if (!profileMessageEl) return;
    profileMessageEl.textContent = text || '';
    profileMessageEl.style.color = isError ? '#991b1b' : '#334155';
  };

  const readProfile = () => {
    const profile = shared.readJson(PROFILE_KEY, {});
    return { name: shared.safeName(profile.name) };
  };

  const writeProfile = (next) => shared.writeJson(PROFILE_KEY, {
    name: shared.safeName(next.name),
    updatedAt: Date.now()
  });

  const renderEntries = (entries) => {
    if (!Array.isArray(entries) || entries.length === 0) {
      listEl.innerHTML = '<li class="entry"><p class="meta">No entries saved yet.</p></li>';
      return;
    }

    listEl.innerHTML = entries.map((entry) => {
      const warningHtml = entry.warning ? '<p class="warning">' + escapeHtml(entry.warning) + '</p>' : '';
      const fallbackLine = entry.fallbackTarget ? '<p class="meta"><strong>Fallback:</strong> ' + escapeHtml(entry.fallbackTarget) + '</p>' : '';
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
    }).join('');
  };

  const loadEntries = async () => {
    try {
      const response = await fetch('/api/hostnames', { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to load hostnames');
      renderEntries(await response.json());
    } catch (error) {
      setMessage(error.message || 'Unable to load hostnames', true);
    }
  };

  if (form) {
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
        if (!response.ok) throw new Error(data.error || 'Save failed');
        hostnameInput.value = '';
        fallbackInput.value = '';
        setMessage('Saved.', false);
        await loadEntries();
      } catch (error) {
        setMessage(error.message || 'Save failed', true);
      }
    });
  }

  if (listEl) {
    listEl.addEventListener('click', async (event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const id = target ? target.getAttribute('data-id') : '';
      if (!id) return;
      try {
        const response = await fetch('/api/hostnames/' + encodeURIComponent(id), { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Delete failed');
        setMessage('Deleted.', false);
        await loadEntries();
      } catch (error) {
        setMessage(error.message || 'Delete failed', true);
      }
    });
  }

  if (profileForm && profileNameInput) {
    const currentProfile = readProfile();
    profileNameInput.value = currentProfile.name || '';
    profileForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const nextName = shared.safeName(profileNameInput.value);
      const ok = writeProfile({ name: nextName });
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
