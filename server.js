const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// In-memory order store and SSE clients
const orders = [];
const sseClients = new Set();
let nextOrderId = 1;

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
    reqPath = '/public/waiter.html';
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
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ orders }));
    return true;
  }

  if (pathname === '/api/orders' && req.method === 'POST') {
    parseJsonBody(req)
      .then((data) => {
        const tableNumberRaw = data.tableNumber;
        const itemsRaw = data.items;

        const tableNumber = Number(tableNumberRaw);
        const items = Array.isArray(itemsRaw)
          ? itemsRaw.map((s) => String(s)).filter((s) => s.trim().length > 0)
          : [];

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

        const order = {
          id: String(nextOrderId++),
          tableNumber,
          items,
          status: 'new',
          createdAt: new Date().toISOString(),
        };
        orders.push(order);
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
      .then((data) => {
        const status = String(data.status || '').trim();
        if (!status) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Missing status' }));
          return;
        }
        const order = orders.find((o) => o.id === id);
        if (!order) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Order not found' }));
          return;
        }
        order.status = status;
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
  console.log(`POS server running at http://localhost:${PORT}`);
  console.log('Waiter UI:   /public/waiter.html');
  console.log('Kitchen UI:  /public/kitchen.html');
});


