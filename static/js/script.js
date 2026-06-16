const mainEl = document.querySelector('main');
const filterInput = document.querySelector('.filter__input');
const suggestionsEl = document.querySelector('.filter__suggestions');

let channelsData = []; // stores original data
let displayedChannels = []; // currently displayed order

// HELPERS
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatNumber(v) {
    if (v == null) return '–';
    const s = String(v).replace(/[^\d.-]/g, '');
    const num = Number(s);
    if (Number.isNaN(num)) return v;

    const opts = Number.isInteger(num) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
    return num.toLocaleString('en-US', opts);
}

function normalizeText(s) {
  if (s == null) return '';
  return String(s)
    .toLowerCase()
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/ż/g, 'z')
    .replace(/ź/g, 'z')
    // also replace composed variants just in case
    .replace(/Ą/g, 'a')
    .replace(/Ć/g, 'c')
    .replace(/Ę/g, 'e')
    .replace(/Ł/g, 'l')
    .replace(/Ń/g, 'n')
    .replace(/Ó/g, 'o')
    .replace(/Ś/g, 's')
    .replace(/Ż/g, 'z')
    .replace(/Ź/g, 'z')
    .replace(/\s+/g, ' ')
    .trim();
}

function debounce(fn, wait = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}


function getNumeric(v) {
    if (v == null) return NaN;
    const s = String(v).replace(/[^\d.-]/g, '');
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
}

// RENDERING

function createCard(channel) {
    const article = document.createElement('article');
    article.classList.add('channel-card');
    article.dataset.title = channel.title || '';

    const placeholder = 'data:image/svg+xml;utf8,' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">' +
      '<rect fill="%23eee" width="100%" height="100%"/>' +
      '<text x="50%" y="50%" font-size="14" fill="%23999" text-anchor="middle" dominant-baseline="central">No image</text>' +
      '</svg>';

    const thumbUrl = channel.thumbnails?.medium?.url || channel.thumbnails?.default?.url || '';

    article.innerHTML = `
        <img class="thumb" src="${thumbUrl || placeholder}" loading="lazy" decoding="async" alt="${escapeHtml(channel.title || '')}">
        <div class="content">
            <h3 class="title">${escapeHtml(channel.title || '')}</h3>
            <div class="meta">
                <div class="meta__item">
                    <span class="meta_item_title">SUBSCRIBERS:</span>
                    <span class="meta_item_value">${formatNumber(channel.statistics?.subscriberCount)}</span>
                </div>
                <div class="meta__item">
                    <span class="meta_item_title">VIDEOS:</span>
                    <span class="meta_item_value">${formatNumber(channel.statistics?.videoCount)}</span>
                </div>
                <div class="meta__item">
                    <span class="meta_item_title">VIEWS:</span>
                    <span class="meta_item_value">${formatNumber(channel.statistics?.viewCount)}</span>
                </div>
            </div>
        </div>
    `;

    const thumb = article.querySelector('.thumb');

    // handle image load error -> use placeholder
    thumb?.addEventListener('error', () => {
        thumb.src = placeholder;
        thumb.classList.add('thumb--broken');
    });

    // safe open URL (when customUrl missing)
    thumb?.addEventListener('click', () => {
        const target = channel.customUrl || channel.url;
        if (!target) return;
        try {
            const url = new URL(target, window.location.href);
            url.searchParams.set('utm_source', 'channels_page');
            url.searchParams.set('utm_medium', 'thumbnail');
            url.searchParams.set('utm_timestamp', Date.now());
            window.open(url.toString(), '_blank', 'noopener,noreferrer');
        } catch (e) {
            console.warn('Invalid URL for channel:', target);
        }
    });

    return article;
}


function renderChannels(channels) {
    if (!mainEl) return;
    mainEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    channels.forEach(ch => fragment.appendChild(createCard(ch)));
    mainEl.appendChild(fragment);
    // remember current view
    displayedChannels = Array.isArray(channels) ? channels.slice() : [];
}


// SORTING 

function getSelectedSortCriteria() {
    const checked = document.querySelector('input[name="sort"]:checked');
    if (!checked) return null;
    if (checked.id === 'sort-title') return 'title';
    if (checked.id === 'sort-subscribers') return 'subscribers';
    if (checked.id === 'sort-videos') return 'videos';
    if (checked.id === 'sort-views') return 'views';
    return null;
}

function sortAndRender(criteria) {
    const base = (Array.isArray(displayedChannels) && displayedChannels.length) ? displayedChannels.slice() : (channelsData.slice ? channelsData.slice() : []);
    if (!base || !base.length) return;

    const copy = base;

    switch (criteria) {
        case 'title':
            copy.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'pl', { sensitivity: 'base' }));
            break;
        case 'subscribers':
            copy.sort((a, b) => (getNumeric(b.statistics?.subscriberCount) || 0) - (getNumeric(a.statistics?.subscriberCount) || 0));
            break;
        case 'videos':
            copy.sort((a, b) => (getNumeric(b.statistics?.videoCount) || 0) - (getNumeric(a.statistics?.videoCount) || 0));
            break;
        case 'views':
            copy.sort((a, b) => (getNumeric(b.statistics?.viewCount) || 0) - (getNumeric(a.statistics?.viewCount) || 0));
            break;
        default:
            // keep original order
            break;
    }

    renderChannels(copy);
}

