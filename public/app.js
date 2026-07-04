// Core client logic for WhatsApp Business Automation System Dashboard
// Connects UI events to backend REST API endpoints and SQL database records

let activeView = 'dashboard';
let activeCustomerId = 1;
let activeDbTab = 'customers';

// Fetch logger & updates the dev console on the UI
async function updateConsoleLogs() {
  try {
    const res = await fetch('/api/logs');
    const logs = await res.json();
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.innerHTML = '';
      logs.forEach(entry => {
        const logElement = document.createElement('div');
        logElement.className = 'log-entry';
        logElement.innerHTML = `
          <span class="log-time">[${entry.time}]</span>
          <span class="log-tag ${entry.tag}">${entry.tag.toUpperCase()}</span>
          <span class="log-text">${escapeHtml(entry.message)}</span>
        `;
        logContainer.appendChild(logElement);
      });
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  } catch (err) {
    console.error('Failed to fetch logs:', err);
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Switch Views
function switchView(viewId) {
  activeView = viewId;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    }
  });

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  
  const targetPanel = document.getElementById(`${viewId}-view`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  const headerTitle = document.querySelector('.header-title h1');
  if (headerTitle) {
    headerTitle.textContent = getHeaderTitle(viewId);
  }

  // Refresh content specific to view
  if (viewId === 'dashboard') {
    renderDashboard();
  } else if (viewId === 'simulator') {
    renderPhoneChat();
  } else if (viewId === 'crm') {
    renderCRM();
  } else if (viewId === 'appointments') {
    renderAppointmentsTable();
  } else if (viewId === 'db-viewer') {
    renderDbTab(activeDbTab);
  }

  updateConsoleLogs();
}

function getHeaderTitle(viewId) {
  switch (viewId) {
    case 'dashboard': return 'System Performance Dashboard';
    case 'simulator': return 'Interactive WhatsApp Sandbox';
    case 'crm': return 'CRM & Customer Management';
    case 'appointments': return 'Appointment Scheduling & Follow-Ups';
    case 'campaigns': return 'Outbound Marketing Campaigns';
    case 'db-viewer': return 'Central Application Database';
    default: return 'WhatsApp Automation Console';
  }
}

// Flowchart Pathway Glowing Animations
function triggerDiagramFlow(pathType, callback) {
  // Clear any existing active classes
  document.querySelectorAll('.diagram-node').forEach(node => {
    node.classList.remove('active-pulse', 'active-pulse-wa');
  });
  document.querySelectorAll('.connector-path').forEach(path => {
    path.classList.remove('active', 'active-wa');
  });

  let steps = [];
  if (pathType === 'order_status') {
    steps = [
      { node: 'start-node', delay: 0 },
      { node: 'wa-api-node', path: 'path-start-wa', delay: 300 },
      { node: 'webhook-node', path: 'path-wa-webhook', delay: 600 },
      { node: 'backend-node', path: 'path-webhook-backend', delay: 900 },
      { node: 'order-status-node', path: 'path-backend-order', delay: 1200 },
      { node: 'database-node', path: 'path-order-db', delay: 1500 },
      { node: 'wa-outbound-node', path: 'path-db-outbound', delay: 1800 },
      { node: 'phone-node-dest', path: 'path-outbound-phone', delay: 2100 }
    ];
  } else if (pathType === 'auto_reply') {
    steps = [
      { node: 'start-node', delay: 0 },
      { node: 'wa-api-node', path: 'path-start-wa', delay: 300 },
      { node: 'webhook-node', path: 'path-wa-webhook', delay: 600 },
      { node: 'backend-node', path: 'path-webhook-backend', delay: 900 },
      { node: 'auto-reply-node', path: 'path-backend-auto', delay: 1200 },
      { node: 'wa-outbound-node', path: 'path-auto-outbound', delay: 1500 },
      { node: 'phone-node-dest', path: 'path-outbound-phone', delay: 1800 }
    ];
  } else if (pathType === 'ai_chatbot') {
    steps = [
      { node: 'start-node', delay: 0 },
      { node: 'wa-api-node', path: 'path-start-wa', delay: 300 },
      { node: 'webhook-node', path: 'path-wa-webhook', delay: 600 },
      { node: 'backend-node', path: 'path-webhook-backend', delay: 900 },
      { node: 'ai-chatbot-node', path: 'path-backend-ai', delay: 1200 },
      { node: 'database-node', path: 'path-ai-db', delay: 1500 },
      { node: 'wa-outbound-node', path: 'path-db-outbound', delay: 1800 },
      { node: 'phone-node-dest', path: 'path-outbound-phone', delay: 2100 }
    ];
  } else if (pathType === 'appointment_mgmt') {
    steps = [
      { node: 'start-node', delay: 0 },
      { node: 'wa-api-node', path: 'path-start-wa', delay: 300 },
      { node: 'webhook-node', path: 'path-wa-webhook', delay: 600 },
      { node: 'backend-node', path: 'path-webhook-backend', delay: 900 },
      { node: 'ai-chatbot-node', path: 'path-backend-ai', delay: 1200 },
      { node: 'database-node', path: 'path-ai-db', delay: 1500 },
      { node: 'appt-mgmt-node', path: 'path-db-appt', delay: 1800 },
      { node: 'wa-outbound-node', path: 'path-appt-outbound', delay: 2100 },
      { node: 'phone-node-dest', path: 'path-outbound-phone', delay: 2400 }
    ];
  } else if (pathType === 'human' || pathType === 'campaign') {
    steps = [
      { node: 'admin-dashboard-node', delay: 0 },
      { node: 'database-node', path: 'path-admin-db', delay: 300 },
      { node: 'wa-outbound-node', path: 'path-db-outbound', delay: 600 },
      { node: 'phone-node-dest', path: 'path-outbound-phone', delay: 900 }
    ];
  }

  steps.forEach(step => {
    setTimeout(() => {
      const nodeEl = document.getElementById(step.node);
      if (nodeEl) {
        nodeEl.classList.add(pathType === 'human' || pathType === 'campaign' ? 'active-pulse' : 'active-pulse-wa');
      }
      if (step.path) {
        const pathEl = document.getElementById(step.path);
        if (pathEl) {
          pathEl.classList.add(pathType === 'human' || pathType === 'campaign' ? 'active' : 'active-wa');
        }
      }
    }, step.delay);
  });

  const totalDuration = steps[steps.length - 1].delay + 400;
  setTimeout(callback, totalDuration);
}

