// ═══════════════════════════════════════════════════════════════
// LEXDOC — LLM Adapter Unificado
// Permite alternar entre Google Gemini e ZAI (z-ai-web-dev-sdk)
// Provider selection: GEMINI_API_KEY presente → usa Gemini, senão ZAI
// ═══════════════════════════════════════════════════════════════

import { chatWithGemini, isGeminiAvailable, type GeminiMessage } from '@/lib/gemini';

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
// Provider detection
// ─────────────────────────────────────────

/** Detectar qual provider usar baseado nas env vars */
export function getActiveProvider(): 'gemini' | 'zai' {
  return isGeminiAvailable() ? 'gemini' : 'zai';
}

/** Info sobre o provider activo (para logging/health) */
export function getProviderInfo(): { provider: 'gemini' | 'zai'; model: string; available: boolean } {
  const geminiAvailable = isGeminiAvailable();
  return {
    provider: geminiAvailable ? 'gemini' : 'zai',
    model: geminiAvailable
      ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-05-20')
      : 'z-ai-default',
    available: true, // ZAI está sempre disponível no sandbox
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

  if (provider === 'gemini') {
    // Usar Google Gemini
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
  } else {
    // Fallback: usar z-ai-web-dev-sdk
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
      tokens_used: undefined, // ZAI não retorna token count
    };
  }
}