// FILTERING

function updateSuggestions(query) {
  if (!suggestionsEl) return;
  const q = normalizeText(query);
  if (!q) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.setAttribute('aria-hidden', 'true');
    return;
  }
  // find up to 8 matching channel titles (by normalized title)
  const matches = (channelsData || [])
    .map(ch => ({ title: ch.title || '', ch }))
    .map(o => ({ title: o.title, norm: normalizeText(o.title), ch: o.ch }))
    .filter(o => o.norm.includes(q))
    .slice(0, 8);

  if (!matches.length) {
    suggestionsEl.innerHTML = '';
    suggestionsEl.setAttribute('aria-hidden', 'true');
    return;
  }

  suggestionsEl.innerHTML = matches.map((m, idx) => {
    // highlight matched
    return `<li role="option" data-index="${idx}" data-title="${escapeHtml(m.title)}">${escapeHtml(m.title)}</li>`;
  }).join('');
  suggestionsEl.setAttribute('aria-hidden', 'false');
}

function filterChannelsByQuery(query) {
  const q = normalizeText(query);
  const base = channelsData || [];
  if (!q) return base.slice();
  return base.filter(ch => {
    const title = normalizeText(ch.title || ch.localized?.title || '');
    return title.includes(q);
  });
}

function highlightSuggestion(index) {
    if (!suggestionsEl) return;
    const items = Array.from(suggestionsEl.querySelectorAll('li'));
    items.forEach((li, i) => {
      if (i === index) li.setAttribute('data-highlight', 'true');
      else li.removeAttribute('data-highlight');
    });
    if (index >= 0 && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
      suggestionActiveIndex = index;
    } else {
      suggestionActiveIndex = -1;
    }
  }


// input listener
if (filterInput) {
  let suggestionActiveIndex = -1;


  const onInput = debounce(() => {
    const q = filterInput.value;

    // remove any checked sort radios when user types -> treat as manual filter (no active sort)
    document.querySelectorAll('input[name="sort"]').forEach(r => r.checked = false);

    updateSuggestions(q);

    if (!q) {
      // empty query -> restore original data order
      renderChannels(channelsData);
    } else {
      const filtered = filterChannelsByQuery(q);
      renderChannels(filtered);
    }

    // reset active suggestion when user types
    highlightSuggestion(-1);
  }, 120);

  filterInput.addEventListener('input', onInput);

  // click on suggestion
  suggestionsEl?.addEventListener('click', (ev) => {
    const li = ev.target.closest('li');
    if (!li) return;
    const index = Number(li.getAttribute('data-index') || 0);
    highlightSuggestion(index);
    const title = li.getAttribute('data-title') || li.textContent;
    filterInput.value = title;
    suggestionsEl.setAttribute('aria-hidden', 'true');
    const filtered = filterChannelsByQuery(title);
    renderChannels(filtered);
  });

  // keyboard navigation works while input has focus:
  filterInput.addEventListener('keydown', (ev) => {
    if (!suggestionsEl) return;
    const visible = suggestionsEl.getAttribute('aria-hidden') === 'false';
    const items = suggestionsEl.querySelectorAll('li');

    if (ev.key === 'Escape') {
      suggestionsEl.setAttribute('aria-hidden', 'true');
      highlightSuggestion(-1);
      return;
    }

    if (!visible || items.length === 0) return;

    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      const next = suggestionActiveIndex + 1 >= items.length ? 0 : suggestionActiveIndex + 1;
      highlightSuggestion(next);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      const prev = suggestionActiveIndex - 1 < 0 ? items.length - 1 : suggestionActiveIndex - 1;
      highlightSuggestion(prev);
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      const idx = suggestionActiveIndex >= 0 ? suggestionActiveIndex : 0;
      const li = items[idx];
      if (!li) return;
      const title = li.getAttribute('data-title') || li.textContent;
      filterInput.value = title;
      suggestionsEl.setAttribute('aria-hidden', 'true');
      highlightSuggestion(-1);
      const filtered = filterChannelsByQuery(title);
      renderChannels(filtered);
    }
  });
}

// clear button - clear input filter
const clearBtn = document.querySelector('.sort .button');
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (filterInput) filterInput.value = '';
    if (suggestionsEl) suggestionsEl.setAttribute('aria-hidden', 'true');
    renderChannels(channelsData);
  });
}

// close suggestions when clicking outside (and on touch)
function closeSuggestionsIfOutside(ev) {
  if (!suggestionsEl) return;
  // already hidden -> nothing to do
  if (suggestionsEl.getAttribute('aria-hidden') === 'true') return;
  const tgt = ev.target;
  // if click/touch is inside input or suggestions, keep open
  if (filterInput.contains(tgt) || suggestionsEl.contains(tgt)) return;
  // otherwise close and reset highlight
  suggestionsEl.setAttribute('aria-hidden', 'true');
  highlightSuggestion(-1);
}

