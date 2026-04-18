// ═══════════════════════════════════════════════════════════════
// LEXDOC — Vista de Aceitação de Convite
// Formulário de registo pré-preenchido para convites
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Shield,
  Mail,
  User,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { invitationsApi, type ValidateInvitationData } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from 'sonner';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface AcceptInvitationViewProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

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

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function AcceptInvitationView({ token, onSuccess, onCancel }: AcceptInvitationViewProps) {
  const [validation, setValidation] = useState<ValidateInvitationData | null>(null);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ── Validar token ──
  const validateToken = useCallback(async () => {
    setValidating(true);
    try {
      const res = await invitationsApi.validate(token);
      if (res.success && res.data) {
        setValidation(res.data);
      } else {
        setError(res.error?.message ?? 'Convite inválido ou expirado.');
      }
    } catch {
      setError('Erro ao validar convite. Tente novamente.');
    } finally {
      setValidating(false);
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  // ── Submeter ──
  const handleSubmit = async () => {
    if (!fullName.trim() || !password || !confirmPassword) {
      toast.error('Todos os campos são obrigatórios.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('A palavra-passe e a confirmação não coincidem.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await invitationsApi.accept(token, {
        full_name: fullName.trim(),
        password,
        password_confirmation: confirmPassword,
      });

      if (res.success && res.data) {
        // Auto-login
        const { access_token, refresh_token, user } = res.data;
        useAuthStore.getState().setAuth(access_token, refresh_token, user);
        toast.success('Bem-vindo ao escritório!');
        onSuccess();
      } else {
        toast.error(res.error?.message ?? 'Erro ao aceitar convite.');
      }
    } catch {
      toast.error('Erro ao aceitar convite.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Estado de carregamento ──
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">A validar convite...</p>
        </motion.div>
      </div>
    );
  }

  // ── Erro de validação ──
  if (error || !validation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <AlertTriangle className="size-8 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Convite Inválido</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {error ?? 'Este convite não é válido ou já foi utilizado.'}
                </p>
              </div>
              <Button variant="outline" onClick={onCancel}>
                Voltar ao início
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const isValid = fullName.trim() && password && confirmPassword && password === confirmPassword;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        {/* Card de aceitação */}
        <Card className="overflow-hidden shadow-xl border-0">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 pt-6 pb-8 text-white">
            <div className="flex items-center gap-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl font-bold border border-white/20"
              >
                <Building2 className="size-7" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold truncate">{validation.firm_name}</h2>
                <p className="text-sm text-white/80">Convite para juntar-se ao escritório</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge
                    className={`text-[10px] border-0 ${ROLE_COLORS[validation.role] ?? ''}`}
                  >
                    {ROLE_LABELS[validation.role] ?? validation.role}
                  </Badge>
                  <span className="text-xs text-white/70 flex items-center gap-1">
                    <CheckCircle2 className="size-3" />
                    Convite válido
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Formulário */}
          <CardContent className="p-6 space-y-4">
            {/* Email (pré-preenchido, só leitura) */}
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">Email (convite)</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={validation.email}
                  readOnly
                  disabled
                  className="pl-9 bg-muted/50"
                />
              </div>
            </div>

            {/* Nome completo */}
            <div className="space-y-1.5">
              <Label htmlFor="accept-name">Nome Completo *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="accept-name"
                  placeholder="Seu nome completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Palavra-passe */}
            <div className="space-y-1.5">
              <Label htmlFor="accept-password">Palavra-passe *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="accept-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <PasswordStrengthIndicator password={password} />
            </div>

            {/* Confirmar palavra-passe */}
            <div className="space-y-1.5">
              <Label htmlFor="accept-confirm">Confirmar Palavra-passe *</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  id="accept-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Confirme a palavra-passe"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 pr-9"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-2"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? (
                    <EyeOff className="size-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="size-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">As palavras-passe não coincidem.</p>
              )}
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md active:scale-[0.98] transition-all"
              onClick={handleSubmit}
              disabled={!isValid || submitting}
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-4 mr-2" />
                  Aceitar Convite e Criar Conta
                </>
              )}
            </Button>

            {/* Voltar */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={onCancel}
            >
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
