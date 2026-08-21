# Hostel Ledger

Multi-hostel management and accounting — Next.js 14 (App Router) + TypeScript + PostgreSQL +
Prisma + NextAuth + Tailwind.

This is the production version of the browser-only prototype: same data model and business
rules, but backed by a real database with **passwords verified server-side**, a **real
scheduled job** for automatic contract cancellation, and **file uploads that live outside the
webroot** behind an access-scoped route.

## What's implemented

- Multi-hostel → unit → room hierarchy, with a Properties tree and dedicated Room detail pages
- Tenants, contracts, check-in/check-out (with deposit settlement)
- **Automatic contract renewal/cancellation**: Monthly contracts get a 4-day grace window after
  a due date — any payment (even partial) within it keeps the contract active; Daily contracts
  have no grace and cancel same-day if unpaid. Runs via a cron-protected endpoint, see
  "Automatic cancellation" below.
- **Archived contracts**: every ended contract (checked out, manually terminated, or
  auto-cancelled) is searchable from the Contracts page, with its end reason and date shown
- **Tenant ⇄ Room cross-linking**: every tenant and room name throughout the app links to a
  detail page — a tenant's page shows their full contract history (with room links) and
  payment history; a room's page shows its current occupant and its own contract history
- Rent obligations generated automatically per contract, partial payments supported
- Income / Expenses / Deposits, all hostel-scoped
- Dashboard: one continuous sheet (not a grid of cards) with a strict mobile-first section
  order, an overdue alert, financial overview, occupancy, revenue potential, trend, and
  outstanding payments
- Authentication (NextAuth, credentials + bcrypt) with role-based nav (Admin / Manager / Reception)
- Per-user access scoping: unrestricted, restricted to specific hostels, or restricted to
  specific units within a single hostel — enforced in every query and server action, not just the UI
- Direct room ⇄ tenant control: Assign / Move / Vacate from the Properties tree, with a safety
  net that force-closes any stray open contract if a room is ever handed to a different tenant
- Admin-only Users screen to create accounts and set their scope, plus password reset
- Tenant ID/passport document upload — one merged control with an ID/Passport toggle, stored
  outside `public/` and only reachable through an authenticated, hostel-scoped route

## Not implemented (still TODO for a full production rollout)

- Audit log UI (the `AuditLog` table exists in the schema; nothing writes to it yet)
- CSV export / print-friendly reports
- Notifications (SMS/WhatsApp/email) — no provider wired up
- Multi-currency, online payment gateway, PWA

---

## Quick start (local)

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL, NEXTAUTH_SECRET, CRON_SECRET
npx prisma migrate dev --name init
npm run seed
npm run dev
```

Demo accounts (from the seed):

| Username           | Password    | Access                          |
|---------------------|-------------|----------------------------------|
| `admin`             | `admin123`  | Full access, can manage Users    |
| `manager`            | `manager123`| Full access                      |
| `marina.reception`  | `marina123` | Marina Hostel only                |
| `b1.reception`       | `flat123`   | Marina Hostel → Building 1 only  |

**Change these passwords (or delete the accounts) before putting real tenant data in.**

---

## Deploying to a VPS (Ubuntu 22.04/24.04) — step by step

This assumes a fresh Ubuntu VPS with root/sudo access and a domain pointed at its IP. Swap
`hostel.example.com` for your real domain throughout.

### 1. Basic server setup

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### 2. Install Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # should print v20.x
```

### 3. Install and configure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE USER hostel WITH PASSWORD 'pick-a-strong-password';"
sudo -u postgres psql -c "CREATE DATABASE hostel_manager OWNER hostel;"
```

Your `DATABASE_URL` will be:
```
postgresql://hostel:pick-a-strong-password@localhost:5432/hostel_manager?schema=public
```

### 4. Get the code onto the server

Upload the project (scp/rsync the zip, or push it to a private git repo and clone it), then:

```bash
cd /var/www
sudo mkdir hostel-ledger && sudo chown $USER:$USER hostel-ledger
cd hostel-ledger
# unzip or git clone the project here
npm install
```

### 5. Configure environment

```bash
cp .env.example .env
nano .env
```

Set:
- `DATABASE_URL` from step 3
- `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `https://hostel.example.com`
- `UPLOAD_DIR` — e.g. `/var/www/hostel-ledger/uploads` (make sure this is backed up — see below)
- `CRON_SECRET` — generate with `openssl rand -hex 24`

### 6. Set up the database and build

```bash
npx prisma migrate deploy
npm run seed          # optional — skip this if you don't want the demo data on a live server
npm run build
```

### 7. Run it with pm2 (keeps it running, restarts on crash/reboot)

