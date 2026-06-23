// ═══════════════════════════════════════════════════════════════
// LEXDOC — Painel de Administração da Plataforma (SUPER_ADMIN)
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, Users, ShieldCheck, Crown, TrendingUp,
  FileText, Clock, Bot, Search, ChevronDown, ChevronUp,
  Eye, Ban, UserCog, RefreshCw, AlertTriangle, CheckCircle2,
  Globe, BarChart3, Mail, Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import { platformApi } from '@/lib/api-client';
import type { ApiResponse } from '@/lib/api-client';

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────
const fmt = (d: string | null) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-MOZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário', CLIENT: 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
  ADMIN: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  ADVOGADO: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
  SECRETARIO: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  CLIENT: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-500/15 text-gray-400',
  PRO: 'bg-blue-500/15 text-blue-400',
  ENTERPRISE: 'bg-purple-500/15 text-purple-400',
};

type SubTab = 'overview' | 'firms' | 'users';

const SUB_TABS: { id: SubTab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
  { id: 'firms', label: 'Escritórios', icon: Building2 },
  { id: 'users', label: 'Utilizadores', icon: Users },
];

// ─────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────
function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-muted ${className}`} />;
}

// ─────────────────────────────────────────
// Bootstrap Banner (promover ADMIN → SUPER_ADMIN)
// ─────────────────────────────────────────
function BootstrapBanner() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePromote = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/v1/platform/bootstrap', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as ApiResponse<{ message: string; user: { id: string; email: string; role: string; firm_id: string; full_name: string } }>;
      if (data.success && data.data) {
        setAuth(accessToken, refreshToken, {
          ...user!,
          role: data.data.user.role,
        });
      } else if (data.error) {
        setError(data.error.message);
      }
    } catch {
      setError('Erro de ligação ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-purple-500/30 bg-purple-500/5">
      <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center shrink-0">
          <Crown className="size-6 text-purple-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-foreground">Tornar-se Super Administrador</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Como administrador, pode promover a sua conta para gerir toda a plataforma —
            todos os escritórios, utilizadores e configurações.
          </p>
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>
        <Button
          onClick={handlePromote}
          disabled={loading}
          className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
        >
          {loading ? <RefreshCw className="size-4 animate-spin mr-2" /> : <Crown className="size-4 mr-2" />}
          Promover Conta
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: number | string;
  sub?: string; color: string;
}) {
  return (
    <Card className="hover:border-border/80 transition-colors">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<ApiResponse<unknown>['data'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { platformApi.stats().then(r => { setStats(r.data ?? null); setLoading(false); }); }, []);

  if (loading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>;
  if (!stats) return <Card><CardContent className="p-8 text-center text-muted-foreground">Erro ao carregar estatísticas.</CardContent></Card>;

  const s = stats as NonNullable<typeof stats>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard icon={Building2} label="Escritórios" value={s.firms.total} sub={`${s.firms.active} activos`} color="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={Users} label="Utilizadores" value={s.users.total} sub={`${s.users.active} activos`} color="bg-blue-500/15 text-blue-400" />
        <StatCard icon={Globe} label="Clientes" value={s.clients.total} color="bg-cyan-500/15 text-cyan-400" />
        <StatCard icon={TrendingUp} label="Processos" value={s.processes.total} sub={`${s.processes.active} activos`} color="bg-amber-500/15 text-amber-400" />
        <StatCard icon={FileText} label="Documentos" value={s.documents.total} color="bg-rose-500/15 text-rose-400" />
        <StatCard icon={Clock} label="Prazos Pendentes" value={s.deadlines.pending} sub={`${s.deadlines.total} total`} color="bg-orange-500/15 text-orange-400" />
        <StatCard icon={Bot} label="Conversas IA" value={s.ai.conversations} color="bg-violet-500/15 text-violet-400" />
        <StatCard icon={ShieldCheck} label="Gerações IA" value={s.ai.generations} color="bg-fuchsia-500/15 text-fuchsia-400" />
      </div>

      {/* Role Distribution + Plan Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Papel</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {s.users.by_role.map(r => (
                <div key={r.role} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ROLE_COLORS[r.role] ?? ''}>{ROLE_LABELS[r.role] ?? r.role}</Badge>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Plano</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {(s.plans ?? []).map(p => (
                <div key={p.plan} className="flex items-center justify-between gap-3">
                  <Badge variant="outline" className={PLAN_COLORS[p.plan] ?? ''}>{p.plan}</Badge>
                  <span className="text-sm font-semibold tabular-nums">{p.count}</span>
                </div>
              ))}
              {(!s.plans || s.plans.length === 0) && <p className="text-sm text-muted-foreground">Sem dados</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Utilizadores Recentes</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {s.recent.users.map(u => (
                <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email} · {u.firm?.name}</p>
                  </div>
                  <Badge variant="outline" className={`shrink-0 ml-2 ${ROLE_COLORS[u.role] ?? ''}`}>{ROLE_LABELS[u.role] ?? u.role}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-muted-foreground">Escritórios Recentes</CardTitle></CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {s.recent.firms.map(f => (
                <div key={f.id} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{fmt(f.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <Badge variant="outline" className={PLAN_COLORS[f.plan] ?? ''}>{f.plan}</Badge>
                    {!f.is_active && <Badge variant="outline" className="bg-red-500/15 text-red-400">Inactivo</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Firms Tab
// ─────────────────────────────────────────
function FirmsTab() {
  const [firms, setFirms] = useState<ApiResponse<unknown>['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deactivating, setDeactivating] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      params.set('limit', '50');
      const res = await platformApi.listFirms(params.toString());
      if (!cancelled) {
        setFirms(res.data ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [search]);

  const handleDeactivate = async (id: string) => {
    if (!confirm('Desactivar este escritório? Todos os utilizadores serão desactivados.')) return;
    setDeactivating(id);
    await platformApi.deactivateFirm(id);
    setDeactivating(null);
    fetchFirms();
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>;

  const list = (firms ?? []) as Array<{
    id: string; name: string; slug: string; nif: string | null; oam_number: string | null;
    is_active: boolean; plan: string; created_at: string;
    _count: { users: number; clients: number; processes: number; documents: number; ai_conversations: number };
  }>;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar escritórios..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 max-w-sm"
        />
      </div>

      {list.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum escritório encontrado.</CardContent></Card>
      )}

      <div className="space-y-3">
        {list.map(firm => (
          <Card key={firm.id} className={`transition-colors ${!firm.is_active ? 'opacity-60' : ''}`}>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${firm.is_active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground truncate">{firm.name}</p>
                      <Badge variant="outline" className={PLAN_COLORS[firm.plan] ?? ''}>{firm.plan}</Badge>
                      {!firm.is_active && <Badge variant="outline" className="bg-red-500/15 text-red-400">Inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{firm.slug} · {firm.nif ?? 'Sem NIF'} · Criado {fmt(firm.created_at)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setExpanded(expanded === firm.id ? null : firm.id)}>
                    {expanded === firm.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    <span className="hidden sm:inline ml-1">Detalhes</span>
                  </Button>
                  {firm.is_active && (
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeactivate(firm.id)} disabled={deactivating === firm.id}>
                      <Ban className="size-4" />
                      <span className="hidden sm:inline ml-1">{deactivating === firm.id ? 'Aguardar...' : 'Desactivar'}</span>
                    </Button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expanded === firm.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border/50">
                      {[
                        { label: 'Utilizadores', value: firm._count.users },
                        { label: 'Clientes', value: firm._count.clients },
                        { label: 'Processos', value: firm._count.processes },
                        { label: 'Documentos', value: firm._count.documents },
                        { label: 'Conv. IA', value: firm._count.ai_conversations },
                      ].map(s => (
                        <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
                          <p className="text-lg font-bold text-foreground tabular-nums">{s.value}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Users Tab
// ─────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<ApiResponse<unknown>['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [editingUser, setEditingUser] = useState<{ id: string; full_name: string; role: string; is_active: boolean } | null>(null);
  const [newRole, setNewRole] = useState('');
  const [saving, setSaving] = useState(false);

  const refreshUsers = useCallback((s: string, r: string) => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (s) params.set('search', s);
      if (r) params.set('role', r);
      params.set('limit', '50');
      const res = await platformApi.listUsers(params.toString());
      if (!cancelled) {
        setUsers(res.data ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { const cleanup = refreshUsers(search, roleFilter); return cleanup; }, [search, roleFilter, refreshUsers]);

  const handleRoleChange = async () => {
    if (!editingUser || !newRole) return;
    setSaving(true);
    await platformApi.updateUser(editingUser.id, { role: newRole });
    setSaving(false);
    setEditingUser(null);
    setNewRole('');
    refreshUsers(search, roleFilter);
  };

  const handleToggleActive = async (u: { id: string; full_name: string; is_active: boolean }) => {
    if (!confirm(`${u.is_active ? 'Desactivar' : 'Activar'} ${u.full_name}?`)) return;
    await platformApi.updateUser(u.id, { is_active: !u.is_active });
    refreshUsers(search, roleFilter);
  };

  if (loading) return <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  const list = (users ?? []) as Array<{
    id: string; email: string; full_name: string; role: string; phone: string | null;
    is_active: boolean; email_verified: boolean; mfa_enabled: boolean;
    last_login_at: string | null; created_at: string;
    firm: { id: string; name: string; plan: string };
  }>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Pesquisar utilizadores..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT', 'SUPER_ADMIN'].map(r => (
            <Button key={r} variant={roleFilter === r ? 'default' : 'outline'} size="sm"
              onClick={() => setRoleFilter(r)} className="text-xs h-8">
              {r ? (ROLE_LABELS[r] ?? r) : 'Todos'}
            </Button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhum utilizador encontrado.</CardContent></Card>
      )}

      {/* Users List */}
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {list.map(u => (
          <Card key={u.id} className={`transition-colors ${!u.is_active ? 'opacity-50' : ''}`}>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-muted-foreground">
                      {u.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{u.full_name}</p>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[u.role] ?? ''}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                      {!u.is_active && <Badge variant="outline" className="bg-red-500/15 text-red-400 text-[10px] px-1.5 py-0">Inactivo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      <Mail className="size-3 inline mr-1" />{u.email}
                      <span className="mx-1.5">·</span>
                      <Building2 className="size-3 inline mr-1" />{u.firm.name}
                      <span className="mx-1.5">·</span>
                      <Calendar className="size-3 inline mr-1" />{fmt(u.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setEditingUser(u); setNewRole(u.role); }}>
                    <UserCog className="size-3.5 mr-1" />Alterar Papel
                  </Button>
                  <Button variant="ghost" size="sm" className={`h-8 text-xs ${u.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                    onClick={() => handleToggleActive(u)}>
                    {u.is_active ? <Ban className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Change Dialog (inline) */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setEditingUser(null)}
          >
            <Card className="w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <CardHeader>
                <CardTitle className="text-base">Alterar Papel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Utilizador: <span className="text-foreground font-medium">{editingUser.full_name}</span>
                </p>
                <div className="space-y-2">
                  {(['ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT'] as const).map(r => (
                    <label key={r} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <input
                        type="radio" name="role" value={r} checked={newRole === r}
                        onChange={e => setNewRole(e.target.value)}
                        className="accent-primary"
                      />
                      <Badge variant="outline" className={ROLE_COLORS[r]}>{ROLE_LABELS[r]}</Badge>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditingUser(null)}>Cancelar</Button>
                  <Button size="sm" onClick={handleRoleChange} disabled={saving || newRole === editingUser.role}>
                    {saving ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 mr-1" />}
                    Guardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────
export function PlatformAdminPanel() {
  const user = useAuthStore(s => s.user);
  const [activeTab, setActiveTab] = useState<SubTab>('overview');

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  if (!user) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Globe className="size-5 text-purple-400" />
            Gestão da Plataforma
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isSuperAdmin
              ? 'Visão e controlo completo de todos os escritórios e utilizadores.'
              : 'Promova a sua conta para aceder à gestão da plataforma.'}
          </p>
        </div>
        {isSuperAdmin && (
          <Badge className="bg-purple-500/15 text-purple-400 border-purple-500/25 px-3 py-1 text-sm">
            <Crown className="size-3.5 mr-1.5" />
            Super Administrador
          </Badge>
        )}
      </div>

      {/* Bootstrap Banner (only for ADMIN) */}
      {!isSuperAdmin && <BootstrapBanner />}

      {/* Sub-tabs (only for SUPER_ADMIN) */}
      {isSuperAdmin && (
        <>
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit">
            {SUB_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <tab.icon className="size-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'overview' && <OverviewTab />}
              {activeTab === 'firms' && <FirmsTab />}
              {activeTab === 'users' && <UsersTab />}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </div>
  );
}