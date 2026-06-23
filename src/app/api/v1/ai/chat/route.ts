// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Chat API (LexAssistent v1.0) com RAG + Memória
// POST /api/v1/ai/chat — Enviar mensagem e receber resposta do assistente jurídico
// GET  /api/v1/ai/chat — Listar conversas do utilizador
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { searchKnowledgeArticles } from '@/lib/rag-search';
import { buildLexAssistPromptWithRAG } from '@/lib/lexassist-prompt';
import { parsePagination, buildPaginationMeta, calcSkip } from '@/lib/pagination';
import { chatWithLLM, getProviderInfo } from '@/lib/llm';

process.env.TZ = 'Africa/Maputo';

/** Serializar array de IDs para JSON string */
function safeJsonStringify(data: unknown): string | null {
  if (!data) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// Governança V2.0 — Detecção de termos portugueses
// ─────────────────────────────────────────

/** Termos que indicam contaminação do sistema jurídico português/brasileiro */
const PORTUGUESE_CONTAMINATION_TERMS: Array<{ term: string; correct: string }> = [
  { term: /\bfreguesia\b/gi, correct: 'Localidade / Posto Administrativo' },
  { term: /\bconcelho\b/gi, correct: 'Distrito' },
  { term: /\bdiá rio da república\b(?!.*moçambique)/gi, correct: 'Boletim da República de Moçambique' },
  { term: /(?<!moçambique|mozambique)\s+diá rio da república/gi, correct: 'Boletim da República de Moçambique' },
  { term: /(?<!de moçambique|de mozambique)\bstj\b/gi, correct: 'Tribunal Supremo de Moçambique (STJ)' },
];

/** Detecta termos portugueses na resposta e retorna avisos */
function detectPortugueseContamination(text: string): Array<{ found: string; correct: string }> {
  const issues: Array<{ found: string; correct: string }> = [];
  for (const { term, correct } of PORTUGUESE_CONTAMINATION_TERMS) {
    const matches = text.match(term);
    if (matches) {
      for (const match of matches) {
        issues.push({ found: match, correct });
      }
    }
  }
  return issues;
}

/** Gera disclaimer de governança se detectar problemas na resposta */
function buildGovernanceDisclaimer(contamination: Array<{ found: string; correct: string }>): string {
  if (contamination.length === 0) return '';

  const corrections = contamination
    .map((c) => `"${c.found}" → "${c.correct}"`)
    .join('; ');

  return (
    '\n\n---\n' +
    '⚠️ **AVISO DE GOVERNANÇA V2.0 — Zero Confusão Lusófona**\n' +
    'A seguinte resposta conterá termos que podem indicar contaminação do sistema jurídico português. ' +
    'Correcções sugeridas: ' + corrections + '.\n' +
    '**Recomenda-se validação por advogado inscrito na OAM.**'
  );
}

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
    const { message, context, conversation_id, context_type, context_id } = body ?? {};

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

    // ── Gerir conversa existente ou criar nova ──
    let conversationId = conversation_id;
    let isNewConversation = false;

    if (conversationId) {
      // Verificar se a conversa existe e pertence ao utilizador
      const existingConversation = await db.aIConversation.findFirst({
        where: {
          id: conversationId,
          user_id: userId,
          firm_id: firmId,
          is_active: true,
        },
      });

      if (!existingConversation) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Conversa não encontrada ou inactiva.',
            },
          },
          { status: 404 },
        );
      }
    } else {
      // Criar nova conversa
      const title = message.trim().substring(0, 60) + (message.trim().length > 60 ? '...' : '');
      const newConversation = await db.aIConversation.create({
        data: {
          firm_id: firmId,
          user_id: userId,
          title,
          context_type: context_type || null,
          context_id: context_id || null,
        },
      });
      conversationId = newConversation.id;
      isNewConversation = true;
    }

    // ── Guardar mensagem do utilizador ──
    await db.aIMessage.create({
      data: {
        firm_id: firmId,
        conversation_id: conversationId,
        role: 'user',
        content: userMessage,
      },
    });

    // ── Carregar histórico de mensagens (últimas 10) ──
    const historyRows = await db.aIMessage.findMany({
      where: {
        conversation_id: conversationId,
      },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: {
        role: true,
        content: true,
      },
    });
    const historyMessages = historyRows.reverse();

    // ── RAG: Pesquisar base de conhecimento ──
    const knowledgeArticles = await searchKnowledgeArticles(firmId, message, 3);

    // ── Construir prompt de sistema com contexto RAG (LexAssistent v1.0) ──
    const systemPrompt = buildLexAssistPromptWithRAG(
      knowledgeArticles.map((a) => ({
        title: a.title,
        content: a.content,
        source: a.source,
        category: a.category,
      })),
    );

    // ── Montar array de mensagens para LLM ──
    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
    ];

    // Adicionar histórico (excepto a última mensagem do utilizador, que já temos)
    for (const msg of historyMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        llmMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    // ── Chamar LLM via adapter unificado (Gemini ou ZAI) ──
    const providerInfo = getProviderInfo();
    const completion = await chatWithLLM(llmMessages, {
      temperature: 0.7,
      maxTokens: 4096,
    });

    let aiMessageContent = completion.content || 'Desculpe, não consegui processar a sua mensagem. Tente novamente.';

    // ── Governança V2.0: Validação pós-LLM (Zero Confusão Lusófana) ──
    const contamination = detectPortugueseContamination(aiMessageContent);
    const governanceDisclaimer = buildGovernanceDisclaimer(contamination);

    // Se detectou contaminação, anexar disclaimer à resposta
    if (governanceDisclaimer) {
      aiMessageContent += governanceDisclaimer;
    }

    // ── Guardar resposta do assistente ──
    const knowledgeIds = knowledgeArticles.map((a) => a.id);
    const sources = knowledgeArticles
      .filter((a) => a.source)
      .map((a) => a.source as string);

    // Se não houver fontes dos artigos, adicionar fontes genéricas
    if (sources.length === 0) {
      sources.push(
        'Legislação moçambicana vigente',
        'Código de Processo Civil de Moçambique',
      );
    }

    await db.aIMessage.create({
      data: {
        firm_id: firmId,
        conversation_id: conversationId,
        role: 'assistant',
        content: aiMessageContent,
        sources: safeJsonStringify(sources),
        knowledge_ids: safeJsonStringify(knowledgeIds),
        metadata: safeJsonStringify({
          knowledge_count: knowledgeArticles.length,
          has_history: historyMessages.length > 1,
        }),
      },
    });

    // ── Registar na auditoria (sem conteúdo da mensagem — sem PII) ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_CHAT_QUERY',
      entity_type: 'ai_assistant',
      entity_id: conversationId,
      metadata: {
        query_length: message.length,
        has_context: !!context,
        response_length: aiMessageContent.length,
        knowledge_articles_used: knowledgeArticles.length,
        is_new_conversation: isNewConversation,
        llm_provider: providerInfo.provider,
        llm_model: providerInfo.model,
        governance_v2: true,
        lusophone_contamination_detected: contamination.length > 0,
        lusophone_terms_found: contamination.length > 0 ? contamination.map((c) => c.found) : undefined,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: {
        message: aiMessageContent,
        sources,
        conversation_id: conversationId,
        knowledge_articles_used: knowledgeArticles.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          source: a.source,
        })),
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

