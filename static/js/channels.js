const mainEl = document.querySelector('main');

function formatNumber(v) {
    if (v == null) return '–';
    const s = String(v).replace(/[^\d.-]/g, '');
    const num = Number(s);
    if (Number.isNaN(num)) return v;

    const opts = Number.isInteger(num) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 0, maximumFractionDigits: 2 };
    return num.toLocaleString('en-US', opts);
}

function createCard(channel) {
    const article = document.createElement('article');
    article.classList.add('channel-card');
    article.dataset.title = channel.title || '';

    const thumbUrl = channel.thumbnails?.medium?.url || channel.thumbnails?.default?.url || '';

    article.innerHTML = `
        <img class="thumb" src="${thumbUrl}" alt="${escapeHtml(channel.title || '')}">
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

    thumb?.addEventListener('click', () => {
        const url = new URL(channel.customUrl);

        url.searchParams.set('utm_source', 'channels_page');
        url.searchParams.set('utm_medium', 'thumbnail');
        url.searchParams.set('utm_timestamp', Date.now());

        window.open(url.toString(), '_blank', 'noopener,noreferrer');
    });

    return article;
}


function renderChannels(channels) {
    if (!mainEl) return;
    mainEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    channels.forEach(ch => fragment.appendChild(createCard(ch)));
    mainEl.appendChild(fragment);
}

let channelsData = []; // przechowuje oryginalne dane

function getNumeric(v) {
    if (v == null) return NaN;
    const s = String(v).replace(/[^\d.-]/g, '');
    const n = Number(s);
    return Number.isNaN(n) ? NaN : n;
}

function sortAndRender(criteria) {
    if (!channelsData || !channelsData.length) return;
    const copy = channelsData.slice();

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
            // domyślnie przywróć oryginalny porządek
            break;
    }

    renderChannels(copy);
}

function getSelectedSortCriteria() {
    const checked = document.querySelector('input[name="sort"]:checked');
    if (!checked) return null;
    if (checked.id === 'sort-title') return 'title';
    if (checked.id === 'sort-subscribers') return 'subscribers';
    if (checked.id === 'sort-videos') return 'videos';
    if (checked.id === 'sort-views') return 'views';
    return null;
}

// zamień/rozszerz loadChannels tak, żeby zapisywała channelsData
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
            // początkowy render
            renderChannels(channelsData);
            return data;
        })
        .catch(err => {
            console.error('Nie udało się wczytać channels.json', err);
            if (mainEl) mainEl.textContent = 'Błąd ładowania danych kanałów.';
            throw err;
        });
}

document.addEventListener('DOMContentLoaded', () => {
    // nasłuch na zmiany radio
    document.querySelectorAll('input[name="sort"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const crit = getSelectedSortCriteria();
            sortAndRender(crit);
        });
    });

    // przycisk Clear — odznacza i przywraca oryginalny porządek
    const clearBtn = document.querySelector('.sort .button');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.querySelectorAll('input[name="sort"]').forEach(r => r.checked = false);
            renderChannels(channelsData);
        });
    }

    // auto-load (jeśli nie masz już innego auto-loada)
    if (mainEl && channelsData.length === 0) {
        loadChannels().catch(()=>{});
    }
});

// utility
function shorten(text, max) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max).trim() + '…' : text;
}
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// expose helper functions for later manipulation (filter, sort etc.)
window.channelsApp = {
    loadChannels,
    renderChannels,
    createCard,
    formatNumber
};

// auto-load on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    if (mainEl) loadChannels().catch(() => {});
});