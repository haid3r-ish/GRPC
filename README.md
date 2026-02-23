# gRPC Workspace

Quick reference to run the `s1` service and the local test server (checkout + Stripe webhook).

## Overview
- `s1`: gRPC authentication/subscription service (entry: `services/s1/app.js`).
- `test` server: lightweight Express server for checkout pages & Stripe webhook (`services/test/server.js`).
- gRPC server listens on `0.0.0.0:50052` by default (see `app.js`).

## Prerequisites
- Node.js (16+ recommended)
- npm
- ngrok (for receiving Stripe webhooks from Stripe servers)

## Important env vars (example)
- `STRIPE_SECRET_KEY`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`
- `MONGODB_URI`
- `PORT` (for test server; default 3000)

Store these in a `.env` file at the service or workspace root (see `services/s1/app.js` for the path used).

## Install
From the workspace root or inside each service folder:

- s1:
  - `cd services/s1`
  - `npm install`
- test server:
  - `cd services/test`
  - `npm install dotenv express cors @grpc/grpc-js`

## Run `s1` (gRPC)
- Ensure dotenv is loaded before other requires in `app.js`. Example (top of file):
  ```js
  require('dotenv').config({ path: require.resolve("./src/config/.env") });
  require('module-alias/register');
  ```
- Start:
  - `cd services/s1`
  - `node app.js`
- Confirm gRPC server listening on `50052`.

## Run test server (checkout + webhook)
- `cd services/test`
- Ensure `.env` contains `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` (webhook secret obtained from Stripe dashboard).
- Start:
  - `node server.js`
- Test server serves static pages on port 3000 by default and exposes:
  - `POST /api/checkout` → calls gRPC `checkSubscription`
  - `POST /api/webhook/stripe` → webhook endpoint (must be called by Stripe)

## Expose webhook to Stripe (ngrok)
- Start ngrok to forward port 3000:
  - `ngrok http 3000`
- In Stripe Dashboard → Webhooks → Add endpoint:
  - URL: `https://<your-ngrok>.ngrok.io/api/webhook/stripe`
  - Event: `checkout.session.completed`
- Copy the Signing Secret and set `STRIPE_WEBHOOK_SECRET` in `.env`, then restart servers.

## Manual test flow
1. Start `s1` (gRPC) and test server.
2. Start ngrok and configure Stripe webhook.
3. Hit test server `/api/checkout` (or use the HTML checkout page) to get Stripe Checkout URL.
4. Complete payment in Stripe test mode with a Stripe test card.
5. Stripe posts webhook to ngrok → forwarded to `/api/webhook/stripe` → test server forwards the signature/body to gRPC `subscriptionWebHook`.
6. Check console logs in test server and `s1` for webhook processing.

## Debug tips
- `dotenv` must load before any module that reads `process.env`. If `.env` is in repo root but your service loads from `services/s1`, specify an absolute path or use `require.resolve`.
- Webhook verification requires raw body: endpoint must use `express.raw({ type: 'application/json' })` before `express.json()`.
- Signature from Stripe is in header `stripe-signature`.
- If webhook not received: verify ngrok URL used in Stripe and that ngrok is running.

## Git / cleanup notes
- Add `.gitignore` (root) to exclude `node_modules` and `.env`.
- To remove tracked files/folders use `git rm` then commit.
