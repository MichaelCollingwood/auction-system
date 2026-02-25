# Auction Platform

A real-time auction platform where users can create auctions and place bids. Built with Next.js, Prisma, PostgreSQL, and Upstash Redis for real-time updates.

## Features

- **Authentication**: Register and login with salted passwords (bcrypt)
- **Create Auctions**: Item name, starting price, duration
- **Real-time Bidding**: Live bid updates via Upstash Realtime (SSE + Redis Streams)
- **Anti-sniping**: Auctions extend by 30 seconds if a bid is placed in the last 30 seconds
- **Bid History**: Most recent bids displayed in real-time

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (Vercel Postgres, Neon, or local)
- Upstash Redis account

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

- `DATABASE_URL` - PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` - From Upstash Console
- `UPSTASH_REDIS_REST_TOKEN` - From Upstash Console
- `NEXTAUTH_URL` - Your app URL (e.g. `http://localhost:3000`)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`

### 3. Run database migrations

```bash
npx prisma migrate dev
```

### 4. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|--------------|
| `/api/auctions` | POST | Required | Create auction |
| `/api/auctions/[id]` | GET | Optional | Get auction state |
| `/api/auctions/[id]/bid` | POST | Required | Place bid |
| `/api/realtime` | GET | Optional | SSE stream for real-time updates |

## Assumptions & Tradeoffs

- **PostgreSQL**: Chosen for relational data (users, auctions, bids). Vercel Postgres or Neon recommended for Vercel deployment.
- **Upstash Redis + Realtime**: HTTP-based (SSE) instead of WebSockets for Vercel serverless compatibility. Auto-reconnect with message replay.
- **Anti-sniping**: 30-second extension when bid placed in last 30 seconds.
- **Expired auctions**: Ended lazily on fetch (no background cron). For production, consider a scheduled job.
- **Bid validation**: Prisma transaction for atomicity. For very high concurrency, Redis Lua scripts could add extra protection.

## Deploy on Vercel

1. Connect your repo to Vercel
2. Add environment variables (DATABASE_URL, Upstash Redis, NEXTAUTH_*)
3. Enable Vercel Postgres or connect Neon
4. Add Upstash Redis via Vercel integration
5. Deploy

## What I'd Improve With More Time

- Bid increment rules (e.g. minimum $1 increase)
- Reserve price (hidden minimum)
- Auction categories and search
- Email notifications (outbid, auction ended)
- Rate limiting on bid endpoint
- Scheduled job to end expired auctions and emit `auction.ended`
- Image upload for auction items
