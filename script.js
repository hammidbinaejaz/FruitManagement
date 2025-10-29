/* ============================================
   Sopore Mandi Digital Khata
   Professional Fruit Trading System
   ============================================ */

// ========== DATA MODEL ==========
let growers = JSON.parse(localStorage.getItem('growers')) || [];
let customers = JSON.parse(localStorage.getItem('customers')) || [];
let varieties = JSON.parse(localStorage.getItem('varieties')) || [
  { name: "Delicious", defaultRate: 0 },
  { name: "American", defaultRate: 0 },
  { name: "Gala", defaultRate: 0 },
  { name: "Red Chief", defaultRate: 0 },
];
let prefs = JSON.parse(localStorage.getItem('prefs')) || { darkMode: false, profile: { name: '', mandi: '', phone: '', gst: '', address: '' } };
let expenses = JSON.parse(localStorage.getItem('expenses')) || [];

// Current viewing state
let currentViewingGrower = null;
let currentViewingCustomer = null;
let editingGrowerTxId = null;
let editingCustomerTxId = null;

// ========== TAB SWITCHING ==========
const tabs = {
  dashboard: { btn: document.getElementById('dashboardTab'), section: document.getElementById('dashboardSection') },
  growers: { btn: document.getElementById('growersTab'), section: document.getElementById('growersSection') },
  customers: { btn: document.getElementById('customersTab'), section: document.getElementById('customersSection') },
  expenses: { btn: document.getElementById('expensesTab'), section: document.getElementById('expensesSection') },
  khata: { btn: document.getElementById('khataTab'), section: document.getElementById('khataSection') },
  settings: { btn: document.getElementById('settingsTab'), section: document.getElementById('settingsSection') },
};

Object.entries(tabs).forEach(([key, { btn }]) => {
  btn.addEventListener('click', () => switchTab(key));
});

window.switchTab = function switchTab(activeKey) {
  Object.entries(tabs).forEach(([key, { btn, section }]) => {
    const isActive = key === activeKey;
    section.classList.toggle('active', isActive);
    btn.classList.toggle('active', isActive);
  });
  
  if (activeKey === 'dashboard') {
    updateDashboard();
  } else if (activeKey === 'growers') {
    renderGrowersList();
    hideGrowerAccountView();
  } else if (activeKey === 'customers') {
    renderCustomersList();
    hideCustomerAccountView();
  } else   if (activeKey === 'expenses') {
    renderExpenses();
  } else if (activeKey === 'khata') {
    renderKhata();
  }
}

