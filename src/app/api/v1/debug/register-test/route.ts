// ═══════════════════════════════════════════════════════════════
// LEXDOC — Register Diagnostic Endpoint (temporary debug)
// GET /api/v1/debug/register-test
// Tests each step of the registration flow with explicit UUIDs
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { hashPassword, generateAccessToken, generateRefreshToken, hashToken } from '@/lib/auth';

const TEST_FIRM_NAME = 'Debug Test Firm';

export async function GET() {
  const steps: Array<{ step: string; ok: boolean; detail?: string; error?: string }> = [];

  // Step 1: Check Prisma client
  try {
    if (!db) throw new Error('Prisma client not initialized');
    steps.push({ step: '1. Prisma client', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '1. Prisma client', ok: false, error: msg });
    return NextResponse.json({ steps, overall: 'FAILED' }, { status: 500 });
  }

  // Step 2: Raw query test
  try {
    await db.$queryRaw`SELECT 1 as ok`;
    steps.push({ step: '2. Raw query', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '2. Raw query', ok: false, error: msg });
  }

  // Step 3: Prisma create firm with explicit UUID
  let firm = null;
  try {
    const firmId = randomUUID();
    const slug = `debug-${Date.now()}`;
    firm = await db.firm.create({
      data: {
        id: firmId,
        name: TEST_FIRM_NAME,
        slug,
      },
    });
    steps.push({ step: '3. Prisma firm.create (explicit UUID)', ok: true, detail: `firm_id=${firm.id}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '3. Prisma firm.create (explicit UUID)', ok: false, error: msg });
  }

  // Step 4: Hash password
  try {
    const hash = await hashPassword('TestPass@123');
    steps.push({ step: '4. Hash password', ok: true, detail: `hash_length=${hash.length}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '4. Hash password', ok: false, error: msg });
  }

  // Step 5: Prisma create user with explicit UUID
  let user = null;
  if (firm) {
    try {
      const userId = randomUUID();
      user = await db.user.create({
        data: {
          id: userId,
          firm_id: firm.id,
          email: `debug-test-${Date.now()}@lexdoc.co.mz`,
          password_hash: 'test_hash_placeholder',
          full_name: 'Debug User',
          role: 'ADMIN',
        },
      });
      steps.push({ step: '5. Prisma user.create (explicit UUID)', ok: true, detail: `user_id=${user.id}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: '5. Prisma user.create (explicit UUID)', ok: false, error: msg });
    }
  } else {
    steps.push({ step: '5. Prisma user.create', ok: false, error: 'Skipped (firm not created)' });
  }

  // Step 6: Generate tokens
  try {
    if (user) {
      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        firm_id: user.firm_id,
      });
      generateRefreshToken({ sub: user.id });
      steps.push({ step: '6. Generate tokens', ok: true });
    } else {
      throw new Error('No user created');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '6. Generate tokens', ok: false, error: msg });
  }

  // Step 7: Create refresh token using raw SQL
  if (user && firm) {
    try {
      const refreshTokenHash = hashToken('test-refresh-token');
      const refreshTokenId = randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.$executeRaw`
        SET search_path TO public;
        INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
        VALUES (${refreshTokenId}::uuid, ${user.id}::uuid, ${refreshTokenHash}, ${expiresAt}::timestamptz, now()::timestamptz)
      `;
      steps.push({ step: '7. Raw SQL INSERT refresh_tokens', ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: '7. Raw SQL INSERT refresh_tokens', ok: false, error: msg });
    }
  } else {
    steps.push({ step: '7. Raw SQL INSERT refresh_tokens', ok: false, error: 'Skipped' });
  }

  // Cleanup: delete test data
  if (user) {
    try {
      await db.refreshToken.deleteMany({ where: { user_id: user.id } });
      await db.user.delete({ where: { id: user.id } });
    } catch { /* ignore */ }
  }
  if (firm) {
    try {
      await db.firm.delete({ where: { id: firm.id } });
    } catch { /* ignore */ }
  }

  const allOk = steps.every((s) => s.ok);
  return NextResponse.json(
    { steps, overall: allOk ? 'ALL PASSED' : 'FAILED' },
    { status: allOk ? 200 : 500 }
  );
}
