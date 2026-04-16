# Task ID: 17 — Process Timeline & Advanced Data Table

## Agent: full-stack-developer
## Date: 2026-01-XX

### Work Log

#### 1. Enhanced ProcessTimeline Component (`src/components/dashboard/ProcessTimeline.tsx`)
- Rewrote the existing ProcessTimeline with major visual and functional improvements
- **Type-based color coding**: audit=blue, deadline=amber, note=green (as specified)
- **Type filter buttons**: Added interactive filter chips (Todos, Auditoria, Prazos, Notas) with live counts
- **Connected dot-line timeline**: Vertical line with colored dots, ring borders on hover, spring animations
- **Date-grouped entries**: Timeline entries grouped by date with decorative dividers
- **Enhanced relative time**: Full Portuguese time display (agora mesmo, há X segundos, ontem, há X semanas, há X meses)
- **Hover title**: Shows full formatted date on hover
- **Auto-refresh**: 60-second polling via `refetchInterval`
- **Animated stagger entrance**: Spring-based stagger animations with scale+slide
- **Empty state**: Improved with multi-type icon background
- **Skeleton loading**: Group-aware skeleton with date group indicators

#### 2. Enhanced NotesPanel Component (`src/components/dashboard/NotesPanel.tsx`)
- Added **priority selector** in the create form (Baixa, Média, Alta, Urgente) with Select dropdown
- Added **complete/uncomplete toggle** via CheckCircle2/Circle icons (click to toggle)
- **Color-coded priority badges**: gray (low), amber (medium), orange (high), red (urgent)
- Added **filter tabs** (Todos, Activas, Concluídas) with counts
- Completed notes show with **strikethrough text** and reduced opacity
- **Sorted display**: Pinned notes first, then by updated_at
- Added `compact` prop for minimal mode
- Added `general` entity type support
- Improved relative time with "ontem", "semana" variations
- Spring-based stagger animations for note cards

#### 3. Created DataTable Component (`src/components/ui/data-table.tsx`)
- Built a **fully reusable data table** using @tanstack/react-table
- **Features implemented**:
  - Sorting (click headers to sort, visual indicators with ArrowUp/ArrowDown/ArrowUpDown)
  - Column filtering with faceted unique values
  - Pagination with page numbers (5 visible), first/last/prev/next buttons
  - Page size selector (5, 10, 20, 50)
  - Column visibility dropdown toggle
  - Row selection with checkbox (individual + select all)
  - Export to CSV with UTF-8 BOM and proper escaping
  - Global search with clear button
  - Loading skeleton state
  - Empty state with animated Inbox icon
  - Active filter count badge
  - Selected rows count badge
  - Row click handler
  - `compact` mode (smaller padding/height)
  - `toolbarExtra` slot for custom toolbar content
  - Configurable empty message/description
  - Responsive horizontal scroll
  - framer-motion stagger row animations
  - Emerald-themed active states

#### 4. Updated ProcessesView (`src/components/dashboard/ProcessesView.tsx`)
- Replaced manual table with **DataTable** component
- Column definitions use `useMemo` with `accessorFn`, `header`, `cell` renderers
- DataTable configured with: search disabled (separate search), column visibility, CSV export, row selection
- Added APPEAL status support in STATUS_LABELS/STATUS_COLORS
- Maintained all existing functionality: status pills, filters, create dialog, detail dialog with tabs (info/notes/timeline)
- Detail dialog properly integrates ProcessTimeline and NotesPanel

#### 5. Verified api-client.ts
- `processesApi.timeline(id)` — ✓ Already exists (line 183)
- `processesApi.updateStatus(id, status)` — ✓ Already exists (line 180-181)
- `notesApi` with full CRUD — ✓ Already exists (lines 689-714):
  - `notesApi.list(entityType, entityId, page, limit)` ✓
  - `notesApi.create(data)` ✓
  - `notesApi.update(id, data)` ✓
  - `notesApi.remove(id)` ✓

### Files Modified
1. `src/components/dashboard/ProcessTimeline.tsx` — Rewritten with enhanced features
2. `src/components/dashboard/NotesPanel.tsx` — Rewritten with priority, complete toggle, filter tabs
3. `src/components/dashboard/ProcessesView.tsx` — Rewritten to use DataTable component
4. `src/components/ui/data-table.tsx` — **New file** created

### Files Verified (no changes needed)
5. `src/lib/api-client.ts` — All required methods already present

### ESLint Result
- 0 errors, 1 pre-existing warning (form.watch in RegisterForm.tsx — React Compiler)

### Stage Summary
- Process Timeline: Fully functional with type filtering, grouped dates, color-coded entries, Portuguese relative time
- Notes Panel: Full CRUD with priority, pin, complete/uncomplete, filter tabs
- DataTable: Reusable component with sorting, filtering, pagination, column visibility, row selection, CSV export
- ProcessesView: Uses DataTable for advanced table functionality
- All API methods verified and working
- Dev server: Compiling without errors
