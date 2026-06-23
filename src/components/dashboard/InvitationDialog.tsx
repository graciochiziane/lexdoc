// ═══════════════════════════════════════════════════════════════
// LEXDOC — Diálogo de Criação de Convite
// Formulário para criar convite de novo membro (ADMIN)
// Descrições de papéis, validação visual, estado de sucesso melhorado
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Shield,
  User,
  Loader2,
  Link2,
  CheckCircle2,
  XCircle,
  Copy,
  CheckCheck,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { invitationsApi, type InvitationResult } from '@/lib/api-client';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface InvitationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Administrador',
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  ADMIN: 'Acesso total ao escritório e gestão de membros',
  ADVOGADO: 'Gestão de processos, clientes e documentos',
  SECRETARIO: 'Visualização e edição de processos e documentos',
  CLIENT: 'Acesso limitado aos seus processos',
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  ADMIN: Shield,
  ADVOGADO: User,
  SECRETARIO: User,
  CLIENT: User,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function InvitationDialog({ open, onOpenChange }: InvitationDialogProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdInvitation, setCreatedInvitation] = useState<InvitationResult | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // ── Estados de validação ──
  const emailTouched = email.length > 0;
  const isEmailValid = email.trim() && EMAIL_REGEX.test(email.trim());
  const isEmailInvalid = emailTouched && email.trim() && !EMAIL_REGEX.test(email.trim());
  const isValid = isEmailValid && role;

  // ── Papel seleccionado com descrição ──
  const selectedRoleDescription = useMemo(() => {
    if (!role) return null;
    return {
      label: ROLE_LABELS[role] ?? role,
      description: ROLE_DESCRIPTIONS[role] ?? '',
      icon: ROLE_ICONS[role] ?? User,
    };
  }, [role]);

  // ── Submeter convite ──
  const handleSubmit = useCallback(async () => {
    if (!isValid) return;

    setSubmitting(true);
    try {
      const res = await invitationsApi.create({
        email: email.trim().toLowerCase(),
        role,
        full_name: fullName.trim() || undefined,
      });

      if (res.success && res.data) {
        setCreatedInvitation(res.data);
        toast.success('Convite criado com sucesso!');
      } else {
        toast.error(res.error?.message ?? 'Erro ao criar convite.');
      }
    } catch {
      toast.error('Erro ao criar convite.');
    } finally {
      setSubmitting(false);
    }
  }, [isValid, email, role, fullName]);

  // ── Copiar link ──
  const handleCopyLink = useCallback(() => {
    if (!createdInvitation) return;

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const link = `${baseUrl}/?invite=${createdInvitation.token}`;

    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      toast.success('Link do convite copiado para a área de transferência!');
      setTimeout(() => setLinkCopied(false), 3000);
    }).catch(() => {
      toast.error('Erro ao copiar link.');
    });
  }, [createdInvitation]);

  // ── Reset ao fechar ──
  const handleClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setEmail('');
      setRole('');
      setFullName('');
      setCreatedInvitation(null);
      setLinkCopied(false);
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  const inviteLink = createdInvitation
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${createdInvitation.token}`
    : '';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-w-[95vw] p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {createdInvitation ? (
            /* ───── Estado de sucesso ───── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center gap-2">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                    className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"
                  >
                    <CheckCircle2 className="size-5 text-emerald-600" />
                  </motion.div>
                  Convite Criado com Sucesso!
                </DialogTitle>
                <DialogDescription>
                  Envie o link abaixo para convidar o novo membro ao escritório.
                </DialogDescription>
              </DialogHeader>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-4"
              >
                {/* Detalhes do convite */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 border border-emerald-200 dark:border-emerald-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <Mail className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Email</p>
                      <p className="text-sm font-medium">{createdInvitation.email}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Papel</p>
                      <p className="text-sm font-medium">{ROLE_LABELS[createdInvitation.role] ?? createdInvitation.role}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Link2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">Expira em</p>
                      <p className="text-sm font-medium">
                        {new Date(createdInvitation.expires_at).toLocaleDateString('pt-MZ', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Link copiável */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="size-3.5 text-emerald-600" />
                    Link do Convite
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLink}
                      className="text-xs font-mono bg-muted/50"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <motion.div whileTap={{ scale: 0.92 }}>
                      <Button
                        variant={linkCopied ? 'default' : 'outline'}
                        size="icon"
                        className={`shrink-0 transition-all duration-200 active:scale-[0.95] ${
                          linkCopied
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : ''
                        }`}
                        onClick={handleCopyLink}
                        title={linkCopied ? 'Copiado!' : 'Copiar link'}
                      >
                        <AnimatePresence mode="wait">
                          {linkCopied ? (
                            <motion.div
                              key="copied"
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              exit={{ scale: 0, rotate: 90 }}
                            >
                              <CheckCheck className="size-4" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="copy"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                            >
                              <Copy className="size-4" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Button>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              <DialogFooter className="mt-4">
                <Button
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all duration-200"
                  onClick={() => handleClose(false)}
                >
                  <Sparkles className="size-4 mr-2" />
                  Concluir
                </Button>
              </DialogFooter>
            </motion.div>
          ) : (
            /* ───── Formulário de criação ───── */
            <motion.div
              key="form"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="p-6"
            >
              <DialogHeader className="mb-4">
                <DialogTitle className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Mail className="size-5 text-emerald-600" />
                  </div>
                  Novo Convite
                </DialogTitle>
                <DialogDescription>
                  Envie um convite para adicionar um novo membro ao escritório.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email" className="flex items-center gap-1.5">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="email@exemplo.co.mz"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`pl-9 pr-9 transition-all duration-200 ${
                        isEmailValid
                          ? 'border-emerald-500 focus-visible:ring-emerald-500/20'
                          : isEmailInvalid
                            ? 'border-red-500 focus-visible:ring-red-500/20'
                            : ''
                      }`}
                    />
                    {/* Indicador de validação */}
                    <AnimatePresence>
                      {isEmailValid && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        </motion.div>
                      )}
                      {isEmailInvalid && (
                        <motion.div
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          <XCircle className="size-4 text-red-500" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {isEmailInvalid && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -4, height: 0 }}
                        className="text-xs text-red-500 overflow-hidden"
                      >
                        Formato de email inválido. Use algo como nome@exemplo.co.mz
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Papel */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    Papel <span className="text-red-500">*</span>
                  </Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="transition-all duration-200">
                      <SelectValue placeholder="Seleccionar papel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">Administrador</span>
                          <span className="text-[10px] text-muted-foreground">Acesso total ao escritório e gestão de membros</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="ADVOGADO">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">Advogado</span>
                          <span className="text-[10px] text-muted-foreground">Gestão de processos, clientes e documentos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="SECRETARIO">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">Secretário(a)</span>
                          <span className="text-[10px] text-muted-foreground">Visualização e edição de processos e documentos</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="CLIENT">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">Cliente</span>
                          <span className="text-[10px] text-muted-foreground">Acesso limitado aos seus processos</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Descrição do papel seleccionado */}
                  <AnimatePresence>
                    {selectedRoleDescription && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, y: -4 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -4 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border">
                          <selectedRoleDescription.icon className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-xs font-medium">{selectedRoleDescription.label}</p>
                            <p className="text-[11px] text-muted-foreground">{selectedRoleDescription.description}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Nome opcional */}
                <div className="space-y-1.5">
                  <Label htmlFor="invite-name" className="text-muted-foreground">
                    Nome Completo <span className="text-muted-foreground/60">(opcional)</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input
                      id="invite-name"
                      placeholder="Nome do convidado"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                  className="active:scale-[0.98] transition-all duration-200"
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all duration-200 disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={!isValid || submitting}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  Criar Convite
                </Button>
              </DialogFooter>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
