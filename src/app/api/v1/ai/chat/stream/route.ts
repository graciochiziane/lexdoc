// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Chat Streaming API (SSE)
// POST /api/v1/ai/chat/stream — Streaming de respostas do assistente
// Retorna text/event-stream com chunks em tempo real
// Integração com Silêncio Seguro (Governança V2.0 — Nível 4)
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { searchKnowledgeArticles } from '@/lib/rag-search';
import { buildLexAssistPromptWithRAG } from '@/lib/lexassist-prompt';
import { streamLLM, getProviderInfo } from '@/lib/llm';
import { evaluateSafeSilence, getCautelarPromptSuffix } from '@/lib/safe-silence';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// POST — Streaming chat
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Rate limiting ──
    const rateLimit = checkRateLimit(`ai:chat:${userId}`, 20, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Limite de 20 mensagens por hora atingido.' },
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Validar body ──
    const body = await request.json().catch(() => null);
    const { message, context, conversation_id } = body ?? {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A mensagem é obrigatória.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    if (message.length > 4000) {
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A mensagem não pode exceder 4000 caracteres.' },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // ── Construir mensagem do utilizador com contexto ──
    let userMessage = message.trim();
    if (context && typeof context === 'string' && context.trim().length > 0) {
      userMessage += `\n\n[Contexto adicional]: ${context.trim()}`;
    }

    // ── Gerir conversa ──
    let conversationId = conversation_id;
    let isNewConversation = false;

    if (conversationId) {
      const existing = await db.aIConversation.findFirst({
        where: { id: conversationId, user_id: userId, firm_id: firmId, is_active: true },
      });
      if (!existing) {
        return new Response(
          JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Conversa não encontrada.' } }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        );
      }
    } else {
      const title = message.trim().substring(0, 60) + (message.trim().length > 60 ? '...' : '');
      const conv = await db.aIConversation.create({
        data: { firm_id: firmId, user_id: userId, title, context_type: null, context_id: null },
      });
      conversationId = conv.id;
      isNewConversation = true;
    }

    // ── Guardar mensagem do utilizador ──
    await db.aIMessage.create({
      data: { firm_id: firmId, conversation_id: conversationId, role: 'user', content: userMessage },
    });

    // ── Carregar histórico (últimas 10) ──
    const historyMessages = await db.aIMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'asc' },
      take: 10,
      select: { role: true, content: true },
    });

    // ── RAG ──
    const knowledgeArticles = await searchKnowledgeArticles(firmId, message, 3);

    // ── ═══ SILÊNCIO SEGURO — Gate de Governança V2.0 ═══ ──
    const governance = evaluateSafeSilence(knowledgeArticles);

    // Preparar prompt do sistema (com possível sufixo cautelar)
    let systemPrompt = buildLexAssistPromptWithRAG(
      knowledgeArticles.map((a) => ({ title: a.title, content: a.content, source: a.source, category: a.category })),
    );

    // Se modo cautelar, injectar sufixo extra
    if (governance.nivel_governanca_accionado === 'CAUTELAR') {
      systemPrompt += getCautelarPromptSuffix();
    }

    // ── Montar mensagens para LLM ──
    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];
    for (const msg of historyMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        llmMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    const providerInfo = getProviderInfo();
    const sources = knowledgeArticles
      .filter((a) => a.source)
      .map((a) => a.source as string);
    if (sources.length === 0) {
      sources.push('Legislação moçambicana vigente', 'Código de Processo Civil de Moçambique');
    }

    // ── Criar stream SSE ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        // Enviar metadata inicial (conversation_id, sources, governance)
        const initEvent = JSON.stringify({
          type: 'init',
          conversation_id: conversationId,
          sources,
          is_new: isNewConversation,
          governance: {
            confidence_score: governance.confidence_score,
            nivel: governance.nivel_governanca_accionado,
            should_block: governance.should_block_llm,
          },
        });
        controller.enqueue(encoder.encode(`data: ${initEvent}\n\n`));

        try {
          // ═══ SILÊNCIO SEGURO: Bloquear LLM se score abaixo do threshold ═══
          if (governance.should_block_llm && governance.safe_response) {
            // Enviar resposta de silêncio seguro como um único chunk
            const safeContent = governance.safe_response;
            const chunkEvent = JSON.stringify({ type: 'chunk', content: safeContent });
            controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
            fullContent = safeContent;

            // Evento de conclusão
            const doneEvent = JSON.stringify({
              type: 'done',
              full_content: fullContent,
              knowledge_ids: knowledgeArticles.map((a) => a.id),
              governance: {
                confidence_score: governance.confidence_score,
                nivel: governance.nivel_governanca_accionado,
                blocked: true,
              },
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));

            // Guardar mensagem do assistente (silêncio seguro)
            void db.aIMessage.create({
              data: {
                firm_id: firmId,
                conversation_id: conversationId,
                role: 'assistant',
                content: fullContent,
                sources: JSON.stringify(sources),
                knowledge_ids: JSON.stringify(knowledgeArticles.map((a) => a.id)),
                metadata: JSON.stringify({
                  knowledge_count: knowledgeArticles.length,
                  has_history: historyMessages.length > 1,
                  safe_silence: true,
                  governance_audit: governance.audit_details,
                }),
                confidence_score: governance.confidence_score,
                nivel_governanca_accionado: governance.nivel_governanca_accionado,
              },
            });

            // Auditoria — Silêncio Seguro accionado
            logAudit({
              firm_id: firmId,
              user_id: userId,
              action: 'AI_CHAT_SAFE_SILENCE',
              entity_type: 'ai_assistant',
              entity_id: conversationId,
              metadata: {
                query_length: message.length,
                response_length: fullContent.length,
                knowledge_articles_used: knowledgeArticles.length,
                confidence_score: governance.confidence_score,
                nivel_governanca_accionado: governance.nivel_governanca_accionado,
                is_new_conversation: isNewConversation,
                trigger_reason: governance.audit_details.trigger_reason,
                has_mozambican_source: governance.has_mozambican_source,
                has_penalized_source: governance.has_penalized_source,
                raw_top_score: governance.raw_top_score,
                llm_provider: 'none',
                llm_model: 'none',
                blocked: true,
              },
            });
          } else {
            // ═══ Fluxo normal — LLM com score de confiança ═══
            for await (const chunk of streamLLM(llmMessages, { temperature: 0.7, maxTokens: 4096 })) {
              fullContent += chunk;
              const chunkEvent = JSON.stringify({ type: 'chunk', content: chunk });
              controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
            }

            // Evento de conclusão
            const doneEvent = JSON.stringify({
              type: 'done',
              full_content: fullContent,
              knowledge_ids: knowledgeArticles.map((a) => a.id),
              governance: {
                confidence_score: governance.confidence_score,
                nivel: governance.nivel_governanca_accionado,
                blocked: false,
              },
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));

            // Guardar mensagem completa do assistente (fire-and-forget)
            void db.aIMessage.create({
              data: {
                firm_id: firmId,
                conversation_id: conversationId,
                role: 'assistant',
                content: fullContent,
                sources: JSON.stringify(sources),
                knowledge_ids: JSON.stringify(knowledgeArticles.map((a) => a.id)),
                metadata: JSON.stringify({
                  knowledge_count: knowledgeArticles.length,
                  has_history: historyMessages.length > 1,
                  governance_audit: governance.audit_details,
                }),
                confidence_score: governance.confidence_score,
                nivel_governanca_accionado: governance.nivel_governanca_accionado,
              },
            });

            // Auditoria (fire-and-forget)
            logAudit({
              firm_id: firmId,
              user_id: userId,
              action: 'AI_CHAT_STREAM',
              entity_type: 'ai_assistant',
              entity_id: conversationId,
              metadata: {
                query_length: message.length,
                response_length: fullContent.length,
                knowledge_articles_used: knowledgeArticles.length,
                is_new_conversation: isNewConversation,
                llm_provider: providerInfo.provider,
                llm_model: providerInfo.model,
                streaming: true,
                confidence_score: governance.confidence_score,
                nivel_governanca_accionado: governance.nivel_governanca_accionado,
                has_mozambican_source: governance.has_mozambican_source,
                has_penalized_source: governance.has_penalized_source,
                blocked: false,
              },
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido';
          const errEvent = JSON.stringify({ type: 'error', message: errorMsg });
          controller.enqueue(encoder.encode(`data: ${errEvent}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[AI Chat Stream] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao processar mensagem.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}