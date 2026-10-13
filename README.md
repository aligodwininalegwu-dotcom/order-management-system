# Order Management System

A full-stack online store with customer accounts, a product catalogue, order management, and card/bank payments through [Paystack](https://paystack.com). Admins manage products and fulfil orders from a built-in dashboard.

**Stack:** React 19 · Vite · React Router · Node.js · Express · MongoDB (Mongoose) · JWT · Paystack

## Features

**Customers**
- Register, log in, and reset a forgotten password
- Browse and search products, view product details
- Persistent shopping cart (survives page refreshes)
- Checkout with Paystack, with server-side payment verification
- Order history with a step-by-step tracking timeline (placed → paid → processing → shipped → delivered)
- Retry payment ("Pay now") on any unpaid order, and cancel unpaid orders
- Account page: edit profile and default address, change password, view payment history

**Admins**
- Overview dashboard: 30-day revenue with period comparison, order counts, average order value, a 14-day revenue chart, order-status breakdown, recent orders, and low-stock alerts
- Orders: update fulfilment status (stock is restored automatically on cancellation)
- Transactions: searchable, filterable ledger of every payment
- Products: create, edit, delist, and delete

## Architecture

```
backend/
  config/        MongoDB connection
  controllers/   Request handlers (auth, products, orders, transactions)
  middleware/    JWT auth, role checks, centralised error handling
  models/        Mongoose schemas: User, Product, Order, Transaction
  routes/        Express routers
  utils/         Token generation, env validation, atomic stock handling
  tests/         API tests (node:test)
frontend/
  src/api/       Fetch client (timeouts, auth header, session expiry)
  src/context/   Auth, cart, and toast state
  src/components/ src/pages/
```

### Design decisions

- **Server-side pricing.** Names and prices are read from the database when an order is placed; client-sent prices are ignored.
- **No overselling.** Stock is reserved with a single conditional `$inc` per product, so two simultaneous orders cannot both take the last unit. Failed or cancelled orders return their stock.
- **Payments are verified, not trusted.** The backend confirms every payment with Paystack, checks the amount charged matches the order, and handles each payment idempotently. A signed webhook (`POST /api/transactions/webhook`) also settles payments if the customer closes the browser before returning.
- **Security.** Helmet headers, CORS limited to `CLIENT_URL`, rate limiting (stricter on login/register/password reset), request size limits, input coercion against NoSQL operator injection, field whitelisting on product updates, hashed password-reset tokens, bcrypt password hashing.

## Getting started

**Requirements:** Node.js 18+ and a MongoDB instance (local or [Atlas](https://www.mongodb.com/atlas)).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env     # then fill in real values
npm run dev
```

| Variable | Description |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Long random string (32+ characters in production) |
| `JWT_EXPIRES_IN` | Token lifetime, e.g. `30d` |
| `PAYSTACK_SECRET_KEY` | From Paystack dashboard → Settings → API Keys & Webhooks |
| `PAYSTACK_PUBLIC_KEY` | Same page |
| `CLIENT_URL` | Frontend origin, used for CORS and the payment redirect |
| `RESEND_API_KEY` | Optional. Enables real emails via [Resend](https://resend.com) |
| `EMAIL_FROM` | Optional. Sender address, e.g. `Online Store <orders@yourdomain.com>` |

The server refuses to start if a required variable is missing. Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Optional helpers:

```bash
npm run seed                          # load sample products
npm run make-admin -- you@example.com # promote a registered user to admin
npm test                              # run API tests
```

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env     # VITE_API_URL, defaults to http://localhost:5000/api
npm run dev
```

Open http://localhost:3000.

### 3. Payments

Use Paystack **test** keys. In the Paystack dashboard, set the webhook URL to `https://<your-api-host>/api/transactions/webhook` (use a tunnel such as ngrok for local development).

## API overview

| Method | Endpoint | Access |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Public |
| POST | `/api/auth/forgot-password` | Public |
| PUT | `/api/auth/reset-password/:token` | Public |
| GET / PUT | `/api/auth/me` | User |
| PUT | `/api/auth/me/password` | User |
| GET | `/api/products`, `/api/products/:id` | Public |
| POST / PUT / DELETE | `/api/products[/:id]` | Admin |
| POST | `/api/orders` | User |
| GET | `/api/orders/my-orders`, `/api/orders/:id` | Owner / Admin |
| PUT | `/api/orders/:id/cancel` | Owner |
| GET | `/api/orders` | Admin |
| PUT | `/api/orders/:id/status` | Admin |
| POST | `/api/transactions/initialize` | User |
| GET | `/api/transactions/my` | User |
| GET | `/api/transactions` | Admin |
| GET | `/api/admin/stats` | Admin |
| GET | `/api/transactions/verify/:reference` | Owner / Admin |
| POST | `/api/transactions/webhook` | Paystack (HMAC signed) |
| GET | `/api/health` | Public |

## Deployment

Recommended free-tier setup: **MongoDB Atlas** (database), **Render** (API), **Vercel** (frontend).

1. **Database.** Create a free M0 cluster on MongoDB Atlas, add a database user, and allow network access from anywhere (`0.0.0.0/0`). Copy the connection string (`mongodb+srv://...`) and add a database name, e.g. `/online_store_db`.
2. **API on Render.** Create a new *Blueprint* from this repository (it reads `render.yaml`) and fill in the secret variables it asks for. Set `CLIENT_URL` to your frontend URL once you have it. Confirm `https://<api-host>/api/health` returns `success: true`.
3. **Frontend on Vercel.** Import the repository, set the *Root Directory* to `frontend`, and add the environment variable `VITE_API_URL=https://<api-host>/api`. Deploy.
4. **Connect them.** Put the Vercel URL into `CLIENT_URL` on Render (no trailing slash) and redeploy the API so CORS and payment redirects use it.
5. **Paystack.** In the Paystack dashboard set the webhook URL to `https://<api-host>/api/transactions/webhook`.
6. **Seed and admin.** From your machine, run the helper scripts against the production database by temporarily setting `MONGO_URI` in your shell: `npm run seed`, then register an account and `npm run make-admin -- you@example.com`.

Render's free tier sleeps after inactivity, so the first request after a pause can take about 30 seconds.

## Production notes

- Set `NODE_ENV=production`. Set `RESEND_API_KEY` and `EMAIL_FROM` (with a verified domain) so password-reset links, payment confirmations, and shipping updates are emailed. Without a key, emails are only logged to the console and, in production, password reset cannot deliver links.
- Serve the API over HTTPS and build the frontend with `npm run build` (output in `frontend/dist`).
- Never commit `.env` files.
