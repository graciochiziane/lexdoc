// ═══════════════════════════════════════════════════
// LEXDOC — Importação de Clientes via CSV
// POST /api/v1/import/clients — Import CSV file
// ═══════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { authenticateRequest } from '@/lib/api-auth';
import { hasRole } from '@/lib/rbac';
import { logAudit } from '@/lib/audit';

process.env.TZ = 'Africa/Maputo';

const VALID_TYPES = ['INDIVIDUAL', 'EMPRESA', 'GOVERNO', 'ONG', 'OUTRO'];

interface ParsedClient {
  full_name: string;
  email?: string;
  phone?: string;
  nif?: string;
  address?: string;
  type: string;
  notes?: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === ',' && !inQuotes) {
      result.push(current); current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseCSV(csvText: string): { clients: ParsedClient[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { clients: [], errors: ['Ficheiro CSV vazio ou sem dados.'] };

  const errors: string[] = [];
  const clients: ParsedClient[] = [];
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));

  const nameIdx = header.findIndex((h) => ['full_name', 'nome', 'name'].includes(h));
  const emailIdx = header.findIndex((h) => ['email', 'e-mail'].includes(h));
  const phoneIdx = header.findIndex((h) => ['phone', 'telefone', 'tel'].includes(h));
  const nifIdx = header.findIndex((h) => ['nif', 'número_contribuinte', 'num_contribuinte'].includes(h));
  const addressIdx = header.findIndex((h) => ['address', 'endereço', 'endereco', 'morada'].includes(h));
  const typeIdx = header.findIndex((h) => ['type', 'tipo'].includes(h));
  const notesIdx = header.findIndex((h) => ['notes', 'notas', 'observações', 'obs'].includes(h));

  if (nameIdx === -1) {
    return { clients: [], errors: ['Coluna "full_name" (ou "nome") não encontrada no cabeçalho. Colunas: full_name, email, phone, nif, address, type, notes'] };
  }

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 2) continue;
    const name = (values[nameIdx] ?? '').trim().replace(/"/g, '');
    if (!name) { errors.push(`Linha ${i + 1}: Nome vazio, ignorado.`); continue; }

    let clientType = typeIdx !== -1 ? (values[typeIdx] ?? 'INDIVIDUAL').trim().replace(/"/g, '').toUpperCase() : 'INDIVIDUAL';
    if (!VALID_TYPES.includes(clientType)) {
      errors.push(`Linha ${i + 1}: Tipo "${clientType}" inválido. Usando INDIVIDUAL.`);
      clientType = 'INDIVIDUAL';
    }

    clients.push({
      full_name: name,
      email: emailIdx !== -1 ? (values[emailIdx] ?? '').trim().replace(/"/g, '') || undefined : undefined,
      phone: phoneIdx !== -1 ? (values[phoneIdx] ?? '').trim().replace(/"/g, '') || undefined : undefined,
      nif: nifIdx !== -1 ? (values[nifIdx] ?? '').trim().replace(/"/g, '') || undefined : undefined,
      address: addressIdx !== -1 ? (values[addressIdx] ?? '').trim().replace(/"/g, '') || undefined : undefined,
      type: clientType,
      notes: notesIdx !== -1 ? (values[notesIdx] ?? '').trim().replace(/"/g, '') || undefined : undefined,
    });
  }
  return { clients, errors };
}

// ─────────────────────────────────────────
// POST — Importar clientes via CSV
// ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const authResult = authenticateRequest(request);
  if (!authResult.success) return authResult.response;
  const { payload, req } = authResult;

  if (!hasRole(payload.role, ['ADMIN', 'ADVOGADO'])) {
    return NextResponse.json({ success: false, error: { code: 'FORBIDDEN', message: 'Sem permissão.' } }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nenhum ficheiro enviado.' } }, { status: 400 });
    }
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Apenas ficheiros CSV são aceites.' } }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Ficheiro muito grande. Máximo 5MB.' } }, { status: 400 });
    }

    const csvText = await file.text();
    const { clients, errors: parseErrors } = parseCSV(csvText);

    if (clients.length === 0) {
      return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Nenhum cliente válido encontrado.', details: parseErrors } }, { status: 400 });
    }

    let created = 0;
    let duplicates = 0;
    const importErrors: string[] = [];

    for (const client of clients) {
      try {
        const existing = await db.client.findFirst({
          where: {
            firm_id: payload.firm_id,
            OR: [
              ...(client.email ? [{ email: client.email }] : []),
              ...(client.phone ? [{ phone: client.phone }] : []),
            ],
          },
        });
        if (existing) { duplicates++; continue; }

        await db.client.create({
          data: {
            firm_id: payload.firm_id,
            full_name: client.full_name,
            email: client.email || null,
            phone: client.phone || null,
            nif: client.nif || null,
            address: client.address || null,
            type: client.type,
            notes: client.notes || null,
            created_by_id: payload.sub,
          },
        });
        created++;
      } catch (err) {
        importErrors.push(`"${client.full_name}": ${(err as Error).message}`);
      }
    }

    logAudit({
      firm_id: payload.firm_id,
      user_id: payload.sub,
      action: 'CLIENTS_IMPORTED',
      entity_type: 'Client',
      entity_id: 'batch',
      new_values: { total: clients.length, created, duplicates, errors: importErrors.length },
      ip_address: req.headers.get('x-forwarded-for') ?? undefined,
      user_agent: req.headers.get('user-agent') ?? undefined,
    });

    return NextResponse.json({
      success: true,
      data: { total: clients.length, created, duplicates, errors: importErrors.length, parse_warnings: parseErrors, import_errors: importErrors },
    });
  } catch (error) {
    console.error('[IMPORT CLIENTS] Erro:', error);
    return NextResponse.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } }, { status: 500 });
  }
}
