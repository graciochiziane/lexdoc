// ═══════════════════════════════════════════════════════════════
// LEXDOC — Formulário de Redefinição de Palavra-passe
// Formulário para definir nova password após reset
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNavStore } from '@/stores/nav.store';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

// ─────────────────────────────────────────
// Schema de validação
// ─────────────────────────────────────────
const resetPasswordSchema = z
  .object({
    new_password: z
      .string()
      .min(8, 'Mínimo 8 caracteres.')
      .regex(/[A-Z]/, 'Deve conter uma letra maiúscula.')
      .regex(/[a-z]/, 'Deve conter uma letra minúscula.')
      .regex(/[0-9]/, 'Deve conter um número.')
      .regex(/[@$!%*?&\-_]/, 'Deve conter um carácter especial (@$!%*?&).'),
    confirm_password: z.string().min(1, 'Confirmação obrigatória.'),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'As palavras-passe não coincidem.',
    path: ['confirm_password'],
  });

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
interface ResetPasswordFormProps {
  token: string;
  onSuccess: () => void;
}

export function ResetPasswordForm({ token, onSuccess }: ResetPasswordFormProps) {
  const navigate = useNavStore((s) => s.navigate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      new_password: '',
      confirm_password: '',
    },
  });

  const watchPassword = form.watch('new_password');

  async function onSubmit(data: ResetPasswordFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          new_password: data.new_password,
          confirm_password: data.confirm_password,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setIsSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        const code = result.error?.code;
        const message = result.error?.message;
        if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED') {
          setError('Token inválido ou expirado. Solicite uma nova redefinição.');
        } else if (code === 'WEAK_PASSWORD') {
          setError(message ?? 'Palavra-passe demasiado fraca.');
        } else {
          setError(message ?? 'Ocorreu um erro. Tente novamente.');
        }
      }
    } catch {
      setError('Erro de ligação ao servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // ── Estado de sucesso ──
  if (isSuccess) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <CheckCircle className="size-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Palavra-passe redefinida!
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5">
              A sua palavra-passe foi actualizada com sucesso.
              Pode agora iniciar sessão com a nova palavra-passe.
            </p>
          </div>
        </div>

        <Button
          className="w-full"
          size="lg"
          onClick={() => navigate('login')}
        >
          Ir para o login
        </Button>
      </div>
    );
  }

  // ── Formulário ──
  return (
    <div className="space-y-6">
      {/* Alerta de erro */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium">Erro</p>
            <p className="text-sm mt-1">{error}</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="text-center space-y-1">
        <h3 className="text-base font-semibold text-foreground">
          Redefinir palavra-passe
        </h3>
        <p className="text-sm text-muted-foreground">
          Introduza a sua nova palavra-passe.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="new_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova palavra-passe</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <FormMessage />
                <PasswordStrengthIndicator password={watchPassword} />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar palavra-passe</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      disabled={isSubmitting}
                      autoComplete="new-password"
                      className="pr-10"
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                A redefinir...
              </>
            ) : (
              'Redefinir palavra-passe'
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          onClick={() => navigate('login')}
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
