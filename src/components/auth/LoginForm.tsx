// ═══════════════════════════════════════════════════════════════
// LEXDOC — Formulário de Login
// Validação com react-hook-form + zod, toggle de password, erros
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { useNavStore } from '@/stores/nav.store';

// ─────────────────────────────────────────
// Schema de validação
// ─────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Email inválido.'),
  password: z.string().min(1, 'Palavra-passe obrigatória.'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function LoginForm() {
  const { login, isLoggingIn, loginError } = useAuth();
  const navigate = useNavStore((s) => s.navigate);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Determinar mensagem de erro
  const errorMessage = (() => {
    if (!loginError) return null;
    const err = loginError as unknown as {
      error?: { code?: string; message?: string };
    };
    const code = err.error?.code;

    if (code === 'ACCOUNT_LOCKED') {
      return {
        title: 'Conta bloqueada',
        message: 'Conta temporariamente bloqueada por segurança. Tente novamente em 15 minutos.',
        variant: 'destructive' as const,
      };
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return {
        title: 'Muitas tentativas',
        message: 'Demasiadas tentativas. Aguarde antes de tentar novamente.',
        variant: 'destructive' as const,
      };
    }
    return {
      title: 'Erro de autenticação',
      message: 'Email ou palavra-passe incorrectos.',
      variant: 'destructive' as const,
    };
  })();

  function onSubmit(data: LoginFormData) {
    login(data);
  }

  return (
    <div className="space-y-6">
      {/* Alerta de erro */}
      {errorMessage && (
        <Alert variant={errorMessage.variant}>
          <AlertDescription>
            <p className="font-medium">{errorMessage.title}</p>
            <p className="text-sm mt-1">{errorMessage.message}</p>
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Campo de email */}
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
                    disabled={isLoggingIn}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Campo de palavra-passe */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Palavra-passe</FormLabel>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => navigate('forgot-password')}
                  >
                    Esqueceu a palavra-passe?
                  </button>
                </div>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      disabled={isLoggingIn}
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
              </FormItem>
            )}
          />

          {/* Botão de login */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                A entrar...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </Form>

      {/* Link para registo */}
      <div className="text-center text-sm text-muted-foreground">
        Não tem uma conta?{' '}
        <button
          type="button"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
          onClick={() => navigate('register')}
        >
          Criar conta
        </button>
      </div>
    </div>
  );
}
