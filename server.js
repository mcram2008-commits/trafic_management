// Node.js Express server with native SQLite database for WhatsApp Business Automation System
// Fully integrated with Meta's WhatsApp Business Cloud API (hybrid simulator/production server)
const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Simple Environment Variable Loader from .env file
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim().replace(/(^"|"$)/g, '');
          process.env[key] = value;
        }
      }
    });
    console.log(`\x1b[36m[Config] Loaded environment configurations from local .env\x1b[0m`);
  }
} catch (err) {
  console.log('[Config] Gracefully skipped .env file load. Using process.env fallback.');
}

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

// 2. Establish SQLite DB Connection
const db = new DatabaseSync(path.join(__dirname, 'database.db'));

// Helper to format timestamps
function getShortTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getCurrentTimeLog() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Global log tracking for the developer console
let serverLogs = [
  { time: getCurrentTimeLog(), tag: 'webhook', message: 'Webhook server listening on Meta API endpoint.' },
  { time: getCurrentTimeLog(), tag: 'db', message: 'Established connection to SQLite database: database.db' }
];

function logMsg(tag, message) {
  serverLogs.push({
    time: getCurrentTimeLog(),
    tag: tag,
    message: message
  });
  // Cap logs size
  if (serverLogs.length > 50) serverLogs.shift();
}

// 3. Initialize database tables
db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    email TEXT,
    status TEXT,
    joined TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id INTEGER,
    items TEXT,
    total TEXT,
    date TEXT,
    status TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    customer_id INTEGER,
    service TEXT,
    date_time TEXT,
    status TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT,
    price TEXT,
    stock INTEGER
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    sender TEXT,
    text TEXT,
    timestamp TEXT,
    source TEXT,
    FOREIGN KEY(customer_id) REFERENCES customers(id)
  );
`);

// 4. Seed database tables if empty
const customerCount = db.prepare('SELECT COUNT(*) as count FROM customers').get();
if (customerCount.count === 0) {
  logMsg('db', 'Seeding database tables with default mock records...');
  
  // Seed Customers
  const insertCustomer = db.prepare('INSERT INTO customers (name, phone, email, status, joined) VALUES (?, ?, ?, ?, ?)');
  insertCustomer.run('Alex Morgan', '+1 (555) 019-2834', 'alex@example.com', 'active', '2026-05-15');
  insertCustomer.run('Sarah Chen', '+1 (555) 043-9812', 'sarah.c@example.com', 'lead', '2026-06-20');
  insertCustomer.run('John Doe', '+1 (555) 088-7743', 'johndoe@example.com', 'inactive', '2026-01-10');

  // Seed Orders
  const insertOrder = db.prepare('INSERT INTO orders (id, customer_id, items, total, date, status) VALUES (?, ?, ?, ?, ?, ?)');
  insertOrder.run('#1002', 1, '1x Smart IoT Hub, 2x Smart Bulbs', '$129.00', '2026-06-29', 'Shipped');
  insertOrder.run('#1005', 2, '3x Smart Plug Lite', '$57.00', '2026-07-01', 'Pending');

  // Seed Appointments
  const insertAppt = db.prepare('INSERT INTO appointments (id, customer_id, service, date_time, status) VALUES (?, ?, ?, ?, ?)');
  insertAppt.run('APT-401', 2, 'Smart Home Consultation', '2026-07-03T10:00', 'Confirmed');

  // Seed Products
  const insertProduct = db.prepare('INSERT INTO products (id, name, price, stock) VALUES (?, ?, ?, ?)');
  insertProduct.run(101, 'Smart IoT Hub', '$89.00', 15);
  insertProduct.run(102, 'Smart Bulb Pack', '$20.00', 42);
  insertProduct.run(103, 'Smart Plug Lite', '$19.00', 8);

  // Seed Message History
  const insertMsg = db.prepare('INSERT INTO messages (customer_id, sender, text, timestamp, source) VALUES (?, ?, ?, ?, ?)');
  insertMsg.run(1, 'customer', 'Hi there! When will my order ship?', '10:30 AM', 'order_status');
  insertMsg.run(1, 'system', 'Hi Alex! Your order #1002 has been shipped and is on the way. Expected delivery: July 2, 2026.', '10:30 AM', 'order_status');
  insertMsg.run(2, 'customer', 'Hello, I would like to schedule a consultation.', '11:15 AM', 'ai_chatbot');
  insertMsg.run(2, 'system', 'Sure! I can help you schedule. I have booked your Smart Home Consultation for July 3, 2026, at 10:00 AM.', '11:16 AM', 'ai_chatbot');

  logMsg('db', 'Seeding complete.');
}

// 5. Official WhatsApp API Sender Helper
async function sendWhatsAppMessage(recipientPhone, messageText, templateName = null) {
  // Strip non-numbers from recipient phone for Graph API payload compatibility
  const cleanPhone = recipientPhone.replace(/\D/g, '');
  
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID || META_ACCESS_TOKEN.includes('your_meta') || META_PHONE_NUMBER_ID.includes('your_whatsapp')) {
    logMsg('outbound', `Simulated WhatsApp API dispatch. Recipient: +${cleanPhone}`);
    logMsg('outbound', `Response content: "${messageText.replace(/\n/g, ' ').substring(0, 45)}..."`);
    return;
  }

  logMsg('outbound', `Dispatching real WhatsApp API message to: +${cleanPhone}...`);

  try {
    const url = `https://graph.facebook.com/v19.0/${META_PHONE_NUMBER_ID}/messages`;
    
    let payload = {};
    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" }
        }
      };
    } else {
      payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: false,
          body: messageText
        }
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (response.ok) {
      logMsg('outbound', `Meta Graph API success. msg_id: ${data.messages && data.messages[0] ? data.messages[0].id : 'N/A'}`);
    } else {
      logMsg('outbound', `Meta Graph API error: ${JSON.stringify(data.error)}`);
    }
  } catch (err) {
    logMsg('outbound', `Meta API fetch failure: ${err.message}`);
  }
}

