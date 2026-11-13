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
│   ├── payments.js         # FP-6 Stripe Checkout for the $60 registration fee
│   ├── attendance.js       # FP-7 attendance API
│   ├── eligibility.js      # FP-10 grading eligibility engine (+ eligibilityRoutes.js)
│   ├── schema.js           # Shared SQLite tables (users, centres, classes, attendance, ...)
│   ├── db.js               # Opens the database; account and enquiry queries
│   ├── seed.js             # Demo data (npm run seed)
│   └── *.test.js           # API tests (npm test)
├── src/                    # React front end
│   ├── App.jsx, Layout.jsx # Public site
│   ├── pages/              # Login, sign-up, member/instructor account, hidden admin page
│   ├── Attendance.jsx      # FP-7 staff screen (/attendance)
│   └── Eligibility.jsx     # FP-10 staff screen (/eligibility)
├── data/                   # Public site content: dojos, timetables, fees, instructors
├── scripts/stripe-setup.js # Creates the registration Product and Price in Stripe
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
* `npm test` runs the API tests. `npm run build` then `npm start` runs the production version.

### Demo accounts

Every seeded account uses the password `aikido-demo-2026`. The server never loads demo data when `NODE_ENV=production`.

| Log in as | Email | Choose |
| --- | --- | --- |
| Instructor at ASK Headquarters Dojo | `kenji.yamamoto@example.com` | Instructor |
| Instructor at Cheng San Dojo | `mei.lin@example.com` | Instructor |
| Member (eligible for grading) | `alice.tan@example.com` | Member |
| Admin | `aiko.tanaka@example.com` | On the hidden admin page |

The admin named by `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` is also created on start-up.

### Accounts

| Who | How they get an account | Where they log in | What they see |
| --- | --- | --- | --- |
| Member | Signs up at `/signup` and pays the $60 registration through Stripe | `/login`, choosing Member | Profile, and their Principal Dojo's class times once paid |
| Instructor | The admin creates the account | `/login`, choosing Instructor | Profile, the active members at their dojo, `/attendance` and `/eligibility` |
| Admin | Created on start-up from `ADMIN_EMAIL` and `ADMIN_PASSWORD` | The hidden page at `VITE_ADMIN_PATH` | All accounts, ranks, adding instructors, enquiries, and the staff screens |

Choosing the wrong role on the login page is refused. Nothing on the site links to the admin page, but its path is inside the site's JavaScript, so the admin password is what actually protects it. Restart the server after changing `VITE_ADMIN_PATH`.

### Payments

Sign-up needs `STRIPE_SECRET_KEY` in `.env`. Use a test key (`sk_test_...`) from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys). Then create the registration Product and its SGD 60 Price in that Stripe account:

```bash
npm run stripe:setup
```

The site finds the Price by its lookup key, `ask_registration_fee`, so you don't copy any IDs. Running the script again changes nothing. To change the fee, edit `AMOUNT_CENTS` in `scripts/stripe-setup.js` and run it again: it makes a new Price and archives the old one. Restart the server afterwards.

Pay with the test card `4242 4242 4242 4242`, any future date and any CVC. Without a key, sign-up shows a message asking people to call Headquarters. No publishable key is needed, because payment happens on Stripe's own Checkout page.

After paying, Stripe sends the member to `/signup/complete`, and the server checks the payment with Stripe before activating the account. Members who close the page early can use "Already paid? Check again" on their account page. An admin can also mark a fee paid in person.

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
| `POST` | `/api/auth/signup` | Anyone | Create a member account and open Stripe Checkout | `FP-2`, `FP-6` |
| `POST` | `/api/payments/checkout`, `/api/payments/confirm` | Member | Pay, or confirm payment of, the registration fee | `FP-6` |
| `PATCH` | `/api/me` | Logged in | Edit own name, phone and (members) Principal Dojo | `FP-16` |
| `GET` | `/api/instructor/members` | Instructor | Active members at the instructor's dojo | `FP-15` |
| `GET` | `/api/instructor/classes` | Staff | The day's classes at the instructor's centre | `FP-7` |
| `PUT` | `/api/sessions/:id/attendance` | Staff | Mark attendance for a session | `FP-7` |
| `GET` | `/api/eligibility`, `/api/students/:id/eligibility` | Staff (students: their own) | Grading eligibility | `FP-10` |
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
