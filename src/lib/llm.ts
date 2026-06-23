// ═══════════════════════════════════════════════════════════════
// LEXDOC — LLM Adapter Unificado
// Provider principal: Google Gemini
// Fallback: ZAI (apenas no sandbox — precisa de .z-ai-config)
// Retry automático para erros transitórios do Gemini (503, 429)
// ═══════════════════════════════════════════════════════════════

import { chatWithGemini, streamGemini, isGeminiAvailable, type GeminiMessage } from '@/lib/gemini';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: 'gemini' | 'zai';
  model: string;
  tokens_used?: {
    prompt: number;
    completion: number;
  };
}

// ─────────────────────────────────────────
// ZAI availability check
// ─────────────────────────────────────────

/**
 * Verifica se o ZAI SDK pode funcionar neste ambiente.
 * O ZAI precisa de .z-ai-config no projecto, home, ou /etc.
 * No Vercel este ficheiro não existe, logo o ZAI não está disponível.
 */
function isZaiAvailable(): boolean {
  const paths = [
    join(process.cwd(), '.z-ai-config'),
    join(process.env.HOME || '/root', '.z-ai-config'),
    '/etc/.z-ai-config',
  ];
  return paths.some((p) => existsSync(p));
}

// ─────────────────────────────────────────
// Retry helper
// ─────────────────────────────────────────

/** Verifica se um erro é transitório e justifica retry */
function isTransientError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('high demand') ||
    msg.includes('quota') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('timeout') ||
    msg.includes('ECONNRESET')
  );
}

/** Sleep promisificado */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────
// Provider detection
// ─────────────────────────────────────────

/** Detectar qual provider usar baseado nas env vars */
export function getActiveProvider(): 'gemini' | 'zai' {
  return isGeminiAvailable() ? 'gemini' : 'zai';
}

/** Info sobre o provider activo (para logging/health) */
export function getProviderInfo(): { provider: 'gemini' | 'zai'; model: string; available: boolean; zai_fallback: boolean } {
  const geminiAvailable = isGeminiAvailable();
  const zaiAvailable = isZaiAvailable();
  return {
    provider: geminiAvailable ? 'gemini' : 'zai',
    model: geminiAvailable
      ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash')
      : 'z-ai-default',
    available: geminiAvailable || zaiAvailable,
    zai_fallback: zaiAvailable,
  };
}

// ─────────────────────────────────────────
// Chat unificado
// ─────────────────────────────────────────

/**
 * Enviar mensagens para o LLM (provider detectado automaticamente).
 * Formato OpenAI-compatible: role + content.
 */
export async function chatWithLLM(
  messages: LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<LLMResponse> {
  const provider = getActiveProvider();
  let geminiError: string | null = null;
  const maxRetries = 2;

  if (provider === 'gemini') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await chatWithGemini(
          messages as GeminiMessage[],
          options
        );
        return {
          content: response.content,
          provider: 'gemini',
          model: response.model,
          tokens_used: response.tokens_used,
        };
      } catch (error) {
        geminiError = error instanceof Error ? error.message : String(error);

        if (isTransientError(error) && attempt < maxRetries) {
          console.warn(`[LLM] Gemini erro transitório (tentativa ${attempt}/${maxRetries}): ${geminiError}`);
          await sleep(1000 * attempt); // backoff: 1s, 2s
          continue;
        }
        console.warn(`[LLM] Gemini falhou definitivamente. Erro: ${geminiError}`);
      }
    }
  }

  // ZAI fallback (apenas se disponível neste ambiente)
  if (isZaiAvailable()) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: messages as any,
        thinking: { type: 'disabled' },
      });

      const content = completion?.choices?.[0]?.message?.content
        ?? 'Erro: Não foi possível gerar resposta. Tente novamente.';

      return {
        content,
        provider: 'zai',
        model: 'z-ai-default',
        tokens_used: undefined,
      };
    } catch (zaiError) {
      const zaiErrMsg = zaiError instanceof Error ? zaiError.message : String(zaiError);
      const parts = ['Todos os providers LLM falharam:'];
      if (geminiError) parts.push(`  Gemini: ${geminiError}`);
      parts.push(`  ZAI: ${zaiErrMsg}`);
      throw new Error(parts.join('\n'));
    }
  }

  // Sem fallback disponível — mensagem amigável
  if (geminiError) {
    if (geminiError.includes('503') || geminiError.includes('high demand')) {
      throw new Error(
        'O serviço de IA está temporariamente sobrecarregado. Por favor, tente novamente em alguns segundos.'
      );
    }
    throw new Error(`Erro do Gemini: ${geminiError}`);
  }

  throw new Error('Nenhum provider de IA disponível. Configure GEMINI_API_KEY nas variáveis de ambiente.');
}

// ─────────────────────────────────────────
// Streaming unificado
// ─────────────────────────────────────────

/**
 * Stream de respostas do LLM (provider detectado automaticamente).
 * Retorna um async generator de chunks de texto.
 */
export async function* streamLLM(
  messages: LLMMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): AsyncGenerator<string> {
  const provider = getActiveProvider();
  let geminiError: string | null = null;
  const maxRetries = 2;

  if (provider === 'gemini') {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        yield* streamGemini(messages as GeminiMessage[], options);
        return; // Sucesso — sair
      } catch (error) {
        geminiError = error instanceof Error ? error.message : String(error);

        if (isTransientError(error) && attempt < maxRetries) {
          console.warn(`[LLM] Gemini erro transitório (tentativa ${attempt}/${maxRetries}): ${geminiError}`);
          await sleep(1000 * attempt);
          continue;
        }
        console.warn(`[LLM] Gemini falhou definitivamente. Erro: ${geminiError}`);
      }
    }
  }

  // ZAI fallback (apenas se disponível neste ambiente)
  if (isZaiAvailable()) {
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default;
      const zai = await ZAI.create();

      const completion = await zai.chat.completions.create({
        messages: messages as any,
        thinking: { type: 'disabled' },
      });

      const content = completion?.choices?.[0]?.message?.content
        ?? 'Erro: Não foi possível gerar resposta. Tente novamente.';
      yield content;
      return;
    } catch (zaiError) {
      const zaiErrMsg = zaiError instanceof Error ? zaiError.message : String(zaiError);
      const parts = ['Todos os providers LLM falharam:'];
      if (geminiError) parts.push(`  Gemini: ${geminiError}`);
      parts.push(`  ZAI: ${zaiErrMsg}`);
      throw new Error(parts.join('\n'));
    }
  }

  // Sem fallback disponível — mensagem amigável
  if (geminiError) {
    if (geminiError.includes('503') || geminiError.includes('high demand')) {
      throw new Error(
        'O serviço de IA está temporariamente sobrecarregado. Por favor, tente novamente em alguns segundos.'
      );
    }
    throw new Error(`Erro do Gemini: ${geminiError}`);
  }

  throw new Error('Nenhum provider de IA disponível. Configure GEMINI_API_KEY nas variáveis de ambiente.');
}