// 6. REST API Endpoint Implementations

// Fetch logs endpoint
app.get('/api/logs', (req, res) => {
  res.json(serverLogs);
});

// GET /api/dashboard
app.get('/api/dashboard', (req, res) => {
  try {
    const totalChats = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'customer'").get().count;
    const activeOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status != 'Delivered' AND status != 'Cancelled'").get().count;
    const bookedAppts = db.prepare("SELECT COUNT(*) as count FROM appointments WHERE status = 'Confirmed'").get().count;
    
    // Count resolutions
    const totalBotMsgs = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'system'").get().count;
    const totalHumanMsgs = db.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'agent'").get().count;
    const resolutionRate = totalBotMsgs > 0 ? Math.round((totalBotMsgs / (totalBotMsgs + totalHumanMsgs)) * 100) : 100;

    // Get statistics per routing module
    const routingStats = db.prepare(`
      SELECT source, COUNT(*) as count 
      FROM messages 
      WHERE sender IN ('system', 'agent') 
      GROUP BY source
    `).all();

    res.json({
      totalChats,
      activeOrders,
      bookedAppts,
      resolutionRate,
      routingStats
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers
app.get('/api/customers', (req, res) => {
  try {
    const customers = db.prepare('SELECT * FROM customers').all();
    const customersWithLastMsg = customers.map(cust => {
      const lastMsg = db.prepare('SELECT text FROM messages WHERE customer_id = ? ORDER BY id DESC LIMIT 1').get(cust.id);
      return {
        ...cust,
        lastMessage: lastMsg ? lastMsg.text : 'No messages yet'
      };
    });
    res.json(customersWithLastMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
app.get('/api/customers/:id', (req, res) => {
  const customerId = parseInt(req.params.id);
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const messages = db.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY id ASC').all(customerId);
    const orders = db.prepare('SELECT * FROM orders WHERE customer_id = ?').all(customerId);
    const appointments = db.prepare('SELECT * FROM appointments WHERE customer_id = ?').all(customerId);

    res.json({
      customer,
      messages,
      orders,
      appointments
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/appointments
app.get('/api/appointments', (req, res) => {
  try {
    const appointments = db.prepare('SELECT * FROM appointments').all();
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/appointments/:id/reminder
app.post('/api/appointments/:id/reminder', async (req, res) => {
  const apptId = req.params.id;
  try {
    const appt = db.prepare('SELECT * FROM appointments WHERE id = ?').get(apptId);
    if (!appt) return res.status(404).json({ error: 'Appointment not found' });

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(appt.customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const dateFormatted = new Date(appt.date_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const reminderText = `⏰ **Reminder**: Hi ${customer.name}, this is an automated confirmation of your upcoming appointment: **${appt.service}** on **${dateFormatted}**. We look forward to speaking with you!`;

    // SQL INSERT reminder message
    const insertMsg = db.prepare('INSERT INTO messages (customer_id, sender, text, timestamp, source) VALUES (?, ?, ?, ?, ?)');
    insertMsg.run(customer.id, 'system', reminderText, getShortTime(), 'appointment_mgmt');

    // Send real template or simulated message
    await sendWhatsAppMessage(customer.phone, reminderText, 'appointment_reminder');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/campaigns
app.post('/api/campaigns', async (req, res) => {
  const { template, segment } = req.body;
  try {
    let targetCustomers = [];
    if (segment === 'all') {
      targetCustomers = db.prepare('SELECT * FROM customers').all();
    } else {
      targetCustomers = db.prepare('SELECT * FROM customers WHERE status = ?').all(segment);
    }

    if (targetCustomers.length === 0) {
      return res.status(400).json({ error: 'No customers found in selected segment' });
    }

    let campaignMsg = "";
    let templateName = null;
    if (template === 'promo_summer') {
      campaignMsg = "☀️ **Summer Tech Extravaganza!** Get up to 20% off all smart products this week only. Use coupon code SUMMER20. Check out products: automation.example.com/summer-sale";
      templateName = "promo_summer";
    } else if (template === 'product_launch') {
      campaignMsg = "🚀 **New Launch Alert!** Meet the new Smart Plug Lite. Compact, energy-monitoring enabled, and integrates with all voice assistants. Buy yours today: automation.example.com/plug-lite";
      templateName = "product_launch";
    } else {
      campaignMsg = "👋 We value your feedback! Tell us about your smart home automation experience and receive a $10 coupon: automation.example.com/feedback-survey";
      templateName = "feedback_survey";
    }

    logMsg('backend', `Initiating campaign broadcast: segment="${segment}", template="${template}"`);

    const insertMsg = db.prepare('INSERT INTO messages (customer_id, sender, text, timestamp, source) VALUES (?, ?, ?, ?, ?)');
    
    for (const cust of targetCustomers) {
      insertMsg.run(cust.id, 'system', campaignMsg, getShortTime(), 'campaign');
      await sendWhatsAppMessage(cust.phone, campaignMsg, templateName);
    }

    res.json({ success: true, count: targetCustomers.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/db/:table (Database Viewer inspector)
app.get('/api/db/:table', (req, res) => {
  const table = req.params.table;
  const whitelist = ['customers', 'orders', 'appointments', 'products', 'messages'];
  
  if (!whitelist.includes(table)) {
    return res.status(400).json({ error: 'Access Denied: Invalid table parameter' });
  }

  try {
    const rows = db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/webhook (Meta Webhook verification handshake)
app.get('/api/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === (META_VERIFY_TOKEN || 'verify_token_fallback')) {
      logMsg('webhook', `Webhook handshake verification successful! Echoing challenge.`);
      console.log(`\x1b[32m[Webhook] Verification successful: verified token "${token}"\x1b[0m`);
      res.type('text/plain');
      res.status(200).send(challenge);
    } else {
      logMsg('webhook', `Webhook verification failed: token mismatch.`);
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// POST /api/webhook (Meta API simulator webhook & Real WhatsApp API Webhook receiver)
app.post('/api/webhook', async (req, res) => {
  let text = '';
  let customerId = null;
  let isRealMetaWebhook = false;
  let senderPhone = '';
  let senderName = 'Unknown User';

  const body = req.body;

  // Detect and parse official Meta webhook payload
  if (body.object === 'whatsapp_business_account' && body.entry && body.entry[0].changes && body.entry[0].changes[0].value) {
    const value = body.entry[0].changes[0].value;
    
    // Webhooks notify for statuses (sent/delivered/read), we only process incoming messages
    if (value.messages && value.messages[0]) {
      isRealMetaWebhook = true;
      const message = value.messages[0];
      
      if (message.type === 'text' && message.text) {
        text = message.text.body;
      } else {
        text = `[Received ${message.type} message]`;
      }
      senderPhone = message.from;
      
      if (value.contacts && value.contacts[0] && value.contacts[0].profile) {
        senderName = value.contacts[0].profile.name || 'WhatsApp User';
      }
    } else {
      // Gracefully acknowledge delivery receipts
      return res.status(200).send('EVENT_RECEIVED');
    }
  } else {
    // Sandbox simulator fallback
    text = body.text;
    customerId = parseInt(body.customerId);
  }

  try {
    let customer = null;

    if (isRealMetaWebhook) {
      // Search database for customer matching phone format (stripping non-digits)
      const queryPhoneSearch = '%' + senderPhone.replace(/\D/g, '') + '%';
      logMsg('db', `SQL SELECT * FROM customers WHERE phone LIKE '${queryPhoneSearch}'`);
      customer = db.prepare("SELECT * FROM customers WHERE replace(replace(replace(replace(phone, '+', ''), ' ', ''), '-', ''), '(', '') LIKE ?").get(queryPhoneSearch);

      if (!customer) {
        // Automatically insert unrecognized phone contacts into SQLite
        logMsg('db', `SQL INSERT INTO customers (name, phone, email, status, joined) VALUES ('${senderName}', '+${senderPhone}', '', 'lead', date('now'))`);
        const insertCust = db.prepare("INSERT INTO customers (name, phone, email, status, joined) VALUES (?, ?, '', 'lead', date('now'))");
        insertCust.run(senderName, `+${senderPhone}`);
        
        customer = db.prepare("SELECT * FROM customers WHERE phone = ?").get(`+${senderPhone}`);
        logMsg('db', `Registered new WhatsApp contact. DB Customer ID: ${customer.id}`);
      }
      customerId = customer.id;
    } else {
      customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    }

    if (!customer) return res.status(404).json({ error: 'Customer record not found' });

    logMsg('webhook', `Incoming message from ${customer.name} (${customer.phone}): "${text}"`);

    // Insert user message in database
    const insertMsg = db.prepare('INSERT INTO messages (customer_id, sender, text, timestamp, source) VALUES (?, ?, ?, ?, ?)');
    insertMsg.run(customer.id, 'customer', text, getShortTime(), 'unknown');

    logMsg('backend', `Routing message: "${text}"`);
    
    let source = 'ai_chatbot';
    let replyText = "";
    const cleanText = text.toLowerCase();

    // 1. Order check
    if (cleanText.includes('order') || cleanText.includes('#') || cleanText.includes('ship') || cleanText.includes('track')) {
      source = 'order_status';
      logMsg('db', `SQL SELECT * FROM orders WHERE customer_id = ${customer.id}`);
      const order = db.prepare('SELECT * FROM orders WHERE customer_id = ?').get(customer.id);
      
      if (order) {
        replyText = `Hello ${customer.name}! Checked our records, your order ${order.id} status is: **${order.status}**.\n\nItems: ${order.items}\nTotal: ${order.total}`;
      } else {
        replyText = `Hi ${customer.name}, I checked but couldn't find any orders linked to your profile in our system. Please check your order ID and try again!`;
      }
    }
    // 2. Appointment Booking
    else if (cleanText.includes('appointment') || cleanText.includes('book') || cleanText.includes('schedule') || cleanText.includes('reserve')) {
      source = 'appointment_mgmt';
      
      logMsg('db', `SQL SELECT * FROM appointments WHERE customer_id = ${customer.id} AND status = 'Confirmed'`);
      const existingAppt = db.prepare("SELECT * FROM appointments WHERE customer_id = ? AND status = 'Confirmed'").get(customer.id);
      
      if (existingAppt) {
        replyText = `Hi ${customer.name}, you already have a booked consultation on **${new Date(existingAppt.date_time).toLocaleDateString()}** at **${new Date(existingAppt.date_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}**. Would you like to reschedule or cancel?`;
      } else {
        const nextId = 'APT-' + Math.floor(100 + Math.random() * 900);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 2);
        tomorrow.setHours(10, 0, 0, 0); 
        const dateStr = tomorrow.toISOString().substring(0, 16);
        
        logMsg('db', `SQL INSERT INTO appointments (id, customer_id, service, date_time, status) VALUES ('${nextId}', ${customer.id}, 'Smart Home Consultation', '${dateStr}', 'Confirmed')`);
        
        const insertAppt = db.prepare('INSERT INTO appointments (id, customer_id, service, date_time, status) VALUES (?, ?, ?, ?, ?)');
        insertAppt.run(nextId, customer.id, 'Smart Home Consultation', dateStr, 'Confirmed');
        
        replyText = `Fantastic, ${customer.name}! I have successfully scheduled a **Smart Home Consultation** for you on **${tomorrow.toLocaleDateString()}** at **10:00 AM**. A calendar invite has been sent to ${customer.email}.`;
      }
    }
    // 3. FAQ auto reply
    else if (cleanText.includes('hours') || cleanText.includes('time') || cleanText.includes('open') || cleanText.includes('close')) {
      source = 'auto_reply';
      replyText = `🕒 **Business Hours**:\nMonday - Friday: 9:00 AM - 6:00 PM\nSaturday: 10:00 AM - 4:00 PM\nSunday: Closed`;
    } 
    else if (cleanText.includes('where') || cleanText.includes('location') || cleanText.includes('address') || cleanText.includes('office')) {
      source = 'auto_reply';
      replyText = `📍 **Our Location**:\n123 Automation Parkway, Suite 400\nSilicon Valley, CA 94025\n\nDirections link: maps.google.com/mock-place`;
    }
    // 4. AI Chatbot general response
    else {
      source = 'ai_chatbot';
      logMsg('db', `SQL SELECT name, price FROM products WHERE stock > 0 LIMIT 3`);
      const products = db.prepare('SELECT name, price FROM products WHERE stock > 0 LIMIT 3').all();
      const productList = products.map(p => `- ${p.name}: ${p.price}`).join('\n');
      
      replyText = `Hi ${customer.name}! I am your AI assistant. I can help track your order, book consulting appointments, or answer product questions.\n\nHere are some of our popular products:\n${productList}`;
    }

    // Update message source tag in database
    db.prepare("UPDATE messages SET source = ? WHERE customer_id = ? AND sender = 'customer' AND source = 'unknown'").run(source, customer.id);

    // Save Bot Response in SQL database
    insertMsg.run(customer.id, 'system', replyText, getShortTime(), source);
    
    // DISPATCH ACTUAL WHATSAPP API MESSAGE (HYBRID SENDER)
    await sendWhatsAppMessage(customer.phone, replyText);

    if (isRealMetaWebhook) {
      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.json({
        success: true,
        route: source,
        logs: serverLogs.slice(-6)
      });
    }
  } catch (err) {
    console.error('Webhook processing failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/agent (Human override message entry)
app.post('/api/chat/agent', async (req, res) => {
  const { customerId, text } = req.body;
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(parseInt(customerId));
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    logMsg('outbound', `Live agent override. Enqueueing manual message to: ${customer.phone}`);

    const insertMsg = db.prepare('INSERT INTO messages (customer_id, sender, text, timestamp, source) VALUES (?, ?, ?, ?, ?)');
    insertMsg.run(customer.id, 'agent', text, getShortTime(), 'human');

    // Send actual message to Meta
    await sendWhatsAppMessage(customer.phone, text);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Run server
app.listen(PORT, () => {
  console.log(`\x1b[32m[Server] Running WhatsApp Automation Simulator at: http://localhost:${PORT}\x1b[0m`);
});
