// ═══════════════════════════════════════════════════════════════
// LEXDOC — DataTable Componente Reutilizável
// Tabela de dados com sorting, filtering, pagination, column visibility,
// row selection, export CSV, loading skeleton e empty state
// Usa @tanstack/react-table + shadcn/ui
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  useReactTable,
} from '@tanstack/react-table';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  SlidersHorizontal,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Inbox,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Global search placeholder text (default: "Pesquisar...") */
  searchPlaceholder?: string;
  /** Text for empty state (default: "Nenhum registo encontrado.") */
  emptyMessage?: string;
  /** Text for empty state description */
  emptyDescription?: string;
  /** Show row selection checkbox */
  enableRowSelection?: boolean;
  /** Enable export to CSV */
  enableExport?: boolean;
  /** CSV filename (default: "export.csv") */
  exportFilename?: string;
  /** Show global search bar */
  enableSearch?: boolean;
  /** Show column visibility toggle */
  enableColumnVisibility?: boolean;
  /** Show filter bar */
  enableFilters?: boolean;
  /** Loading state */
  isLoading?: boolean;
  /** Initial page size */
  initialPageSize?: number;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Called when selected rows change */
  onSelectionChange?: (rows: TData[]) => void;
  /** Max height for scrollable container */
  maxHeight?: string;
  /** Row click handler */
  onRowClick?: (row: TData) => void;
  /** Additional toolbar content */
  toolbarExtra?: React.ReactNode;
  /** Em variant: compact table with less padding */
  compact?: boolean;
}

// ─────────────────────────────────────────
// Stagger animation
// ─────────────────────────────────────────
const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.03 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0 },
};

