---
Task ID: 7b
Agent: full-stack-developer (subagent)
Task: LexDoc Frontend — Deadlines View, Documents View, Dark Mode

Work Log:
- Updated `/home/z/my-project/src/lib/api-client.ts` — Added DeadlineRecord and DocumentRecord interfaces, plus deadlinesApi and documentsApi endpoints with full CRUD
- Created `/home/z/my-project/src/components/dashboard/DeadlinesView.tsx` — Full deadlines management with card-based layout, color-coded urgency (red/amber/emerald), filter tabs, create/edit dialogs, mark as completed, pagination, date-fns formatting with pt locale
- Created `/home/z/my-project/src/components/dashboard/DocumentsView.tsx` — Full documents management with table layout, search, status filter tabs, file size formatter, MIME type badges, confidential lock icon, create/edit dialogs, soft-archive (delete) with confirmation, pagination
- Updated `/home/z/my-project/src/components/views/DashboardView.tsx` — Replaced ComingSoonView for 'prazos' and 'documentos' tabs with actual components; added dark mode toggle button in header (Moon/Sun icons with framer-motion animation), hidden on mobile; used useSyncExternalStore for hydration-safe mounted check
- Updated `/home/z/my-project/src/app/layout.tsx` — Wrapped children with ThemeProvider from next-themes (attribute="class", defaultTheme="light", enableSystem, disableTransitionOnChange); replaced shadcn Toaster with sonner Toaster
- Updated `/home/z/my-project/src/app/globals.css` — Added smooth color-scheme transition for dark mode, dark mode hover states for tables

Stage Summary:
- 6 files created/updated
- 0 new lint errors (1 pre-existing warning from RegisterForm.tsx)
- Dev server compiling successfully
- All text in Portuguese, emerald accent, no blue/indigo
- Deadlines: card layout with urgency indicators, process association, complete/edit actions
- Documents: table layout with MIME badges, confidentiality indicators, soft-archive flow
- Dark mode: ThemeProvider + toggle in header with animated icon transition
