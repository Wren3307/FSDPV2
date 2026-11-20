# Aikido Shinju-Kai Singapore — Centralised Student Management System

**Full Stack Development Project (FSDP) | Assignment 1 (Problem Statement PS01)**  
**Institution:** Ngee Ann Polytechnic — School of InfoComm Technology  
**Sprint 1 Prototype & Pitch Submission:** November 2026

---

## 1. Project Overview

**Aikido Shinju-Kai Singapore** (recognised by Aikido World Headquarters, Japan) operates across a permanent HQ Dojo in Sin Ming Road and over 60 branch centres island-wide and overseas, serving 10,000+ members and 70+ instructors.

This centralised web application eliminates fragmented paper/spreadsheet workflows by unifying:
* **Role-Based Access & Student Onboarding** (`FP-1`, `FP-2`, `FP-3`)
* **Belt-Matched Class Enrolment & Stripe Payments** (`FP-4`, `FP-5`, `FP-6`)
* **Multi-Centre Session Attendance & Retention Alerts** (`FP-7`, `FP-9`)
* **Automated Grading Eligibility Assessment Engine** (`FP-10`, `FP-11`)
* **Instructor Progression Dashboard & Student Self-Service Portal** (`FP-15`, `FP-16`)

---

## 2. Sprint 1 MVP Scope (`FP-1` to `FP-16`)

| ID | Story Title | Story Points | Persona | Status |
| :--- | :--- | :---: | :--- | :--- |
| **FP-1** | Role-Based Account Login (Student / Instructor / Admin) | 3 | All Users | Done |
| **FP-2** | Student Registration & Auto-Profile Creation | 3 | Student | In Progress |
| **FP-3** | Automated Welcome Email Notification | 2 | Student | In Progress |
| **FP-5** | Class Enrolment & Belt Prerequisite Matching | 3 | Student | In Progress |
| **FP-7** | Record Class Session Attendance | 5 | Instructor | Done |
| **FP-10** | Automatic Grading Eligibility Assessment Engine | 3 | Admin / System | In Progress |
| **FP-15** | Instructor Progression & Attendance Dashboard | 5 | Instructor | In Progress |
| **FP-16** | Student Self-Service Portal | 3 | Student | Done |

---

## 3. Repository Directory Structure

One Node.js app: an Express API and a React front end, served together on one port.

```text
FSDPV2/
├── server/                 # Express API (Node.js)
│   ├── index.js            # Starts the server: database, Stripe, Vite in development
│   ├── app.js              # API routes: content, enquiries, login, sign-up, payments, admin
│   ├── auth.js             # FP-1 login: password hashing, session cookies, role checks
│   ├── payments.js         # FP-6 Stripe Checkout for membership ($60 joining, $48 renewal)
│   ├── membership.js       # FP-2 membership rules: who is a member, until when, what a payment buys
│   ├── attendance.js       # FP-7 attendance API
│   ├── eligibility.js      # FP-10 grading eligibility engine (+ eligibilityRoutes.js)
│   ├── notifications.js    # FP-11 eligibility notifications (+ notificationRoutes.js)
│   ├── schema.js           # Shared SQLite tables (users, centres, classes, attendance, ...)
│   ├── db.js               # Opens the database; account and enquiry queries
│   ├── seed.js             # Demo data (npm run seed)
│   └── *.test.js           # API tests (npm test)
├── src/                    # React front end
│   ├── App.jsx, Layout.jsx # Public site
│   ├── pages/              # Login, sign-up, member/instructor account, hidden admin page
│   ├── Attendance.jsx      # FP-7 staff screen (/attendance)
│   ├── Eligibility.jsx     # FP-10 staff screen (/eligibility)
│   └── GradingProgress.jsx # FP-11 member's Grading tab and notification banner (on /account)
├── data/                   # Public site content: dojos, timetables, fees, instructors
├── scripts/stripe-setup.js # Creates the membership Products and Prices in Stripe
├── public/images/          # Photos and logo
└── storage/                # SQLite database file (not in git)
```

## 4. Tech Stack & Brand Palette

* **Frontend:** React 19, React Router, Vite
* **Backend:** Node.js 22.13+, Express 5, Helmet, express-rate-limit
* **Database:** SQLite through Node's built-in `node:sqlite`. The schema in `server/schema.js` is the team's PostgreSQL design rewritten for SQLite.
* **Payments:** Stripe Checkout (test mode)
* **Colours:** the public site uses the logo's navy (`#2C3F67`) and red (`#E12429`). The staff screens use the team palette: black (`#1A1A1A`), white, crimson (`#C8102E`) and royal blue (`#1D4ED8`).

---

## 5. Setup & Running Instructions

Needs Node.js 22.13 or newer.

