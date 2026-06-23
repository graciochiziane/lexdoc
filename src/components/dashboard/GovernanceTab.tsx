'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  TrendingDown,
  TrendingUp,
  BarChart3,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Info,
  Eye,
  Activity,
  Brain,
  ChevronDown,
  ChevronUp,
  FileWarning,
  Scale,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { platformApi, type GovernanceData } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';

const fmt = (d: string) =>
  new Date(d).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

const periods = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
] as const;

const nivelConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  NENHUM: { label: 'Sem RAG', color: 'text-red-500', bg: 'bg-red-500' },
  SILENCIO_SEGURO: {
    label: 'Silêncio Seguro',
    color: 'text-amber-500',
    bg: 'bg-amber-500',
  },
  CAUTELAR: { label: 'Cautelar', color: 'text-yellow-500', bg: 'bg-yellow-500' },
  CONFIANTE: {
    label: 'Confiante',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500',
  },
  ALTA_CONFIANCA: {
    label: 'Alta Confiança',
    color: 'text-green-500',
    bg: 'bg-green-500',
  },
};

const scoreBuckets = [
  { key: '0-9', label: '0–9 (Crítico)', color: 'bg-red-500' },
  { key: '10-24', label: '10–24 (Baixo)', color: 'bg-amber-500' },
  { key: '25-49', label: '25–49 (Médio)', color: 'bg-yellow-500' },
  { key: '50-74', label: '50–74 (Bom)', color: 'bg-emerald-500' },
  { key: '75-100', label: '75–100 (Alto)', color: 'bg-green-500' },
];

const fadeIn = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

function SkeletonCard() {
  return (
    <Card className="border border-border/50">
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-24" />
      </CardContent>
    </Card>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-16 rounded-md" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="rounded-full bg-muted p-4 mb-4">
        <ShieldOff className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Sem dados de governança
      </h3>
      <p className="text-sm text-muted-foreground max-w-md">
        Ainda não existem respostas com dados de governança para o período
        selecionado. Os dados aparecerão aqui após as primeiras interacções com
        o LexDoc AI.
      </p>
    </motion.div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <FileWarning className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">
        Erro ao carregar dados
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        Não foi possível obter os dados de governança. Verifique a ligação e
        tente novamente.
      </p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </motion.div>
  );
}

