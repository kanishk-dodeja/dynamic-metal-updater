export function getDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MetalSync Dashboard</title>
  <style>
    :root {
      --bg-color: #f6f6f7;
      --card-bg: #ffffff;
      --border-color: #e3e5e7;
      --text-color: #202223;
      --text-muted: #6d7175;
      --primary-color: #008060;
      --primary-hover: #006e52;
      --danger-color: #d72c0d;
      --warning-color: #ffc453;
      --success-color: #008060;
      --input-border: #8c9196;
      --input-focus: #005bd3;
      --radius: 12px;
      --shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    * { box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      margin: 0;
      padding: 0;
      line-height: 1.5;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
      font-weight: 600;
    }

    .brand span { font-size: 24px; }

    header a {
      color: var(--primary-color);
      text-decoration: none;
      font-size: 14px;
    }

    header a:hover { text-decoration: underline; }

    .card {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 24px;
      margin-bottom: 24px;
    }

    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }

    .card-description {
      font-size: 14px;
      color: var(--text-muted);
      margin: -8px 0 20px 0;
    }

    .banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 24px;
      border: 1px solid transparent;
    }

    .banner-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .banner-info { border-color: #b2d4ff; background: #f0f7ff; }
    .banner-info .banner-status { background: #005bd3; }

    .banner-success { border-color: #8ceda2; background: #f1fbf3; }
    .banner-success .banner-status { background: var(--success-color); }

    .banner-warning { border-color: #ffd68a; background: #fffaf0; }
    .banner-warning .banner-status { background: var(--warning-color); }

    .banner-danger { border-color: #fdada1; background: #fff4f2; }
    .banner-danger .banner-status { background: var(--danger-color); }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    @media (max-width: 600px) {
      .grid { grid-template-columns: 1fr; }
    }

    .form-group {
      margin-bottom: 16px;
      position: relative;
    }

    label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 8px;
    }

    input, select {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--input-border);
      border-radius: 8px;
      font-size: 14px;
      background: #fff;
      transition: border-color 0.2s;
    }

    input:focus, select:focus {
      outline: none;
      border-color: var(--input-focus);
      box-shadow: 0 0 0 2px rgba(0, 91, 211, 0.1);
    }

    input:read-only {
      background: #f1f2f3;
      cursor: not-allowed;
    }

    .input-wrapper {
      position: relative;
    }

    .input-suffix {
      position: absolute;
      right: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: 14px;
      pointer-events: none;
    }

    .input-with-button {
      display: flex;
      gap: 8px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      border: 1px solid var(--border-color);
      background: #fff;
      transition: all 0.2s;
      gap: 8px;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: var(--primary-color);
      color: #fff;
      border: none;
    }

    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }

    .btn-outline { color: var(--text-color); }
    .btn-outline:hover:not(:disabled) { background: #f6f6f7; }

    .price-display {
      display: flex;
      align-items: baseline;
      gap: 12px;
    }

    .price-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--text-color);
    }

    .price-label {
      font-size: 14px;
      color: var(--text-muted);
    }

    .toast-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
    }

    .toast {
      background: #30373e;
      color: #fff;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      margin-top: 8px;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .helper-text {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }

    .stop-loss-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 16px;
    }

    .loader {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* New CSS for Part 2 */
    .badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    .badge-success { background: #bbe5b3; color: #008060; }
    .badge-warning { background: #ffea8a; color: #8a6116; }
    .badge-danger { background: #fead9a; color: #d72c0d; }
    .badge-info { background: #b2d4ff; color: #005bd3; }

    .search-row {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
    }

    .product-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .product-item {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow: hidden;
    }

    .product-header {
      display: flex;
      align-items: center;
      padding: 12px;
      gap: 16px;
      cursor: pointer;
      background: #fafbfb;
    }

    .product-header:hover { background: #f4f6f6; }

    .product-thumb {
      width: 48px;
      height: 48px;
      border-radius: 4px;
      object-fit: cover;
      background: #eee;
    }

    .product-info { flex: 1; }
    .product-title { font-size: 14px; font-weight: 500; }
    .product-status { font-size: 12px; color: var(--text-muted); }

    .config-form {
      padding: 16px;
      border-top: 1px solid var(--border-color);
      background: #fff;
    }

    .formula-step {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 40px;
      gap: 8px;
      align-items: end;
      margin-bottom: 8px;
      padding: 8px;
      background: #f9fafb;
      border-radius: 4px;
    }

    .table-container {
      width: 100%;
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    th {
      text-align: left;
      padding: 12px;
      border-bottom: 2px solid var(--border-color);
      color: var(--text-muted);
      font-weight: 500;
    }

    td {
      padding: 12px;
      border-bottom: 1px solid var(--border-color);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <span>💎</span>
        MetalSync
      </div>
      <a href="mailto:support@metalsync.app">Support</a>
    </header>

    <div id="status-banner" class="banner banner-info">
      <div class="banner-status"></div>
      <span id="status-text">Checking system status...</span>
    </div>

    <div class="card" id="metal-prices">
      <h2 class="card-title">Live Gold Price</h2>
      <div class="price-display">
        <div class="price-value" id="gold-price">--.--</div>
        <div class="price-label" id="price-meta">Fetching latest market data...</div>
      </div>
    </div>

    <div class="card" id="settings-card">
      <h2 class="card-title">Merchant Settings</h2>
      <div class="grid">
        <div>
          <div class="form-group">
            <label for="goldApiKey">Metals.Dev API Key</label>
            <div class="input-with-button">
              <input type="password" id="goldApiKey" placeholder="Enter your key">
              <button type="button" class="btn btn-outline" id="toggleApi">Show</button>
            </div>
            <p class="helper-text">Get your free API key from <a href="https://metals.dev" target="_blank" style="color:var(--primary-color)">metals.dev</a></p>
          </div>
          <div class="form-group">
            <label for="markupPercentage">Global Markup</label>
            <div class="input-wrapper">
              <input type="number" id="markupPercentage" placeholder="0.00" step="0.01">
              <span class="input-suffix">%</span>
            </div>
          </div>
        </div>
        <div>
          <div class="form-group">
            <label for="storeCurrency">Store Currency</label>
            <input type="text" id="storeCurrency" readonly value="Detecting...">
          </div>
          <div class="form-group">
            <label for="syncFrequencyMin">Sync Frequency</label>
            <select id="syncFrequencyMin">
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 1 hour</option>
              <option value="180">Every 3 hours</option>
              <option value="360" selected>Every 6 hours</option>
              <option value="720">Every 12 hours</option>
              <option value="1440">Once per day</option>
            </select>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" id="saveSettings" style="width: 100%; margin-top: 12px;">Save Settings</button>
    </div>

    <div class="card" id="stop-loss-card">
      <h2 class="card-title">Stop-Loss Pricing</h2>
      <p class="card-description">Set minimum price per gram. If market price falls below this, the minimum is used.</p>
      
      <div class="stop-loss-grid">
        <div class="form-group">
          <label>Gold (XAU)</label>
          <div class="input-wrapper">
            <input type="number" id="stopLossXAU" placeholder="None" step="0.01">
            <span class="input-suffix currency-symbol"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Silver (XAG)</label>
          <div class="input-wrapper">
            <input type="number" id="stopLossXAG" placeholder="None" step="0.01">
            <span class="input-suffix currency-symbol"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Platinum (XPT)</label>
          <div class="input-wrapper">
            <input type="number" id="stopLossXPT" placeholder="None" step="0.01">
            <span class="input-suffix currency-symbol"></span>
          </div>
        </div>
        <div class="form-group">
          <label>Palladium (XPD)</label>
          <div class="input-wrapper">
            <input type="number" id="stopLossXPD" placeholder="None" step="0.01">
            <span class="input-suffix currency-symbol"></span>
          </div>
        </div>
      </div>
      <button class="btn btn-outline" id="saveStopLoss" style="width: 100%;">Save Stop-Loss Only</button>
    </div>

    <div class="card" id="sync-card">
      <h2 class="card-title">Quick Sync</h2>
      <button class="btn btn-outline" id="runSync" style="width: 100%; height: 52px; font-size: 16px;">🔄 Sync Prices Now</button>
      <p class="helper-text" id="sync-helper" style="text-align: center; margin-top: 12px;">Auto-sync runs based on your settings above.</p>
    </div>

    <!-- Part 2 Sections -->
    <div class="card" id="product-browser-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 class="card-title" style="margin: 0;">Product Configuration</h2>
        <span class="badge badge-info" id="product-count">0 Products</span>
      </div>
      
      <div class="search-row">
        <input type="text" id="productSearch" placeholder="Search by title..." style="flex: 2;">
        <select id="productFilter" style="flex: 1;">
          <option value="all">All Products</option>
          <option value="configured">Configured</option>
          <option value="unconfigured">Not Configured</option>
          <option value="tag:auto_price_update">Auto-Price Tag</option>
        </select>
      </div>

      <div id="bulkAction" class="banner banner-info" style="display: none; justify-content: space-between; position: sticky; top: 0; z-index: 100;">
        <span id="bulkCount">0 selected</span>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-primary btn-sm" id="configureSelectedBtn">Configure Selected</button>
          <button class="btn btn-outline btn-sm" id="clearSelection">Clear</button>
        </div>
      </div>
      
      <div id="productList" class="product-list">
        <!-- Products will be injected here -->
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">Loading products...</div>
      </div>

      <button class="btn btn-outline" id="loadMoreProducts" style="width: 100%; margin-top: 16px; display: none;">Load More</button>
    </div>

    <div class="card" id="formula-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h2 class="card-title" style="margin: 0;">Custom Pricing Formulas</h2>
        <button class="btn btn-primary btn-sm" id="addFormulaBtn">+ Create Formula</button>
      </div>
      <div id="formulaList" class="product-list">
        <!-- Formulas will be injected here -->
      </div>
    </div>

    <div id="formulaModal" class="card" style="display: none; border: 2px solid var(--primary-color);">
      <h2 class="card-title">Edit Formula</h2>
      <div class="form-group">
        <label>Formula Name</label>
        <input type="text" id="formulaName" placeholder="e.g. Standard Jewelry">
      </div>
      <div class="form-group">
        <label>Applicable Tags (comma separated)</label>
        <input type="text" id="formulaTags" placeholder="e.g. rings, gold-jewelry">
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="formulaIsDefault"> Set as Global Default</label>
      </div>
      
      <div id="formulaModeToggle" style="display: flex; gap: 8px; margin-bottom: 16px;">
        <button class="btn btn-outline btn-sm active-mode" id="modeSimple" style="flex: 1;">Simple Mode</button>
        <button class="btn btn-outline btn-sm" id="modeAdvanced" style="flex: 1;">Advanced Mode</button>
      </div>

      <div id="simpleFormulaBuilder">
        <p class="helper-text">Standard formula: Cost = (Market Price × Purity/24 × Weight) + Markup + Making Charge.</p>
        <div class="form-group">
          <label>Markup Percentage (%)</label>
          <input type="number" id="simpleMarkup" step="0.1" value="0">
        </div>
        <div class="form-group">
          <label>Base Making Charge</label>
          <input type="number" id="simpleMaking" step="0.01" value="0">
        </div>
      </div>

      <div id="advancedFormulaBuilder" style="display: none;">
        <label>Calculation Steps</label>
        <div id="formulaStepsContainer"></div>
        <button class="btn btn-outline" id="addFormulaStep" style="width: 100%; margin-top: 8px;">+ Add Step</button>
      </div>

      <div style="display: flex; gap: 12px; margin-top: 24px;">
        <button class="btn btn-primary" id="saveFormula" style="flex: 1;">Save Formula</button>
        <button class="btn btn-outline" id="cancelFormula" style="flex: 1;">Cancel</button>
      </div>
    </div>

    <div class="card" id="csv-card">
      <h2 class="card-title">Bulk Product Configuration</h2>
      <p class="card-description">Upload a CSV to configure hundreds of products at once.</p>
      <div class="grid" style="margin-bottom: 20px;">
        <button class="btn btn-outline" id="downloadTemplate" style="width: 100%;">📥 Download Template</button>
        <button class="btn btn-outline" id="exportConfig" style="width: 100%;">📋 Export Current Config</button>
      </div>
      <div class="form-group">
        <label>Import CSV File</label>
        <div class="input-with-button">
          <input type="file" id="csvFileInput" accept=".csv">
          <button class="btn btn-primary" id="uploadCsvBtn">Upload</button>
        </div>
      </div>
    </div>

    <div class="card" id="activity-card">
      <h2 class="card-title">Activity Log</h2>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody id="logList">
            <tr><td colspan="4" style="text-align: center;">Loading activity...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="toast-container" id="toastContainer"></div>

  <script>
    const state = {
      loading: false,
      currency: '',
      searchTimer: null
    };

    const productState = {
      items: [],
      nextCursor: null,
      search: '',
      filter: 'all',
      loading: false
    };

    const purityPresets = {
      XAU: [{ l: '24K (99.9%)', v: 24 }, { l: '22K (91.6%)', v: 22 }, { l: '18K (75.0%)', v: 18 }, { l: '14K (58.5%)', v: 14 }, { l: '10K (41.7%)', v: 10 }, { l: '9K (37.5%)', v: 9 }],
      XAG: [{ l: 'Fine 999', v: 999 }, { l: 'Sterling 925', v: 925 }, { l: '900 Coin', v: 900 }, { l: '800 silver', v: 800 }],
      XPT: [{ l: '999', v: 999 }, { l: '950', v: 950 }, { l: '900', v: 900 }, { l: '850', v: 850 }],
      XPD: [{ l: '999', v: 999 }, { l: '950', v: 950 }, { l: '500', v: 500 }]
    };

    function showToast(message, type = 'info') {
      const container = document.getElementById('toastContainer');
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.style.background = type === 'danger' ? 'var(--danger-color)' : (type === 'warning' ? 'var(--warning-color)' : '#30373e');
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    async function fetchData(url, options = {}) {
      try {
        const response = await fetch(url, { credentials: 'include', ...options });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Request failed');
        return data;
      } catch (err) {
        showToast(err.message, 'danger');
        return null;
      }
    }

    async function loadHealth() {
      const data = await fetchData('/api/debug/health');
      if (!data) return;
      const banner = document.getElementById('status-banner');
      const statusText = document.getElementById('status-text');
      if (data.status === 'healthy') {
        banner.className = 'banner banner-success';
        statusText.textContent = 'All systems operational';
      } else {
        banner.className = 'banner banner-warning';
        statusText.textContent = 'System degraded: Check connection settings';
      }
      if (data.checks.goldapi.status === 'healthy' && data.checks.goldapi.message) {
        const match = data.checks.goldapi.message.match(/\\$(\\d+\\.\\d+)/);
        if (match) {
          document.getElementById('gold-price').textContent = '$' + match[1];
          document.getElementById('price-meta').textContent = 'Live market price per ounce';
        }
      }
    }

    async function loadSettings() {
      const settings = await fetchData('/api/settings');
      if (!settings) return;
      state.currency = settings.storeCurrency || 'USD';
      document.getElementById('goldApiKey').value = settings.goldApiKey || '';
      document.getElementById('markupPercentage').value = settings.markupPercentage || 0;
      document.getElementById('storeCurrency').value = state.currency;
      document.getElementById('syncFrequencyMin').value = settings.syncFrequencyMin || 360;
      document.getElementById('stopLossXAU').value = settings.stopLossXAU || '';
      document.getElementById('stopLossXAG').value = settings.stopLossXAG || '';
      document.getElementById('stopLossXPT').value = settings.stopLossXPT || '';
      document.getElementById('stopLossXPD').value = settings.stopLossXPD || '';
      document.querySelectorAll('.currency-symbol').forEach(el => el.textContent = state.currency);
    }

    async function saveAllSettings(isStopLossOnly = false) {
      if (state.loading) return;
      const btn = isStopLossOnly ? document.getElementById('saveStopLoss') : document.getElementById('saveSettings');
      const originalText = btn.textContent;
      state.loading = true; btn.disabled = true;
      btn.innerHTML = '<div class="loader"></div> Saving...';
      const payload = {
        goldApiKey: document.getElementById('goldApiKey').value,
        markupPercentage: parseFloat(document.getElementById('markupPercentage').value),
        syncFrequencyMin: parseInt(document.getElementById('syncFrequencyMin').value),
        stopLossXAU: document.getElementById('stopLossXAU').value ? parseFloat(document.getElementById('stopLossXAU').value) : null,
        stopLossXAG: document.getElementById('stopLossXAG').value ? parseFloat(document.getElementById('stopLossXAG').value) : null,
        stopLossXPT: document.getElementById('stopLossXPT').value ? parseFloat(document.getElementById('stopLossXPT').value) : null,
        stopLossXPD: document.getElementById('stopLossXPD').value ? parseFloat(document.getElementById('stopLossXPD').value) : null,
      };
      const result = await fetchData('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      state.loading = false; btn.disabled = false; btn.textContent = originalText;
      if (result) { showToast('Settings saved successfully'); loadHealth(); loadSettings(); }
    }

    async function runSync() {
      if (state.loading) return;
      const btn = document.getElementById('runSync');
      state.loading = true; btn.disabled = true;
      btn.innerHTML = '<div class="loader"></div> Syncing...';
      const result = await fetchData('/api/sync', { method: 'POST' });
      state.loading = false; btn.disabled = false; btn.textContent = '🔄 Sync Prices Now';
      if (result && result.success) showToast(\`Sync complete! Updated \${result.itemsUpdated} products.\`);
      loadLogs();
    }

    // Product Functions
    async function loadProducts(isNew = true) {
      if (productState.loading) return;
      productState.loading = true;
      if (isNew) { productState.nextCursor = null; productState.items = []; document.getElementById('productList').innerHTML = '<div style="text-align: center; padding: 20px;">Loading...</div>'; }
      const params = new URLSearchParams({ limit: 25, search: productState.search, tag: productState.filter.startsWith('tag:') ? productState.filter.split(':')[1] : '' });
      if (productState.nextCursor) params.append('cursor', productState.nextCursor);
      const data = await fetchData(\`/api/products?\${params.toString()}\`);
      productState.loading = false;
      if (!data) return;
      productState.items = isNew ? data.products : [...productState.items, ...data.products];
      productState.nextCursor = data.pageInfo.hasNextPage ? data.pageInfo.endCursor : null;
      renderProducts();
      document.getElementById('loadMoreProducts').style.display = productState.nextCursor ? 'block' : 'none';
      document.getElementById('product-count').textContent = \`\${productState.items.length} Products\`;
    }

    function renderProducts() {
      const list = document.getElementById('productList');
      list.innerHTML = productState.items.map(p => {
        const isConfigured = p.metal_type?.value && p.metal_purity?.value;
        return '' +
          '<div class="product-item" id="p-' + p.id + '">' +
            '<div class="product-header">' +
              '<input type="checkbox" onclick="event.stopPropagation(); toggleSelect(\'' + p.id + '\')" id="sel-' + p.id + '" class="prod-check" ' + (selection.has(p.id) ? 'checked' : '') + ' style="width: 20px; height: 20px; margin-right: 8px;">' +
              '<div style="display: flex; align-items: center; gap: 16px; flex: 1;" onclick="toggleConfig(\'' + p.id + '\')">' +
                '<img src="' + (p.featuredImage?.url || 'https://via.placeholder.com/48') + '" class="product-thumb">' +
                '<div class="product-info">' +
                  '<div class="product-title">' + p.title + '</div>' +
                  '<div class="product-status">' +
                    (isConfigured ? '<span class="badge badge-success">✅ ' + p.metal_type.value + ' ' + p.metal_purity.value + 'K, ' + (p.weight_grams?.value || 0) + 'g</span>' : '<span class="badge badge-warning">❌ Not Configured</span>') +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<button class="btn btn-sm" onclick="toggleConfig(\'' + p.id + '\')">Edit</button>' +
            '</div>' +
            '<div class="config-form" id="form-' + p.id + '" style="display: none;">' +
              '<div class="grid">' +
                '<div class="form-group"><label>Metal Type</label><select onchange="updatePurityOptions(\'' + p.id + '\', this.value)" id="mt-' + p.id + '"><option value="XAU" ' + (p.metal_type?.value === 'XAU' ? 'selected' : '') + '>Gold (XAU)</option><option value="XAG" ' + (p.metal_type?.value === 'XAG' ? 'selected' : '') + '>Silver (XAG)</option><option value="XPT" ' + (p.metal_type?.value === 'XPT' ? 'selected' : '') + '>Platinum (XPT)</option><option value="XPD" ' + (p.metal_type?.value === 'XPD' ? 'selected' : '') + '>Palladium (XPD)</option></select></div>' +
                '<div class="form-group"><label>Purity</label><select id="mp-' + p.id + '" onchange="toggleCustomPurity(\'' + p.id + '\', this.value)">' + getPurityHtml(p.metal_type?.value || 'XAU', p.metal_purity?.value) + '</select><input type="number" id="custom-mp-' + p.id + '" style="display: none; margin-top: 8px;" placeholder="Custom value"></div>' +
                '<div class="form-group"><label>Weight (grams)</label><input type="number" step="0.01" id="mw-' + p.id + '" value="' + (p.weight_grams?.value || '') + '"></div>' +
                '<div class="form-group"><label>Making Charge</label><input type="number" step="0.01" id="mc-' + p.id + '" value="' + (p.making_charge?.value || '') + '"></div>' +
              '</div>' +
              '<div style="margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">' +
                '<label><input type="checkbox" id="at-' + p.id + '" ' + (p.tags.includes('auto_price_update') ? 'checked' : '') + '> Auto Update Price</label>' +
                '<div style="display: flex; gap: 8px;"><button class="btn btn-outline btn-sm" onclick="toggleConfig(\'' + p.id + '\')">Cancel</button><button class="btn btn-primary btn-sm" onclick="saveConfig(\'' + p.id + '\')">Save Changes</button></div>' +
              '</div>' +
            '</div>' +
          '</div>';
      }).join('');
    }

    function getPurityHtml(type, current) {
      const sets = purityPresets[type] || [];
      return sets.map(s => \`<option value="\${s.v}" \${parseFloat(current) === s.v ? 'selected' : ''}>\${s.l}</option>\`).join('') + \`<option value="custom">Custom Value...</option>\`;
    }

    function toggleConfig(id) { const form = document.getElementById('form-' + id); form.style.display = form.style.display === 'none' ? 'block' : 'none'; }
    function toggleCustomPurity(id, val) { const customInput = document.getElementById('custom-mp-' + id); customInput.style.display = val === 'custom' ? 'block' : 'none'; }
    function updatePurityOptions(id, type) { document.getElementById('mp-' + id).innerHTML = getPurityHtml(type, null); toggleCustomPurity(id, null); }

    const selection = new Set();
    function toggleSelect(id) { if (selection.has(id)) selection.delete(id); else selection.add(id); updateBulkUi(); }
    function updateBulkUi() { const bar = document.getElementById('bulkAction'); bar.style.display = selection.size > 0 ? 'flex' : 'none'; document.getElementById('bulkCount').textContent = \`\${selection.size} items selected\`; }

    async function saveConfig(id) {
      const purityVal = document.getElementById('mp-' + id).value;
      const finalPurity = purityVal === 'custom' ? parseFloat(document.getElementById('custom-mp-' + id).value) : parseFloat(purityVal);
      const payload = { productId: id, metalType: document.getElementById('mt-' + id).value, metalPurity: finalPurity, weightGrams: parseFloat(document.getElementById('mw-' + id).value), makingCharge: parseFloat(document.getElementById('mc-' + id).value || 0), addTag: document.getElementById('at-' + id).checked };
      if (isNaN(finalPurity) || isNaN(payload.weightGrams)) return showToast('Purity and weight are required', 'warning');
      const result = await fetchData('/api/products/configure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (result) { showToast('Product configured!'); loadProducts(true); }
    }

    async function configureBulk() {
      if (selection.size === 0) return;
      const metalType = prompt('Enter Metal Type (XAU, XAG, XPT, XPD)', 'XAU'); if (!metalType) return;
      const purity = prompt('Enter Purity (number)', '22'); if (!purity) return;
      const products = Array.from(selection).map(id => ({ productId: id, metalType: metalType.toUpperCase(), metalPurity: parseFloat(purity), weightGrams: 1.0, makingCharge: 0, addTag: true }));
      const result = await fetchData('/api/products/configure-bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ products }) });
      if (result) { showToast(\`Configured \${result.configured} products.\`); selection.clear(); updateBulkUi(); loadProducts(true); }
    }

    // Formula Functions
    let activeFormulaId = null;
    async function loadFormulas() {
      const formulas = await fetchData('/api/formulas'); if (!formulas) return;
      const list = document.getElementById('formulaList');
      list.innerHTML = formulas.map(f => \`
        <div class="product-item" style="padding: 12px; display: flex; justify-content: space-between; align-items: center;">
          <div><strong>\${f.name}</strong> \${f.isDefault ? '<span class="badge badge-success">Default</span>' : ''}<div style="font-size: 12px; color: var(--text-muted);">Tags: \${f.applyToTags || 'None'}</div></div>
          <div style="display: flex; gap: 8px;"><button class="btn btn-outline btn-sm" onclick="editFormula(\${JSON.stringify(f).replace(/"/g, '&quot;')})">Edit</button><button class="btn btn-outline btn-sm" style="color: var(--danger-color);" onclick="deleteFormula('\${f.id}')">Delete</button></div>
        </div>\`).join('') || '<div style="text-align: center; padding: 20px; color: var(--text-muted);">No custom formulas created.</div>';
    }

    let formulaMode = 'simple';

    function setFormulaMode(mode) {
      formulaMode = mode;
      document.getElementById('simpleFormulaBuilder').style.display = mode === 'simple' ? 'block' : 'none';
      document.getElementById('advancedFormulaBuilder').style.display = mode === 'advanced' ? 'block' : 'none';
      document.getElementById('modeSimple').classList.toggle('btn-primary', mode === 'simple');
      document.getElementById('modeAdvanced').classList.toggle('btn-primary', mode === 'advanced');
    }

    function editFormula(f = null) {
      activeFormulaId = f ? f.id : null;
      document.getElementById('formulaName').value = f ? f.name : '';
      document.getElementById('formulaTags').value = f ? f.applyToTags : '';
      document.getElementById('formulaIsDefault').checked = f ? f.isDefault : false;
      
      const container = document.getElementById('formulaStepsContainer');
      container.innerHTML = '';
      
      let config;
      try {
        config = f ? JSON.parse(f.formulaConfig) : [];
      } catch (e) { config = []; }

      // Try to determine mode based on config structure
      if (config.length > 0 && config.some(s => s.id !== 'metal_cost' && s.id !== 'making' && s.id !== 'markup' && s.id !== 'final_price')) {
        setFormulaMode('advanced');
      } else {
        setFormulaMode('simple');
        const markupStep = config.find(s => s.id === 'markup');
        const makingStep = config.find(s => s.id === 'making');
        document.getElementById('simpleMarkup').value = markupStep ? (markupStep.defaultValue || 0) : 0;
        document.getElementById('simpleMaking').value = makingStep ? (makingStep.defaultValue || 0) : 0;
      }
      
      if (config.length === 0) config = [{ id: 'metal_cost', label: 'Metal Cost', type: 'computed' }];
      config.forEach(s => addStepToUI(s));
      
      document.getElementById('formulaModal').style.display = 'block';
      document.getElementById('formula-card').style.display = 'none';
    }

    function addStepToUI(s = {}) {
      const div = document.createElement('div');
      div.className = 'formula-step';
      div.innerHTML =
        '<div>' +
          '<label style="font-size: 10px;">Label</label>' +
          '<input type="text" class="step-label" value="' + (s.label || '') + '">' +
        '</div>' +
        '<div>' +
          '<label style="font-size: 10px;">Type</label>' +
          '<select class="step-type">' +
            '<option value="computed" ' + (s.type === 'computed' ? 'selected' : '') + '>Metal Cost</option>' +
            '<option value="fixed" ' + (s.type === 'fixed' ? 'selected' : '') + '>Fixed Amount</option>' +
            '<option value="percentage" ' + (s.type === 'percentage' ? 'selected' : '') + '>Percentage</option>' +
            '<option value="sum" ' + (s.type === 'sum' ? 'selected' : '') + '>Sum</option>' +
          '</select>' +
        '</div>' +
        '<div>' +
          '<label style="font-size: 10px;">ID/Val</label>' +
          '<input type="text" class="step-id" value="' + (s.id || '') + '" placeholder="Unique ID">' +
        '</div>' +
        '<button class="btn" style="color: var(--danger-color); padding: 8px 0;" onclick="this.parentElement.remove()">×</button>';
      document.getElementById('formulaStepsContainer').appendChild(div);
    }

    async function saveFormula() {
      let steps = [];
      if (formulaMode === 'simple') {
        const markup = parseFloat(document.getElementById('simpleMarkup').value) || 0;
        const making = parseFloat(document.getElementById('simpleMaking').value) || 0;
        steps = [
          { id: 'metal_cost', label: 'Metal Cost', type: 'computed' },
          { id: 'making', label: 'Making Charge', type: 'fixed', defaultValue: making },
          { id: 'markup', label: 'Markup', type: 'percentage', applyOn: 'metal_cost', defaultValue: markup },
          { id: 'final_price', label: 'Final Price', type: 'sum', components: ['metal_cost', 'making', 'markup'] }
        ];
      } else {
        document.querySelectorAll('.formula-step').forEach(row => {
          steps.push({
            id: row.querySelector('.step-id').value,
            label: row.querySelector('.step-label').value,
            type: row.querySelector('.step-type').value
          });
        });
      }

      const payload = {
        id: activeFormulaId,
        name: document.getElementById('formulaName').value || 'Unnamed Formula',
        isDefault: document.getElementById('formulaIsDefault').checked,
        applyToTags: document.getElementById('formulaTags').value,
        formulaConfig: steps
      };

      const result = await fetchData('/api/formulas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (result) {
        showToast('Formula saved!');
        document.getElementById('formulaModal').style.display = 'none';
        document.getElementById('formula-card').style.display = 'block';
        loadFormulas();
      }
    }

    async function deleteFormula(id) { if (!confirm('Are you sure?')) return; const result = await fetchData('/api/formulas/' + id, { method: 'DELETE' }); if (result) { showToast('Formula deleted'); loadFormulas(); } }

    async function uploadCSV() {
      const input = document.getElementById('csvFileInput'); if (!input.files.length) return showToast('Select a CSV file', 'warning');
      const reader = new FileReader(); reader.onload = async (e) => { const result = await fetchData('/api/csv/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csvData: e.target.result }) }); if (result) { showToast(\`Imported \${result.imported} configurations. \${result.errors.length} errors.\`); loadProducts(true); } };
      reader.readAsText(input.files[0]);
    }

    function downloadFile(url, filename) {
      const btn = event.target; const oldText = btn.textContent; btn.textContent = '...';
      fetch(url, { credentials: 'include' }).then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); btn.textContent = oldText; });
    }

    async function loadLogs() {
      const logs = await fetchData('/api/logs'); if (!logs) return;
      document.getElementById('logList').innerHTML = logs.map(l => \`<tr><td>\${new Date(l.startedAt).toLocaleString()}</td><td><span class="badge badge-\${l.status === 'SUCCESS' ? 'success' : 'danger'}">\${l.status}</span></td><td>\${l.itemsUpdated || 0}</td><td style="font-size: 12px;">\${l.message}</td></tr>\`).join('') || '<tr><td colspan="4" style="text-align: center;">No activity logs found.</td></tr>';
    }

    document.getElementById('productSearch').addEventListener('input', (e) => { productState.search = e.target.value; clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => loadProducts(true), 500); });
    document.getElementById('productFilter').addEventListener('change', (e) => { productState.filter = e.target.value; loadProducts(true); });
    document.getElementById('loadMoreProducts').addEventListener('click', () => loadProducts(false));
    document.getElementById('addFormulaBtn').addEventListener('click', () => editFormula());
    document.getElementById('addFormulaStep').addEventListener('click', () => addStepToUI());
    document.getElementById('saveFormula').addEventListener('click', saveFormula);
    document.getElementById('cancelFormula').addEventListener('click', () => { document.getElementById('formulaModal').style.display = 'none'; document.getElementById('formula-card').style.display = 'block'; });
    document.getElementById('downloadTemplate').addEventListener('click', () => downloadFile('/api/csv/template', 'metal_config_template.csv'));
    document.getElementById('exportConfig').addEventListener('click', () => downloadFile('/api/csv/export', 'current_metal_config.csv'));
    document.getElementById('uploadCsvBtn').addEventListener('click', uploadCSV);
    document.getElementById('configureSelectedBtn').addEventListener('click', configureBulk);
    document.getElementById('clearSelection').addEventListener('click', () => { selection.clear(); updateBulkUi(); document.querySelectorAll('.prod-check').forEach(c => c.checked = false); });
    document.getElementById('toggleApi').addEventListener('click', () => { const input = document.getElementById('goldApiKey'); const btn = document.getElementById('toggleApi'); if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; } else { input.type = 'password'; btn.textContent = 'Show'; } });
    document.getElementById('saveSettings').addEventListener('click', () => saveAllSettings(false));
    document.getElementById('saveStopLoss').addEventListener('click', () => saveAllSettings(true));
    document.getElementById('runSync').addEventListener('click', runSync);

    document.getElementById('modeSimple').addEventListener('click', () => setFormulaMode('simple'));
    document.getElementById('modeAdvanced').addEventListener('click', () => setFormulaMode('advanced'));

    document.addEventListener('DOMContentLoaded', () => { loadHealth(); loadSettings(); loadProducts(); loadFormulas(); loadLogs(); setInterval(loadHealth, 60000); });
  </script>
</body>
</html>`;
}
