// ═══════════════════════════════════════════════════════════════
// LEXDOC — LLM Adapter (Google Gemini)
// Provider: Gemini 2.0 Flash (estável, menos 503 que 2.5)
// Retry automático para erros transitórios (503, 429)
// ═══════════════════════════════════════════════════════════════

import { chatWithGemini, streamGemini, isGeminiAvailable, type GeminiMessage } from '@/lib/gemini';

// ─────────────────────────────────────────
// Modelo padrão
// ─────────────────────────────────────────
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: 'gemini';
  model: string;
  tokens_used?: {
    prompt: number;
    completion: number;
  };
}

// ─────────────────────────────────────────
// Retry helpers
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────
// Provider info
// ─────────────────────────────────────────

/** Modelo activo */
export function getActiveProvider(): 'gemini' {
  return 'gemini';
}

/** Info sobre o provider (para logging/health) */
export function getProviderInfo(): { provider: 'gemini'; model: string; available: boolean } {
  return {
    provider: 'gemini',
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
    available: isGeminiAvailable(),
  };
}

/** Mensagem de erro amigável baseada no erro do Gemini */
function friendlyError(errorMsg: string): string {
  if (errorMsg.includes('503') || errorMsg.includes('high demand')) {
    return 'O serviço de IA está temporariamente sobrecarregado. Por favor, tente novamente em alguns segundos.';
  }
  if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
    return 'Limite de uso da IA atingido. Aguarde um momento antes de tentar novamente.';
  }
  if (errorMsg.includes('API key')) {
    return 'Chave de API do Gemini inválida ou em falta.';
  }
  return 'Não foi possível obter resposta da IA. Tente novamente.';
}

// ─────────────────────────────────────────
// Chat
// ─────────────────────────────────────────

/**
 * Enviar mensagens para o Gemini.
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
  if (!isGeminiAvailable()) {
    throw new Error('GEMINI_API_KEY não configurada. Defina nas variáveis de ambiente.');
  }

  let lastError: string | null = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await chatWithGemini(messages as GeminiMessage[], options);
      return {
        content: response.content,
        provider: 'gemini',
        model: response.model,
        tokens_used: response.tokens_used,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      if (isTransientError(error) && attempt < maxRetries) {
        console.warn(`[LLM] Gemini erro transitório (${attempt}/${maxRetries}): ${lastError}`);
        await sleep(1000 * attempt);
        continue;
      }
    }
  }

  throw new Error(friendlyError(lastError ?? 'Erro desconhecido'));
}

// ─────────────────────────────────────────
// Streaming
// ─────────────────────────────────────────

/**
 * Stream de respostas do Gemini.
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
  if (!isGeminiAvailable()) {
    throw new Error('GEMINI_API_KEY não configurada. Defina nas variáveis de ambiente.');
  }

  let lastError: string | null = null;
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      yield* streamGemini(messages as GeminiMessage[], options);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);

      if (isTransientError(error) && attempt < maxRetries) {
        console.warn(`[LLM] Gemini erro transitório (${attempt}/${maxRetries}): ${lastError}`);
        await sleep(1000 * attempt);
        continue;
      }
    }
  }

  throw new Error(friendlyError(lastError ?? 'Erro desconhecido'));
}