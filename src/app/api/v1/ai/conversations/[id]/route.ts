// ═══════════════════════════════════════════════════════════════
// LEXDOC — Conversation Management API
// GET    /api/v1/ai/conversations/[id] — Carregar conversa completa
// POST   /api/v1/ai/conversations/[id] — Adicionar mensagem a conversa existente
// DELETE /api/v1/ai/conversations/[id] — Soft-delete (desactivar) conversa
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { searchKnowledgeArticles, type KnowledgeSearchResult } from '@/lib/rag-search';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// Prompt do sistema — LexAssistente
// ─────────────────────────────────────────
const SYSTEM_PROMPT = `És o LexAssistent, um assistente jurídico virtual especializado no direito moçambicano.

ÁREAS: Direito Civil, Penal, Trabalho, Comercial, Administrativo, Constitucional

REGRAS:
1. Responde SEMPRE em português de Moçambique (pt-MZ).
2. Baseia-te na legislação moçambicana vigente.
3. Cita artigos de lei e diplomas legais quando relevante.
4. Para cálculos de prazos, segue as regras do CPC moçambicano.
5. Quando sugerires minutas, usa linguagem jurídica formal adequada.
6. ADVERTÊNCIA: Respostas informativas, NÃO substituem aconselhamento profissional.
7. Se a pergunta estiver fora do escopo, redirecciona educadamente.
8. Formata com listas e parágrafos curtos.
9. Identifica-se como "LexAssistent, o seu assistente jurídico virtual".`;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

function buildSystemPromptWithRAG(knowledgeArticles: KnowledgeSearchResult[]): string {
  if (knowledgeArticles.length === 0) return SYSTEM_PROMPT;

  const contextSection = knowledgeArticles
    .map((article, index) => {
      const sourceLine = article.source ? `\nFonte: ${article.source}` : '';
      return `[Artigo ${index + 1}] ${article.title}\n${article.content.substring(0, 500)}${sourceLine}`;
    })
    .join('\n\n---\n\n');

  return `${SYSTEM_PROMPT}

CONTEXTO DA BASE DE CONHECIMENTO DA FIRMA:
Utiliza as informações abaixo como referência adicional. Se forem relevantes para a pergunta do utilizador, incorpora-as na tua resposta. Se não forem relevantes, ignora-as.

${contextSection}

INSTRUÇÕES ADICIONAIS:
- Quando utilizares informações da base de conhecimento, indica a fonte.
- Se a base de conhecimento contiver informações contraditórias, prioriza a legislação vigente.`;
}

