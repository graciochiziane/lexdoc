// ═══════════════════════════════════════════════════════════════
// LEXDOC — Formulário de Registo
// Campos: nome, email, password, confirmação, escritório, papel
// ═══════════════════════════════════════════════════════════════

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';

// ─────────────────────────────────────────
// Schema de validação
// ─────────────────────────────────────────
const registerSchema = z
  .object({
    full_name: z
      .string()
      .min(3, 'Nome deve ter pelo menos 3 caracteres.')
      .max(100, 'Nome demasiado longo.'),
    email: z.string().email('Email inválido.'),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres.')
      .regex(/[A-Z]/, 'Deve conter uma letra maiúscula.')
      .regex(/[a-z]/, 'Deve conter uma letra minúscula.')
      .regex(/[0-9]/, 'Deve conter um número.')
      .regex(/[@$!%*?&]/, 'Deve conter um carácter especial (@$!%*?&).'),
    confirm_password: z.string().min(1, 'Confirmação obrigatória.'),
    firm_name: z
      .string()
      .min(2, 'Nome do escritório deve ter pelo menos 2 caracteres.')
      .max(100, 'Nome demasiado longo.'),
    role: z.string().min(1, 'Seleccione um papel.'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Palavras-passe não coincidem.',
    path: ['confirm_password'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

// ─────────────────────────────────────────
// Opções de papel
// ─────────────────────────────────────────
const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'ADVOGADO', label: 'Advogado' },
  { value: 'SECRETARIO', label: 'Secretário(a)' },
  { value: 'CLIENT', label: 'Cliente' },
];

// ─────────────────────────────────────────
// Componente
// ─────────────────────────────────────────
export function RegisterForm() {
  const { register, isRegistering, registerError } = useAuth();
  const navigate = useNavStore((s) => s.navigate);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
      firm_name: '',
      role: 'ADVOGADO',
    },
  });

  // Password actual para indicador de força
  const watchPassword = form.watch('password');

  // Determinar mensagem de erro
  const errorMessage = (() => {
    if (!registerError) return null;
    const err = registerError as unknown as {
      error?: { code?: string; message?: string; details?: string[] };
    };
    const message = err.error?.message;

    if (err.error?.code === 'TOO_MANY_REQUESTS') {
      return {
        title: 'Muitas tentativas',
        message: 'Demasiadas tentativas. Aguarde antes de tentar novamente.',
        variant: 'destructive' as const,
      };
    }

    return {
      title: 'Erro no registo',
      message: message ?? 'Erro ao criar conta. Tente novamente.',
      variant: 'destructive' as const,
    };
  })();

  function onSubmit(data: RegisterFormData) {
    register({
      full_name: data.full_name,
      email: data.email,
      password: data.password,
      firm_name: data.firm_name,
      role: data.role,
    });
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
          {/* Nome completo */}
          <FormField
            control={form.control}
            name="full_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome completo</FormLabel>
                <FormControl>
                  <Input
                    placeholder="João da Silva"
                    disabled={isRegistering}
                    autoComplete="name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Email */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="nome@exemplo.co.mz"
                    disabled={isRegistering}
                    autoComplete="email"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Palavra-passe */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Palavra-passe</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      disabled={isRegistering}
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
                {/* Indicador de força */}
                <PasswordStrengthIndicator password={watchPassword} />
              </FormItem>
            )}
          />

          {/* Confirmar palavra-passe */}
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
                      disabled={isRegistering}
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

          {/* Nome do escritório */}
          <FormField
            control={form.control}
            name="firm_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do escritório</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Silva & Associados, Lda"
                    disabled={isRegistering}
                    autoComplete="organization"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Papel */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Papel</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={isRegistering}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione o papel" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Botão de registo */}
          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isRegistering}
          >
            {isRegistering ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                A criar conta...
              </>
            ) : (
              'Criar conta'
            )}
          </Button>
        </form>
      </Form>

      {/* Link para login */}
      <div className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <button
          type="button"
          className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-medium transition-colors"
          onClick={() => navigate('login')}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
