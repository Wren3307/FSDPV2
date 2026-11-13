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

Open http://localhost:3100. Fill in `.env` first: see the comments in `.env.example`.

To run the production version:

```bash
npm run build
npm start
```

Run the backend tests with `npm test`.

## Accounts

| Who | How they get an account | Where they log in | What they see |
| --- | --- | --- | --- |
| Member | Signs up at `/signup` and pays the $60 registration through Stripe | `/login`, choosing Member | Profile, and their Principal Dojo's class times once paid |
| Instructor | The admin creates the account | `/login`, choosing Instructor | Profile, and the active members at the dojos they teach |
| Admin | Created on start-up from `ADMIN_EMAIL` and `ADMIN_PASSWORD` | The hidden page at `VITE_ADMIN_PATH` | All accounts, ranks, adding instructors, and enquiries |

Choosing the wrong role on the login page is refused. Nothing on the site links to the admin page, but its path is inside the site's JavaScript, so the admin password is what actually protects it. Restart the server after changing `VITE_ADMIN_PATH`.

### Payments

Sign-up needs `STRIPE_SECRET_KEY` in `.env`. Use a test key (`sk_test_...`) from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys), then pay with the test card `4242 4242 4242 4242`, any future date and any CVC. Without a key, sign-up shows a message asking people to call Headquarters.

After paying, Stripe sends the member to `/signup/complete`, and the server checks the payment with Stripe before activating the account. Members who close the page early can use "Already paid? Check again" on their account page. An admin can also mark a fee paid in person.

## See enquiries

Log in on the admin page and open the Enquiries tab. Enquiries and accounts are saved in `storage/enquiries.db`. Nothing is emailed to anyone.

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

Set `NODE_ENV=production`, `PUBLIC_URL` (with `https://`, which also makes login cookies secure), the admin settings, `STRIPE_SECRET_KEY` and, behind a reverse proxy, `TRUST_PROXY=1`. `VITE_ADMIN_PATH` must be set before `npm run build`. The host needs a persistent disk for `storage/`, or accounts and enquiries are lost on redeploy. You can set `DATABASE_PATH` to put the database elsewhere.
