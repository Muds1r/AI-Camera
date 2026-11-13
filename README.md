# AI-Camera

An intelligent real-time camera monitoring and analytics system built as a Final Year Project (FYP).

## Tech Stack

### Frontend
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Code Quality:** ESLint, Prettier

### Backend
- **Runtime:** Node.js
- **Framework:** Express
- **Language:** TypeScript
- **Database / Auth:** Supabase (PostgreSQL)
- **Dev Server:** Nodemon + ts-node
- **Testing:** Jest + ts-jest
- **Code Quality:** ESLint, Prettier

### Monorepo Tooling
- **Orchestration:** npm workspaces
- **Parallel Execution:** Concurrently
- **Git Hooks:** Husky (automated pre-commit verification)

---

## Project Structure

```text
AI-Camera/
├── backend/
│   ├── src/
│   │   ├── db/              # SQL schema for Supabase
│   │   ├── lib/             # Supabase client setup
│   │   ├── routes/          # API endpoints (cameras, etc.)
│   │   ├── types/           # Shared TypeScript interfaces
│   │   ├── __tests__/       # Backend Jest unit tests
│   │   └── index.ts         # Express server entry point
│   ├── .env.example         # Environment template
│   ├── jest.config.ts       # Jest test runner config
│   ├── nodemon.json         # Nodemon live reload config
│   ├── tsconfig.json        # TypeScript configuration
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js App Router (pages & layout)
│   │   └── __tests__/       # Frontend Jest test suites
│   ├── jest.config.ts       # Frontend test runner config
│   ├── tsconfig.json        # TypeScript configuration
│   └── package.json
│
├── .husky/                  # Git pre-commit hooks
├── package.json             # Root monorepo workspace configuration
└── README.md
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or higher)
- [npm](https://www.npmjs.com/) (version 10 or higher)
- [Supabase](https://supabase.com/) account and project (for database features)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/Muds1r/AI-Camera.git
cd AI-Camera
```

### 2. Install dependencies

Install all dependencies across the entire monorepo with a single command from the root directory:

```bash
npm install --legacy-peer-deps
```

This installs packages for root, frontend, and backend workspaces and automatically configures Git pre-commit hooks via Husky.

### 3. Environment variables setup

Create a `.env` file in the `backend/` directory:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and update it with your Supabase credentials:

```env
PORT=5000

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

FRONTEND_URL=http://localhost:3000
```

### 4. Database setup (Supabase)

Copy the SQL schema from `backend/src/db/schema.sql` and run it in your **Supabase Dashboard -> SQL Editor**. This creates the required tables (`cameras`, `detections`, `alerts`) and indexes.

### 5. Password reset email (optional)

Forgot password emails a **6-digit code** to the **secondary (recovery) email** on the account (`secondary_email`), not the login address. The person enters that code, then chooses a new password. Each user must have a distinct secondary email when the account is created.

For **local development**, you can leave `SMTP_*` unset. The backend logs the reset code to the console instead of sending mail.

For **real email** (e.g. Gmail with an [app password](https://support.google.com/accounts/answer/185833)), set in `backend/.env`:

```env
APP_NAME=TruckFlow
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM="TruckFlow <your@gmail.com>"
```

In production, configure SMTP before enabling forgot password; the API still returns a generic success message and does not reveal whether an account exists.

---

## Running the Application

### Start both Frontend & Backend concurrently (Recommended)

From the root directory:

```bash
npm run dev
```

> **Note:** `npm run dev` automatically runs verification checks (`format:check`, `lint`, and `test`) before booting the servers.

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API:** [http://localhost:5000](http://localhost:5000)
* **API Health Check:** [http://localhost:5000/health](http://localhost:5000/health)

### Start services individually

If you prefer running services in separate terminal windows:

```bash
# Terminal 1: Backend
npm run dev:backend

# Terminal 2: Frontend
npm run dev:frontend
```

---

## Testing & Quality Assurance

### Run full test & style verification

```bash
npm run check
```

### Run specific commands

| Command | Action |
|---|---|
| `npm test` | Runs all Jest unit tests across both workspaces |
| `npm run lint` | Runs ESLint analysis across both workspaces |
| `npm run format` | Auto-formats code with Prettier |
| `npm run format:check` | Checks code formatting conformity |
| `npm run build` | Builds both frontend and backend for production |

---

## Git Pre-Commit Hook

Husky is configured to ensure code quality. Whenever anyone attempts to commit:

```bash
git commit -m "your message"
```

The pre-commit hook automatically verifies:
1. Code formatting (`prettier --check`)
2. Lint rules (`eslint`)
3. Unit test pass rate (`jest`)

If any check fails, the commit is blocked until the issues are resolved.

