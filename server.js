require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please create a .env file with SUPABASE_URL and SUPABASE_ANON_KEY');
  console.error('See .env.example for reference');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// SSE clients for real-time updates (optional, Supabase real-time can be used from frontend)
const sseClients = new Set();

function sendSseEvent(eventName, data) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

function serveStatic(req, res) {
  const parsed = url.parse(req.url);
  let reqPath = parsed.pathname;
  if (reqPath === '/') {
    reqPath = '/public/index.html';
  }

  const filePath = path.join(__dirname, reqPath.replace(/^\/+/, ''));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
  }[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-cache' });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        reject(new Error('Body too large'));
        req.connection.destroy();
      }
    });
    req.on('end', () => {
      try {
        const json = body ? JSON.parse(body) : {};
        resolve(json);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function handleApi(req, res) {
  const parsed = url.parse(req.url, true);
  const { pathname } = parsed;

  // CORS for convenience if needed (same-origin pages won't require it)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  if (pathname === '/api/orders' && req.method === 'GET') {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Transform Supabase format to API format
        const orders = data.map(order => ({
          id: order.id,
          tableNumber: order.table_number,
          items: order.items,
          status: order.status,
          createdAt: order.created_at,
          notes: order.notes || '',
          totalPrice: Number(order.total_price || 0),
        }));

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ orders }));
      } catch (err) {
        console.error('Error fetching orders:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Failed to fetch orders', details: String(err.message) }));
      }
    })();
    return true;
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    parseJsonBody(req)
      .then(async (data) => {
        const tableNumberRaw = data.tableNumber;
        const itemsRaw = data.items;
        const notesRaw = data.notes || '';
        const totalPriceRaw = data.totalPrice;

        const tableNumber = Number(tableNumberRaw);
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((s) => String(s)).filter((s) => s.trim().length > 0)
          : [];
        const notes = String(notesRaw || '');
        const totalPrice = Number(totalPriceRaw || 0);

        if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid tableNumber' }));
          return;
        }

        if (items.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Order must include at least one item' }));
          return;
        }

        // Insert into Supabase
        const { data: orderData, error } = await supabase
          .from('orders')
          .insert({
            table_number: tableNumber,
            items: items,
            status: 'new',
            notes: notes || null,
            total_price: Number.isFinite(totalPrice) ? totalPrice : 0,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating order:', error);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Failed to create order', details: String(error.message) }));
          return;
        }

        // Transform to API format
        const order = {
          id: orderData.id,
          tableNumber: orderData.table_number,
          items: orderData.items,
          status: orderData.status,
          createdAt: orderData.created_at,
          notes: orderData.notes || '',
          totalPrice: Number(orderData.total_price || 0),
        };

        sendSseEvent('order_created', order);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(order));
      })
      .catch((err) => {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: String(err && err.message || err) }));
      });
    return true;
  }

  // update status: /api/orders/:id/status with { status }
  if (pathname && pathname.startsWith('/api/orders/') && pathname.endsWith('/status') && req.method === 'POST') {
    const parts = pathname.split('/');
    const id = parts[3];
    parseJsonBody(req)
      .then(async (data) => {
        const status = String(data.status || '').trim();
        if (!status) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing status' }));
          return;
        }

        if (!['new', 'preparing', 'ready'].includes(status)) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Invalid status. Must be: new, preparing, or ready' }));
          return;
        }

        // Update in Supabase
        const { data: orderData, error } = await supabase
          .from('orders')
          .update({ status })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating order:', error);
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Order not found', details: String(error.message) }));
          return;
        }

        // Transform to API format
        const order = {
          id: orderData.id,
          tableNumber: orderData.table_number,
          items: orderData.items,
          status: orderData.status,
          createdAt: orderData.created_at,
          notes: orderData.notes || '',
          totalPrice: Number(orderData.total_price || 0),
        };

        sendSseEvent('order_updated', order);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(order));
      })
      .catch((err) => {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: String(err && err.message || err) }));
      });
    return true;
  }

  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    sseClients.add(res);

    // Heartbeat to keep connections alive on proxies
    const heartbeat = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch (_) { /* ignore */ }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  if (req.url && req.url.startsWith('/api/')) {
    const handled = handleApi(req, res);
    if (handled) return;
  }

  const served = serveStatic(req, res);
  if (served) return;

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
server.listen(PORT, () => {
  console.log(`✅ POS server running at http://localhost:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/`);
  console.log(`👨‍💼 Waiter UI: http://localhost:${PORT}/public/waiter.html`);
  console.log(`👨‍🍳 Kitchen UI: http://localhost:${PORT}/public/kitchen.html`);
  console.log(`🔗 Supabase: ${supabaseUrl}`);
});