// ─────────────────────────────────────────
// Skeleton Table
// ─────────────────────────────────────────
function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full space-y-0">
      {/* Header skeleton */}
      <div className="flex gap-4 pb-3 border-b px-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-24 rounded" />
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-4 py-3 px-4 border-b last:border-0">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <Skeleton
              key={colIdx}
              className={`h-4 rounded ${colIdx === 0 ? 'w-28' : colIdx === 1 ? 'w-40' : 'w-20'}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────
// Empty state
// ─────────────────────────────────────────
function EmptyState({ message, description }: { message: string; description?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center px-4"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 dark:from-muted dark:to-muted/30 flex items-center justify-center mb-4"
      >
        <Inbox className="size-8 text-muted-foreground" />
      </motion.div>
      <p className="text-sm font-medium text-foreground">{message}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────
// CSV Export Helper
// ─────────────────────────────────────────
function exportToCSV<TData>(
  data: TData[],
  columns: ColumnDef<TData, unknown>[],
  filename: string,
) {
  // Get header names
  const headers = columns
    .filter((col) => col.header !== undefined)
    .map((col) => {
      const header = col.header;
      if (typeof header === 'string') return header;
      return '';
    });

  // Get row values
  const rows = data.map((row) =>
    columns
      .filter((col) => col.accessorFn !== undefined)
      .map((col) => {
        const val = col.accessorFn?.(row, 0);
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      }),
  );

  const csvContent = [
    headers.join(','),
    ...rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────
// DataTable Component
// ─────────────────────────────────────────
export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = 'Pesquisar...',
  emptyMessage = 'Nenhum registo encontrado.',
  emptyDescription,
  enableRowSelection = false,
  enableExport = false,
  exportFilename = `export_${new Date().toISOString().split('T')[0]}.csv`,
  enableSearch = true,
  enableColumnVisibility = true,
  enableFilters = true,
  isLoading = false,
  initialPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  onSelectionChange,
  maxHeight = 'calc(100vh - 380px)',
  onRowClick,
  toolbarExtra,
  compact = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: initialPageSize,
      },
    },
  });

  // Track selected rows
  const selectedRowIds = Object.keys(rowSelection);
  const selectedRows = useMemo(() => {
    if (!enableRowSelection || !onSelectionChange) return [];
    return table.getFilteredSelectedRowModel().rows.map((r) => r.original);
  }, [enableRowSelection, onSelectionChange, table, rowSelection]);

  // Notify parent of selection changes
  useMemo(() => {
    if (onSelectionChange) {
      onSelectionChange(selectedRows);
    }
  }, [selectedRows, onSelectionChange]);

  // Export handler
  const handleExport = useCallback(() => {
    exportToCSV(data, columns, exportFilename);
  }, [data, columns, exportFilename]);

  const activeFilterCount = columnFilters.length + (globalFilter ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      {(enableSearch || enableColumnVisibility || enableExport || toolbarExtra) && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          {enableSearch && (
            <div className="relative flex-1 max-w-sm w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9 h-8 text-sm"
              />
              {globalFilter && (
                <button
                  onClick={() => setGlobalFilter('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Extra toolbar content */}
          {toolbarExtra}

          {/* Active filter count */}
          {enableFilters && activeFilterCount > 0 && (
            <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200">
              <SlidersHorizontal className="size-2.5 mr-1" />
              {activeFilterCount} filtro{activeFilterCount !== 1 ? 's' : ''}
            </Badge>
          )}

          {/* Selected count */}
          {enableRowSelection && selectedRowIds.length > 0 && (
            <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200">
              {selectedRowIds.length} selecionado{selectedRowIds.length !== 1 ? 's' : ''}
            </Badge>
          )}

          {/* Column visibility */}
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 active:scale-[0.98]">
                  <SlidersHorizontal className="size-3" />
                  <span className="hidden sm:inline">Colunas</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => table.resetColumnVisibility()}
                  className="text-xs"
                >
                  <Eye className="size-3.5 mr-2" />
                  Mostrar todas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((column) => column.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="text-xs capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id.replace(/_/g, ' ')}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export */}
          {enableExport && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="h-8 text-xs gap-1.5 active:scale-[0.98] hover:border-emerald-300 dark:hover:border-emerald-700"
            >
              <Download className="size-3" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-lg border overflow-x-auto overflow-y-auto"
        style={{ maxHeight }}
      >
        {isLoading ? (
          <SkeletonTable rows={initialPageSize} cols={Math.min(columns.length, 6)} />
        ) : table.getRowModel().rows.length === 0 ? (
          <EmptyState message={emptyMessage} description={emptyDescription} />
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-sm z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {enableRowSelection && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          table.getIsAllPageRowsSelected() ||
                          (table.getIsSomePageRowsSelected() && 'indeterminate')
                        }
                        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                        aria-label="Seleccionar todas as linhas"
                        className="size-3.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                      />
                    </TableHead>
                  )}
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className={`text-xs ${header.column.getCanSort() ? 'cursor-pointer select-none hover:bg-muted/50' : ''} ${
                        compact ? 'h-8 py-1 px-3' : 'h-9 px-4'
                      }`}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className="flex items-center gap-1"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <span className="text-muted-foreground">
                              {{
                                asc: <ArrowUp className="size-3" />,
                                desc: <ArrowDown className="size-3" />,
                              }[header.column.getIsSorted() as string] ?? (
                                <ArrowUpDown className="size-2.5 opacity-40" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              <motion.tbody
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="[&_tr:last-child]:border-0"
              >
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.id}
                    variants={staggerItem}
                    className={`transition-all duration-150 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10 hover:shadow-sm ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${
                      row.getIsSelected()
                        ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
                        : ''
                    }`}
                    onClick={() => {
                      if (onRowClick) onRowClick(row.original);
                    }}
                  >
                    {enableRowSelection && (
                      <TableCell className={compact ? 'py-1 px-3' : 'py-2 px-4'}>
                        <Checkbox
                          checked={row.getIsSelected()}
                          onCheckedChange={(value) => row.toggleSelected(!!value)}
                          aria-label="Seleccionar linha"
                          onClick={(e) => e.stopPropagation()}
                          className="size-3.5 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        />
                      </TableCell>
                    )}
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={`text-sm ${compact ? 'py-1 px-3' : 'py-2.5 px-4'}`}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </motion.tr>
                ))}
              </motion.tbody>
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {table.getRowModel().rows.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Page info + size selector */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {table.getFilteredRowModel().rows.length} registo{table.getFilteredRowModel().rows.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-1.5">
              <span>Mostrar:</span>
              <Select
                value={String(table.getState().pagination.pageSize)}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-7 w-[65px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)} className="text-xs">
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Pagination buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-3.5" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-0.5 mx-1">
              {Array.from(
                { length: Math.min(table.getPageCount(), 5) },
                (_, idx) => {
                  const totalPages = table.getPageCount();
                  const currentPage = table.getState().pagination.pageIndex;
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = idx;
                  } else if (currentPage <= 2) {
                    pageNum = idx;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 5 + idx;
                  } else {
                    pageNum = currentPage - 2 + idx;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="icon"
                      className={`size-7 text-[11px] ${currentPage === pageNum ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                      onClick={() => table.setPageIndex(pageNum)}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                },
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
