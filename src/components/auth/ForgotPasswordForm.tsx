// ═══════════════════════════════════════════════════════════════
// LEXDOC — Formulário de Recuperação de Palavra-passe
// Formulário de email + estado de sucesso
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
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

// ─────────────────────────────────────────
// Schema de validação
// ─────────────────────────────────────────
const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido.'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function ForgotPasswordForm({ onBack }: { onBack?: () => void }) {
  const navigate = useNavStore((s) => s.navigate);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  async function onSubmit(data: ForgotPasswordFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.email }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmittedEmail(data.email);
        setIsSuccess(true);
      } else {
        const code = result.error?.code;
        if (code === 'TOO_MANY_REQUESTS') {
          setError('Demasiadas tentativas. Tente novamente mais tarde.');
        } else {
          setError('Ocorreu um erro. Tente novamente.');
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
              Email enviado!
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
              Se existir uma conta associada a{' '}
              <span className="font-medium text-foreground">{submittedEmail}</span>,
              receberá instruções para redefinir a sua palavra-passe.
            </p>
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 border p-3">
          <p className="text-xs text-muted-foreground text-center">
            Verifique a sua caixa de entrada e a pasta de spam. O link é válido por 1 hora.
          </p>
        </div>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => onBack?.() ?? navigate('login')}
        >
          <ArrowLeft className="size-4 mr-2" />
          Voltar ao login
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
        <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto">
          <Mail className="size-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Recuperar palavra-passe
        </h3>
        <p className="text-sm text-muted-foreground">
          Introduza o seu email e enviaremos instruções para redefinir a palavra-passe.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="nome@exemplo.co.mz"
                    disabled={isSubmitting}
                    {...field}
                  />
                </FormControl>
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
                A enviar...
              </>
            ) : (
              'Enviar instruções'
            )}
          </Button>
        </form>
      </Form>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
          onClick={() => onBack?.() ?? navigate('login')}
        >
          <ArrowLeft className="size-3.5" />
          Voltar ao login
        </button>
      </div>
    </div>
  );
}
