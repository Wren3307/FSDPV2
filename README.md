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

```text
aikido-shinjukai-system/
│
├── backend/                                   # Node.js + Express REST API Server
│   ├── package.json                           # Backend dependencies (express, cors)
│   └── server.js                              # Consolidated REST API & in-memory demo DB
│
├── frontend/                                  # Client-Side Application (Black, White, Red & Blue Theme)
│   ├── individual_modules/                    # Separated HTML/CSS/JS per team member
│   │   ├── member_A_auth_registration/        # FP-1, FP-2, FP-3 (Auth & Welcome Email)
│   │   ├── member_B_classes_stripe/           # FP-4, FP-5, FP-6 (Class Catalog & Stripe Checkout)
│   │   ├── member_C_attendance_eligibility/   # FP-7, FP-10 (Attendance Roster & Rules Engine)
│   │   └── member_D_dashboard_portal/         # FP-15, FP-16 (Instructor Dashboard & Student Portal)
│   │
│   └── presentation_prototype/                # Master Unified Prototype for Pitch Demo
│       ├── index.html                         # Unified Header, Persona Switcher & Layout
│       ├── styles.css                         # Brand styling (#1A1A1A, #FFFFFF, #C8102E, #1D4ED8)
│       └── script.js                          # Dynamic persona navigation & API integration
│
├── docs/                                      # Project Documentation & Artefacts
│   ├── Aikido_Shinjukai_Scrum_Log.xlsx        # Daily Scrum Review & Burndown Log
│   └── Aikido_ShinjuKai_Pitch_Deck.pptx       # Sprint 1 Pitch Presentation Slides
│
├── .gitignore                                 # Ignores node_modules and OS temporary files
└── README.md                                  # Setup, architecture, and workflow guide
```

---

## 4. Tech Stack & Brand Palette

* **Frontend:** HTML5, Tailwind CSS (CDN), Vanilla JavaScript (`fetch` API), Font Awesome 6
* **Backend:** Node.js, Express.js (`cors`, JSON middleware)
* **Database Design:** PostgreSQL Relational Schema (6 normalized tables: `users`, `centres`, `classes`, `enrolments`, `attendance`, `grading_assessments`)
* **Third-Party Integrations:** Stripe Checkout (Test Mode simulation), Nodemailer (automated welcome email logs)
* **Official Brand Color Coding:**
  * **Black (`#1A1A1A` / `#111111`):** Headers, footers, primary dark containers
  * **White (`#FFFFFF` / `#F8FAFC`):** Clean card surfaces and high-contrast text
  * **Crimson Red (`#C8102E`):** Primary action buttons, brand emblem, declining attendance flags (`<50%`)
  * **Royal Blue (`#1D4ED8`):** Grading-ready indicators, Stripe checkout, progress bars

---

## 5. Setup & Running Instructions

### Step 1: Start the Express Backend Server
1. Open a terminal and navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install required dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   node server.js
   ```
   The API server will run at **`http://localhost:5000`**.

### Step 2: Launch the Frontend Prototype
1. Open `frontend/presentation_prototype/index.html` (or any individual module inside `frontend/individual_modules/`) in Chrome/Edge, or run via **VS Code Live Server**.
2. Use the top persona selector or module links to test:
   * **Student Flow:** Register a profile (`FP-2`) -> Preview welcome email (`FP-3`) -> Enrol in class (`FP-5`).
   * **Instructor Flow:** Mark attendance (`FP-7`) -> Run eligibility check (`FP-10`) -> View dashboard flags (`FP-15`).
   * **Student Portal:** Check belt rank and grading progress bar (`FP-16`).

---

## 6. Backend API Endpoints

| Method | Endpoint | Description | Related Feature |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticates user by email and role persona | `FP-1` |
| `POST` | `/api/students/register` | Creates student profile and logs welcome email | `FP-2`, `FP-3` |
| `POST` | `/api/classes/enrol` | Enrols student in class and simulates Stripe receipt | `FP-5`, `FP-6` |
| `POST` | `/api/attendance/mark` | Records class attendance and increments counters | `FP-7` |
| `GET` | `/api/grading/eligibility-check` | Evaluates student attendance & tenure against rules | `FP-10` |
| `GET` | `/api/dashboard/instructor` | Returns aggregated KPIs, declining flags & readiness | `FP-15`, `FP-16` |

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
