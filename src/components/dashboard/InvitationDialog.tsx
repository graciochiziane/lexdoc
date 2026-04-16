// ═══════════════════════════════════════════════════════════════
// LEXDOC — Diálogo de Criação de Convite
// Formulário para criar convite de novo membro (ADMIN)
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Mail,
  Shield,
  User,
  Loader2,
  Link2,
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
  ADMIN: 'Administrador',
  ADVOGADO: 'Advogado',
  SECRETARIO: 'Secretário(a)',
  CLIENT: 'Cliente',
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

  // ── Validar email ──
  const isValid = email.trim() && EMAIL_REGEX.test(email.trim()) && role;

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
  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setEmail('');
      setRole('');
      setFullName('');
      setCreatedInvitation(null);
      setLinkCopied(false);
    }
    onOpenChange(open);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {createdInvitation ? (
          <>
            {/* Sucesso - mostrar link */}
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Link2 className="size-4 text-emerald-600" />
                </div>
                Convite Criado
              </DialogTitle>
              <DialogDescription>
                Envie o link abaixo para convidar o novo membro.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
              >
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="text-sm font-medium">{createdInvitation.email}</p>
                <p className="text-sm text-muted-foreground mt-2">Papel</p>
                <p className="text-sm font-medium">{ROLE_LABELS[createdInvitation.role] ?? createdInvitation.role}</p>
                <p className="text-sm text-muted-foreground mt-2">Expira em</p>
                <p className="text-sm font-medium">
                  {new Date(createdInvitation.expires_at).toLocaleDateString('pt-MZ', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </motion.div>

              <div className="space-y-2">
                <Label>Link do Convite</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/?invite=${createdInvitation.token}`}
                    className="text-xs font-mono"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <Button
                    variant={linkCopied ? 'default' : 'outline'}
                    size="icon"
                    className="shrink-0"
                    onClick={handleCopyLink}
                  >
                    {linkCopied ? (
                      <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    ) : (
                      <Link2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleClose(false)}
              >
                Concluir
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            {/* Formulário de criação */}
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Mail className="size-4 text-emerald-600" />
                </div>
                Novo Convite
              </DialogTitle>
              <DialogDescription>
                Envie um convite para adicionar um novo membro ao escritório.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="email@exemplo.co.mz"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {email && !EMAIL_REGEX.test(email.trim()) && (
                  <p className="text-xs text-red-500">Formato de email inválido.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Papel *</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar papel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                    <SelectItem value="ADVOGADO">Advogado</SelectItem>
                    <SelectItem value="SECRETARIO">Secretário(a)</SelectItem>
                    <SelectItem value="CLIENT">Cliente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-name">Nome Completo (opcional)</Label>
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

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} className="active:scale-[0.98]">
                Cancelar
              </Button>
              <Button
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98]"
                onClick={handleSubmit}
                disabled={!isValid || submitting}
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Criar Convite
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
