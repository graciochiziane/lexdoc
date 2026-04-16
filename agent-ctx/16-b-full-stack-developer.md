# Task ID: 16-b
## Agent: full-stack-developer
## Task: Build PDF Report Generation + Enhanced Dashboard Widgets

### Work Log:
- Created `src/app/api/v1/export/report-pdf/route.ts` — GET endpoint supporting 4 report types (firm_overview, processes, clients, deadlines). Each type generates a well-formatted HTML document with print-friendly CSS, firm branding, data tables, status badges, and a print-to-PDF button. Auth protected (ADMIN/ADVOGADO only), filtered by firm_id, audit-logged.
- Updated `src/lib/api-client.ts` — Added `reportPdf(type)` method to `exportApi` that downloads the report as a blob via `apiFetchBlob`.
- Updated `src/components/dashboard/ReportsView.tsx` — Added "Exportar PDF" button (emerald gradient, emerald/600 hover) next to existing "Imprimir Relatório" button. Button shows Loader2 spinner during export, uses toast notifications for success/error feedback via sonner. Added FileDown and Loader2 icon imports, useState for exporting state.
- Updated `src/components/dashboard/DashboardHome.tsx` — Added 3 new dashboard widgets:
  a) **Urgency Alert Widget** (3-column grid): Overdue deadlines (red, pulse animation), due within 3 days (amber), recently closed processes (green). Each item has gradient backgrounds, hover effects, and ChevronRight navigation arrows.
  b) **Quick Process Overview** (2-column span): Shows top 5 most recently updated processes with priority indicator dots (red=urgent with pulse, orange=high, amber=medium, gray=low), status badges, priority badges, process number/client info, and update date. Replaces the old "Processos Recentes" table with a more modern card-list layout.
  c) **Team Activity Widget** (1-column): Shows active user count with emerald badge, mini avatar circles for team members (overlapping with z-index), and most recent login timestamps with relative time formatting (min/h/d atrás). Uses firmApi.members query.
- Added new lucide-react icon imports: CheckCircle2, CircleAlert, AlertCircle
- Added imports for deadlinesApi, firmApi, addDays from date-fns
- ESLint: 0 errors, 1 pre-existing warning (form.watch)
- Dev server: compiled successfully, 200 OK on /

### Stage Summary:
- 4 files created/modified
- 1 new API endpoint: GET /api/v1/export/report-pdf?type=firm_overview|processes|clients|deadlines
- 3 new dashboard widgets: Urgency Alert, Quick Process Overview, Team Activity Summary
- PDF export functionality in Reports view with loading states and toast notifications
- All text in Portuguese (pt-MZ)
- Emerald color theme maintained throughout
- framer-motion animations on all new widgets
