# Unique Visitor Analytics

## Public landing
`public/index.html` is intentionally visible without Firebase or Guest login. Anonymous visitors can browse the landing page. Protected chat actions can still send signed-out visitors to login.

## Unique visitor behavior
The browser stores a persistent random ID in `localStorage` under `s2s_unique_visitor_id_v1`. The backend stores only a SHA-256 hash. Reloading, reopening, logging in, logging out, or switching Guest/Firebase mode in the same browser profile does not increase the all-time unique visitor count.

A different browser profile/device, incognito session, or cleared site storage can be counted as a new visitor. This is an unavoidable limitation without requiring verified login/device identity.

## Backend
`visitor-analytics.js` lives beside `server.js` and is registered by:

```js
require("./visitor-analytics")(app);
```

The existing Mongoose connection is reused.

## API
- `POST /api/analytics/visit`
- `GET /api/analytics/summary`
- `GET /api/analytics/years`
- `GET /api/analytics/series?period=day|week|month|year&year=2026&month=8`

## Dashboard
`/analytics.html` refreshes every 5 seconds and supports date-wise, week-wise, month-wise and year-wise views. New years appear automatically from stored visit dates; no January 1 reset job is required.