// ========== DASHBOARD ==========
function updateDashboard() {
  const dateRange = document.getElementById('dateRange').value;
  const now = new Date();
  const today = formatDate(now);
  
  let dateFilter = (tx) => true;
  if (dateRange === 'today') {
    dateFilter = (tx) => tx.date === today;
  } else if (dateRange === 'week') {
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    dateFilter = (tx) => new Date(tx.date) >= weekAgo;
  } else if (dateRange === 'month') {
    const monthAgo = new Date(now);
    monthAgo.setMonth(now.getMonth() - 1);
    dateFilter = (tx) => new Date(tx.date) >= monthAgo;
  }

  // Collect all transactions
  const allPurchases = growers.flatMap(g => g.transactions || []);
  const allSales = customers.flatMap(c => c.transactions || []);
  
  const filteredPurchases = allPurchases.filter(dateFilter);
  const filteredSales = allSales.filter(dateFilter);
  const todayPurchases = allPurchases.filter(tx => tx.date === today);
  const todaySales = allSales.filter(tx => tx.date === today);

  // Calculate KPIs
  const totalBoxesBought = filteredPurchases.reduce((sum, tx) => sum + (tx.boxes || 0), 0);
  const totalBoxesSold = filteredSales.reduce((sum, tx) => sum + (tx.boxes || 0), 0);
  const totalPurchases = filteredPurchases.reduce((sum, tx) => sum + (tx.total || 0), 0);
  const totalSales = filteredSales.reduce((sum, tx) => sum + (tx.total || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const profit = (totalSales - totalPurchases) - totalExpenses;
  
  const todayBoxesBought = todayPurchases.reduce((sum, tx) => sum + (tx.boxes || 0), 0);
  const todayBoxesSold = todaySales.reduce((sum, tx) => sum + (tx.boxes || 0), 0);
  const todayProfit = todaySales.reduce((sum, tx) => sum + (tx.total || 0), 0) - 
                      todayPurchases.reduce((sum, tx) => sum + (tx.total || 0), 0);

  document.getElementById('kpiBoxesBought').textContent = totalBoxesBought;
  document.getElementById('kpiBoxesSold').textContent = totalBoxesSold;
  document.getElementById('kpiAmountBought').textContent = formatCurrency(totalPurchases);
  document.getElementById('kpiAmountSold').textContent = formatCurrency(totalSales);
  document.getElementById('kpiProfit').textContent = formatCurrency(profit);
  document.getElementById('kpiGross').textContent = `Gross: ${formatCurrency(totalSales - totalPurchases)} | Expenses: ${formatCurrency(totalExpenses)}`;

  document.getElementById('todayBought').textContent = todayBoxesBought;
  document.getElementById('todaySold').textContent = todayBoxesSold;
  document.getElementById('todayProfit').textContent = formatCurrency(todayProfit);

  // Stock by variety
  renderStockByVariety();
  
  // Render charts
  renderCharts();
}

function renderStockByVariety() {
  const stockMap = {};
  
  growers.forEach(g => {
    (g.transactions || []).forEach(tx => {
      if (!stockMap[tx.variety]) stockMap[tx.variety] = { purchased: 0, sold: 0 };
      stockMap[tx.variety].purchased += tx.boxes || 0;
    });
  });
  
  customers.forEach(c => {
    (c.transactions || []).forEach(tx => {
      if (!stockMap[tx.variety]) stockMap[tx.variety] = { purchased: 0, sold: 0 };
      stockMap[tx.variety].sold += tx.boxes || 0;
    });
  });

  const stockGrid = document.getElementById('stockGrid');
  stockGrid.innerHTML = '';

  Object.entries(stockMap).forEach(([variety, data]) => {
    const stock = data.purchased - data.sold;
    const card = document.createElement('div');
    card.className = 'stock-card';
    card.innerHTML = `
      <div class="variety-name">${variety}</div>
      <div class="stock-value">${stock}</div>
      <div class="stock-label">boxes in stock</div>
    `;
    stockGrid.appendChild(card);
  });
}

// ========== GROWERS MANAGEMENT ==========
function renderGrowersList() {
  const list = document.getElementById('growersList');
  list.innerHTML = '';
  const q = (document.getElementById('growerSearch')?.value || '').toLowerCase();
  growers.filter(g => g.name.toLowerCase().includes(q)).forEach(grower => {
    const stats = calculateGrowerStats(grower);
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-card-header">
        <div>
          <div class="account-card-name">${grower.name}</div>
          <div class="account-card-contact">${grower.contact || 'No contact'}</div>
        </div>
        <div class="account-card-actions">
          <button class="icon-btn" title="Delete" onclick="deleteAccount('grower','${grower.id}')">🗑️</button>
        </div>
      </div>
      <div class="account-card-stats">
        <div class="stat-item">
          <div class="stat-label">Total Boxes</div>
          <div class="stat-value">${stats.totalBoxes}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Amount</div>
          <div class="stat-value">${formatCurrency(stats.totalAmount)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${formatCurrency(stats.pending)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${(grower.transactions || []).length}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => viewGrowerAccount(grower.id));
    list.appendChild(card);
  });

  if (growers.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#6b7d7d;">No growers added yet. Click "Add New Grower" to create one.</p>';
  }
}

function viewGrowerAccount(growerId) {
  const grower = growers.find(g => g.id === growerId);
  if (!grower) return;

  currentViewingGrower = grower;
  document.getElementById('growerAccountView').classList.remove('hidden');
  document.querySelector('#growersSection .section-header').classList.add('hidden');
  document.getElementById('growersList').classList.add('hidden');

  document.getElementById('growerAccountName').textContent = grower.name;
  
  const stats = calculateGrowerStats(grower);
  const summary = document.getElementById('growerAccountSummary');
  summary.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Total Transactions</div>
      <div class="summary-value">${(grower.transactions || []).length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Boxes</div>
      <div class="summary-value">${stats.totalBoxes}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Amount</div>
      <div class="summary-value">${formatCurrency(stats.totalAmount)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Pending Balance</div>
      <div class="summary-value">${formatCurrency(stats.pending)}</div>
    </div>
  `;

  renderGrowerTransactions(grower);
  populateVarietySelect(document.getElementById('growerTxVariety'));
}

function hideGrowerAccountView() {
  document.getElementById('growerAccountView').classList.add('hidden');
  document.querySelector('#growersSection .section-header').classList.remove('hidden');
  document.getElementById('growersList').classList.remove('hidden');
  currentViewingGrower = null;
  editingGrowerTxId = null;
}

function renderGrowerTransactions(grower) {
  const tbody = document.querySelector('#growerTransactionsTable tbody');
  tbody.innerHTML = '';

  (grower.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.variety}</td>
      <td class="num">${tx.boxes}</td>
      <td class="num">${formatCurrency(tx.rate)}</td>
      <td class="num">${formatCurrency(tx.commission || 0)}</td>
      <td class="num">${formatCurrency(tx.transport || 0)}</td>
      <td class="num">${formatCurrency(tx.total)}</td>
      <td><span class="status-badge ${tx.paymentStatus === 'paid' ? 'status-paid' : 'status-due'}">${tx.paymentStatus === 'paid' ? 'Paid' : 'Due'}</span></td>
      <td class="table-actions">
        <button class="btn-edit" onclick="editGrowerTransaction('${grower.id}', '${tx.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteGrowerTransaction('${grower.id}', '${tx.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function calculateGrowerStats(grower) {
  const txs = grower.transactions || [];
  return {
    totalBoxes: txs.reduce((sum, tx) => sum + (tx.boxes || 0), 0),
    totalAmount: txs.reduce((sum, tx) => sum + (tx.total || 0), 0),
    pending: txs.filter(tx => tx.paymentStatus === 'due').reduce((sum, tx) => sum + (tx.total || 0), 0),
  };
}

// Grower transaction form
document.getElementById('addTransactionGrower').addEventListener('click', () => {
  document.getElementById('growerTransactionForm').classList.remove('hidden');
  document.getElementById('growerTxDate').value = formatDate(new Date());
  editingGrowerTxId = null;
});

document.getElementById('cancelGrowerTx').addEventListener('click', () => {
  document.getElementById('growerTransactionForm').classList.add('hidden');
  document.getElementById('growerTransactionForm').reset();
  editingGrowerTxId = null;
});

document.getElementById('growerTransactionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentViewingGrower) return;

  const tx = {
    id: editingGrowerTxId || `tx_${Date.now()}`,
    date: document.getElementById('growerTxDate').value,
    variety: document.getElementById('growerTxVariety').value,
    boxes: parseInt(document.getElementById('growerTxBoxes').value),
    rate: parseFloat(document.getElementById('growerTxRate').value),
    commission: parseFloat(document.getElementById('growerTxCommission').value || 0),
    transport: parseFloat(document.getElementById('growerTxTransport').value || 0),
    paymentStatus: document.getElementById('growerTxPaymentStatus').value,
    notes: document.getElementById('growerTxNotes').value,
    total: 0,
  };
  tx.total = (tx.boxes * tx.rate) + tx.commission + tx.transport;

  if (!currentViewingGrower.transactions) currentViewingGrower.transactions = [];
  
  if (editingGrowerTxId) {
    const idx = currentViewingGrower.transactions.findIndex(t => t.id === editingGrowerTxId);
    if (idx !== -1) currentViewingGrower.transactions[idx] = tx;
  } else {
    currentViewingGrower.transactions.push(tx);
  }

  saveGrowers();
  viewGrowerAccount(currentViewingGrower.id);
  document.getElementById('growerTransactionForm').classList.add('hidden');
  document.getElementById('growerTransactionForm').reset();
  editingGrowerTxId = null;
  updateDashboard();
});

window.editGrowerTransaction = (growerId, txId) => {
  const grower = growers.find(g => g.id === growerId);
  const tx = (grower.transactions || []).find(t => t.id === txId);
  if (!tx) return;

  currentViewingGrower = grower;
  editingGrowerTxId = txId;
  document.getElementById('growerTxDate').value = tx.date;
  document.getElementById('growerTxVariety').value = tx.variety;
  document.getElementById('growerTxBoxes').value = tx.boxes;
  document.getElementById('growerTxRate').value = tx.rate;
  document.getElementById('growerTxCommission').value = tx.commission || 0;
  document.getElementById('growerTxTransport').value = tx.transport || 0;
  document.getElementById('growerTxPaymentStatus').value = tx.paymentStatus;
  document.getElementById('growerTxNotes').value = tx.notes || '';
  document.getElementById('growerTransactionForm').classList.remove('hidden');
};

window.deleteGrowerTransaction = (growerId, txId) => {
  if (!confirm('Delete this transaction?')) return;
  const grower = growers.find(g => g.id === growerId);
  if (grower && grower.transactions) {
    grower.transactions = grower.transactions.filter(t => t.id !== txId);
    saveGrowers();
    if (currentViewingGrower?.id === growerId) {
      viewGrowerAccount(growerId);
    }
    updateDashboard();
  }
};

// ========== CUSTOMERS MANAGEMENT ==========
function renderCustomersList() {
  const list = document.getElementById('customersList');
  list.innerHTML = '';
  const q = (document.getElementById('customerSearch')?.value || '').toLowerCase();
  customers.filter(c => c.name.toLowerCase().includes(q)).forEach(customer => {
    const stats = calculateCustomerStats(customer);
    const card = document.createElement('div');
    card.className = 'account-card';
    card.innerHTML = `
      <div class="account-card-header">
        <div>
          <div class="account-card-name">${customer.name}</div>
          <div class="account-card-contact">${customer.contact || 'No contact'}</div>
        </div>
        <div class="account-card-actions">
          <button class="icon-btn" title="Delete" onclick="deleteAccount('customer','${customer.id}')">🗑️</button>
        </div>
      </div>
      <div class="account-card-stats">
        <div class="stat-item">
          <div class="stat-label">Total Boxes</div>
          <div class="stat-value">${stats.totalBoxes}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Total Amount</div>
          <div class="stat-value">${formatCurrency(stats.totalAmount)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Pending</div>
          <div class="stat-value">${formatCurrency(stats.pending)}</div>
        </div>
        <div class="stat-item">
          <div class="stat-label">Transactions</div>
          <div class="stat-value">${(customer.transactions || []).length}</div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => viewCustomerAccount(customer.id));
    list.appendChild(card);
  });

  if (customers.length === 0) {
    list.innerHTML = '<p style="text-align:center; color:#6b7d7d;">No customers added yet. Click "Add New Customer" to create one.</p>';
  }
}

function viewCustomerAccount(customerId) {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;

  currentViewingCustomer = customer;
  document.getElementById('customerAccountView').classList.remove('hidden');
  document.querySelector('#customersSection .section-header').classList.add('hidden');
  document.getElementById('customersList').classList.add('hidden');

  document.getElementById('customerAccountName').textContent = customer.name;
  
  const stats = calculateCustomerStats(customer);
  const summary = document.getElementById('customerAccountSummary');
  summary.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Total Transactions</div>
      <div class="summary-value">${(customer.transactions || []).length}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Boxes</div>
      <div class="summary-value">${stats.totalBoxes}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Total Amount</div>
      <div class="summary-value">${formatCurrency(stats.totalAmount)}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Pending Balance</div>
      <div class="summary-value">${formatCurrency(stats.pending)}</div>
    </div>
  `;

  renderCustomerTransactions(customer);
  populateVarietySelect(document.getElementById('customerTxVariety'));
}

function hideCustomerAccountView() {
  document.getElementById('customerAccountView').classList.add('hidden');
  document.querySelector('#customersSection .section-header').classList.remove('hidden');
  document.getElementById('customersList').classList.remove('hidden');
  currentViewingCustomer = null;
  editingCustomerTxId = null;
}

function renderCustomerTransactions(customer) {
  const tbody = document.querySelector('#customerTransactionsTable tbody');
  tbody.innerHTML = '';

  (customer.transactions || []).sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(tx => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${tx.date}</td>
      <td>${tx.variety}</td>
      <td class="num">${tx.boxes}</td>
      <td class="num">${formatCurrency(tx.rate)}</td>
      <td class="num">${formatCurrency(tx.commission || 0)}</td>
      <td class="num">${formatCurrency(tx.transport || 0)}</td>
      <td class="num">${formatCurrency(tx.total)}</td>
      <td><span class="status-badge ${tx.paymentStatus === 'received' ? 'status-paid' : 'status-pending'}">${tx.paymentStatus === 'received' ? 'Received' : 'Pending'}</span></td>
      <td class="table-actions">
        <button class="btn-edit" onclick="editCustomerTransaction('${customer.id}', '${tx.id}')">Edit</button>
        <button class="btn-delete" onclick="deleteCustomerTransaction('${customer.id}', '${tx.id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function calculateCustomerStats(customer) {
  const txs = customer.transactions || [];
  return {
    totalBoxes: txs.reduce((sum, tx) => sum + (tx.boxes || 0), 0),
    totalAmount: txs.reduce((sum, tx) => sum + (tx.total || 0), 0),
    pending: txs.filter(tx => tx.paymentStatus === 'pending').reduce((sum, tx) => sum + (tx.total || 0), 0),
  };
}

// Customer transaction form
document.getElementById('addTransactionCustomer').addEventListener('click', () => {
  document.getElementById('customerTransactionForm').classList.remove('hidden');
  document.getElementById('customerTxDate').value = formatDate(new Date());
  editingCustomerTxId = null;
});

document.getElementById('cancelCustomerTx').addEventListener('click', () => {
  document.getElementById('customerTransactionForm').classList.add('hidden');
  document.getElementById('customerTransactionForm').reset();
  editingCustomerTxId = null;
});

document.getElementById('customerTransactionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!currentViewingCustomer) return;

  const tx = {
    id: editingCustomerTxId || `tx_${Date.now()}`,
    date: document.getElementById('customerTxDate').value,
    variety: document.getElementById('customerTxVariety').value,
    boxes: parseInt(document.getElementById('customerTxBoxes').value),
    rate: parseFloat(document.getElementById('customerTxRate').value),
    commission: parseFloat(document.getElementById('customerTxCommission').value || 0),
    transport: parseFloat(document.getElementById('customerTxTransport').value || 0),
    paymentStatus: document.getElementById('customerTxPaymentStatus').value,
    notes: document.getElementById('customerTxNotes').value,
    total: 0,
  };
  tx.total = (tx.boxes * tx.rate) - tx.commission - tx.transport;

  if (!currentViewingCustomer.transactions) currentViewingCustomer.transactions = [];
  
  if (editingCustomerTxId) {
    const idx = currentViewingCustomer.transactions.findIndex(t => t.id === editingCustomerTxId);
    if (idx !== -1) currentViewingCustomer.transactions[idx] = tx;
  } else {
    currentViewingCustomer.transactions.push(tx);
  }

  saveCustomers();
  viewCustomerAccount(currentViewingCustomer.id);
  document.getElementById('customerTransactionForm').classList.add('hidden');
  document.getElementById('customerTransactionForm').reset();
  editingCustomerTxId = null;
  updateDashboard();
});

window.editCustomerTransaction = (customerId, txId) => {
  const customer = customers.find(c => c.id === customerId);
  const tx = (customer.transactions || []).find(t => t.id === txId);
  if (!tx) return;

  currentViewingCustomer = customer;
  editingCustomerTxId = txId;
  document.getElementById('customerTxDate').value = tx.date;
  document.getElementById('customerTxVariety').value = tx.variety;
  document.getElementById('customerTxBoxes').value = tx.boxes;
  document.getElementById('customerTxRate').value = tx.rate;
  document.getElementById('customerTxCommission').value = tx.commission || 0;
  document.getElementById('customerTxTransport').value = tx.transport || 0;
  document.getElementById('customerTxPaymentStatus').value = tx.paymentStatus;
  document.getElementById('customerTxNotes').value = tx.notes || '';
  document.getElementById('customerTransactionForm').classList.remove('hidden');
};

window.deleteCustomerTransaction = (customerId, txId) => {
  if (!confirm('Delete this transaction?')) return;
  const customer = customers.find(c => c.id === customerId);
  if (customer && customer.transactions) {
    customer.transactions = customer.transactions.filter(t => t.id !== txId);
    saveCustomers();
    if (currentViewingCustomer?.id === customerId) {
      viewCustomerAccount(customerId);
    }
    updateDashboard();
  }
};

// ========== ADD ACCOUNTS ==========
document.getElementById('addGrowerBtn').addEventListener('click', () => showAddAccountModal('grower'));
document.getElementById('addCustomerBtn').addEventListener('click', () => showAddAccountModal('customer'));

function showAddAccountModal(type) {
  const modal = document.getElementById('addAccountModal');
  const title = document.getElementById('modalTitle');
  title.textContent = `Add New ${type === 'grower' ? 'Grower' : 'Customer'}`;
  modal.classList.remove('hidden');
  modal.classList.add('active');
  
  const form = document.getElementById('addAccountForm');
  form.onsubmit = (e) => {
    e.preventDefault();
    const name = document.getElementById('accountNameInput').value.trim();
    const contact = document.getElementById('accountContactInput').value.trim();
    const address = document.getElementById('accountAddressInput').value.trim();
    
    if (!name) return;

    const account = {
      id: `${type}_${Date.now()}`,
      name,
      contact,
      address,
      transactions: [],
    };

    if (type === 'grower') {
      growers.push(account);
      saveGrowers();
      renderGrowersList();
    } else {
      customers.push(account);
      saveCustomers();
      renderCustomersList();
    }

    modal.classList.remove('active');
    form.reset();
  };
}

document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const modal = document.getElementById('addAccountModal');
    modal.classList.remove('active');
  });
});

// Back buttons
document.getElementById('backFromGrower').addEventListener('click', () => {
  hideGrowerAccountView();
  switchTab('growers');
});

document.getElementById('backFromCustomer').addEventListener('click', () => {
  hideCustomerAccountView();
  switchTab('customers');
});

// ========== BILL GENERATION ==========
document.getElementById('generateBillGrower').addEventListener('click', () => {
  if (!currentViewingGrower) return;
  generateBill(currentViewingGrower, 'grower');
});

document.getElementById('generateBillCustomer').addEventListener('click', () => {
  if (!currentViewingCustomer) return;
  generateBill(currentViewingCustomer, 'customer');
});

function generateBill(account, type) {
  const txs = (account.transactions || []).filter(tx => 
    type === 'grower' ? tx.paymentStatus === 'due' : tx.paymentStatus === 'pending'
  );
  
  if (txs.length === 0) {
    alert(`No pending transactions for ${account.name}`);
    return;
  }

  const win = window.open('', '_blank');
  const totalPending = txs.reduce((sum, tx) => sum + tx.total, 0);
  
  let billHtml = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Sopore Mandi - Bill</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Poppins', sans-serif;
          padding: 30px;
          color: #2d5f3f;
          background: white;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 3px solid #4c9a53;
          padding-bottom: 20px;
        }
        .header h1 { font-size: 24px; color: #4c9a53; margin-bottom: 5px; }
        .bill-info {
          margin-bottom: 30px;
        }
        .bill-info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 14px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background: #e9f7ea;
          color: #2d5f3f;
          font-weight: 600;
        }
        .text-right { text-align: right; }
        .total-row {
          font-weight: 700;
          font-size: 18px;
          background: #f8fff9;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 12px;
          color: #6b7d7d;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🍎 SOPORE MANDI DIGITAL KHATA</h1>
        <p style="font-size: 14px;">Professional Fruit Trading System</p>
      </div>
      <div class="bill-info">
        <div class="bill-info-row">
          <strong>${type === 'grower' ? 'Grower' : 'Customer'} Name:</strong>
          <span>${account.name}</span>
        </div>
        <div class="bill-info-row">
          <strong>Contact:</strong>
          <span>${account.contact || 'N/A'}</span>
        </div>
        <div class="bill-info-row">
          <strong>Buyer:</strong>
          <span>${prefs.profile?.name || ''} ${prefs.profile?.mandi ? '— ' + prefs.profile.mandi : ''}</span>
        </div>
        <div class="bill-info-row">
          <strong>Phone / GST:</strong>
          <span>${prefs.profile?.phone || ''} ${prefs.profile?.gst ? ' | ' + prefs.profile.gst : ''}</span>
        </div>
        <div class="bill-info-row">
          <strong>Address:</strong>
          <span>${prefs.profile?.address || ''}</span>
        </div>
        <div class="bill-info-row">
          <strong>Date:</strong>
          <span>${formatDate(new Date())}</span>
        </div>
        <div class="bill-info-row">
          <strong>Status:</strong>
          <span style="color: #721c24; font-weight: 600;">PENDING</span>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Variety</th>
            <th class="text-right">Boxes</th>
            <th class="text-right">Rate</th>
            <th class="text-right">Commission</th>
            <th class="text-right">Transport</th>
            <th class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  txs.forEach(tx => {
    billHtml += `
      <tr>
        <td>${tx.date}</td>
        <td>${tx.variety}</td>
        <td class="text-right">${tx.boxes}</td>
        <td class="text-right">₹${tx.rate}</td>
        <td class="text-right">₹${tx.commission || 0}</td>
        <td class="text-right">₹${tx.transport || 0}</td>
        <td class="text-right">₹${tx.total}</td>
      </tr>
    `;
  });

  billHtml += `
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="6">Total Pending Amount:</td>
            <td class="text-right">₹${totalPending.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Sopore Mandi Digital Khata System</p>
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;

  win.document.write(billHtml);
  win.document.close();
}

// ========== KHATA ==========
function renderKhata() {
  const growersKhata = [];
  const customersKhata = [];

  growers.forEach(g => {
    const pending = (g.transactions || []).filter(tx => tx.paymentStatus === 'due')
      .reduce((sum, tx) => sum + tx.total, 0);
    if (pending > 0) {
      growersKhata.push({ name: g.name, amount: pending, id: g.id });
    }
  });

  customers.forEach(c => {
    const pending = (c.transactions || []).filter(tx => tx.paymentStatus === 'pending')
      .reduce((sum, tx) => sum + tx.total, 0);
    if (pending > 0) {
      customersKhata.push({ name: c.name, amount: pending, id: c.id });
    }
  });

  const q = (document.getElementById('khataSearch')?.value || '').toLowerCase();
  const growersList = document.getElementById('growersKhataList');
  growersList.innerHTML = '';
  growersKhata.filter(x => x.name.toLowerCase().includes(q)).forEach(item => {
    const div = document.createElement('div');
    div.className = 'khata-item';
    div.innerHTML = `
      <div class="khata-item-info">
        <div class="khata-item-name">${item.name}</div>
        <div class="khata-item-amount">${formatCurrency(item.amount)}</div>
      </div>
      <div class="khata-item-actions">
        <button class="btn-secondary" onclick="markGrowerPaid('${item.id}')">Mark Paid</button>
      </div>
    `;
    growersList.appendChild(div);
  });

  const customersList = document.getElementById('customersKhataList');
  customersList.innerHTML = '';
  customersKhata.filter(x => x.name.toLowerCase().includes(q)).forEach(item => {
    const div = document.createElement('div');
    div.className = 'khata-item';
    div.innerHTML = `
      <div class="khata-item-info">
        <div class="khata-item-name">${item.name}</div>
        <div class="khata-item-amount">${formatCurrency(item.amount)}</div>
      </div>
      <div class="khata-item-actions">
        <button class="btn-secondary" onclick="markCustomerReceived('${item.id}')">Mark Received</button>
      </div>
    `;
    customersList.appendChild(div);
  });
  const dueGrowers = growersKhata.reduce((s,x)=>s+x.amount,0);
  const dueCustomers = customersKhata.reduce((s,x)=>s+x.amount,0);
  const summary = document.getElementById('khataSummary');
  summary.textContent = `Total Due to Growers: ${formatCurrency(dueGrowers)} | Pending from Customers: ${formatCurrency(dueCustomers)} | Net Balance: ${formatCurrency(dueCustomers - dueGrowers)}`;
}

window.markGrowerPaid = (growerId) => {
  const grower = growers.find(g => g.id === growerId);
  if (grower && grower.transactions) {
    grower.transactions.forEach(tx => {
      if (tx.paymentStatus === 'due') tx.paymentStatus = 'paid';
    });
    saveGrowers();
    renderKhata();
    if (currentViewingGrower?.id === growerId) viewGrowerAccount(growerId);
    updateDashboard();
  }
};

window.markCustomerReceived = (customerId) => {
  const customer = customers.find(c => c.id === customerId);
  if (customer && customer.transactions) {
    customer.transactions.forEach(tx => {
      if (tx.paymentStatus === 'pending') tx.paymentStatus = 'received';
    });
    saveCustomers();
    renderKhata();
    if (currentViewingCustomer?.id === customerId) viewCustomerAccount(customerId);
    updateDashboard();
  }
};

// ========== SETTINGS ==========
function populateVarietySelect(selectEl) {
  selectEl.innerHTML = '<option value="">Select Variety</option>';
  varieties.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = v.name;
    selectEl.appendChild(opt);
  });
}

document.getElementById('dateRange').addEventListener('change', updateDashboard);

document.getElementById('varietyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('newVariety').value.trim();
  const rate = parseFloat(document.getElementById('defaultRate').value || 0);
  
  if (!name) return;
  if (varieties.find(v => v.name.toLowerCase() === name.toLowerCase())) {
    alert('Variety already exists');
    return;
  }

  varieties.push({ name, defaultRate: rate });
  saveVarieties();
  renderVarietiesList();
  e.target.reset();
});

function renderVarietiesList() {
  const list = document.getElementById('varietiesList');
  list.innerHTML = '';
  varieties.forEach((v, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span>${v.name} — Default Rate: ₹${v.defaultRate || 0}</span>
      <button class="btn-delete" onclick="deleteVariety(${idx})">Delete</button>
    `;
    list.appendChild(li);
  });
}

window.deleteVariety = (idx) => {
  if (confirm('Delete this variety?')) {
    varieties.splice(idx, 1);
    saveVarieties();
    renderVarietiesList();
  }
};

// Dark mode with auto-detect
const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
if (prefs.darkMode === undefined && prefersDark) prefs.darkMode = true;

document.getElementById('darkModeToggle').checked = prefs.darkMode || false;
document.getElementById('darkModeToggle').addEventListener('change', (e) => {
  prefs.darkMode = e.target.checked;
  savePrefs();
  document.body.classList.toggle('dark', prefs.darkMode);
  if (profitChart || stockPieChart) renderCharts(); // Update charts on theme change
});

document.getElementById('exportDataBtn').addEventListener('click', () => {
  const data = { growers, customers, varieties, prefs };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mandi-khata-backup-${formatDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('importDataBtn').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (data.growers) growers = data.growers;
      if (data.customers) customers = data.customers;
      if (data.varieties) varieties = data.varieties;
      if (data.prefs) prefs = data.prefs;
      localStorage.setItem('growers', JSON.stringify(growers));
      localStorage.setItem('customers', JSON.stringify(customers));
      localStorage.setItem('varieties', JSON.stringify(varieties));
      localStorage.setItem('prefs', JSON.stringify(prefs));
      alert('Data imported successfully!');
      location.reload();
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

// ========== STORAGE FUNCTIONS ==========
function saveGrowers() {
  localStorage.setItem('growers', JSON.stringify(growers));
}

function saveCustomers() {
  localStorage.setItem('customers', JSON.stringify(customers));
}

function saveVarieties() {
  localStorage.setItem('varieties', JSON.stringify(varieties));
}

function savePrefs() {
  localStorage.setItem('prefs', JSON.stringify(prefs));
}

function saveExpenses() { localStorage.setItem('expenses', JSON.stringify(expenses)); }

// ========== UTILITY FUNCTIONS ==========
function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ========== INITIALIZATION ==========
window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.toggle('dark', prefs.darkMode);
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches && !prefs.darkMode) {
    document.body.classList.toggle('dark', true);
  }
  renderGrowersList();
  renderCustomersList();
  renderVarietiesList();
  updateDashboard();
  
  // Populate variety selects
  populateVarietySelect(document.getElementById('growerTxVariety'));
  populateVarietySelect(document.getElementById('customerTxVariety'));
  
  // Variety auto-fill rates
  document.getElementById('growerTxVariety').addEventListener('change', (e) => {
    const v = varieties.find(x => x.name === e.target.value);
    if (v) document.getElementById('growerTxRate').value = v.defaultRate || '';
  });
  
  document.getElementById('customerTxVariety').addEventListener('change', (e) => {
    const v = varieties.find(x => x.name === e.target.value);
    if (v) document.getElementById('customerTxRate').value = v.defaultRate || '';
  });

  document.getElementById('growerSearch').addEventListener('input', renderGrowersList);
  document.getElementById('customerSearch').addEventListener('input', renderCustomersList);
  document.getElementById('khataSearch').addEventListener('input', renderKhata);

  // Expenses UI bindings
  document.getElementById('addExpenseBtn').addEventListener('click', () => {
    document.getElementById('expenseForm').classList.remove('hidden');
    document.getElementById('expenseDate').value = formatDate(new Date());
  });
  document.getElementById('cancelExpenseBtn').addEventListener('click', () => {
    document.getElementById('expenseForm').classList.add('hidden');
    document.getElementById('expenseForm').reset();
  });
  document.getElementById('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const exp = {
      id: `exp_${Date.now()}`,
      date: document.getElementById('expenseDate').value,
      desc: document.getElementById('expenseDesc').value.trim(),
      amount: parseFloat(document.getElementById('expenseAmount').value),
      category: document.getElementById('expenseCategory').value,
    };
    if (!exp.desc || !exp.amount) return;
    expenses.push(exp); saveExpenses();
    renderExpenses(); updateDashboard();
    document.getElementById('expenseForm').classList.add('hidden');
    document.getElementById('expenseForm').reset();
  });

  renderExpenses();

  // Profile form
  const pf = prefs.profile || {};
  document.getElementById('buyerName').value = pf.name || '';
  document.getElementById('buyerMandi').value = pf.mandi || '';
  document.getElementById('buyerPhone').value = pf.phone || '';
  document.getElementById('buyerGst').value = pf.gst || '';
  document.getElementById('buyerAddress').value = pf.address || '';
  document.getElementById('profileForm').addEventListener('submit', (e)=>{
    e.preventDefault();
    prefs.profile = {
      name: document.getElementById('buyerName').value.trim(),
      mandi: document.getElementById('buyerMandi').value.trim(),
      phone: document.getElementById('buyerPhone').value.trim(),
      gst: document.getElementById('buyerGst').value.trim(),
      address: document.getElementById('buyerAddress').value.trim(),
    };
    savePrefs();
    alert('Profile saved');
  });

  // Add export button to khata section
  const khataTools = document.getElementById('khataSection')?.querySelector('.section-tools');
  if (khataTools && !khataTools.querySelector('[onclick="exportKhataCSV()"]')) {
    khataTools.insertAdjacentHTML('beforeend', '<button class="btn-secondary" onclick="exportKhataCSV()">📥 Export to CSV</button>');
  }
});

// Expenses renderer
function renderExpenses() {
  const tbody = document.querySelector('#expensesTable tbody');
  tbody.innerHTML = '';
  expenses.sort((a,b)=> new Date(b.date) - new Date(a.date)).forEach(e => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${e.date}</td><td>${e.desc}</td><td>${e.category}</td><td class="num">${formatCurrency(e.amount)}</td><td class="table-actions"><button class="btn-delete" onclick="deleteExpense('${e.id}')">Delete</button></td>`;
    tbody.appendChild(tr);
  });
}

window.deleteExpense = (id) => {
  if (!confirm('Delete this expense?')) return;
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses(); renderExpenses(); updateDashboard();
};

// Delete account (grower/customer)
window.deleteAccount = (type, id) => {
  const list = type === 'grower' ? growers : customers;
  const acc = list.find(x => x.id === id);
  if (!acc) return;
  if (!confirm(`Are you sure you want to delete "${acc.name}"? All related transactions will be removed.`)) return;
  if (type === 'grower') {
    growers = growers.filter(x => x.id !== id); saveGrowers(); renderGrowersList();
  } else {
    customers = customers.filter(x => x.id !== id); saveCustomers(); renderCustomersList();
  }
  updateDashboard(); renderKhata();
};

// ========== CHARTS ==========
let profitChart, stockPieChart;

function renderCharts() {
  if (!window.Chart) return;
  
  // 7-Day Profit Trend
  const ctxProfit = document.getElementById('profitChart');
  if (ctxProfit) {
    const last7Days = [];
    const profits = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = formatDate(d);
      last7Days.push(d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }));
      
      const dayPurchases = growers.flatMap(g => g.transactions || []).filter(tx => tx.date === dayStr);
      const daySales = customers.flatMap(c => c.transactions || []).filter(tx => tx.date === dayStr);
      const dayExpenses = expenses.filter(e => e.date === dayStr);
      const profit = daySales.reduce((s, tx) => s + tx.total, 0) - 
                    dayPurchases.reduce((s, tx) => s + tx.total, 0) - 
                    dayExpenses.reduce((s, e) => s + e.amount, 0);
      profits.push(profit);
    }
    
    if (profitChart) profitChart.destroy();
    const textColor = prefs.darkMode ? '#f1f5f9' : '#1e293b';
    profitChart = new Chart(ctxProfit, {
      type: 'line',
      data: {
        labels: last7Days,
        datasets: [{
          label: 'Daily Profit (₹)',
          data: profits,
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.1)',
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: textColor, font: { weight: 600 } } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: prefs.darkMode ? '#334155' : '#e2e8f0' } },
          y: { ticks: { color: textColor }, grid: { color: prefs.darkMode ? '#334155' : '#e2e8f0' } }
        }
      }
    });
  }
  
  // Stock Pie Chart
  const ctxPie = document.getElementById('stockPieChart');
  if (ctxPie) {
    const stockMap = {};
    growers.forEach(g => {
      (g.transactions || []).forEach(tx => {
        stockMap[tx.variety] = (stockMap[tx.variety] || 0) + (tx.boxes || 0);
      });
    });
    customers.forEach(c => {
      (c.transactions || []).forEach(tx => {
        stockMap[tx.variety] = (stockMap[tx.variety] || 0) - (tx.boxes || 0);
      });
    });
    
    const labels = Object.keys(stockMap).filter(v => stockMap[v] > 0);
    const data = labels.map(v => stockMap[v]);
    const colors = ['#0d9488', '#14b8a6', '#f59e0b', '#fbbf24', '#10b981', '#34d399', '#3b82f6'];
    
    if (stockPieChart) stockPieChart.destroy();
    const textColor = prefs.darkMode ? '#f1f5f9' : '#1e293b';
    stockPieChart = new Chart(ctxPie, {
      type: 'pie',
      data: {
        labels,
        datasets: [{ data, backgroundColor: colors }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { weight: 600 } } }
        }
      }
    });
  }
}

