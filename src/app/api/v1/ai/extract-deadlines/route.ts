// ═══════════════════════════════════════════════════════════════
// LEXDOC — AI Deadline Extraction API
// POST /api/v1/ai/extract-deadlines — Extrair prazos de texto legal
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/api-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { db } from '@/lib/db';
import { chatWithLLM, getProviderInfo } from '@/lib/llm';

process.env.TZ = 'Africa/Maputo';

// ─────────────────────────────────────────
// System prompt especializado para extração de prazos
// ─────────────────────────────────────────
const EXTRACTION_PROMPT = `És um assistente especializado em extrair prazos, datas e marcos temporais de textos jurídicos moçambicanos.

TAREFA: Analisa o texto jurídico fornecido e extrai TODOS os prazos, datas e marcos temporais mencionados.

TIPOS DE PRAZOS A IDENTIFICAR:
- Prazos processuais (dias, meses, anos)
- Datas específicas (audiências, julgamentos, entregas)
- Períodos de contestação, recurso, embargos
- Prazos de notificação e citação
- Prazos legais automáticos (decorrentes de lei)

REGRAS DO CPC MOÇAMBICANO PARA CÁLCULO:
- Excluir o dia do evento inicial (dia a quo non computatur in termino)
- Contar apenas dias úteis quando a lei determinar
- Prazo em dias = primeiro dia útil seguinte ao evento + (prazo - 1) dias úteis
- Prazo em meses = mesmo dia do mês seguinte (ou último dia útil se cair em fim-de-semana/feriado)

FORMATO DA RESPOSTA:
Responde EXCLUSIVAMENTE com um JSON válido (sem markdown, sem \`\`\`) com a seguinte estrutura:
{
  "deadlines": [
    {
      "title": "Título curto descritivo do prazo",
      "due_date": "2025-01-15",
      "description": "Descrição detalhada do prazo e sua base legal",
      "source_text": "Texto original do documento que menciona o prazo",
      "type": "processual|contratual|legal|notificacao",
      "priority": "high|medium|low"
    }
  ]
}

REGRAS:
1. Se não encontrar prazos, retorna {"deadlines": []}
2. Para prazos relativos (ex: "15 dias após a citação"), estima a data mais provável ou usa "PENDENTE" como due_date
3. Quando a data depender de eventos futuros, indica isso na descrição
4. Classifica a prioridade: "high" para prazos peremptórios, "medium" para prazos ordinários, "low" para informativos
5. Mantém o texto original na source_text para referência`;

// ─────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────

interface ExtractedDeadline {
  title: string;
  due_date: string;
  description: string;
  source_text: string;
  type: string;
  priority: string;
}

interface ExtractionResult {
  deadlines: ExtractedDeadline[];
}

function safeJsonParse(text: string): ExtractionResult {
  try {
    // Tentar parse directo
    return JSON.parse(text);
  } catch {
    // Tentar extrair JSON do texto (LLM pode incluir markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Última tentativa: remover quebras de linha problemáticas
        const cleaned = text.replace(/[\n\r\t]/g, ' ').trim();
        const match = cleaned.match(/\{.*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
      }
    }
    // Fallback: retornar array vazio
    return { deadlines: [] };
  }
}

// ─────────────────────────────────────────
// POST — Extrair prazos de texto legal
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // ── Autenticação ──
    const authResult = authenticateRequest(request);
    if (!authResult.success) return authResult.response;

    const { payload } = authResult;
    const userId = payload.sub;
    const firmId = payload.firm_id;

    // ── Rate limiting: 15 pedidos por hora por utilizador ──
    const rateLimit = checkRateLimit(
      `ai:extract:${userId}`,
      15,
      60 * 60 * 1000,
    );

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Limite de 15 extrações por hora atingido. Tente novamente mais tarde.',
          },
        },
        { status: 429 },
      );
    }

    // ── Validar body ──
    const body = await request.json().catch(() => null);
    const { text, process_id, auto_create } = body ?? {};

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O texto é obrigatório para extrair prazos.',
          },
        },
        { status: 400 },
      );
    }

    if (text.length > 20000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'O texto não pode exceder 20000 caracteres.',
          },
        },
        { status: 400 },
      );
    }

    // ── Verificar se o processo existe (se fornecido) ──
    if (process_id) {
      const process = await db.legalProcess.findFirst({
        where: {
          id: process_id,
          firm_id: firmId,
        },
      });

      if (!process) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Processo não encontrado.',
            },
          },
          { status: 404 },
        );
      }
    }

    // ── Chamar LLM via adapter unificado (Gemini ou ZAI) ──
    const providerInfo = getProviderInfo();
    const completion = await chatWithLLM([
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: `Analisa o seguinte texto jurídico e extrai todos os prazos:\n\n${text.trim()}` },
    ], {
      temperature: 0.3,
      maxTokens: 2048,
    });

    const rawResponse = completion.content ?? '{"deadlines":[]}';

    // ── Parsear resposta ──
    const extractionResult = safeJsonParse(rawResponse);
    const deadlines = Array.isArray(extractionResult.deadlines)
      ? extractionResult.deadlines
      : [];

    // ── Auto-criar prazos no processo (se solicitado) ──
    const createdDeadlines: Array<{ id: string; title: string; due_date: string }> = [];

    if (auto_create && process_id && deadlines.length > 0) {
      for (const deadline of deadlines) {
        // Apenas criar prazos com data válida (não PENDENTE)
        if (deadline.due_date && deadline.due_date !== 'PENDENTE') {
          try {
            const dueDate = new Date(deadline.due_date);
            // Verificar se a data é válida
            if (!isNaN(dueDate.getTime())) {
              const created = await db.deadline.create({
                data: {
                  process_id: process_id,
                  title: deadline.title || 'Prazo extraído pela IA',
                  description: deadline.description || null,
                  due_date: dueDate,
                  status: 'PENDING',
                  source: 'AI',
                  ai_extracted: true,
                },
              });
              createdDeadlines.push({
                id: created.id,
                title: created.title,
                due_date: created.due_date.toISOString().split('T')[0],
              });
            }
          } catch {
            // Ignorar erros de criação individual — prosseguir com os restantes
          }
        }
      }
    }

    // ── Auditoria ──
    logAudit({
      firm_id: firmId,
      user_id: userId,
      action: 'AI_DEADLINES_EXTRACTED',
      entity_type: 'deadline',
      entity_id: process_id || undefined,
      metadata: {
        text_length: text.length,
        deadlines_found: deadlines.length,
        deadlines_created: createdDeadlines.length,
        auto_create: !!auto_create,
      },
      ip_address: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null,
    });

    // ── Resposta ──
    return NextResponse.json({
      success: true,
      data: {
        deadlines: deadlines.map((d) => ({
          title: d.title,
          due_date: d.due_date,
          description: d.description,
          source_text: d.source_text,
          type: d.type,
          priority: d.priority,
        })),
        auto_created: createdDeadlines,
        summary: {
          total_found: deadlines.length,
          with_dates: deadlines.filter((d) => d.due_date && d.due_date !== 'PENDENTE').length,
          pending_dates: deadlines.filter((d) => d.due_date === 'PENDENTE').length,
          auto_created_count: createdDeadlines.length,
        },
      },
    });
  } catch (error) {
    console.error('[AI Extract Deadlines] Erro ao extrair prazos:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno ao extrair prazos. Tente novamente.',
        },
      },
      { status: 500 },
    );
  }
}
