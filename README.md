# Pilot

Pilot is a Next.js 15 / React 19 school operations workspace backed by Supabase.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production-backed workspace

The application uses Supabase Auth, Postgres, Row Level Security, and database functions for school-scoped records and role-aware access.

Implemented areas include:

- School setup, sign-in, password recovery, and staff invitation acceptance.
- Staff invitations with expiring, email-bound links. Administrators can revoke an unused invitation.
- Student roster management, CSV import/export, and student QR credential administration.
- Student portal and authenticated student QR sign-in flow.
- Hall-pass requests, staff approval, security approval, denial, return/end actions, and shared countdown monitoring.
- Staff directory and school memberships.
- Classes, student enrollments, and staff assignments.
- Attendance records.
- School events and announcements.
- Bell schedules and substitute coverage.
- Security console and administrative audit history.

School records are stored in Supabase. The app uses authenticated sessions and server/database authorization; transient form state remains in memory while a page is open.

## iPhone installation

Pilot can be added to an iPhone Home Screen from Safari as a standalone web app. It uses the same production website and updates automatically when the website is updated. This is not an App Store-native iOS binary.

## Production readiness notes

A feature being connected to Supabase does not by itself make the whole platform ready for a real school launch. Before entering real student or staff records, the school/district must approve the system and complete a privacy, security, accessibility, retention, backup, and operational review. Verify the full student QR sign-in and staff invitation flows with fictional accounts first. Review and resolve the known dependency security advisories before any real-data use.

Features that were previously local-only previews or demo modules have been removed from the workspace navigation rather than presented as production functionality. They can be rebuilt as database-backed modules after their data model, permissions, and school workflows are defined.