// ========== ENHANCED BILL GENERATION ==========
function generateBill(account, type) {
  const txs = (account.transactions || []).filter(tx => 
    type === 'grower' ? tx.paymentStatus === 'due' : tx.paymentStatus === 'pending'
  );
  
  if (txs.length === 0) {
    alert(`No pending transactions for ${account.name}`);
    return;
  }

  // Show preview modal first
  const modal = document.getElementById('billPreviewModal');
  const preview = document.getElementById('billPreviewContent');
  const totalPending = txs.reduce((sum, tx) => sum + tx.total, 0);
  
  let billHtml = `
    <style>
      body { font-family: 'Inter', sans-serif; }
      .bill-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #0d9488; }
      .bill-watermark { position: absolute; opacity: 0.05; font-size: 200px; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); z-index: 0; }
    </style>
    <div style="position: relative; background: white; padding: 40px;">
      <div class="bill-watermark">🍎</div>
      <div class="bill-header">
        <h1 style="font-size: 28px; color: #0d9488; margin-bottom: 8px; font-weight: 800;">🍎 SOPORE MANDI DIGITAL KHATA</h1>
        <p style="font-size: 14px; color: #64748b; font-weight: 600;">Professional Fruit Trading System</p>
        <p style="font-size: 12px; color: #94a3b8; margin-top: 4px;">${type === 'grower' ? 'PURCHASE RECEIPT' : 'SALES INVOICE'}</p>
      </div>
      <div style="margin-bottom: 30px; font-size: 13px; line-height: 1.8;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>${type === 'grower' ? 'Grower' : 'Customer'}:</strong><span>${account.name}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>Contact:</strong><span>${account.contact || 'N/A'}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>Buyer:</strong><span>${prefs.profile?.name || ''} ${prefs.profile?.mandi ? '— ' + prefs.profile.mandi : ''}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>Phone / GST:</strong><span>${prefs.profile?.phone || ''} ${prefs.profile?.gst ? ' | ' + prefs.profile.gst : ''}</span></div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>Date:</strong><span>${formatDate(new Date())}</span></div>
        <div style="display: flex; justify-content: space-between;"><strong>Status:</strong><span style="color: #ef4444; font-weight: 700;">PENDING</span></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f0fdfa; color: #0d9488;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #14b8a6;">Date</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #14b8a6;">Variety</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #14b8a6;">Boxes</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #14b8a6;">Rate</th>
            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #14b8a6;">Total</th>
          </tr>
        </thead>
        <tbody>
  `;

  txs.forEach(tx => {
    billHtml += `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tx.date}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${tx.variety}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">${tx.boxes}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${tx.rate}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right;">₹${tx.total.toFixed(2)}</td>
      </tr>
    `;
  });

  billHtml += `
        </tbody>
        <tfoot>
          <tr style="background: #fef3c7; font-weight: 800; font-size: 18px;">
            <td colspan="4" style="padding: 15px; border-top: 2px solid #fbbf24;">Total Pending Amount:</td>
            <td style="padding: 15px; text-align: right; border-top: 2px solid #fbbf24;">₹${totalPending.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8;">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Sopore Mandi Digital Khata System</p>
      </div>
    </div>
  `;

  preview.innerHTML = billHtml;
  modal.classList.remove('hidden');
  modal.classList.add('active');

  // Set up print handler
  document.getElementById('printBillBtn').onclick = () => {
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sopore Mandi - Bill</title>${billHtml.replace('<div style="position: relative; background: white; padding: 40px;">', '<div style="position: relative; background: white; padding: 40px; max-width: 800px; margin: 0 auto;">')}</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 250);
  };

  // Mark as printed
  document.getElementById('markPrintedBtn').onclick = () => {
    txs.forEach(tx => {
      tx.paymentStatus = type === 'grower' ? 'paid' : 'received';
    });
    if (type === 'grower') saveGrowers(); else saveCustomers();
    alert('All transactions marked as ' + (type === 'grower' ? 'paid' : 'received'));
    modal.classList.remove('active');
    if (type === 'grower' && currentViewingGrower) viewGrowerAccount(currentViewingGrower.id);
    if (type === 'customer' && currentViewingCustomer) viewCustomerAccount(currentViewingCustomer.id);
    updateDashboard();
    renderKhata();
  };

  document.getElementById('closeBillPreview').onclick = () => {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  };
}

