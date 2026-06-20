// ═══════════════════════════════════════════════════════════════
// LEXDOC — Google Gemini Integration Service
// Usa @google/generative-ai SDK com Gemini 2.0 Flash
// ═══════════════════════════════════════════════════════════════

import { GoogleGenerativeAI, type Content, type Part } from '@google/generative-ai';

// ─────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_MAX_TOKENS = parseInt(process.env.GEMINI_MAX_TOKENS || '8192', 10);

// Singleton do cliente
let geminiClient: GoogleGenerativeAI | null = null;

/** Verificar se o Gemini está configurado */
export function isGeminiAvailable(): boolean {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.length > 10;
}

/** Obter ou criar instância do Google Generative AI */
function getGeminiClient(): GoogleGenerativeAI {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
    throw new Error(
      'GEMINI_API_KEY não definida ou inválida. Defina no .env com uma chave válida do Google AI Studio.'
    );
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  return geminiClient;
}

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
export interface GeminiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GeminiResponse {
  content: string;
  model: string;
  tokens_used?: {
    prompt: number;
    completion: number;
  };
}

// ─────────────────────────────────────────
// Conversão de formatos
// ─────────────────────────────────────────

/**
 * Converte mensagens no formato OpenAI (role + content) para o formato Gemini.
 * O Gemini não suporta role "system" directamente — converte para instrução inline.
 */
function convertMessagesToGemini(messages: GeminiMessage[]): {
  systemInstruction: string;
  history: Content[];
  lastUserMessage: string;
} {
  let systemInstruction = '';
  const history: Content[] = [];
  let lastUserMessage = '';

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Gemini: system instruction é separada
      systemInstruction += (systemInstruction ? '\n\n' : '') + msg.content;
    } else {
      // Gemini usa 'user' e 'model' (não 'assistant')
      const role = msg.role === 'assistant' ? 'model' : 'user';
      history.push({
        role: role as 'user' | 'model',
        parts: [{ text: msg.content }],
      });

      if (msg.role === 'user') {
        lastUserMessage = msg.content;
      }
    }
  }

  return { systemInstruction, history, lastUserMessage };
}

// ─────────────────────────────────────────
// Funções principais
// ─────────────────────────────────────────

/**
 * Enviar mensagens para o Gemini e obter resposta.
 * Aceita formato OpenAI-compatible (system/user/assistant).
 */
export async function chatWithGemini(
  messages: GeminiMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }
): Promise<GeminiResponse> {
  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: undefined, // será definido abaixo
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? GEMINI_MAX_TOKENS,
      temperature: options?.temperature ?? 0.7,
      topP: options?.topP ?? 0.95,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT' as const,
        threshold: 'BLOCK_NONE' as const,
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH' as const,
        threshold: 'BLOCK_NONE' as const,
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const,
        threshold: 'BLOCK_NONE' as const,
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const,
        threshold: 'BLOCK_NONE' as const,
      },
    ],
  });

  // Converter mensagens
  const { systemInstruction, history, lastUserMessage } = convertMessagesToGemini(messages);

  // Se há system instruction, recriar o model com ela
  let genModel = model;
  if (systemInstruction) {
    genModel = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? GEMINI_MAX_TOKENS,
        temperature: options?.temperature ?? 0.7,
        topP: options?.topP ?? 0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT' as const, threshold: 'BLOCK_NONE' as const },
        { category: 'HARM_CATEGORY_HATE_SPEECH' as const, threshold: 'BLOCK_NONE' as const },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as const, threshold: 'BLOCK_NONE' as const },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as const, threshold: 'BLOCK_NONE' as const },
      ],
    });
  }

  // Chat com histórico (para conversas multi-turn)
  const chat = genModel.startChat({ history });

  // Enviar última mensagem do utilizador
  const result = await chat.sendMessage(lastUserMessage);
  const response = result.response;

  // Extrair tokens usados (se disponível)
  const usageMetadata = (response as any).usageMetadata;

  return {
    content: response.text(),
    model: GEMINI_MODEL,
    tokens_used: usageMetadata
      ? {
          prompt: usageMetadata.promptTokenCount ?? 0,
          completion: usageMetadata.candidatesTokenCount ?? 0,
        }
      : undefined,
  };
}

/**
 * Stream de resposta do Gemini (para uso futuro com SSE).
 * Retorna um async generator de chunks de texto.
 */
export async function* streamGemini(
  messages: GeminiMessage[],
  options?: {
    temperature?: number;
    maxTokens?: number;
  }
): AsyncGenerator<string> {
  const client = getGeminiClient();
  const { systemInstruction, history, lastUserMessage } = convertMessagesToGemini(messages);

  const genModel = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemInstruction || undefined,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? GEMINI_MAX_TOKENS,
      temperature: options?.temperature ?? 0.7,
    },
  });

  const chat = genModel.startChat({ history });
  const result = await chat.sendMessageStream(lastUserMessage);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

/**
 * Testar ligação ao Gemini — útil para health check.
 */
export async function testGeminiConnection(): Promise<{
  ok: boolean;
  model: string;
  response_time_ms: number;
  error?: string;
}> {
  if (!isGeminiAvailable()) {
    return { ok: false, model: GEMINI_MODEL, response_time_ms: 0, error: 'GEMINI_API_KEY not configured' };
  }

  try {
    const start = Date.now();
    const response = await chatWithGemini([
      { role: 'user', content: 'Responde com uma palavra: OK' },
    ], { maxTokens: 10 });
    const elapsed = Date.now() - start;

    return {
      ok: response.content.length > 0,
      model: GEMINI_MODEL,
      response_time_ms: elapsed,
    };
  } catch (error) {
    return {
      ok: false,
      model: GEMINI_MODEL,
      response_time_ms: Date.now() - Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
