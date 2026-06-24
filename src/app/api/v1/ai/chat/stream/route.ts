// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Chat Streaming API (SSE) v3.0
// POST /api/v1/ai/chat/stream — Streaming de respostas do assistente
// System Orchestrator v3.0 — RAG Hierárquico (OURO → PRATA → BRONZE)
// ═══════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { hierarchicalSearch, TIER_LABELS } from '@/lib/rag-hierarchical';
import { orchestratePrompt } from '@/lib/lexassist-orchestrator';
import { streamLLM, getProviderInfo } from '@/lib/llm';
import { isConversationalMessage, getConversationalPrompt } from '@/lib/query-rewriter';
// Internet RAG (BRONZE web) — PERMANENTEMENTE DESACTIVADO
// Nenhuma busca na internet é realizada. O sistema usa apenas:
//   OURO/PRATA/BRONZE (base de conhecimento local) → CONVERSACIONAL (Gate 0) → BRONZE-GERAL (LLM puro)

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// POST — Streaming chat (System Orchestrator v3.0)
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
    const { message, context, conversation_id, context_type, context_id } = body ?? {};

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
        data: { firm_id: firmId, user_id: userId, title, context_type: context_type ?? null, context_id: context_id ?? null },
      });
      conversationId = conv.id;
      isNewConversation = true;
    }

    // ── Guardar mensagem do utilizador ──
    await db.aIMessage.create({
      data: { firm_id: firmId, conversation_id: conversationId, role: 'user', content: userMessage },
    });

    // ── Carregar histórico (últimas 10) ──
    const historyRows = await db.aIMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { created_at: 'desc' },
      take: 10,
      select: { role: true, content: true },
    });
    const historyMessages = historyRows.reverse();

    // ════════════════════════════════════════════════════════════
    // GATE 0: Classificação de Intenção (ANTES do pipeline RAG)
    // Saudações, despedidas, agradecimentos → bypass completo
    // ════════════════════════════════════════════════════════════

    if (isConversationalMessage(message)) {
      const convMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: getConversationalPrompt() },
      ];
      for (const msg of historyMessages.slice(-4)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          convMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }
      convMessages.push({ role: 'user', content: message });

      const providerInfo = getProviderInfo();
      const encoder = new TextEncoder();

      const convStream = new ReadableStream({
        async start(controller) {
          let fullContent = '';
          const initEvent = JSON.stringify({
            type: 'init', conversation_id: conversationId, sources: [], is_new: isNewConversation,
            orchestrator: { version: '3.1', tier: 'CONVERSACIONAL', tier_label: 'Conversação', tier_emoji: '💬', confidence: 'ALTA', confidence_score: null, should_block: false, query_rewrite: { areas_detected: [], legal_terms_found: 0 }, search_audit: [] },
          });
          controller.enqueue(encoder.encode(`data: ${initEvent}\n\n`));
          try {
            for await (const chunk of streamLLM(convMessages, { temperature: 0.7, maxTokens: 300 })) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', full_content: fullContent, knowledge_ids: [], orchestrator: { tier: 'CONVERSACIONAL', confidence: 'ALTA', confidence_score: null, blocked: false } })}\n\n`));
            try {
              await db.aIMessage.create({ data: { firm_id: firmId, conversation_id: conversationId, role: 'assistant', content: fullContent, metadata: JSON.stringify({ orchestrator_version: '3.1', tier: 'CONVERSACIONAL', conversational_bypass: true }) } });
            } catch (dbErr) { console.error('[Gate 0] Erro DB:', dbErr); }
            logAudit({ firm_id: firmId, user_id: userId, action: 'AI_CHAT_STREAM', entity_type: 'ai_assistant', entity_id: conversationId, metadata: { query_length: message.length, response_length: fullContent.length, is_new_conversation: isNewConversation, llm_provider: providerInfo.provider, llm_model: providerInfo.model, streaming: true, orchestrator_version: '3.1', tier: 'CONVERSACIONAL', conversational_bypass: true, blocked: false } });
          } catch (error) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'Erro desconhecido' })}\n\n`));
          } finally { controller.close(); }
        },
      });
      return new Response(convStream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' } });
    }

    // ════════════════════════════════════════════════════════════
    // SYSTEM ORCHESTRATOR v3.1 — Pipeline Completo
    // ════════════════════════════════════════════════════════════

    // Passo 1: Query Rewriter + RAG Hierárquico (OURO → PRATA → BRONZE local)
    const searchResult = await hierarchicalSearch(firmId, message);

    // Passo 2: BRONZE-GERAL — Fallback LLM puro (SEM internet)
    // Quando NENHUMA camada na base de conhecimento, usa conhecimento geral do LLM.
    // O orquestrador BRONZE já inclui disclaimers automáticos.
    const isBronzeGeral = searchResult.activeTier === 'NENHUMA';
    if (isBronzeGeral) {
      searchResult.activeTier = 'BRONZE';
      searchResult.confidenceScore = 5;
    }

    // Passo 3: Orquestrar prompt baseado na camada activa (SEM webResults — internet desactivada)
    const orchestration = orchestratePrompt(
      searchResult.activeTier,
      searchResult.results.map(a => ({ title: a.title, content: a.content, source: a.source, category: a.category })),
      searchResult.confidenceScore,
    );

    // Fontes para o evento init
    const sources = searchResult.results
      .filter(a => a.source)
      .map(a => a.source as string);
    if (sources.length === 0) {
      sources.push('Legislação moçambicana vigente', 'Código de Processo Civil de Moçambique');
    }

    // Tier info para o evento init
    const tierInfo = TIER_LABELS[searchResult.activeTier];

    // ── Montar mensagens para LLM ──
    const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: orchestration.systemPrompt },
    ];
    for (const msg of historyMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        llmMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    const providerInfo = getProviderInfo();

    // ── Criar stream SSE ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullContent = '';

        // Enviar metadata inicial (v3.0 — com tier info)
        const initEvent = JSON.stringify({
          type: 'init',
          conversation_id: conversationId,
          sources,
          is_new: isNewConversation,
          orchestrator: {
            version: '3.0',
            tier: searchResult.activeTier,
            tier_label: tierInfo.label,
            tier_emoji: tierInfo.emoji,
            confidence: orchestration.confidence,
            confidence_score: orchestration.numericScore,
            should_block: orchestration.shouldBlock,
            query_rewrite: {
              areas_detected: searchResult.rewrittenQuery.detectedAreas,
              legal_terms_found: searchResult.rewrittenQuery.legalTerms.length,
            },
            search_audit: searchResult.allTiers,
          },
        });
        controller.enqueue(encoder.encode(`data: ${initEvent}\n\n`));

        try {
          // ═══ BLOQUEIO: Resposta de informação insuficiente ═══
          if (orchestration.shouldBlock && orchestration.blockResponse) {
            const blockContent = orchestration.blockResponse;
            const chunkEvent = JSON.stringify({ type: 'chunk', content: blockContent });
            controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
            fullContent = blockContent;

            const doneEvent = JSON.stringify({
              type: 'done',
              full_content: fullContent,
              knowledge_ids: searchResult.results.map(a => a.id),
              orchestrator: {
                tier: searchResult.activeTier,
                confidence: orchestration.confidence,
                confidence_score: orchestration.numericScore,
                blocked: true,
              },
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));

            // Guardar mensagem do assistente (bloqueio)
            try {
              await db.aIMessage.create({
                data: {
                  firm_id: firmId,
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullContent,
                  sources: JSON.stringify(sources),
                  knowledge_ids: JSON.stringify(searchResult.results.map(a => a.id)),
                  metadata: JSON.stringify({
                    orchestrator_version: '3.1',
                    tier: searchResult.activeTier,
                    confidence: orchestration.confidence,
                    search_tiers: searchResult.allTiers,
                    query_areas: searchResult.rewrittenQuery.detectedAreas,
                    web_used: false,
                    is_bronze_geral: isBronzeGeral,
                    safe_silence: false,
                  }),
                  confidence_score: orchestration.numericScore,
                  nivel_governanca_accionado: searchResult.activeTier,
                },
              });
            } catch (dbErr) {
              console.error('[AI Chat Stream v3] Erro ao guardar mensagem (bloqueio):', dbErr);
            }

            // Auditoria
            logAudit({
              firm_id: firmId,
              user_id: userId,
              action: 'AI_CHAT_BLOCKED',
              entity_type: 'ai_assistant',
              entity_id: conversationId,
              metadata: {
                query_length: message.length,
                response_length: fullContent.length,
                tier: searchResult.activeTier,
                confidence: orchestration.confidence,
                confidence_score: orchestration.numericScore,
                is_new_conversation: isNewConversation,
                search_tiers: searchResult.allTiers,
                detected_areas: searchResult.rewrittenQuery.detectedAreas,
                llm_provider: 'none',
                llm_model: 'none',
                blocked: true,
                orchestrator_version: '3.0',
              },
            });
          } else {
            // ═══ FLUXO NORMAL — LLM com prompt orquestrado ═══
            for await (const chunk of streamLLM(llmMessages, { temperature: 0.7, maxTokens: 4096 })) {
              fullContent += chunk;
              const chunkEvent = JSON.stringify({ type: 'chunk', content: chunk });
              controller.enqueue(encoder.encode(`data: ${chunkEvent}\n\n`));
            }

            const doneEvent = JSON.stringify({
              type: 'done',
              full_content: fullContent,
              knowledge_ids: searchResult.results.map(a => a.id),
              orchestrator: {
                tier: searchResult.activeTier,
                confidence: orchestration.confidence,
                confidence_score: orchestration.numericScore,
                blocked: false,
              },
            });
            controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));

            // Guardar mensagem completa do assistente
            try {
              await db.aIMessage.create({
                data: {
                  firm_id: firmId,
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: fullContent,
                  sources: JSON.stringify(sources),
                  knowledge_ids: JSON.stringify(searchResult.results.map(a => a.id)),
                  metadata: JSON.stringify({
                    orchestrator_version: '3.1',
                    tier: searchResult.activeTier,
                    confidence: orchestration.confidence,
                    search_tiers: searchResult.allTiers,
                    query_areas: searchResult.rewrittenQuery.detectedAreas,
                    query_legal_terms: searchResult.rewrittenQuery.legalTerms,
                    web_used: false,
                    is_bronze_geral: isBronzeGeral,
                    has_history: historyMessages.length > 1,
                  }),
                  confidence_score: orchestration.numericScore,
                  nivel_governanca_accionado: searchResult.activeTier,
                },
              });
            } catch (dbErr) {
              console.error('[AI Chat Stream v3] Erro ao guardar mensagem:', dbErr);
            }

            // Auditoria
            logAudit({
              firm_id: firmId,
              user_id: userId,
              action: 'AI_CHAT_STREAM',
              entity_type: 'ai_assistant',
              entity_id: conversationId,
              metadata: {
                query_length: message.length,
                response_length: fullContent.length,
                knowledge_articles_used: searchResult.results.length,
                is_new_conversation: isNewConversation,
                llm_provider: providerInfo.provider,
                llm_model: providerInfo.model,
                streaming: true,
                orchestrator_version: '3.1',
                tier: searchResult.activeTier,
                confidence: orchestration.confidence,
                confidence_score: orchestration.numericScore,
                search_tiers: searchResult.allTiers,
                detected_areas: searchResult.rewrittenQuery.detectedAreas,
                query_legal_terms_count: searchResult.rewrittenQuery.legalTerms.length,
                web_used: false,
                is_bronze_geral: isBronzeGeral,
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
    console.error('[AI Chat Stream v3] Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Erro interno ao processar mensagem.' },
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}