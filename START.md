# Quick Start Guide

## Commands to Run Locally

### 1. Install Dependencies (First time only)
```bash
cd /Users/mohammedtalha/pos
npm install
```

### 2. Start the Server
```bash
npm start
```

Or directly:
```bash
node server.js
```

### 3. Access the Website
Open your browser and go to:
- **Main Dashboard**: http://localhost:3000/
- **Waiter View Only**: http://localhost:3000/public/waiter.html
- **Kitchen View Only**: http://localhost:3000/public/kitchen.html

### 4. Stop the Server
Press `Ctrl + C` in the terminal

### 5. If Port 3000 is Already in Use
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Then start again
npm start
```

### 6. Use a Different Port
```bash
PORT=4000 node server.js
```
Then open: http://localhost:4000/

## Prerequisites
- Node.js installed (v16+ recommended)
- `.env` file with Supabase credentials:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- Database migrations run in Supabase:
  - `001_initial_schema.sql`
  - `002_add_notes_total.sql`

