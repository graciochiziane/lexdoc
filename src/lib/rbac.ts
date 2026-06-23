// ═══════════════════════════════════════════════════════════════
// LEXDOC — Controlo de Acesso Baseado em Funções (RBAC)
// Verificações de permissões e hierarquia de papéis
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Hierarquia de papéis
// SUPER_ADMIN > ADMIN > ADVOGADO > SECRETARIO > CLIENT
// SUPER_ADMIN: acesso total à plataforma (todos os escritórios)
// ADMIN: acesso total ao seu escritório
// ─────────────────────────────────────────
const ROLE_HIERARCHY: Record<string, number> = {
  SUPER_ADMIN: 5,
  ADMIN: 4,
  ADVOGADO: 3,
  SECRETARIO: 2,
  CLIENT: 1,
};

/** Lista de papéis válidos */
export const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT'] as const;
export type ValidRole = (typeof VALID_ROLES)[number];

// ─────────────────────────────────────────
// Funções de verificação
// ─────────────────────────────────────────

/**
 * Verificar se o papel do utilizador está entre os permitidos.
 * SUPER_ADMIN e ADMIN têm acesso a todas as operações.
 *
 * @param userRole - Papel do utilizador autenticado
 * @param requiredRoles - Lista de papéis permitidos para a operação
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  // SUPER_ADMIN e ADMIN têm acesso a tudo
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') {
    return true;
  }

  return requiredRoles.includes(userRole);
}

/**
 * Verificar se o utilizador pode aceder a um recurso.
 * SUPER_ADMIN pode aceder a recursos de qualquer escritório.
 * Outros utilizadores só acedem aos recursos do seu próprio escritório.
 *
 * @param userRole - Papel do utilizador autenticado
 * @param resourceFirmId - firm_id do recurso a aceder
 * @param userFirmId - firm_id do utilizador autenticado
 */
export function canAccessResource(
  userRole: string,
  resourceFirmId: string,
  userFirmId: string
): boolean {
  // SUPER_ADMIN acede a tudo
  if (userRole === 'SUPER_ADMIN') {
    return true;
  }

  return resourceFirmId === userFirmId;
}

/**
 * Obter o nível hierárquico de um papel.
 * Retorna 0 se o papel não for reconhecido.
 */
export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

/**
 * Verificar se um utilizador pode gerir outro (hierarquia superior).
 * O userRole deve ter nível superior ao targetRole.
 */
export function canManageRole(userRole: string, targetRole: string): boolean {
  const userLevel = getRoleLevel(userRole);
  const targetLevel = getRoleLevel(targetRole);

  // Só pode gerir se tiver nível estritamente superior
  return userLevel > targetLevel;
}