```bash
sudo npm install -g pm2
pm2 start npm --name hostel-ledger -- start
pm2 save
pm2 startup            # follow the printed instructions to enable on-boot startup
```

### 8. Put nginx in front (TLS + reverse proxy)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/hostel-ledger
```

```nginx
server {
    listen 80;
    server_name hostel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hostel-ledger /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 9. Get a TLS certificate (free, via Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hostel.example.com
```

Certbot edits the nginx config to add HTTPS and sets up auto-renewal. Your app is now live at
`https://hostel.example.com`.

### 10. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Automatic contract cancellation (cron)

The reconciliation job lives at `GET /api/cron/reconcile?secret=YOUR_CRON_SECRET`. It's not
meant to be called from the browser — it's meant to be called once a day (or more often if you
want) by a real scheduler. On a VPS, use system cron:

```bash
crontab -e
```

Add a line to run it daily at 2am:

```
0 2 * * * curl -fsS "https://hostel.example.com/api/cron/reconcile?secret=YOUR_CRON_SECRET" >> /var/log/hostel-reconcile.log 2>&1
```

If you'd rather not put the secret in crontab in plaintext, read it from your `.env` file
instead:

```
0 2 * * * curl -fsS "https://hostel.example.com/api/cron/reconcile?secret=$(grep CRON_SECRET /var/www/hostel-ledger/.env | cut -d= -f2 | tr -d '\"')" >> /var/log/hostel-reconcile.log 2>&1
```

Test it manually first:

```bash
curl "https://hostel.example.com/api/cron/reconcile?secret=YOUR_CRON_SECRET"
# {"ok":true,"cancelled":0,"details":[]}
```

If you deploy on Vercel instead of a VPS, use [Vercel Cron](https://vercel.com/docs/cron-jobs)
pointed at the same route instead of system cron.

---

## Updating the app later

```bash
cd /var/www/hostel-ledger
git pull                        # or re-upload the new code
npm install
npx prisma migrate deploy       # applies any new migrations
npm run build
pm2 restart hostel-ledger
```

---

## File uploads

Tenant ID/passport scans (JPG, PNG, or PDF, up to 8MB) are stored on disk under `UPLOAD_DIR`
with a randomly generated filename — never the name the user uploaded, so nothing is
guessable. They're written outside `public/`, so the only way to read one back is through
`GET /api/tenants/[id]/documents/[docId]`, which re-checks the caller's session and hostel/unit
scope on every request before streaming the file.

Two things to plan around:

- **Backups.** `UPLOAD_DIR` isn't part of the Postgres database — back it up separately (e.g.
  a nightly `rsync` or your VPS provider's snapshot feature covering that path).
- **Body size limits on serverless hosts.** If you deploy on Vercel instead of a VPS, their
  default function body limit (4.5MB on most plans) is smaller than the 8MB this app allows —
  either lower `MAX_UPLOAD_BYTES` in `src/lib/uploads.ts`, or stay on a VPS/Docker host, which
  has no such cap.

## Design system

`src/components/ui.tsx` holds every shared UI primitive (Card, Badge, Button, Field/Input/
Select/Textarea, Alert, EmptyState, MetricPrimary/MetricSecondary, RingStat). Badge colors are
semantic (green = good, amber = attention, rose = overdue/negative, slate = neutral) and
applied consistently everywhere a status appears. Navigation (`src/components/AppShell.tsx`) is
grouped by section on desktop and uses a real mobile bottom-tab bar with a "More" sheet, not a
shrunk sidebar.

## Project structure

```
prisma/schema.prisma      All data models (Hostel → Unit → Room → Tenant → Contract → ...)
prisma/seed.ts            Demo data + demo accounts
src/lib/auth.ts           NextAuth config (credentials provider, JWT session)
src/lib/scope.ts          Access-control helpers — the enforcement point for hostel/unit scoping
src/lib/password.ts       bcrypt hashing
src/lib/reconcile.ts      Auto-cancellation logic, called by the cron route
src/app/api/cron/reconcile  The endpoint your scheduler calls (see above)
src/actions/*.ts          Server actions — all mutations go through these, each one re-checks
                           the caller's session and scope before touching the database
src/app/login             Login page
src/app/(app)/...         Authenticated pages (one folder per nav item), including
                           tenants/[id] and rooms/[id] detail pages
src/middleware.ts         Redirects unauthenticated requests to /login
```

## Extending it

Each entity's server actions live in `src/actions/`. To add a new field or screen, follow the
existing pattern: extend `schema.prisma`, run `npx prisma migrate dev`, add/adjust the action,
and wire it into the relevant page. Everything reads and writes through Prisma with the
session's hostel/unit scope applied — don't bypass `src/lib/scope.ts` when adding new queries,
or scoped users will see data outside their access.
