"# FSDPV2" 
# Aikido Shinju-Kai website

A React front end with an Express API. Enquiries from the website are saved in a SQLite database.

## Run it

Needs Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3100. Change `ADMIN_TOKEN` in `.env` before going live.

To run the production version:

```bash
npm run build
npm start
```

Run the backend tests with `npm test`.

## See enquiries

Go to `/admin` and enter the `ADMIN_TOKEN` from `.env`. Enquiries are saved in `storage/enquiries.db` and are not emailed to anyone.

## Update the content

| To change | Edit |
| --- | --- |
| Dojos and class times | `data/dojos.json` |
| Headquarters timetable | `data/hq-timetable.json` |
| Instructors | `data/instructors.json` |
| Fees | `data/fees.json` |
| About text and history | `src/App.jsx` |
| Joining steps | `src/Join.jsx` |
| Photos | `public/images/` |

The API serves the `data` files, so restart the server after editing them.

## Hosting

Set `NODE_ENV=production`, `ADMIN_TOKEN` and, behind a reverse proxy, `TRUST_PROXY=1`. The host needs a persistent disk for `storage/`, or enquiries are lost on redeploy. You can set `DATABASE_PATH` to put the database elsewhere.
