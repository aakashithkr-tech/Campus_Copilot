# CampusCopilot

CampusCopilot is a role-based smart college utility MVP based on the WEBNOVA 2026 submission deck. It turns verified campus notices into concise summaries, deadlines, actions, reminders, and source-backed answers.

## Run locally

No packages are required. Use Node.js 22.5 or newer because the backend uses the built-in SQLite module.

```bash
node server.mjs
```

Then open `http://localhost:4173`.

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@campus.edu` | `student123` |
| Faculty | `faculty@campus.edu` | `faculty123` |
| Admin | `admin@campus.edu` | `admin123` |

## Role functionality

**Student**
- Verified notice hub with search and filters
- Source-backed CampusCopilot query assistant
- Deadline and personal task tracker
- Event discovery and registration
- Complaints plus lost-and-found reporting

**Faculty**
- Publish announcements, assignments, and events
- Answer student questions
- View classes and student engagement insights
- Track notice reach and saves

**Admin**
- Upload/publish verified campus notices
- Manage user roles and account status
- Resolve campus requests and moderate lost-and-found posts
- View platform analytics and activity

## Database architecture

The project includes a real SQLite database powered by Node's built-in `node:sqlite` module:

- The database is created automatically at `data/campuscopilot.db`
- Demo accounts are seeded on first run with hashed passwords
- Login creates authenticated seven-day server sessions
- Student, faculty, and admin mutations are protected by role-aware API permissions
- Suspended accounts are blocked from creating new sessions
- Each role only receives the database collections needed for its workspace
- Notices, tasks, events, questions, complaints, lost-and-found posts, users, and activity persist across browser and server restarts

No database packages or cloud credentials are required.

The AI assistant uses deterministic search over verified database-backed notices so every answer remains grounded in campus data. For production deployment across multiple servers, the same API can be migrated to PostgreSQL/Supabase and connected to a RAG pipeline with a supported AI API.