```bash
npm install
cp .env.example .env
npm run dev
```

Fill in `.env` first (see the comments in `.env.example`), then open http://localhost:3100.

* A new, empty database loads the demo data automatically. `npm run seed` reloads it at any time (it replaces accounts, classes and attendance; enquiries are kept).
* If the server says the database was made by an older version, run `npm run seed` once.
* If the server or the seed stops with `table users has no column named phone`, your `storage/enquiries.db` was made by an earlier version of the code. Delete that file and start the server again: it makes a new one with the demo data.
* Restart the server after `npm run seed`. Start-up adds the full dojo list and notifies members who are already eligible for grading.
* `npm test` runs the API tests. `npm run build` then `npm start` runs the production version.

### Demo accounts

Every seeded account uses the password `aikido-demo-2026`. The server never loads demo data when `NODE_ENV=production`.

| Log in as | Email | Choose |
| --- | --- | --- |
| Instructor at ASK Headquarters Dojo | `kenji.yamamoto@example.com` | Instructor |
| Instructor at Cheng San Dojo | `mei.lin@example.com` | Instructor |
| Student, paid member (eligible for grading) | `alice.tan@example.com` | Student |
| Student, membership ended last year (one session short of eligible) | `ben.lim@example.com` | Student |
| Student, free account, never a member | `ethan.koh@example.com` | Student |
| Admin | `aiko.tanaka@example.com` | On the hidden admin page |

The admin named by `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` is also created on start-up.

### Demo: a student becomes eligible and is told (FP-7, FP-10, FP-11)

1. On the day, run `npm run seed` and restart the server. The demo data is dated from today, and this puts Ben back at 13 of the 14 sessions he needs.
2. Log in as Kenji and open `/attendance`. Open a class Ben is in: Monday Beginners, Wednesday General or Friday Fundamentals. Attendance can be saved on the day of the class and the day after.
3. Mark Ben present and save. The screen says Ben is now eligible for his 5th kyu grading.
4. Log in as Ben in another browser or a private window. His account shows the notification, and the Grading tab shows his progress. If his account page was already open, it updates within 5 seconds.

### Accounts

| Who | How they get an account | Where they log in | What they see |
| --- | --- | --- | --- |
| Student | Signs up for free at `/signup`, and can become a paid member there or later | `/login`, choosing Student | Profile, membership, their grading progress, and their Principal Dojo's class times |
| Instructor | The admin creates the account | `/login`, choosing Instructor | Profile, the students at their dojo and whether each is a paid member, `/attendance` and `/eligibility` |
| Admin | Created on start-up from `ADMIN_EMAIL` and `ADMIN_PASSWORD` | The hidden page at `VITE_ADMIN_PATH` | All accounts, ranks, memberships (and recording membership paid at a dojo), adding instructors, enquiries, and the staff screens |

### Membership (FP-2)

Sign-up is free. Membership is a separate, optional purchase, and it is what member offers and member prices check:

* The first membership is **$60**. It includes the one-time registration. Each later year is **$48**.
* A membership runs to **31 December** of the year it is for. Paying while still a member adds the next calendar year. Someone in their final year can renew for next year, but not further ahead.
* Every payment is a row in the `memberships` table, with its period, amount and whether it was paid online (with the Stripe session id) or at a dojo (with the admin who recorded it).
* To check whether someone is a member, use `is_member` and `member_until` on any user the API returns (`/api/auth/me`, `/api/admin/users`, `/api/instructor/members`). In server code, use `createMemberships(connection).status(userId)` from `server/membership.js`.
* Accounts in a database from before free sign-up are converted on start-up. Accounts waiting to pay become free accounts. Anyone who had paid the registration gets a membership to 31 December of the year they paid.

Choosing the wrong role on the login page is refused. Nothing on the site links to the admin page, but its path is inside the site's JavaScript, so the admin password is what actually protects it. Restart the server after changing `VITE_ADMIN_PATH`.

### Payments

Paying for membership online needs `STRIPE_SECRET_KEY` in `.env`. Use a test key (`sk_test_...`) from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys). Then create the two membership Products and Prices (SGD 60 joining, SGD 48 renewal) in that Stripe account:

```bash
npm run stripe:setup
```

The site finds each Price by its lookup key, `ask_registration_fee` and `ask_annual_membership`, so you don't copy any IDs. Running the script again changes nothing. To change a price, edit `PLANS` in `server/membership.js` and run the script again: it makes a new Price and archives the old one. Restart the server afterwards.

Pay with the test card `4242 4242 4242 4242`, any future date and any CVC. Without a key, sign-up still works, and members are told to pay at their dojo, where an admin records the payment. No publishable key is needed, because payment happens on Stripe's own Checkout page.

