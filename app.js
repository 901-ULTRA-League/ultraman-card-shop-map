(() => {
  const API_URL = 'https://api.ultraman-cardgame.com/api/v1/us/shops';
  const API_PROXY = `https://corsproxy.io/?${encodeURIComponent(API_URL)}`;

  const els = {
    status: document.getElementById('status'),
    search: document.getElementById('searchInput'),
    region: document.getElementById('regionSelect'),
    state: document.getElementById('stateSelect'),
    sort: document.getElementById('sortSelect'),
    reset: document.getElementById('resetBtn'),
    list: document.getElementById('shopList'),
    stats: document.getElementById('stats'),
    template: document.getElementById('shopTemplate'),
    toast: document.getElementById('toast'),
  };

  const state = {
    shops: [],
    filtered: [],
    map: null,
    mapMarkers: null,
  };

  function setStatus(message, type = 'info') {
    els.status.textContent = message;
    els.status.style.color = type === 'error' ? '#ff9b9b' : '#a0a7b8';
  }

  async function fetchWithFallback() {
    const sources = [
      { url: API_URL, label: 'direct' },
      { url: API_PROXY, label: 'proxy' },
    ];

    let lastError;
    for (const source of sources) {
      try {
        const res = await fetch(source.url, { mode: 'cors', cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setStatus(`Loaded shops (${source.label})`);
        return json;
      } catch (err) {
        lastError = err;
        console.warn(`Shop fetch failed via ${source.label}`, err);
      }
    }
    throw lastError || new Error('Could not load shops');
  }

  function normalize(shop) {
    return {
      id: shop.id,
      region: shop.area_name || 'Unknown region',
      state: shop.subarea || 'Unknown state',
      name: shop.name ? shop.name.trim() : 'Unnamed shop',
      address: shop.address || 'Address not provided',
      mapUrl: shop.map_url || '',
      phone: shop.telephone_number || '',
    };
  }

  const stateCoords = {
    Connecticut: [41.6, -72.7],
    Florida: [27.7, -81.5],
    Indiana: [39.8, -86.1],
    Michigan: [43, -84.5],
    'New Jersey': [40.1, -74.7],
    'New York': [42.9, -75.5],
    Ohio: [40.3, -82.7],
    Pennsylvania: [41, -77.8],
    'Rhode Island': [41.7, -71.5],
    Virginia: [37.7, -78.5],
    Arkansas: [34.8, -92.2],
    Illinois: [40, -89],
    'Kentucky (West)': [37.7, -87.1],
    Minnesota: [46.1, -94.3],
    Mississippi: [33, -89.9],
    Missouri: [38.5, -92.6],
    Texas: [31.5, -99.8],
    Wisconsin: [44.5, -89.5],
    Arizona: [34.2, -111.7],
    Idaho: [44.1, -114.5],
    'South Dakota (West)': [44.4, -103.8],
    Utah: [39.4, -111.5],
    California: [36.8, -119.4],
    Nevada: [39.3, -116.6],
    Oregon: [43.9, -120.6],
    Washington: [47.4, -121.8],
    Alaska: [64.2, -150],
  };

  const regionCoords = {
    'America-Eastern': [40.3, -77],
    'America-Central': [38, -95],
    'America-Mountain': [39, -111],
    'America-Pacific': [37, -120],
    'America-Alaska': [64.2, -150],
  };

  function getCoords(shop) {
    return stateCoords[shop.state] || regionCoords[shop.region] || [39.5, -98.35];
  }

  function ensureMap() {
    if (typeof L === 'undefined') return null;
    if (!state.map) {
      state.map = L.map('map', { zoomControl: true, attributionControl: false }).setView([39.5, -98.35], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(state.map);
      state.mapMarkers = L.featureGroup().addTo(state.map);
    }
    return state.map;
  }

  function setMapMarkers(list) {
    const map = ensureMap();
    if (!map || !state.mapMarkers) return;

    state.mapMarkers.clearLayers();

    list.forEach((shop) => {
      const coords = getCoords(shop);
      const popup = `<strong>${shop.name}</strong><br>${shop.address}<br>${shop.state}<br>` +
        (shop.mapUrl ? `<a href="${shop.mapUrl}" target="_blank" rel="noopener">Open map</a>` : '');
      const marker = L.marker(coords).bindPopup(popup);
      state.mapMarkers.addLayer(marker);
    });

    if (state.mapMarkers.getLayers().length) {
      map.fitBounds(state.mapMarkers.getBounds().pad(0.4));
    } else {
      map.setView([39.5, -98.35], 4);
    }
  }

  function renderFilters() {
    const regions = Array.from(new Set(state.shops.map((s) => s.region))).sort();
    const states = Array.from(new Set(state.shops.map((s) => s.state))).sort();

    els.region.innerHTML = '<option value="all">All regions</option>' +
      regions.map((r) => `<option value="${r}">${r}</option>`).join('');

    els.state.innerHTML = '<option value="all">All states</option>' +
      states.map((s) => `<option value="${s}">${s}</option>`).join('');
  }

  function renderStats(list) {
    const regionTotals = list.reduce((acc, shop) => {
      acc[shop.region] = (acc[shop.region] || 0) + 1;
      return acc;
    }, {});

    els.stats.innerHTML = '';

    const totalStat = document.createElement('div');
    totalStat.className = 'stat';
    totalStat.innerHTML = `<strong>${list.length}</strong><span>shops shown</span>`;
    els.stats.appendChild(totalStat);

    Object.entries(regionTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([region, count]) => {
        const node = document.createElement('div');
        node.className = 'stat';
        node.innerHTML = `<strong>${count}</strong><span>${region}</span>`;
        els.stats.appendChild(node);
      });
  }

  function renderList(list) {
    els.list.innerHTML = '';

    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No shops match your filters yet.';
      els.list.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach((shop) => {
      const node = els.template.content.firstElementChild.cloneNode(true);
      node.querySelector('.region').textContent = shop.region;
      node.querySelector('.name').textContent = shop.name;
      node.querySelector('.state').textContent = shop.state;
      node.querySelector('.pill').textContent = shop.state;
      node.querySelector('.pill').dataset.state = shop.state;
      node.querySelector('.address').textContent = shop.address;

      const phoneNode = node.querySelector('.phone');
      if (shop.phone) {
        const tel = shop.phone.replace(/[^\d+]/g, '');
        phoneNode.innerHTML = `<a href="tel:${tel}">${shop.phone}</a>`;
      } else {
        phoneNode.textContent = 'Phone unavailable';
      }

      const mapLink = node.querySelector('.map-link');
      if (shop.mapUrl) {
        mapLink.href = shop.mapUrl;
        mapLink.setAttribute('rel', 'noopener noreferrer');
        mapLink.textContent = 'Open map';
      } else {
        mapLink.textContent = 'Map unavailable';
        mapLink.classList.add('button--ghost');
        mapLink.removeAttribute('href');
      }

      const copyBtn = node.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => copyAddress(shop.address));

      fragment.appendChild(node);
    });

    els.list.appendChild(fragment);
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    setTimeout(() => els.toast.classList.remove('show'), 1600);
  }

  async function copyAddress(address) {
    try {
      await navigator.clipboard.writeText(address);
      showToast('Address copied');
    } catch (err) {
      console.error('Copy failed', err);
      showToast('Copy not available');
    }
  }

  function applyFilters() {
    const search = els.search.value.trim().toLowerCase();
    const region = els.region.value;
    const stateFilter = els.state.value;
    const sort = els.sort.value;

    let list = state.shops.slice();

    if (region !== 'all') {
      list = list.filter((shop) => shop.region === region);
    }

    if (stateFilter !== 'all') {
      list = list.filter((shop) => shop.state === stateFilter);
    }

    if (search) {
      list = list.filter((shop) => {
        const blob = `${shop.name} ${shop.state} ${shop.address}`.toLowerCase();
        return blob.includes(search);
      });
    }

    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name),
      state: (a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name),
      region: (a, b) => a.region.localeCompare(b.region) || a.name.localeCompare(b.name),
      recent: (a, b) => b.id - a.id,
    };

    list.sort(sorters[sort] || sorters.name);

    state.filtered = list;
    renderStats(list);
    renderList(list);
    setMapMarkers(list);
    setStatus(`${list.length} shops shown`);
  }

  async function loadShops() {
    setStatus('Loading shops...');
    try {
      const payload = await fetchWithFallback();
      const list = Array.isArray(payload?.data?.shopList) ? payload.data.shopList : [];

      state.shops = list.map(normalize);
      renderFilters();
      applyFilters();
    } catch (err) {
      console.error(err);
      setStatus('Could not load shops. Please refresh.', 'error');
      els.list.innerHTML = '<div class="empty">Could not reach the ULTRAMAN shops API.</div>';
    }
  }

  function bindControls() {
    els.search.addEventListener('input', applyFilters);
    els.region.addEventListener('change', applyFilters);
    els.state.addEventListener('change', applyFilters);
    els.sort.addEventListener('change', applyFilters);
    els.reset.addEventListener('click', () => {
      els.search.value = '';
      els.region.value = 'all';
      els.state.value = 'all';
      els.sort.value = 'name';
      applyFilters();
    });
  }

  bindControls();
  loadShops();
})();