// Incoming Message Submission API
async function processIncomingMessage(text, customerId) {
  if (!text.trim()) return;

  // Append user message immediately to the phone view for quick response feedback
  const chatArea = document.getElementById('phone-chat-area');
  if (chatArea) {
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble outgoing';
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `${escapeHtml(text)}<div class="message-meta">${nowStr} <i class="ri-double-check-line"></i></div>`;
    chatArea.appendChild(bubble);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  // Show typing indicator
  const typingIndicator = document.getElementById('phone-typing');
  if (typingIndicator) {
    typingIndicator.style.display = 'block';
    chatArea.appendChild(typingIndicator); // push typing to bottom
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  try {
    const res = await fetch('/api/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, customerId })
    });
    const data = await res.json();
    
    if (data.success) {
      // Trigger SVG dataflow connector highlight animations
      triggerDiagramFlow(data.route, () => {
        if (typingIndicator) typingIndicator.style.display = 'none';
        
        // Refresh phone chat layout to display bot response bubble
        renderPhoneChat();
        updateConsoleLogs();
      });
    }
  } catch (err) {
    console.error('Webhook dispatch failed:', err);
    if (typingIndicator) typingIndicator.style.display = 'none';
  }
}

// Live Admin Overwrite Text API
async function sendAdminMessage(text) {
  if (!text.trim()) return;

  try {
    const res = await fetch('/api/chat/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerId: activeCustomerId, text })
    });
    const data = await res.json();
    if (data.success) {
      // Render details chat view immediately
      renderCRM();
      triggerDiagramFlow('human', () => {
        renderPhoneChat();
        updateConsoleLogs();
      });
    }
  } catch (err) {
    console.error('Failed to submit agent message:', err);
  }
}

