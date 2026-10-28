# Career Log — Job Application Tracker

A responsive MERN application for recording applications, tracking status changes, and managing follow-ups. The API generates application IDs and enforces workflow and validation rules on the server.

## Requirements

- Node.js 18 or newer and npm
- A MongoDB Atlas test database (free tier is sufficient)

## MongoDB Atlas setup

1. Sign in to MongoDB Atlas and create a free shared cluster for this exam.
2. Create a database user with a new, test-only password. Do not reuse personal or production credentials.
3. In **Network Access**, allow your current IP address for the exam.
4. Choose **Connect → Drivers → Node.js** and copy the connection string. Replace the password placeholder and add `/job_tracker` before the query string.
5. Copy `backend/.env.example` to `backend/.env`, then put the URI in `MONGODB_URI`. The checked-in example is deliberately a placeholder, not a working credential. Keep real credentials out of GitHub.

## Run locally (PowerShell)

From the project root:

```powershell
Copy-Item backend/.env.example backend/.env
notepad backend/.env
npm install --prefix backend
npm install --prefix frontend
```

In `backend/.env`, set `MONGODB_URI` to the test Atlas URI. Then open **two PowerShell terminals**, both in this project folder:

```powershell
# Terminal 1 — API
npm run dev --prefix backend
```

```powershell
# Terminal 2 — React app
npm run dev --prefix frontend
```

Open <http://localhost:5173>. The API health endpoint is <http://localhost:5000/api/health>. If you prefer one command, install the root helper and run `npm run dev` from the project root.

## Features and rules

- Create an application with company, role, job type, applied date, optional expected salary, and notes.
- The backend creates immutable `JA-XXX-###` IDs, with an independent, persistent sequence for each normalized company.
- Every new record starts at **Applied** and has an initial status history entry.
- Allowed transitions: Applied → Interview or Rejected; Interview → Offer or Rejected; Offer → Hired or Rejected. Rejected and Hired are final.
- Every status change appends a dated timeline entry. Follow-up date is computed as applied date + 7 days; `isOverdue` is true only when the application remains Applied past that date.
- Company and role matching is case-insensitive. An active duplicate (Applied, Interview, or Offer) returns HTTP 409. Rejected/Hired applications do not block a later application.
- Applied date and IDs cannot be edited. Delete is allowed for Applied, Rejected, and Hired records; Interview and Offer records are protected.
- List filters are applied by the backend. Search matches company names without case sensitivity. Dashboard counts come from the backend.
- API responses consistently use `{ "success": boolean, "message": string, "data": any }`.

## API reference

Base URL: `http://localhost:5000/api`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API and database status |
| GET | `/applications` | List; optional `?status=Applied` and `?company=Acme` |
| GET | `/applications/counts` | Count records grouped by status |
| POST | `/applications` | Create a validated application; ID/status/history set by backend |
| GET | `/applications/:id` | Get one application with virtual follow-up fields |
| PUT | `/applications/:id` | Edit company, role, type, salary, and notes; applied date/status/ID are immutable |
| PATCH | `/applications/:id/status` | Validate transition and append to status history; JSON `{ "status": "Interview", "note": "Screening call" }` |
| DELETE | `/applications/:id` | Delete only when status is Applied, Rejected, or Hired |

All invalid input receives a JSON error response. Duplicate active applications return `409 Conflict`.

## Screenshots for the submission README

After launching the app and adding at least one record, capture two screenshots:

1. **Dashboard:** show the summary cards and application list (Windows: `Win + Shift + S`). Save as `screenshots/dashboard.png`.
2. **Application detail:** open a record so its status history timeline and follow-up date are visible. Save as `screenshots/application-details.png`.

Create the folder with `New-Item -ItemType Directory -Force screenshots`, add the two images, and link them here before submitting:

```md
![Dashboard](screenshots/dashboard.png)
![Application details and status timeline](screenshots/application-details.png)
```

The screenshots are intentionally left for the exam run, since they need to show your own working Atlas-backed app and real interaction.

## Five meaningful commits across the exam

Make these during the exam as each stage is completed (adjust the timing to your remaining time; do not make five back-to-back commits at the end):

1. `chore: scaffold MERN application`
2. `feat: add MongoDB application model and API`
3. `feat: enforce application workflow and follow-up rules`
4. `feat: build responsive application dashboard`
5. `docs: add setup guide and submission screenshots`

Example after each milestone:

```powershell
git add .
git commit -m "feat: add MongoDB application model and API"
```

Do not commit the populated `backend/.env`. Push your repository to GitHub and submit its URL before the exam portal closes.
