// ═══════════════════════════════════════════════════════════════
// LEXDOC — Calendário de Prazos
// Vista mensal com navegação e filtros por processo
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Filter,
  X,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deadlinesApi, processesApi, type CalendarDeadlineItem, type ProcessRecord } from '@/lib/api-client';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  differenceInDays,
} from 'date-fns';
import { pt } from 'date-fns/locale';

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  COMPLETED: 'Concluído',
  OVERDUE: 'Expirado',
};

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────
function getDeadlineColor(item: CalendarDeadlineItem): string {
  if (item.status === 'COMPLETED') return 'bg-emerald-400';
  const diff = differenceInDays(new Date(item.due_date), new Date());
  if (diff < 0) return 'bg-red-500';
  if (diff <= 3) return 'bg-amber-400';
  return 'bg-emerald-400';
}

function getDeadlineDotColor(item: CalendarDeadlineItem): string {
  if (item.status === 'COMPLETED') return 'bg-emerald-500';
  const diff = differenceInDays(new Date(item.due_date), new Date());
  if (diff < 0) return 'bg-red-500';
  if (diff <= 3) return 'bg-amber-500';
  return 'bg-emerald-400';
}

function getDaysRemainingText(item: CalendarDeadlineItem): { text: string; color: string } {
  if (item.status === 'COMPLETED') {
    return { text: 'Concluído', color: 'text-emerald-600 dark:text-emerald-400' };
  }
  const diff = differenceInDays(new Date(item.due_date), new Date());
  if (diff < 0) {
    return { text: `Expirado há ${Math.abs(diff)} dia${Math.abs(diff) !== 1 ? 's' : ''}`, color: 'text-red-600 dark:text-red-400' };
  }
  if (diff === 0) return { text: 'Vence hoje!', color: 'text-red-600 dark:text-red-400' };
  if (diff <= 3) {
    return { text: `${diff} dia${diff !== 1 ? 's' : ''} restante${diff !== 1 ? 's' : ''}`, color: 'text-amber-600 dark:text-amber-400' };
  }
  return { text: `${diff} dias restantes`, color: 'text-emerald-600 dark:text-emerald-400' };
}

