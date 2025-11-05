# Restaurant POS (Waiter + Kitchen)

A minimal, dependency-free Node.js app with real-time updates using Server-Sent Events (SSE).

## Features
- Waiter page to submit table number and items
- Kitchen page to see incoming orders in real-time and mark status
- No external packages; just Node's built-in `http` server and SSE

## Run

1. Ensure Node.js is installed (v16+ recommended)
2. From the project directory, run:

```bash
node server.js
```

3. Open the waiter and kitchen UIs:
   - Waiter:  http://localhost:3000/public/waiter.html
   - Kitchen: http://localhost:3000/public/kitchen.html

## Endpoints
- `GET  /api/orders` — list all orders
- `POST /api/orders` — create a new order `{ tableNumber: number, items: string[] }`
- `POST /api/orders/:id/status` — update order status `{ status: "new"|"preparing"|"ready" }`
- `GET  /api/stream` — SSE event stream for real-time updates (`order_created`, `order_updated`)

## Notes
- Data is stored in memory for simplicity. Restarting the server clears orders.
- To change the port, set `PORT=4000` (or another value) before starting the server.

