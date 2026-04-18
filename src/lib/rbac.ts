// ═══════════════════════════════════════════════════════════════
// LEXDOC — Controlo de Acesso Baseado em Funções (RBAC)
// Verificações de permissões e hierarquia de papéis
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────
// Hierarquia de papéis
// ADMIN > ADVOGADO > SECRETARIO > CLIENT
// ─────────────────────────────────────────
const ROLE_HIERARCHY: Record<string, number> = {
  ADMIN: 4,
  ADVOGADO: 3,
  SECRETARIO: 2,
  CLIENT: 1,
};

/** Lista de papéis válidos */
export const VALID_ROLES = ['ADMIN', 'ADVOGADO', 'SECRETARIO', 'CLIENT'] as const;
export type ValidRole = (typeof VALID_ROLES)[number];

// ─────────────────────────────────────────
// Funções de verificação
// ─────────────────────────────────────────

/**
 * Verificar se o papel do utilizador está entre os permitidos.
 * ADMIN tem acesso a todas as operações do seu escritório.
 *
 * @param userRole - Papel do utilizador autenticado
 * @param requiredRoles - Lista de papéis permitidos para a operação
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  // ADMIN tem acesso a tudo
  if (userRole === 'ADMIN') {
    return true;
  }

  return requiredRoles.includes(userRole);
}

/**
 * Verificar se o utilizador pode aceder a um recurso.
 * Sempre verifica firm_id — nenhum utilizador acede recursos de outro escritório.
 *
 * @param userRole - Papel do utilizador autenticado
 * @param resourceFirmId - firm_id do recurso a aceder
 * @param userFirmId - firm_id do utilizador autenticado
 */
export function canAccessResource(
  _userRole: string,
  resourceFirmId: string,
  userFirmId: string
): boolean {
  // Nenhum utilizador acede recursos de outro escritório
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