// ========== KHATA ENHANCEMENTS ==========
document.getElementById('markAllPaidGrowers')?.addEventListener('click', () => {
  if (!confirm('Mark ALL growers as paid? This will mark all pending purchase transactions as paid.')) return;
  growers.forEach(g => {
    (g.transactions || []).forEach(tx => {
      if (tx.paymentStatus === 'due') tx.paymentStatus = 'paid';
    });
  });
  saveGrowers();
  renderKhata();
  updateDashboard();
});

document.getElementById('markAllReceivedCustomers')?.addEventListener('click', () => {
  if (!confirm('Mark ALL customers as received? This will mark all pending sale transactions as received.')) return;
  customers.forEach(c => {
    (c.transactions || []).forEach(tx => {
      if (tx.paymentStatus === 'pending') tx.paymentStatus = 'received';
    });
  });
  saveCustomers();
  renderKhata();
  updateDashboard();
});

// Export Khata to CSV
function exportKhataCSV() {
  const growersKhata = [];
  const customersKhata = [];
  growers.forEach(g => {
    const pending = (g.transactions || []).filter(tx => tx.paymentStatus === 'due').reduce((sum, tx) => sum + tx.total, 0);
    if (pending > 0) growersKhata.push({ type: 'Grower', name: g.name, amount: pending });
  });
  customers.forEach(c => {
    const pending = (c.transactions || []).filter(tx => tx.paymentStatus === 'pending').reduce((sum, tx) => sum + tx.total, 0);
    if (pending > 0) customersKhata.push({ type: 'Customer', name: c.name, amount: pending });
  });
  
  const csv = [
    'Type,Name,Pending Amount',
    ...growersKhata.map(x => `Grower,${x.name},${x.amount}`),
    ...customersKhata.map(x => `Customer,${x.name},${x.amount}`)
  ].join('\n');
  
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `khata-${formatDate(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Add export button to khata section (in DOMContentLoaded)
window.exportKhataCSV = exportKhataCSV;

// ========== AUTO-BACKUP ==========
function createBackup() {
  const backup = {
    timestamp: new Date().toISOString(),
    growers,
    customers,
    expenses,
    varieties,
    prefs
  };
  localStorage.setItem('auto_backup', JSON.stringify(backup));
}

function restoreBackup() {
  const backup = localStorage.getItem('auto_backup');
  if (!backup) {
    alert('No backup found');
    return;
  }
  if (confirm('Restore from last auto-backup? Current data will be replaced.')) {
    try {
      const data = JSON.parse(backup);
      growers = data.growers || [];
      customers = data.customers || [];
      expenses = data.expenses || [];
      varieties = data.varieties || [];
      prefs = data.prefs || prefs;
      saveGrowers();
      saveCustomers();
      saveExpenses();
      saveVarieties();
      savePrefs();
      alert('Backup restored!');
      location.reload();
    } catch (e) {
      alert('Backup restore failed');
    }
  }
}

// Auto-backup every 24 hours
setInterval(() => {
  createBackup();
  console.log('Auto-backup created');
}, 24 * 60 * 60 * 1000);

// Initial backup on load
createBackup();

// ========== FLOATING ACTION BUTTON ==========
document.getElementById('fabButton').addEventListener('click', () => {
  const menu = document.createElement('div');
  menu.style.cssText = 'position: fixed; bottom: 90px; right: 32px; background: white; border-radius: 16px; padding: 1rem; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); z-index: 1500; min-width: 200px;';
  menu.innerHTML = `
    <button class="btn-primary" style="width: 100%; margin-bottom: 0.5rem;" onclick="switchTab('growers'); document.body.removeChild(this.parentElement);">+ Add Grower</button>
    <button class="btn-primary" style="width: 100%; margin-bottom: 0.5rem;" onclick="switchTab('customers'); document.body.removeChild(this.parentElement);">+ Add Customer</button>
    <button class="btn-secondary" style="width: 100%;" onclick="switchTab('expenses'); document.getElementById('addExpenseBtn').click(); document.body.removeChild(this.parentElement);">+ Add Expense</button>
  `;
  document.body.appendChild(menu);
  setTimeout(() => {
    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && e.target.id !== 'fabButton') {
        if (menu.parentElement) menu.parentElement.removeChild(menu);
        document.removeEventListener('click', closeMenu);
      }
    });
  }, 100);
});

// ========== INLINE EDITING (for rates in transaction tables) ==========
// Add double-click to edit functionality in transaction tables
// This would be called when rendering transactions