// Render dashboard analytics values and charts
async function renderDashboard() {
  try {
    const res = await fetch('/api/dashboard');
    const data = await res.json();

    document.getElementById('stat-total-chats').textContent = data.totalChats;
    document.getElementById('stat-active-orders').textContent = data.activeOrders;
    document.getElementById('stat-booked-appts').textContent = data.bookedAppts;
    document.getElementById('stat-resolution-rate').textContent = `${data.resolutionRate}%`;

    // Populate chart using statistics returned
    const container = document.getElementById('dashboard-chart');
    if (container) {
      container.innerHTML = '';
      
      // Draw SVG Background grid
      const svgOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgOverlay.setAttribute('class', 'chart-svg-overlay');
      for (let i = 1; i <= 3; i++) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const yPos = 250 - (i * 60);
        line.setAttribute('x1', '0');
        line.setAttribute('y1', yPos.toString());
        line.setAttribute('x2', '100%');
        line.setAttribute('y2', yPos.toString());
        line.setAttribute('class', 'chart-grid-line');
        svgOverlay.appendChild(line);
      }
      container.appendChild(svgOverlay);

      const sources = {
        'Auto Reply': 0,
        'AI Chatbot': 0,
        'Order Status': 0,
        'Live Agent': 0,
        'Campaigns': 0
      };

      data.routingStats.forEach(stat => {
        if (stat.source === 'auto_reply') sources['Auto Reply'] = stat.count;
        if (stat.source === 'ai_chatbot') sources['AI Chatbot'] = stat.count;
        if (stat.source === 'order_status') sources['Order Status'] = stat.count;
        if (stat.source === 'human') sources['Live Agent'] = stat.count;
        if (stat.source === 'campaign') sources['Campaigns'] = stat.count;
      });

      let maxVal = Math.max(...Object.values(sources), 1);
      if (maxVal < 5) maxVal = 5;

      Object.entries(sources).forEach(([label, value]) => {
        const wrap = document.createElement('div');
        wrap.className = 'chart-bar-wrap';

        const barHeightPercent = (value / maxVal) * 80;

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(barHeightPercent, 10)}%`;

        if (label === 'Live Agent') {
          bar.style.background = 'linear-gradient(180deg, var(--accent-orange) 0%, rgba(245, 158, 11, 0.2) 100%)';
        } else if (label === 'Campaigns') {
          bar.style.background = 'linear-gradient(180deg, var(--accent-red) 0%, rgba(244, 63, 94, 0.2) 100%)';
        }

        const valueLabel = document.createElement('span');
        valueLabel.className = 'chart-bar-value';
        valueLabel.textContent = value;
        bar.appendChild(valueLabel);

        const labelText = document.createElement('span');
        labelText.className = 'chart-label';
        labelText.textContent = label;

        wrap.appendChild(bar);
        wrap.appendChild(labelText);
        container.appendChild(wrap);
      });
    }

    // Populate logs activity panel
    const logRes = await fetch('/api/logs');
    const logs = await logRes.json();
    const activityList = document.getElementById('activity-list');
    if (activityList) {
      activityList.innerHTML = '';
      logs.slice(-5).reverse().forEach(evt => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        let dotColor = '#3b82f6';
        if (evt.tag === 'webhook') dotColor = '#a855f7';
        if (evt.tag === 'db') dotColor = '#06b6d4';
        if (evt.tag === 'outbound') dotColor = '#eab308';

        item.innerHTML = `
          <div class="activity-dot" style="background: ${dotColor}"></div>
          <div>
            <strong>[${evt.tag.toUpperCase()}]</strong> ${escapeHtml(evt.message)}
          </div>
          <div class="activity-time">${evt.time}</div>
        `;
        activityList.appendChild(item);
      });
    }

  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// Render customer conversations in phone mockup simulator
async function renderPhoneChat() {
  const chatArea = document.getElementById('phone-chat-area');
  if (!chatArea) return;

  const typingIndicator = document.getElementById('phone-typing');
  chatArea.innerHTML = '';

  try {
    const res = await fetch(`/api/customers/${activeCustomerId}`);
    const data = await res.json();
    
    // Update phone headers
    const phoneTitle = document.getElementById('phone-contact-name');
    if (phoneTitle) phoneTitle.textContent = data.customer.name;

    data.messages.forEach(msg => {
      const bubble = document.createElement('div');
      
      if (msg.sender === 'customer') {
        bubble.className = 'message-bubble outgoing';
        bubble.innerHTML = `
          ${escapeHtml(msg.text)}
          <div class="message-meta">
            ${msg.timestamp} <i class="ri-double-check-line"></i>
          </div>
        `;
      } else {
        bubble.className = 'message-bubble incoming';
        let botTag = '🤖 Automation';
        if (msg.sender === 'agent') botTag = '🧑 Live Agent';
        bubble.innerHTML = `
          <div style="font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; font-weight: 600;">${botTag}</div>
          ${escapeHtml(msg.text)}
          <div class="message-meta">${msg.timestamp}</div>
        `;
      }
      chatArea.appendChild(bubble);
    });

    if (typingIndicator) chatArea.appendChild(typingIndicator);
    chatArea.scrollTop = chatArea.scrollHeight;

  } catch (err) {
    console.error('Failed to render phone chat:', err);
  }
}

// Render CRM directory list and focused client summaries
async function renderCRM() {
  const listContainer = document.getElementById('crm-customer-list');
  if (!listContainer) return;

  try {
    const res = await fetch('/api/customers');
    const customers = await res.json();
    
    listContainer.innerHTML = '';
    customers.forEach(cust => {
      const item = document.createElement('div');
      item.className = `customer-item ${cust.id === activeCustomerId ? 'active' : ''}`;
      item.onclick = () => {
        activeCustomerId = cust.id;
        renderCRM();
        renderPhoneChat();
      };
      item.innerHTML = `
        <div class="phone-avatar">${cust.name.split(' ').map(n => n[0]).join('')}</div>
        <div class="customer-info">
          <span class="customer-name">${cust.name}</span>
          <span class="customer-last-msg">${escapeHtml(cust.lastMessage)}</span>
          <span class="customer-tag tag-${cust.status}">${cust.status.toUpperCase()}</span>
        </div>
      `;
      listContainer.appendChild(item);
    });

    // Populate active details
    const detailRes = await fetch(`/api/customers/${activeCustomerId}`);
    const details = await detailRes.json();

    document.getElementById('crm-det-name').textContent = details.customer.name;
    document.getElementById('crm-det-phone').textContent = details.customer.phone;
    document.getElementById('crm-det-email').textContent = details.customer.email;
    
    const statusEl = document.getElementById('crm-det-status');
    statusEl.className = `status-pill status-${details.customer.status === 'active' ? 'delivered' : details.customer.status === 'lead' ? 'pending' : 'cancelled'}`;
    statusEl.textContent = details.customer.status.toUpperCase();
    
    document.getElementById('crm-det-joined').textContent = details.customer.joined;

    // Build order history sub-table
    const orderHistoryContainer = document.getElementById('crm-order-history');
    if (orderHistoryContainer) {
      if (details.orders.length > 0) {
        orderHistoryContainer.innerHTML = `
          <table class="data-table">
            <thead>
              <tr><th>Order ID</th><th>Items</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${details.orders.map(o => `
                <tr>
                  <td><strong>${o.id}</strong></td>
                  <td>${o.items}</td>
                  <td>${o.total}</td>
                  <td><span class="status-pill status-${o.status.toLowerCase()}">${o.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      } else {
        orderHistoryContainer.innerHTML = '<div style="color: var(--text-secondary); font-size:13px;">No orders found for this customer.</div>';
      }
    }

    // Build CRM takeover conversations thread
    const crmChatArea = document.getElementById('crm-chat-takeover-history');
    if (crmChatArea) {
      crmChatArea.innerHTML = '';
      details.messages.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${msg.sender === 'customer' ? 'incoming' : 'outgoing'}`;
        
        let label = 'Customer';
        if (msg.sender === 'system') label = 'Automation';
        if (msg.sender === 'agent') label = 'Live Agent (You)';

        if (msg.sender !== 'customer') {
          bubble.style.background = msg.sender === 'agent' ? '#005c4b' : '#2c3e50';
        }

        bubble.innerHTML = `
          <div style="font-size: 10px; opacity: 0.7; margin-bottom: 2px; font-weight: bold;">${label}</div>
          ${escapeHtml(msg.text)}
          <div class="message-meta">${msg.timestamp}</div>
        `;
        crmChatArea.appendChild(bubble);
      });
      crmChatArea.scrollTop = crmChatArea.scrollHeight;
    }

  } catch (err) {
    console.error('CRM rendering failed:', err);
  }
}