function safeJsonStringify(data: unknown): string | null {
  if (!data) return null;
  try {
    return JSON.stringify(data);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// GET — Carregar conversa completa com todas as mensagens
// ─────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;
    const { id } = await params;

    // ── Buscar conversa ──
    const conversation = await db.aIConversation.findFirst({
      where: {
        id,
        user_id: userId,
        firm_id: firmId,
        is_active: true,
      },
      select: {
        id: true,
        title: true,
        context_type: true,
        context_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        messages: {
          orderBy: { created_at: 'asc' },
          select: {
            id: true,
            role: true,
            content: true,
            sources: true,
            knowledge_ids: true,
            created_at: true,
          },
        },
      },
    });

    if (!conversation) {
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

    // ── Formatar mensagens com sources parseados ──
    const formattedMessages = conversation.messages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      sources: msg.sources ? JSON.parse(msg.sources) : null,
      knowledge_ids: msg.knowledge_ids ? JSON.parse(msg.knowledge_ids) : null,
      created_at: msg.created_at,
    }));

    return NextResponse.json({
      success: true,
      data: {
        id: conversation.id,
        title: conversation.title,
        context_type: conversation.context_type,
        context_id: conversation.context_id,
        is_active: conversation.is_active,
        created_at: conversation.created_at,
        updated_at: conversation.updated_at,
        messages: formattedMessages,
        message_count: formattedMessages.length,
      },
    });
  } catch (error) {
    console.error('[AI Conversations] Erro ao carregar conversa:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao carregar conversa.',
        },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// POST — Adicionar mensagem a conversa existente
// ─────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;
    const { id } = await params;

    // ── Rate limiting ──
    const rateLimit = checkRateLimit(
      `ai:chat:${userId}`,
      20,
      60 * 60 * 1000,
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

    // ── Verificar se a conversa existe ──
    const conversation = await db.aIConversation.findFirst({
      where: {
        id,
        user_id: userId,
        firm_id: firmId,
        is_active: true,
      },
    });

    if (!conversation) {
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

    // ── Construir mensagem com contexto ──
    let userMessage = message.trim();
    if (context && typeof context === 'string' && context.trim().length > 0) {
      userMessage += `\n\n[Contexto adicional fornecido pelo utilizador]: ${context.trim()}`;
    }

    // ── Guardar mensagem do utilizador ──
    await db.aIMessage.create({
      data: {
        conversation_id: id,
        role: 'user',
        content: userMessage,
      },
    });

    // ── Carregar histórico (últimas 10 mensagens) ──
    const historyMessages = await db.aIMessage.findMany({
      where: { conversation_id: id },
      orderBy: { created_at: 'asc' },
      take: 10,
      select: { role: true, content: true },
    });

    // ── RAG: Pesquisar base de conhecimento ──
    const knowledgeArticles = await searchKnowledgeArticles(firmId, message, 3);

    // ── Construir prompt ──
    const systemPrompt = buildSystemPromptWithRAG(knowledgeArticles);

    const llmMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...historyMessages.map((msg) => ({ role: msg.role as 'user' | 'assistant', content: msg.content })),
    ];

    // ── Chamar LLM ──
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: llmMessages as any,
      thinking: { type: 'disabled' },
    });

    const aiMessageContent = completion?.choices?.[0]?.message?.content
      ?? 'Desculpe, não consegui processar a sua mensagem. Tente novamente.';

    // ── Guardar resposta ──
    const knowledgeIds = knowledgeArticles.map((a) => a.id);
    const sources = knowledgeArticles
      .filter((a) => a.source)
      .map((a) => a.source as string);

    if (sources.length === 0) {
      sources.push('Legislação moçambicana vigente', 'Código de Processo Civil de Moçambique');
    }

    await db.aIMessage.create({
      data: {
        conversation_id: id,
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

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_CHAT_QUERY',
      entity_type: 'ai_assistant',
      entity_id: id,
      metadata: {
        query_length: message.length,
        has_context: !!context,
        response_length: aiMessageContent.length,
        knowledge_articles_used: knowledgeArticles.length,
        is_new_conversation: false,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: aiMessageContent,
        sources,
        conversation_id: id,
        knowledge_articles_used: knowledgeArticles.map((a) => ({
          id: a.id,
          title: a.title,
          category: a.category,
          source: a.source,
        })),
      },
    });
  } catch (error) {
    console.error('[AI Conversations] Erro ao adicionar mensagem:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao processar a mensagem.',
        },
      },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────
// DELETE — Soft-delete (desactivar) conversa
// ─────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;
    const { id } = await params;

    // ── Verificar se a conversa existe e pertence ao utilizador ──
    const conversation = await db.aIConversation.findFirst({
      where: {
        id,
        user_id: userId,
        firm_id: firmId,
        is_active: true,
      },
    });

    if (!conversation) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Conversa não encontrada ou já desactivada.',
          },
        },
        { status: 404 },
      );
    }

    // ── Soft-delete: marcar como inactiva ──
    await db.aIConversation.update({
      where: { id },
      data: { is_active: false },
    });

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_CONVERSATION_DELETED',
      entity_type: 'ai_conversation',
      entity_id: id,
      metadata: {
        conversation_title: conversation.title,
        message_count: await db.aIMessage.count({ where: { conversation_id: id } }),
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    return NextResponse.json({
      success: true,
      data: {
        id,
        message: 'Conversa desactivada com sucesso.',
      },
    });
  } catch (error) {
    console.error('[AI Conversations] Erro ao desactivar conversa:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao desactivar conversa.',
        },
      },
      { status: 500 },
    );
  }
}
