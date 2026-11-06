# Pilot workspace batch

This is a consolidated Next.js 15 / React 19 implementation of the ten Pilot workspace sections.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Included demo features

- Overview dashboard with shared live counts, pass queue, upcoming events, and activity.
- Hall passes: create from active roster, search/filter, approve, deny, mark returned.
- Students: add/archive/restore, search, CSV import with common header detection, CSV export.
- Staff directory: add, search, export, remove.
- Attendance: mark Present, Absent, Tardy, or Excused by student and date; edit today's mark; export.
- Schedule: add/search/delete events.
- Announcements: publish/search/delete announcements.
- Analytics: counts and breakdowns derived from the same workspace data.
- Activity log: records actions and supports search/clear.
- Settings: save school name/year, pass limit, student request preference, and reset demo data.
- All pages use one shared browser-storage data model.

## Important limitations

This is a functional single-browser prototype, not a production school information system. Data is stored in localStorage and is not shared between users or devices. It has no authentication, authorization, server database, audit-grade event history, backups, encryption-at-rest controls, district/school tenant isolation, or secure student-data import. Do not enter real student or staff personal information. A production launch requires a real backend, identity and role controls, tenant isolation, security review, backups, and school/legal review for applicable student privacy requirements.

## Additional module library
The `/tools` page adds 30 local demo modules across student experience, staff tools, school operations, administration, and Pilot signature features. These include digital student ID card preview (without active QR scanning), a student portal preview, to-do lists, lost & found, lunch menus, clubs, substitute view, classroom groups, seating charts, teacher-note drafts, family contact log, classroom timer, visitor log, facilities requests, room reservations, emergency broadcast drafts, bell schedule templates, tardy slips, custom report definitions, school goals, permission-profile drafts, district school switcher preview, audit-note drafts, JSON export, command center, alert rules, campus room directory, kiosk preview, custom form templates, and theme studio.

The module library persists demo records in a separate browser localStorage key. It is not connected to the main workspace database (there is no database yet), does not send alerts/broadcasts, does not authenticate users, and does not enforce permissions or isolate school data. The timer, preview toggles, directory, local records, and JSON export work in this browser-only prototype. Do not enter real student, family, visitor, or staff information.