// Fetch and render appointments
async function renderAppointmentsTable() {
  const container = document.getElementById('appointments-table-container');
  if (!container) return;

  try {
    const apptRes = await fetch('/api/appointments');
    const appts = await apptRes.json();
    const custRes = await fetch('/api/customers');
    const customers = await custRes.json();

    if (appts.length === 0) {
      container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary)">No scheduled appointments.</div>';
      return;
    }

    let html = `
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Customer</th>
            <th>Phone</th>
            <th>Service</th>
            <th>Date & Time</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    appts.forEach(appt => {
      const customer = customers.find(c => c.id === appt.customer_id);
      const dateFormatted = new Date(appt.date_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      
      html += `
        <tr>
          <td><strong>${appt.id}</strong></td>
          <td>${customer ? customer.name : 'Unknown'}</td>
          <td>${customer ? customer.phone : 'N/A'}</td>
          <td>${appt.service}</td>
          <td>${dateFormatted}</td>
          <td><span class="status-pill status-${appt.status === 'Confirmed' ? 'delivered' : 'pending'}">${appt.status}</span></td>
          <td>
            <button class="btn btn-primary" style="padding: 4px 8px; font-size: 11px;" onclick="triggerApptReminder('${appt.id}')">
              <i class="ri-notification-badge-line"></i> Ping WhatsApp
            </button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

  } catch (err) {
    console.error('Failed to load appointments:', err);
  }
}