After paying, Stripe sends the member to `/signup/complete`, and the server checks the payment with Stripe before recording the membership. Each Stripe payment is recorded only once. Members who close the page early can use "Already paid? Check again" on their account page.

### Content and data

| To change | Edit |
| --- | --- |
| Dojos and class times on the public site | `data/dojos.json` (each dojo is also added to the `centres` table) |
| Headquarters timetable | `data/hq-timetable.json` |
| Instructors shown on the public site | `data/instructors.json` |
| Fees | `data/fees.json` |
| Demo accounts, classes and attendance | `server/seed.js` |

Accounts, attendance and enquiries are saved in `storage/enquiries.db`, which is not in git. Nothing is emailed to anyone yet.

---

## 6. Backend API Endpoints

| Method | Endpoint | Who | Description | Feature |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Anyone | Log in as `student`, `instructor` or `admin` | `FP-1` |
| `POST` | `/api/auth/logout` | Logged in | Log out | `FP-1` |
| `GET` | `/api/auth/me` | Anyone | The logged-in user, or `null` | `FP-1` |
| `POST` | `/api/auth/signup` | Anyone | Create a free student account. With `membership: true`, also opens Stripe Checkout for membership | `FP-2`, `FP-6` |
| `GET` | `/api/me/membership` | Student | Whether they are a member, until when, what their next payment would buy, and their payment history | `FP-2` |
| `POST` | `/api/payments/checkout`, `/api/payments/confirm` | Student | Pay for membership ($60 joining or $48 renewal), or confirm a payment and record the membership | `FP-2`, `FP-6` |
| `POST` | `/api/admin/users/:id/membership` | Admin | Record a membership paid at a dojo | `FP-2` |
| `PATCH` | `/api/me` | Logged in | Edit own name, phone and (members) Principal Dojo | `FP-16` |
| `GET` | `/api/instructor/members` | Instructor | Active students at the instructor's dojo, with whether each is a paid member | `FP-15` |
| `GET` | `/api/instructor/classes` | Staff | The day's classes at the instructor's centre | `FP-7` |
| `PUT` | `/api/sessions/:id/attendance` | Staff | Mark attendance for a session. The reply lists students the save made eligible | `FP-7`, `FP-11` |
| `GET` | `/api/instructor/attendance-rates` | Staff | Each active member's attendance rate over the last 8 weeks; under 50% is flagged as declining. Instructors get their own dojo; admins can pass `?centreId=` | `FP-15` |
| `GET` | `/api/eligibility`, `/api/students/:id/eligibility` | Staff (instructors: their own dojo; students: their own) | Grading eligibility | `FP-10` |
| `GET` | `/api/me/notifications` | Logged in | The user's own notifications, newest first | `FP-11` |
| `POST` | `/api/me/notifications/read` | Logged in | Mark the user's own notifications as read | `FP-11` |
| `GET` | `/api/admin/users`, `/api/admin/enquiries` | Admin | Accounts and enquiries | — |
| `POST` | `/api/admin/instructors` | Admin | Create an instructor account | — |

All writes must be sent as JSON. Login uses an HttpOnly session cookie.

### Hosting

Set `NODE_ENV=production`, `PUBLIC_URL` (with `https://`, which also makes login cookies secure), the admin settings, `STRIPE_SECRET_KEY` and, behind a reverse proxy, `TRUST_PROXY=1`. `VITE_ADMIN_PATH` must be set before `npm run build`. The host needs a persistent disk for `storage/`, or accounts and enquiries are lost on redeploy. You can set `DATABASE_PATH` to put the database elsewhere.

---

## 7. Team Contributions & Git Branching Workflow

| Role | Branch Name | Assigned Features |
| :--- | :--- | :--- |
| **Ho Yee Fuung (Scrum Master)** | `feature/fp01-auth-registration` | `FP-1`, `FP-2`, `FP-3`, Jira & Sprint management |
| **Chiam Sheng Le (UI/UX Lead)** | `feature/fp05-classes-stripe` | `FP-4`, `FP-5`, `FP-6`, Brand CSS consistency |
| **Cai Renjie (QA & Test Lead)** | `feature/fp07-attendance-eligibility` | `FP-7`, `FP-9`, `FP-10`, Test cases & QA |
| **Xie Liangchen (Pitch Lead)** | `feature/fp15-dashboard-portal` | `FP-15`, `FP-16`, DB Schema, Pitch Deck & README |

### Git Workflow Rules
1. Create a feature branch from `dev`: `git checkout -b feature/fpXX-feature-name`
2. Commit changes using clear prefixes (`feat:`, `fix:`, `docs:`).
3. Open a Pull Request (PR) into `dev` for peer review before merging into `main`.