// ─────────────────────────────────────────
// GET — Listar conversas do utilizador
// ─────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Paginação ──
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const skip = calcSkip(page, limit);
    const activeOnly = searchParams.get('active') !== 'false';

    // ── Filtros ──
    const where: Record<string, unknown> = {
      user_id: userId,
      firm_id: firmId,
    };

    if (activeOnly) {
      where.is_active = true;
    }

    // ── Contar total ──
    const total = await db.aIConversation.count({ where });

    // ── Buscar conversas com última mensagem e contagem ──
    const conversations = await db.aIConversation.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        context_type: true,
        context_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          select: {
            content: true,
            created_at: true,
            role: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
    });

    // ── Formatar resposta ──
    const formatted = conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      context_type: conv.context_type,
      context_id: conv.context_id,
      is_active: conv.is_active,
      created_at: conv.created_at,
      updated_at: conv.updated_at,
      last_message: conv.messages[0]
        ? conv.messages[0].content.substring(0, 150) + (conv.messages[0].content.length > 150 ? '...' : '')
        : null,
      message_count: conv._count.messages,
    }));

    return NextResponse.json({
      success: true,
      data: formatted,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error) {
    console.error('[AI Chat] Erro ao listar conversas:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao listar conversas.',
        },
      },
      { status: 500 },
    );
  }
}