document.addEventListener('click', closeSuggestionsIfOutside);
document.addEventListener('touchstart', closeSuggestionsIfOutside);



// DATA LOADING

// loadChannels saves channelsData
function loadChannels(url = './channels.json') {
    return fetch(url)
        .then(async r => {
            if (!r.ok) {
                const body = await r.text().catch(()=>'<no body>');
                throw new Error('Fetch error: ' + r.status + ' — ' + body);
            }
            return r.json();
        })
        .then(data => {
            channelsData = Array.isArray(data) ? data : (data.items || []);
            // initial render
            renderChannels(channelsData);
            return data;
        })
        .catch(err => {
            console.error('Failed to load channels.json', err);
            if (mainEl) mainEl.textContent = 'Error loading channel data.';
            throw err;
        });
}




document.addEventListener('DOMContentLoaded', () => {
  // listen for radio changes
  document.querySelectorAll('input[name="sort"]').forEach(radio => {
      radio.addEventListener('change', () => {
          const crit = getSelectedSortCriteria();
          sortAndRender(crit);
      });
  });

  // Clear button — clear checked filters
  const clearBtn = document.querySelector('.sort .button');
  if (clearBtn) {
      clearBtn.addEventListener('click', () => {
          document.querySelectorAll('input[name="sort"]').forEach(r => r.checked = false);
          renderChannels(channelsData);
      });
  }

  // click on sort icon - reverse current rendering order
  const sortIcon = document.querySelector('.sort__icon');
  if (sortIcon) {
      sortIcon.addEventListener('click', () => {
          if (!displayedChannels || !displayedChannels.length) return;
          displayedChannels.reverse();
          renderChannels(displayedChannels);
      });
  }

  // --- Night mode toggle (persist choice in localStorage)
  function applyNightMode(enabled) {
    document.body.classList.toggle('dark', !!enabled);
    try {
      if (enabled) localStorage.setItem('nightMode', '1');
      else localStorage.removeItem('nightMode');
    } catch (e) {
      // ignore storage errors (private mode, quotas)
    }
  }

  const nightBtn = document.querySelector('.header__icon--night');
  if (nightBtn) {
    nightBtn.addEventListener('click', () => {
      applyNightMode(!document.body.classList.contains('dark'));
    });
  }

  // initialize night mode: prefer stored setting, fallback to system preference
  (function initNightMode() {
    let stored = null;
    try { stored = localStorage.getItem('nightMode'); } catch (e) { stored = null; }
    if (stored !== null) {
      applyNightMode(stored === '1');
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyNightMode(true);
    }
  })();

  // auto-load (if not loaded elsewhere)
  if (mainEl && channelsData.length === 0) {
      loadChannels().catch(()=>{});
  }

  // STORAGE

  // persist visit info: count, lastVisit and currentVisit (e.g. "29 wrz. 2020")
  function formatPolishDate(d) {
    const months = ['sty.', 'lut.', 'mar.', 'kwi.', 'maj.', 'cze.', 'lip.', 'sie.', 'wrz.', 'paź.', 'lis.', 'gru.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function setCookie(name, value, days = 3650) {
    try {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; expires=${expires}`;
    } catch (e) {}
  }
  function getCookie(name) {
    try {
      const m = document.cookie.match('(?:^|; )' + name.replace(/([.*+?^${}()|[\]\\])/g, '\\$1') + '=([^;]*)');
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }

  (function recordVisit() {
    const now = new Date();
    const nowStr = formatPolishDate(now);

    try {
      // use localStorage for visit counts / dates (but do not store raw timestamp)
      const prevCurrent = localStorage.getItem('currentVisit');
      const prevLast = localStorage.getItem('lastVisit') || prevCurrent || null;
      const count = Number(localStorage.getItem('visitCount') || '0') + 1;

      if (prevCurrent) localStorage.setItem('lastVisit', prevCurrent);
      else if (prevLast) localStorage.setItem('lastVisit', prevLast);

      localStorage.setItem('currentVisit', nowStr);
      localStorage.setItem('visitCount', String(count));
      // removed: localStorage.setItem('currentVisitTs', String(now.getTime()));
    } catch (e) {
      // fallback to cookies if localStorage unavailable
      const prevCurrent = getCookie('currentVisit');
      const prevLast = getCookie('lastVisit') || prevCurrent || null;
      const count = Number(getCookie('visitCount') || '0') + 1;

      if (prevCurrent) setCookie('lastVisit', prevCurrent);
      else if (prevLast) setCookie('lastVisit', prevLast);

      setCookie('currentVisit', nowStr);
      setCookie('visitCount', String(count));
    }
  })();
});


// expose for testing
window.channelsApp = {
    loadChannels,
    renderChannels,
    createCard,
    formatNumber
};
