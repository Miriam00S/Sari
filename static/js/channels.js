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



    return article;
}

function renderChannels(channels) {
    if (!mainEl) return;
    mainEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    channels.forEach(ch => fragment.appendChild(createCard(ch)));
    mainEl.appendChild(fragment);
}

function loadChannels(url = './channels.json') {
    return fetch(url)
        .then(r => {
            if (!r.ok) throw new Error('Fetch error: ' + r.status);
            return r.json();
        })
        .then(data => {
            renderChannels(Array.isArray(data) ? data : (data.items || []));
            return data;
        })
        .catch(err => {
            console.error('Nie udało się wczytać channels.json', err);
            if (mainEl) mainEl.textContent = 'Błąd ładowania danych kanałów.';
            throw err;
        });
}

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