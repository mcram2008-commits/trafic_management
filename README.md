# WhatsApp Business Automation System Simulator

An interactive, high-fidelity browser-based simulator and dashboard for the WhatsApp Business Automation System. This project visualizes the end-to-end data pipeline from customer WhatsApp message trigger to webhook processing, routing algorithms, database updates, and admin takeover desks.

## 🚀 How to Run the Simulator

Since this is a client-side Single-Page Application (SPA) built with vanilla HTML5, CSS3, and JavaScript, you can run it immediately without complex backend services or database installations.

### Method 1: Open Directly (Easiest)
1. Navigate to the project directory: `c:\Users\Admin\OneDrive\Desktop\man\`
2. Double-click the [index.html](file:///c:/Users/Admin/OneDrive/Desktop/man/index.html) file to open it directly in any modern web browser (Chrome, Edge, Firefox, Safari).

### Method 2: Serve Locally (Recommended)
If you have Python or Node installed, you can spin up a quick local web server for better routing performance and console capabilities:

- **Using Node.js**:
  ```bash
  npx serve .
  ```
- **Using Python**:
  ```bash
  python -m http.server 8000
  ```
  Then open `http://localhost:8000` in your browser.

---

## 🛠️ Key Components & How to Interact

### 📱 1. WhatsApp Sandbox (`WhatsApp Sandbox` view)
- **Interactive Phone Mockup**: On the left, type a query in the chat input. Try keywords like:
  - `"hours"`, `"location"`, `"open"` to trigger the **Auto Reply** pipeline.
  - `"order #1002"`, `"where is my shipping"` to trigger the **Order Status** database pipeline.
  - `"book an appointment"`, `"schedule Consultation"` to trigger the **Appointment Scheduler** pipeline.
  - Custom texts like `"Hello"` to chat with the dynamic **AI Chatbot** pipeline.
- **Pipeline Dataflow Execution Tracker**: Watch the SVG flowchart light up in real-time as your message makes its way from the API Gateway, to the Webhooks, through the router engines, down to the Database, and back to the customer.
- **Developer Console Logs**: Review raw JSON webhook payloads, SQL queries, and outbound API calls in the log terminal.

### 📊 2. Performance Dashboard (`Performance Dashboard` view)
- View metrics on chats handled, active orders, and booked consultations.
- Interactive SVG bar chart showing the allocation of message flows across engines (Auto Reply, Chatbot, Orders, human agents).
- Live audit log monitoring webhook events and DB changes.

### 👥 3. CRM & Agent Intervention Takeover (`CRM & Takeover` view)
- Click on different customer records to see their profile, email, status, and active order histories.
- **Live Takeover Chat**: Simulates an admin intervening to override automation. Type a response and send it; it will show up on the customer's phone mockup.

### 📅 4. Appointment Management (`Appointments` view)
- Displays scheduled customer consultations.
- Trigger "Ping WhatsApp" templates to dispatch custom reminders or notifications to the customer simulator.

### 📢 5. Promotional Campaigns (`Outbound Campaigns` view)
- Design and dispatch promotional messages (e.g. Summer sale coupon codes) to all or segmented (Leads, Active, Inactive) customer cohorts.
- Watch messages propagate to the chat history.

### 🗄️ 6. Database Viewer (`Database Viewer` view)
- Check live database records for `customers`, `orders`, `appointments`, `products`, and `messages` tables, updating automatically as you run simulations.
