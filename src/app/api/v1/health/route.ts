// ═══════════════════════════════════════════════════════════════
// LEXDOC — Health Check Endpoint
// GET /api/v1/health
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // ── Database connectivity ──
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    checks.database = { ok: true, detail: 'connected' };

    // Check if key tables exist
    try {
      await db.$queryRaw`SELECT count(*) FROM firms`;
      checks.tables = { ok: true, detail: 'firms table exists' };
    } catch {
      checks.tables = { ok: false, detail: 'tables not found — run prisma db push' };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    checks.database = { ok: false, detail: msg };

    // Identify common issues
    if (msg.includes('DIRECT_URL') || msg.includes('Environment variable')) {
      checks.database.detail += ' — DIRECT_URL env var missing';
    }
    if (msg.includes('prepared statement') || msg.includes('42P05')) {
      checks.database.detail += ' — PgBouncer issue (use Session Mode)';
    }
    if (msg.includes('relation') && msg.includes('does not exist')) {
      checks.database.detail += ' — Tables missing (run prisma db push)';
    }
    if (msg.includes('ECONNREFUSED') || msg.includes('connect')) {
      checks.database.detail += ' — Connection failed (check DATABASE_URL)';
    }
  }

  // ── Environment variables ──
  const requiredEnvs = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
  checks.env = { ok: true };
  const missingEnvs: string[] = [];
  for (const envName of requiredEnvs) {
    if (!process.env[envName]) {
      missingEnvs.push(envName);
    }
  }
  if (missingEnvs.length > 0) {
    checks.env = { ok: false, detail: `Missing: ${missingEnvs.join(', ')}` };
  }

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allOk ? 200 : 503 }
  );
}
// deploy trigger Fri Jun 19 13:09:07 UTC 2026
