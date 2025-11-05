# Restaurant POS (Waiter + Kitchen)

A modern restaurant POS system with Supabase backend, featuring real-time updates and persistent storage.

## Features
- 🍽️ **Unified Dashboard** - Waiter and Kitchen views in one page
- 📊 **Real-time Updates** - Orders appear instantly in the kitchen
- 💾 **Persistent Storage** - Supabase database for reliable data storage
- 🎨 **Modern UI** - Tailwind CSS with beautiful dark theme
- ⚡ **Fast & Responsive** - Optimized for production use

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at https://app.supabase.com
2. Go to **Settings** → **API** to get your credentials
3. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Fill in your Supabase credentials in `.env`:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   PORT=3000
   ```

### 3. Run Database Migration

In your Supabase dashboard:
1. Go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run the SQL to create the `orders` table

### 4. Start the Server

```bash
npm start
```

Or for development:
```bash
node server.js
```

### 5. Open the Dashboard

Visit: **http://localhost:3000/**

## Project Structure

```
pos/
├── server.js              # Node.js server with Supabase integration
├── public/
│   ├── index.html         # Unified dashboard (waiter + kitchen)
│   ├── waiter.html        # Waiter-only view
│   ├── kitchen.html       # Kitchen-only view
│   └── styles.css         # Legacy styles (using Tailwind now)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Database schema
├── package.json           # Dependencies
├── .env                   # Environment variables (create from .env.example)
└── README.md             # This file
```

## API Endpoints

- `GET  /api/orders` — list all orders
- `POST /api/orders` — create a new order `{ tableNumber: number, items: string[] }`
- `POST /api/orders/:id/status` — update order status `{ status: "new"|"preparing"|"ready" }`
- `GET  /api/stream` — SSE event stream for real-time updates (backward compatibility)

## Deployment

### Option 1: Deploy to Railway

1. Push your code to GitHub
2. Go to https://railway.app
3. Create a new project from GitHub
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `PORT` (Railway will set this automatically)
5. Deploy!

### Option 2: Deploy to Render

1. Push your code to GitHub
2. Go to https://render.com
3. Create a new **Web Service**
4. Connect your GitHub repository
5. Set build command: `npm install`
6. Set start command: `npm start`
7. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
8. Deploy!

### Option 3: Deploy to Vercel (Serverless)

1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project directory
3. Add environment variables in Vercel dashboard
4. Deploy!

### Option 4: Deploy to DigitalOcean App Platform

1. Push your code to GitHub
2. Go to https://cloud.digitalocean.com/apps
3. Create a new app from GitHub
4. Add environment variables
5. Deploy!

## Environment Variables

Required:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key

Optional:
- `PORT` - Server port (default: 3000)

## Notes

- Data is stored in Supabase PostgreSQL database
- Orders persist across server restarts
- Real-time updates work via Supabase and SSE fallback
- The unified dashboard (`/`) shows both waiter and kitchen views side-by-side