// ─────────────────────────────────────────
// Componente de dia
// ─────────────────────────────────────────
function DayCell({
  date,
  deadlines,
  isCurrentMonth,
  onSelect,
}: {
  date: Date;
  deadlines: CalendarDeadlineItem[];
  isCurrentMonth: boolean;
  onSelect: (date: Date, deadlines: CalendarDeadlineItem[]) => void;
}) {
  const today = isToday(date);
  const hasDeadlines = deadlines.length > 0;

  return (
    <button
      onClick={() => hasDeadlines && onSelect(date, deadlines)}
      disabled={!hasDeadlines}
      className={`
        relative flex flex-col items-start gap-1 p-1.5 sm:p-2 rounded-lg text-left
        min-h-[60px] sm:min-h-[80px] transition-all duration-150
        ${!isCurrentMonth ? 'opacity-30' : ''}
        ${hasDeadlines
          ? 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20 cursor-pointer active:scale-[0.98]'
          : 'cursor-default'
        }
        ${today ? 'ring-2 ring-emerald-500 ring-offset-1 dark:ring-offset-background' : ''}
      `}
    >
      {/* Número do dia */}
      <span
        className={`
          text-xs sm:text-sm font-medium leading-none
          ${today ? 'text-emerald-600 dark:text-emerald-400' : ''}
          ${!isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'}
        `}
      >
        {format(date, 'd')}
      </span>

      {/* Indicadores de prazos */}
      {hasDeadlines && (
        <div className="flex flex-wrap gap-0.5 mt-0.5 w-full">
          {deadlines.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className={`w-1.5 h-1.5 rounded-full ${getDeadlineDotColor(item)} shrink-0`}
            />
          ))}
          {deadlines.length > 3 && (
            <span className="text-[9px] text-muted-foreground leading-none ml-0.5">
              +{deadlines.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Primeiro prazo visível (desktop) */}
      {hasDeadlines && (
        <p className="hidden sm:block text-[10px] text-muted-foreground truncate w-full leading-tight mt-0.5">
          {deadlines[0].title}
        </p>
      )}
    </button>
  );
}

// ─────────────────────────────────────────
// Popover de prazos do dia
// ─────────────────────────────────────────
function DayDeadlinesPopover({
  open,
  date,
  deadlines,
  onClose,
  onNavigateToPrazos,
}: {
  open: boolean;
  date: Date | null;
  deadlines: CalendarDeadlineItem[];
  onClose: () => void;
  onNavigateToPrazos: () => void;
}) {
  if (!open || !date || deadlines.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="fixed inset-0 bg-black/40" />
        <Card
          className="relative z-10 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {format(date, "d 'de' MMMM, yyyy", { locale: pt })}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {deadlines.length} prazo{deadlines.length !== 1 ? 's' : ''} neste dia
                </p>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {deadlines.map((item) => {
              const daysInfo = getDaysRemainingText(item);
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border-l-4 p-3 bg-card ${getDeadlineColor(item)} border-l`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Briefcase className="size-3 shrink-0" />
                        <span className="truncate">{item.process_title}</span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-emerald-200'
                            : item.status === 'OVERDUE'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 border-amber-200'
                        }`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Clock className={`size-3 ${daysInfo.color}`} />
                    <span className={`text-xs font-medium ${daysInfo.color}`}>
                      {daysInfo.text}
                    </span>
                  </div>
                </div>
              );
            })}
            <Button
              variant="outline"
              className="w-full mt-2"
              onClick={() => {
                onClose();
                onNavigateToPrazos();
              }}
            >
              Ver todos os prazos
              <ChevronRight className="size-3.5 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────
// Estado vazio animado
// ─────────────────────────────────────────
function EmptyCalendarState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-950/60 dark:to-emerald-900/30 flex items-center justify-center mb-4"
      >
        <CalendarDays className="size-10 text-emerald-500" />
      </motion.div>
      <h3 className="text-base font-semibold text-foreground">
        Sem prazos neste mês
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Não existem prazos processuais agendados para este período.
        Adicione prazos na aba de Gestão de Prazos.
      </p>
    </motion.div>
  );
}

// ─────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────
interface CalendarViewProps {
  onNavigateToPrazos?: () => void;
}

export function CalendarView({ onNavigateToPrazos }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [processFilter, setProcessFilter] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedDeadlines, setSelectedDeadlines] = useState<CalendarDeadlineItem[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const monthStr = format(currentDate, 'yyyy-MM');

  // ── Query: prazos do calendário ──
  const calendarParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('month', monthStr);
    if (processFilter) params.set('process_id', processFilter);
    return params.toString();
  }, [monthStr, processFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', monthStr, processFilter],
    queryFn: () => deadlinesApi.calendar(calendarParams),
    staleTime: 30 * 1000,
  });

  const calendarData = data?.data ?? null;

  // ── Query: processos (para filtro) ──
  const { data: processesData } = useQuery({
    queryKey: ['processes', 'filter-list'],
    queryFn: () => processesApi.list('limit=100'),
    staleTime: 60 * 1000,
  });
  const processList: ProcessRecord[] = processesData?.data ?? [];

  // ── Gerar dias do mês ──
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    let day = calendarStart;
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarStart, calendarEnd]);

  // ── Mapear prazos para datas ──
  const deadlinesByDate = useMemo(() => {
    return calendarData?.deadlines_by_date ?? {};
  }, [calendarData]);

  const getDeadlinesForDate = useCallback(
    (date: Date): CalendarDeadlineItem[] => {
      const key = format(date, 'yyyy-MM-dd');
      return deadlinesByDate[key] ?? [];
    },
    [deadlinesByDate],
  );

  // ── Handlers ──
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevMonth = useCallback(() => setCurrentDate((d) => subMonths(d, 1)), []);
  const goToNextMonth = useCallback(() => setCurrentDate((d) => addMonths(d, 1)), []);

  const handleDaySelect = useCallback(
    (date: Date, deadlines: CalendarDeadlineItem[]) => {
      setSelectedDate(date);
      setSelectedDeadlines(deadlines);
      setPopoverOpen(true);
    },
    [],
  );

  const handleClosePopover = useCallback(() => {
    setPopoverOpen(false);
    setSelectedDate(null);
    setSelectedDeadlines([]);
  }, []);

  const totalDeadlines = calendarData?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Calendário de Prazos</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeadlines} prazo{totalDeadlines !== 1 ? 's' : ''} em{' '}
            {format(currentDate, 'MMMM yyyy', { locale: pt })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToToday} className="text-xs">
            Hoje
          </Button>
        </div>
      </div>

      {/* Navegação e filtros */}
      <Card className="bg-gradient-to-br from-white to-emerald-50/30 dark:from-background dark:to-emerald-950/10 border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={goToPrevMonth}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <h3 className="text-sm font-semibold min-w-[160px] text-center">
                {format(currentDate, 'MMMM yyyy', { locale: pt })}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={goToNextMonth}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {/* Filtro por processo */}
            <Select value={processFilter} onValueChange={setProcessFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <Filter className="size-3 mr-1" />
                <SelectValue placeholder="Todos os processos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os processos</SelectItem>
                {processList.map((proc) => (
                  <SelectItem key={proc.id} value={proc.id}>
                    {proc.process_number} — {proc.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendário */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : totalDeadlines === 0 ? (
          <EmptyCalendarState />
        ) : (
          <CardContent className="p-2 sm:p-4">
            {/* Cabeçalhos dos dias da semana */}
            <div className="grid grid-cols-7 gap-0 mb-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="text-center text-xs font-medium text-muted-foreground py-1.5 sm:py-2"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Grade de dias */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((date) => {
                const dayDeadlines = getDeadlinesForDate(date);
                const isCurrent = isSameMonth(date, currentDate);

                return (
                  <DayCell
                    key={date.toISOString()}
                    date={date}
                    deadlines={dayDeadlines}
                    isCurrentMonth={isCurrent}
                    onSelect={handleDaySelect}
                  />
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span>Expirado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span>Próximo (≤3 dias)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span>No prazo</span>
        </div>
      </div>

      {/* Popover de prazos do dia */}
      <DayDeadlinesPopover
        open={popoverOpen}
        date={selectedDate}
        deadlines={selectedDeadlines}
        onClose={handleClosePopover}
        onNavigateToPrazos={() => onNavigateToPrazos?.()}
      />
    </div>
  );
}