function HorizontalBar({
  label,
  count,
  percentage,
  color,
  index,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
  index: number;
}) {
  return (
    <motion.div
      custom={index}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground font-medium">{label}</span>
        <span className="text-muted-foreground">
          {count} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(percentage, 0.5)}%` }}
          transition={{ duration: 0.6, delay: index * 0.08, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

export function GovernanceTab() {
  const [period, setPeriod] = useState<string>('7d');
  const [data, setData] = useState<GovernanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const fetchData = async (p: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await platformApi.governance(p);
      setData(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(period);
  }, [period]);

  if (loading) return <SkeletonGrid />;
  if (error) return <ErrorState onRetry={() => fetchData(period)} />;
  if (!data || data.summary.total_responses === 0) return <EmptyState />;

  const { summary, nivel_distribution, score_distribution, source_analysis, daily_trend, recent_governance } = data;

  const trendData = daily_trend.slice(-14);
  const maxTrendTotal = Math.max(...trendData.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <motion.div
        custom={0}
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="flex items-center gap-2 flex-wrap"
      >
        <Scale className="h-4 w-4 text-muted-foreground mr-1" />
        <span className="text-sm text-muted-foreground mr-2">Período:</span>
        {periods.map((p) => (
          <Button
            key={p.value}
            size="sm"
            variant={period === p.value ? 'default' : 'outline'}
            onClick={() => setPeriod(p.value)}
            className="h-8 text-xs"
          >
            {p.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => fetchData(period)}
          className="h-8 w-8 p-0 ml-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Respostas */}
        <motion.div custom={1} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Respostas
              </CardTitle>
              <Brain className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {summary.total_responses.toLocaleString('pt-MZ')}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.with_governance_data} com dados de governança
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Taxa Silêncio Seguro */}
        <motion.div custom={2} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                Taxa Silêncio Seguro
                {summary.safe_silence_rate < 5 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Baixa
                  </Badge>
                )}
              </CardTitle>
              <ShieldAlert className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {summary.safe_silence_rate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.safe_silence_count} silêncios activados
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Médio */}
        <motion.div custom={3} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Score Médio
              </CardTitle>
              <Activity className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {summary.avg_confidence_score !== null
                  ? summary.avg_confidence_score.toFixed(1)
                  : '—'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.min_confidence_score !== null &&
                summary.max_confidence_score !== null
                  ? `Mín: ${summary.min_confidence_score.toFixed(0)} · Máx: ${summary.max_confidence_score.toFixed(0)}`
                  : 'Sem dados de score'}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cobertura Governança */}
        <motion.div custom={4} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cobertura Governança
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {summary.governance_coverage.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.governance_coverage >= 90 ? (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" />
                    Cobertura excelente
                  </span>
                ) : summary.governance_coverage >= 70 ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Info className="h-3 w-3" />
                    Cobertura razoável
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertTriangle className="h-3 w-3" />
                    Cobertura baixa
                  </span>
                )}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Distribution charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nível Distribution */}
        <motion.div custom={5} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Distribuição por Nível
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {nivel_distribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de nível
                </p>
              ) : (
                nivel_distribution.map((item, i) => {
                  const cfg = nivelConfig[item.nivel] ?? {
                    label: item.nivel,
                    color: 'text-muted-foreground',
                    bg: 'bg-muted-foreground',
                  };
                  return (
                    <HorizontalBar
                      key={item.nivel}
                      label={cfg.label}
                      count={item.count}
                      percentage={item.percentage}
                      color={cfg.bg}
                      index={i}
                    />
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Score Distribution */}
        <motion.div custom={6} variants={fadeIn} initial="hidden" animate="visible">
          <Card className="border border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Distribuição de Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(score_distribution).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Sem dados de score
                </p>
              ) : (
                (() => {
                  const totalScore = Object.values(score_distribution).reduce(
                    (a, b) => a + b,
                    0
                  );
                  return scoreBuckets.map((bucket, i) => {
                    const count = score_distribution[bucket.key] ?? 0;
                    const pct = totalScore > 0 ? (count / totalScore) * 100 : 0;
                    return (
                      <HorizontalBar
                        key={bucket.key}
                        label={bucket.label}
                        count={count}
                        percentage={pct}
                        color={bucket.color}
                        index={i}
                      />
                    );
                  });
                })()
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Source Analysis */}
      <motion.div custom={7} variants={fadeIn} initial="hidden" animate="visible">
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Análise de Fontes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-emerald-500/10 p-2.5">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Fontes MZ
                  </p>
                  <p className="text-lg font-bold text-emerald-500">
                    {source_analysis.with_mozambican_source}
                  </p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20">
                  Oficial MZ
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-500/10 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Fontes Penalizadas
                  </p>
                  <p className="text-lg font-bold text-red-500">
                    {source_analysis.with_penalized_source}
                  </p>
                </div>
                <Badge className="bg-red-500/15 text-red-600 border-red-500/20 hover:bg-red-500/20">
                  Possível PT
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2.5">
                  <Info className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Sem Fonte
                  </p>
                  <p className="text-lg font-bold text-muted-foreground">
                    {source_analysis.with_no_source}
                  </p>
                </div>
                <Badge variant="secondary">Não especificada</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Amostra: {source_analysis.sample_size} respostas com dados de
              fonte
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Daily Trend */}
      <motion.div custom={8} variants={fadeIn} initial="hidden" animate="visible">
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Tendência Diária
              <span className="text-xs font-normal text-muted-foreground ml-1">
                (últimos 14 dias)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem dados de tendência
              </p>
            ) : (
              <div className="flex items-end gap-1.5 h-36">
                {trendData.map((day, i) => {
                  const totalHeight = (day.total / maxTrendTotal) * 100;
                  const silenceHeight =
                    day.total > 0
                      ? (day.safe_silence / day.total) * totalHeight
                      : 0;
                  const barHeight = Math.max(totalHeight, 2);
                  const dateStr = new Date(day.date).toLocaleDateString(
                    'pt-MZ',
                    { day: '2-digit', month: '2-digit' }
                  );
                  return (
                    <motion.div
                      key={day.date}
                      className="flex-1 flex flex-col items-center gap-1"
                      initial={{ opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{
                        delay: i * 0.04,
                        duration: 0.4,
                        ease: 'easeOut',
                      }}
                      style={{ transformOrigin: 'bottom' }}
                    >
                      <div className="text-[10px] text-muted-foreground leading-none">
                        {day.safe_silence > 0 ? day.safe_silence : ''}
                      </div>
                      <div
                        className="w-full rounded-t-sm bg-muted relative overflow-hidden"
                        style={{ height: `${barHeight}%` }}
                      >
                        {silenceHeight > 0 && (
                          <motion.div
                            className="absolute bottom-0 left-0 right-0 bg-amber-500 rounded-t-sm"
                            initial={{ height: 0 }}
                            animate={{ height: `${(silenceHeight / barHeight) * 100}%` }}
                            transition={{
                              delay: i * 0.04 + 0.3,
                              duration: 0.4,
                            }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {dateStr}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-muted" />
                Total respostas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" />
                Silêncio seguro
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Governance Log */}
      <motion.div custom={9} variants={fadeIn} initial="hidden" animate="visible">
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Registo de Governança Recente
                <Badge variant="secondary" className="text-[10px] ml-1">
                  {recent_governance.length}
                </Badge>
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLogExpanded(!logExpanded)}
                className="h-7 text-xs gap-1"
              >
                {logExpanded ? (
                  <>
                    Ocultar <ChevronUp className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Expandir <ChevronDown className="h-3.5 w-3.5" />
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recent_governance.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Sem registos recentes
              </p>
            ) : (
              <div
                className={`overflow-x-auto ${
                  logExpanded ? 'max-h-64 overflow-y-auto' : 'max-h-0 overflow-hidden'
                } transition-[max-height] duration-300 ease-in-out custom-scrollbar`}
              >
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background z-10">
                    <tr className="border-b border-border text-left">
                      <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                        Data
                      </th>
                      <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                        Utilizador
                      </th>
                      <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs hidden md:table-cell">
                        Escritório
                      </th>
                      <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs text-right">
                        Score
                      </th>
                      <th className="pb-2 pr-3 font-medium text-muted-foreground text-xs">
                        Nível
                      </th>
                      <th className="pb-2 font-medium text-muted-foreground text-xs">
                        Pré-visualização
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {recent_governance.map((entry) => {
                      const ncfg = entry.nivel
                        ? nivelConfig[entry.nivel]
                        : null;
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap text-xs">
                            {fmt(entry.created_at)}
                          </td>
                          <td className="py-2 pr-3 text-foreground whitespace-nowrap text-xs font-medium">
                            {entry.user_name}
                          </td>
                          <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap text-xs hidden md:table-cell">
                            {entry.firm_name}
                          </td>
                          <td className="py-2 pr-3 text-foreground text-xs text-right font-mono">
                            {entry.confidence_score !== null
                              ? entry.confidence_score.toFixed(0)
                              : '—'}
                          </td>
                          <td className="py-2 pr-3">
                            {entry.nivel && ncfg ? (
                              <Badge
                                className={`${ncfg.bg}/15 ${ncfg.color} border-current/20 text-[10px] px-1.5 py-0`}
                                style={{ borderColor: 'currentColor' }}
                              >
                                {ncfg.label}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                —
                              </Badge>
                            )}
                          </td>
                          <td className="py-2 text-muted-foreground text-xs max-w-[200px] truncate">
                            {entry.content_preview}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!logExpanded && recent_governance.length > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                Clique em &quot;Expandir&quot; para ver os {recent_governance.length} registos
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}