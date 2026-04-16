// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Chat API (LexAssistent)
// POST /api/v1/ai/chat — Enviar mensagem e receber resposta do assistente jurídico
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMIT_MESSAGE } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Prompt do sistema — LexAssistente
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `És o LexAssistent, um assistente jurídico virtual especializado no direito moçambicano. Forneces assistência jurídica informativa a advogados, secretários e profissionais jurídicos em Moçambique.

ÁREAS DE ESPECIALIZAÇÃO:
- Direito Civil (Código Civil Moçambicano, Lei de Família, Lei das Sucessões)
- Direito Criminal (Código Penal, Código de Processo Penal)
- Direito do Trabalho (Lei do Trabalho, Lei Geral do Trabalho)
- Direito Comercial (Código Comercial, Lei das Sociedades Comerciais)
- Direito Administrativo (Lei dos Contratos Administrativos)
- Legislação fiscal e tributária de Moçambique

REGRAS:
1. Responde SEMPRE em português de Moçambique (pt-MZ).
2. Baseia-te na legislação moçambicana vigente.
3. Cita artigos de lei e diplomas legais quando relevante.
4. Para cálculos de prazos, segue as regras do CPC moçambicano (contagem em dias úteis, exclusão do dia inicial).
5. Quando sugerires minutas, usa linguagem jurídica formal adequada.
6. ADVERTÊNCIA: As tuas respostas são informativas e NÃO substituem aconselhamento jurídico profissional.
7. Se a pergunta estiver fora do escopo jurídico, redirecciona educadamente o utilizador.
8. Formata as respostas de forma clara, usando listas e parágrafos curtos quando apropriado.
9. Quando relevante, menciona prazos processuais e medidas cautelares.
10. Identifica-se sempre como "LexAssistent, o seu assistente jurídico virtual".`;

// ─────────────────────────────────────────
// POST — Enviar mensagem ao chat
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Rate limiting: 20 pedidos por hora por utilizador ──
    const rateLimit = checkRateLimit(
      `ai:chat:${userId}`,
      20,
      60 * 60 * 1000, // 1 hora
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Limite de 20 mensagens por hora atingido. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // ── Validar body ──
    const body = await request.json().catch(() => null);
    const { message, context } = body ?? {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A mensagem é obrigatória e não pode estar vazia.',
          },
        },
        { status: 400 },
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'A mensagem não pode exceder 4000 caracteres.',
          },
        },
        { status: 400 },
      );
    }

    // ── Construir mensagem do utilizador com contexto ──
    let userMessage = message.trim();
    if (context && typeof context === 'string' && context.trim().length > 0) {
      userMessage += `\n\n[Contexto adicional fornecido pelo utilizador]: ${context.trim()}`;
    }

    // ── Chamar LLM via z-ai-web-dev-sdk ──
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      thinking: { type: 'disabled' },
    });

    const aiMessage = completion?.choices?.[0]?.message?.content ?? 'Desculpe, não consegui processar a sua mensagem. Tente novamente.';

    // ── Registar na auditoria (sem conteúdo da mensagem — sem PII) ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_CHAT_QUERY',
      entity_type: 'ai_assistant',
      metadata: {
        query_length: message.length,
        has_context: !!context,
        response_length: aiMessage.length,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: {
        message: aiMessage,
        sources: [
          'Legislação moçambicana vigente',
          'Código de Processo Civil de Moçambique',
          'Código Civil Moçambicano',
          'Lei do Trabalho (Lei nº 23/2007)',
        ],
      },
    });
  } catch (error) {
    console.error('[AI Chat] Erro ao processar mensagem:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao processar a sua mensagem. Tente novamente.',
        },
      },
      { status: 500 },
    );
  }
}
