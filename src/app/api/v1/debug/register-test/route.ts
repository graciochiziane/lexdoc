// ═══════════════════════════════════════════════════════════════
// LEXDOC — Register Diagnostic Endpoint (temporary debug)
// GET /api/v1/debug/register-test
// Tests each step of the registration flow
// ═══════════════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
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

  // Step 3: Check if firms table exists
  try {
    await db.$queryRaw`SELECT count(*) FROM firms`;
    steps.push({ step: '3. Firms table', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '3. Firms table', ok: false, error: msg });
  }

  // Step 4: Check if users table exists
  try {
    await db.$queryRaw`SELECT count(*) FROM users`;
    steps.push({ step: '4. Users table', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '4. Users table', ok: false, error: msg });
  }

  // Step 5: Check if refresh_tokens table exists
  try {
    await db.$queryRaw`SELECT count(*) FROM refresh_tokens`;
    steps.push({ step: '5. Refresh tokens table', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '5. Refresh tokens table', ok: false, error: msg });
  }

  // Step 6: Prisma findUnique on firms
  try {
    await db.firm.findFirst();
    steps.push({ step: '6. Prisma firm.findFirst', ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '6. Prisma firm.findFirst', ok: false, error: msg });
  }

  // Step 7: Prisma create firm
  let firm = null;
  try {
    const slug = `debug-${Date.now()}`;
    firm = await db.firm.create({
      data: { name: TEST_FIRM_NAME, slug },
    });
    steps.push({ step: '7. Prisma firm.create', ok: true, detail: `firm_id=${firm.id}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '7. Prisma firm.create', ok: false, error: msg });
  }

  // Step 8: Hash password
  try {
    const hash = await hashPassword('TestPass@123');
    steps.push({ step: '8. Hash password', ok: true, detail: `hash_length=${hash.length}` });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '8. Hash password', ok: false, error: msg });
  }

  // Step 9: Prisma create user
  let user = null;
  if (firm) {
    try {
      user = await db.user.create({
        data: {
          firm_id: firm.id,
          email: `debug-test-${Date.now()}@lexdoc.co.mz`,
          password_hash: 'test_hash_placeholder',
          full_name: 'Debug User',
          role: 'ADMIN',
        },
      });
      steps.push({ step: '9. Prisma user.create', ok: true, detail: `user_id=${user.id}` });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: '9. Prisma user.create', ok: false, error: msg });
    }
  } else {
    steps.push({ step: '9. Prisma user.create', ok: false, error: 'Skipped (firm not created)' });
  }

  // Step 10: Generate tokens
  try {
    if (user) {
      const accessToken = generateAccessToken({
        sub: user.id,
        email: user.email,
        role: user.role,
        firm_id: user.firm_id,
      });
      generateRefreshToken({ sub: user.id });
      steps.push({ step: '10. Generate tokens', ok: true });
    } else {
      throw new Error('No user created');
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    steps.push({ step: '10. Generate tokens', ok: false, error: msg });
  }

  // Step 11: Create refresh token in DB
  if (user && firm) {
    try {
      const refreshTokenHash = hashToken('test-refresh-token');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.refreshToken.create({
        data: {
          user_id: user.id,
          firm_id: firm.id,
          token_hash: refreshTokenHash,
          expires_at: expiresAt,
        },
      });
      steps.push({ step: '11. Prisma refreshToken.create', ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      steps.push({ step: '11. Prisma refreshToken.create', ok: false, error: msg });
    }
  } else {
    steps.push({ step: '11. Prisma refreshToken.create', ok: false, error: 'Skipped' });
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
