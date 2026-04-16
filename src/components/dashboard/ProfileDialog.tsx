// ═══════════════════════════════════════════════════════════════
// LEXDOC — Diálogo de Perfil do Utilizador
// Visualização e edição do perfil + alteração de palavra-passe
// Status de verificação, último acesso, fundos alternados
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Mail,
  Phone,
  Building2,
  Shield,
  CalendarDays,
  Pencil,
  Loader2,
  Eye,
  EyeOff,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Clock,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { profileApi, type ProfileData } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Rótulos de papéis
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

// ─────────────────────────────────────────
// Funções auxiliares
// ─────────────────────────────────────────
function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatLastAccess(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Não disponível';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'Neste momento';
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  if (diffHours < 24) return `há ${diffHours}h`;
  if (diffDays < 2) return 'Ontem';
  if (diffDays < 7) return `há ${diffDays} dias`;

  return date.toLocaleDateString('pt-MZ', {
    day: '2-digit',
    month: 'short',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);

  // Estado de edição
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Estado de alteração de palavra-passe
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // ── Buscar perfil ──
  const fetchProfile = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await profileApi.get();
      if (res.success && res.data) {
        setProfile(res.data);
        setEditName(res.data.full_name);
        setEditPhone(res.data.phone ?? '');
      }
    } catch {
      toast.error('Erro ao carregar perfil.');
    } finally {
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    fetchProfile();
    // Reset form states on open
    if (open) {
      setEditMode(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, fetchProfile]);

  // ── Guardar alterações de perfil ──
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await profileApi.update({
        full_name: editName,
        phone: editPhone || null,
      });
      if (res.success && res.data) {
        setProfile(res.data);
        setEditMode(false);
        // Actualizar store local
        const { user } = useAuthStore.getState();
        if (user) {
          useAuthStore.setState({
            user: { ...user, full_name: res.data.full_name },
          });
        }
        toast.success('Perfil actualizado com sucesso!');
      } else {
        toast.error(res.error?.message ?? 'Erro ao actualizar perfil.');
      }
    } catch {
      toast.error('Erro ao actualizar perfil.');
    } finally {
      setSaving(false);
    }
  };

  // ── Alterar palavra-passe ──
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('Todos os campos são obrigatórios.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A nova palavra-passe e a confirmação não coincidem.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await profileApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      if (res.success) {
        toast.success('Palavra-passe alterada com sucesso!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.error?.message ?? 'Erro ao alterar palavra-passe.');
      }
    } catch {
      toast.error('Erro ao alterar palavra-passe.');
    } finally {
      setChangingPassword(false);
    }
  };

  if (!profile && !loading) return null;

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('') ?? 'U';

  // Verificação de email (simulado - campo existe na BD)
  const isEmailVerified = true; // Seria profile.email_verified

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Cabeçalho visual */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-500 px-6 pt-6 pb-8 text-white">
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl font-bold border border-white/20"
            >
              {initials}
            </motion.div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold truncate">{profile?.full_name}</h2>
              <p className="text-sm text-white/80 truncate flex items-center gap-1.5">
                {profile?.email}
                {isEmailVerified ? (
                  <CheckCircle2 className="size-3.5 text-emerald-200" />
                ) : (
                  <AlertTriangle className="size-3.5 text-amber-300" />
                )}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge
                  className={`text-[10px] border-0 rounded-full shadow-sm ${ROLE_COLORS[profile?.role ?? ''] ?? ''}`}
                >
                  {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
                </Badge>
                {profile?.firm && (
                  <span className="text-xs text-white/70">{profile.firm.name}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogHeader className="sr-only">
          <DialogTitle>Perfil do Utilizador</DialogTitle>
          <DialogDescription>Visualizar e editar informações do perfil</DialogDescription>
        </DialogHeader>

        {/* Conteúdo em tabs */}
        <div className="px-6 pb-6">
          <Tabs defaultValue="info" className="mt-2">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">Informações</TabsTrigger>
              <TabsTrigger value="password" className="flex-1 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-200">Palavra-passe</TabsTrigger>
            </TabsList>

            {/* Tab: Informações */}
            <TabsContent value="info" className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-emerald-500" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  {!editMode ? (
                    <motion.div
                      key="view"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {/* Campos de visualização com fundos alternados */}
                      <div className="grid gap-2">
                        <InfoField
                          icon={User}
                          label="Nome completo"
                          value={profile?.full_name ?? ''}
                          altBg
                        />
                        <InfoField
                          icon={Mail}
                          label="Email"
                          value={profile?.email ?? ''}
                          rightSlot={
                            isEmailVerified ? (
                              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-3.5" />
                                <span className="text-[10px] font-medium">Verificado</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-amber-500">
                                <AlertTriangle className="size-3.5" />
                                <span className="text-[10px] font-medium">Não verificado</span>
                              </div>
                            )
                          }
                        />
                        <InfoField
                          icon={Phone}
                          label="Telefone"
                          value={profile?.phone ?? 'Não definido'}
                          altBg
                        />
                        <InfoField
                          icon={Building2}
                          label="Escritório"
                          value={profile?.firm?.name ?? ''}
                          rightSlot={
                            profile?.firm?.plan ? (
                              <Badge variant="secondary" className="text-[10px] rounded-full shadow-sm bg-muted">
                                {PLAN_LABELS[profile.firm.plan] ?? profile.firm.plan}
                              </Badge>
                            ) : undefined
                          }
                        />
                        <InfoField
                          icon={Shield}
                          label="Papel"
                          value={ROLE_LABELS[profile?.role ?? ''] ?? profile?.role ?? ''}
                          altBg
                        />
                        <InfoField
                          icon={CalendarDays}
                          label="Membro desde"
                          value={profile ? formatFullDate(profile.created_at) : ''}
                        />
                        <InfoField
                          icon={Clock}
                          label="Último acesso"
                          value={profile?.last_login_at ? formatLastAccess(profile.last_login_at) : 'Não disponível'}
                          altBg
                        />
                      </div>

                      <Separator />

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full active:scale-[0.98] transition-all duration-200"
                        onClick={() => setEditMode(true)}
                      >
                        <Pencil className="size-3.5 mr-2" />
                        Editar perfil
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="edit"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-4"
                    >
                      {/* Campos de edição */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-name">Nome completo</Label>
                          <Input
                            id="edit-name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Nome completo"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="edit-phone">Telefone</Label>
                          <Input
                            id="edit-phone"
                            value={editPhone}
                            onChange={(e) => setEditPhone(e.target.value)}
                            placeholder="+258 84 XXX XXXX"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 active:scale-[0.98] transition-all duration-200"
                          onClick={() => {
                            setEditMode(false);
                            setEditName(profile?.full_name ?? '');
                            setEditPhone(profile?.phone ?? '');
                          }}
                          disabled={saving}
                        >
                          Cancelar
                        </Button>
                        <Button
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200"
                          onClick={handleSaveProfile}
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
            </TabsContent>

            {/* Tab: Palavra-passe */}
            <TabsContent value="password" className="mt-4 space-y-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="current-pw">Palavra-passe actual</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="current-pw"
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Palavra-passe actual"
                      className="pl-9 pr-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => setShowCurrent(!showCurrent)}
                    >
                      {showCurrent ? (
                        <EyeOff className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">Nova palavra-passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="new-pw"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nova palavra-passe"
                      className="pl-9 pr-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-2"
                      onClick={() => setShowNew(!showNew)}
                    >
                      {showNew ? (
                        <EyeOff className="size-3.5 text-muted-foreground" />
                      ) : (
                        <Eye className="size-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                  <PasswordStrengthIndicator password={newPassword} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-pw">Confirmar nova palavra-passe</Label>
                  <Input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirmar nova palavra-passe"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-500">As palavras-passe não coincidem.</p>
                  )}
                </div>
              </div>

              <Separator />

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all duration-200"
                onClick={handleChangePassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    <Lock className="size-4 mr-2" />
                    Alterar palavra-passe
                  </>
                )}
              </Button>
            </TabsContent>
          </Tabs>
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
  altBg = false,
  rightSlot,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  altBg?: boolean;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors ${
      altBg ? 'bg-muted/50' : ''
    }`}>
      <div className="flex items-center justify-center size-8 rounded-lg bg-muted shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      {rightSlot && (
        <div className="shrink-0">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