// Trigger appointment template reminder
async function triggerApptReminder(apptId) {
  try {
    const res = await fetch(`/api/appointments/${apptId}/reminder`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert('Outbound appointment reminder template enqueued and sent successfully.');
      renderAppointmentsTable();
      updateConsoleLogs();
    }
  } catch (err) {
    console.error('Reminder trigger failed:', err);
  }
}

// Dispatch marketing campaign templates
async function sendCampaignBlast() {
  const templateSelect = document.getElementById('campaign-template-select');
  const segmentSelect = document.getElementById('campaign-segment-select');
  if (!templateSelect || !segmentSelect) return;

  const template = templateSelect.value;
  const segment = segmentSelect.value;

  try {
    const res = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, segment })
    });
    const data = await res.json();
    
    if (data.success) {
      alert(`Campaign broadcast sent successfully! Dispatched templates to ${data.count} recipients.`);
      triggerDiagramFlow('campaign', () => {
        renderPhoneChat();
        updateConsoleLogs();
      });
    } else {
      alert(`Campaign failed: ${data.error}`);
    }
  } catch (err) {
    console.error('Campaign broadcast dispatch failed:', err);
  }
}

// Fetch database rows directly from SQLite tables
async function renderDbTab(tabName) {
  activeDbTab = tabName;
  document.querySelectorAll('.db-tab').forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-tab') === tabName) {
      btn.classList.add('active');
    }
  });

  const tableContainer = document.getElementById('db-table-contents');
  if (!tableContainer) return;

  try {
    const res = await fetch(`/api/db/${tabName}`);
    const rows = await res.json();

    if (rows.length === 0) {
      tableContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Table is currently empty.</div>';
      return;
    }

    let tableHtml = '<table class="data-table"><thead><tr>';
    const keys = Object.keys(rows[0]);
    keys.forEach(k => {
      tableHtml += `<th>${k.toUpperCase()}</th>`;
    });
    tableHtml += '</tr></thead><tbody>';

    rows.forEach(row => {
      tableHtml += '<tr>';
      keys.forEach(k => {
        let val = row[k];
        if (k === 'status') {
          tableHtml += `<td><span class="status-pill status-${val.toString().toLowerCase() === 'confirmed' || val.toString().toLowerCase() === 'delivered' || val.toString().toLowerCase() === 'active' ? 'delivered' : val.toString().toLowerCase() === 'pending' || val.toString().toLowerCase() === 'shipped' || val.toString().toLowerCase() === 'lead' ? 'pending' : 'cancelled'}">${val}</span></td>`;
        } else {
          tableHtml += `<td>${escapeHtml(val ? val.toString() : '')}</td>`;
        }
      });
      tableHtml += '</tr>';
    });

    tableHtml += '</tbody></table>';
    tableContainer.innerHTML = tableHtml;

  } catch (err) {
    tableContainer.innerHTML = `<div style="padding: 20px; color: var(--accent-red)">Failed to inspect table: ${escapeHtml(err.message)}</div>`;
  }
}

// DOM Setup
document.addEventListener('DOMContentLoaded', () => {
  // Sidebar tab click listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      switchView(viewId);
    });
  });

  // Simulated phone messages listeners
  const phoneSendBtn = document.getElementById('phone-send-btn');
  const phoneInput = document.getElementById('phone-input');
  
  if (phoneSendBtn && phoneInput) {
    const handleSend = () => {
      const text = phoneInput.value.trim();
      if (!text) return;
      phoneInput.value = '';
      processIncomingMessage(text, activeCustomerId);
    };
    phoneSendBtn.addEventListener('click', handleSend);
    phoneInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  // CRM Chat takeover override listeners
  const crmSendBtn = document.getElementById('crm-takeover-send');
  const crmInput = document.getElementById('crm-takeover-input');
  
  if (crmSendBtn && crmInput) {
    const handleCrmSend = () => {
      const text = crmInput.value.trim();
      if (!text) return;
      crmInput.value = '';
      sendAdminMessage(text);
    };
    crmSendBtn.addEventListener('click', handleCrmSend);
    crmInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleCrmSend();
    });
  }

  // SQLite DB Inspect tabs listeners
  document.querySelectorAll('.db-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      renderDbTab(tabName);
    });
  });

  // Initial load
  switchView('dashboard');
});
