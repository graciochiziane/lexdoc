// ═══════════════════════════════════════════════════════════════
// LEXDOC — Diálogo de Configurações do Escritório
// Informações do escritório + membros + edição (ADMIN)
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Hash,
  BadgeCheck,
  Crown,
  Users,
  Pencil,
  Loader2,
  X,
  Mail,
  Shield,
  CheckCircle2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { firmApi, type FirmSettings } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface FirmSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Rótulos
const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ADVOGADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SECRETARIO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CLIENT: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Iniciante',
  PROFESSIONAL: 'Profissional',
  ENTERPRISE: 'Empresarial',
};

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  PROFESSIONAL: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  ENTERPRISE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function FirmSettingsDialog({ open, onOpenChange }: FirmSettingsDialogProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [settings, setSettings] = useState<FirmSettings | null>(null);
  const [members, setMembers] = useState<Array<{
    id: string;
    email: string;
    full_name: string;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
  }> | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado de edição
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editNif, setEditNif] = useState('');
  const [editOam, setEditOam] = useState('');
  const [saving, setSaving] = useState(false);

  // ── Buscar dados ──
  const fetchData = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const [settingsRes, membersRes] = await Promise.all([
        firmApi.settings.get(),
        firmApi.members(),
      ]);

      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data);
        setEditName(settingsRes.data.name);
        setEditNif(settingsRes.data.nif ?? '');
        setEditOam(settingsRes.data.oam_number ?? '');
      }

      if (membersRes.success && membersRes.data) {
        setMembers(membersRes.data);
      }
    } catch {
      toast.error('Erro ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    fetchData();
    if (open) {
      setEditMode(false);
    }
  }, [open, fetchData]);

  // ── Guardar alterações ──
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await firmApi.settings.update({
        name: editName,
        nif: editNif || undefined,
        oam_number: editOam || undefined,
      });
      if (res.success && res.data) {
        setSettings(res.data);
        setEditMode(false);
        toast.success('Configurações actualizadas com sucesso!');
      } else {
        toast.error(res.error?.message ?? 'Erro ao actualizar configurações.');
      }
    } catch {
      toast.error('Erro ao actualizar configurações.');
    } finally {
      setSaving(false);
    }
  };

  const firmInitials = settings?.name
    ?.split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') ?? 'LE';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Cabeçalho visual */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 pt-6 pb-8 text-white shrink-0">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold border border-white/20"
            >
              {firmInitials}
            </motion.div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">
                {settings?.name ?? 'Escritório'}
              </h2>
              <p className="text-sm text-white/80 truncate">
                {settings?.slug ?? ''}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  className={`text-[10px] border-0 ${PLAN_COLORS[settings?.plan ?? ''] ?? ''}`}
                >
                  {PLAN_LABELS[settings?.plan ?? ''] ?? settings?.plan}
                </Badge>
                <span className="text-xs text-white/70">
                  {settings?.member_count ?? 0} membros
                </span>
                {settings?.is_active && (
                  <span className="flex items-center gap-1 text-xs text-emerald-200">
                    <CheckCircle2 className="size-3" />
                    Activo
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>Configurações do Escritório</DialogTitle>
          <DialogDescription>Visualizar e editar configurações do escritório</DialogDescription>
        </DialogHeader>

        {/* Conteúdo */}
        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-6 space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-12 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {!editMode ? (
                <motion.div
                  key="view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 mt-4"
                >
                  {/* Informações do escritório */}
                  <div className="grid gap-3">
                    <InfoField
                      icon={Building2}
                      label="Nome do Escritório"
                      value={settings?.name ?? ''}
                    />
                    <InfoField
                      icon={Hash}
                      label="NIF"
                      value={settings?.nif ?? 'Não definido'}
                    />
                    <InfoField
                      icon={BadgeCheck}
                      label="Número OAM"
                      value={settings?.oam_number ?? 'Não definido'}
                    />
                    <InfoField
                      icon={Crown}
                      label="Plano"
                      value={PLAN_LABELS[settings?.plan ?? ''] ?? settings?.plan ?? ''}
                    />
                    <InfoField
                      icon={Users}
                      label="Membros"
                      value={`${settings?.member_count ?? 0} utilizadores`}
                    />
                  </div>

                  {isAdmin && (
                    <>
                      <Separator />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setEditMode(true)}
                      >
                        <Pencil className="size-3.5 mr-2" />
                        Editar configurações
                      </Button>
                    </>
                  )}

                  <Separator />

                  {/* Lista de membros */}
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <Users className="size-4 text-emerald-600" />
                      Membros da Equipa
                    </h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {members && members.length > 0 ? (
                        members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                              <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                                {member.full_name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{member.full_name}</p>
                              <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={`text-[10px] rounded-full ${ROLE_COLORS[member.role] ?? ''}`}
                              >
                                {ROLE_LABELS[member.role] ?? member.role}
                              </Badge>
                              {!member.is_active && (
                                <Badge variant="outline" className="text-[10px] bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Nenhum membro encontrado.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 mt-4"
                >
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-firm-name">Nome do Escritório</Label>
                      <Input
                        id="edit-firm-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nome do escritório"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-firm-nif">NIF</Label>
                      <Input
                        id="edit-firm-nif"
                        value={editNif}
                        onChange={(e) => setEditNif(e.target.value)}
                        placeholder="Número de Identificação Fiscal"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-firm-oam">Número OAM</Label>
                      <Input
                        id="edit-firm-oam"
                        value={editOam}
                        onChange={(e) => setEditOam(e.target.value)}
                        placeholder="Número de registo na OAM"
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setEditMode(false);
                        setEditName(settings?.name ?? '');
                        setEditNif(settings?.nif ?? '');
                        setEditOam(settings?.oam_number ?? '');
                      }}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        'Guardar'
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────
// Sub-componente: Campo de informação
// ─────────────────────────────────────────
function InfoField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
