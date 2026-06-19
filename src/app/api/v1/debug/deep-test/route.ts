// ═══════════════════════════════════════════════════════════════
// LEXDOC — Deep Diagnostic Endpoint
// GET /api/v1/debug/deep-test
// Tests raw SQL vs Prisma to identify the exact failure point
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';

export async function GET() {
  const steps: Array<{ step: string; ok: boolean; detail?: string; error?: string }> = [];
  const testUuid = randomUUID();

  // Step 0: Show the UUID we'll use
  steps.push({ step: `0. Generated UUID: ${testUuid}`, ok: true });

  // Step 1: Raw SQL - check column types of firms table
  try {
    const columns = await db.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'firms' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    steps.push({
      step: '1. firms column definitions',
      ok: true,
      detail: JSON.stringify(columns),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '1. firms column definitions', ok: false, error: msg });
  }

  // Step 2: Raw SQL - insert with explicit UUID
  try {
    const slug = `raw-test-${Date.now()}`;
    await db.$queryRaw`
      INSERT INTO firms (id, name, slug, is_active, plan, settings, created_at, updated_at)
      VALUES (${testUuid}::uuid, 'Raw SQL Test', ${slug}, true, 'STARTER', '{}', now(), now())
    `;
    steps.push({ step: '2. Raw SQL INSERT firms', ok: true, detail: `id=${testUuid}` });
    // Clean up
    await db.$queryRaw`DELETE FROM firms WHERE id = ${testUuid}::uuid`;
    steps.push({ step: '2b. Raw SQL DELETE firms', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '2. Raw SQL INSERT firms', ok: false, error: msg });
  }

  // Step 3: Prisma create firm with explicit UUID
  try {
    const firmId = randomUUID();
    const slug = `prisma-test-${Date.now()}`;
    const firm = await db.firm.create({
      data: {
        id: firmId,
        name: 'Prisma Test Firm',
        slug,
      },
    });
    steps.push({ step: '3. Prisma firm.create (explicit UUID)', ok: true, detail: `id=${firm.id}` });
    await db.$queryRaw`DELETE FROM firms WHERE id = ${firmId}::uuid`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '3. Prisma firm.create (explicit UUID)', ok: false, error: msg });
  }

  // Step 4: Prisma create firm WITHOUT explicit UUID (rely on default)
  try {
    const slug = `default-test-${Date.now()}`;
    const firm = await db.firm.create({
      data: {
        name: 'Default UUID Test',
        slug,
      },
    });
    steps.push({ step: '4. Prisma firm.create (default UUID)', ok: true, detail: `id=${firm.id}` });
    try { await db.$queryRaw`DELETE FROM firms WHERE id = ${firm.id}::uuid`; } catch { /* ignore */ }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '4. Prisma firm.create (default UUID)', ok: false, error: msg });
  }

  const allOk = steps.every((s) => s.ok);
  return NextResponse.json(
    { steps, overall: allOk ? 'ALL PASSED' : 'FAILED' },
    { status: allOk ? 200 : 500 }
  );
}
