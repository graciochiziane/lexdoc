// ═══════════════════════════════════════════════════════════════
// LEXDOC — Cliente API para pedidos autenticados
// Reutiliza o token de auth.store.ts
// Inclui interceptor 401 com refresh token automático
// ═══════════════════════════════════════════════════════════════

import { useAuthStore } from '@/stores/auth.store';

// ─────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────
interface ApiMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface ApiError {
  code: string;
  message: string;
  details?: string[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: ApiMeta;
  error?: ApiError;
}

// ─────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────
const API_BASE = '/api/v1';

// ─────────────────────────────────────────
// Refresh token — queue para evitar race conditions
// ─────────────────────────────────────────
let apiRefreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const { refreshToken, clearAuth, setAuth } = useAuthStore.getState();
  if (!refreshToken) {
    clearAuth();
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (data.success && data.data) {
      const { access_token, refresh_token, user } = data.data;
      setAuth(access_token, refresh_token, user);
      return true;
    } else {
      clearAuth();
      return false;
    }
  } catch {
    clearAuth();
    return false;
  }
}

// ─────────────────────────────────────────
// Construir headers de autenticação
// ─────────────────────────────────────────
function getAuthHeaders(extra?: HeadersInit): HeadersInit {
  const { accessToken } = useAuthStore.getState();
  return {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...extra,
  };
}

// ─────────────────────────────────────────
// Fetch genérico com headers + interceptor 401
// ─────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const headers = getAuthHeaders();
  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  // Se 401 — tentar refresh e repetir pedido
  if (response.status === 401) {
    if (!apiRefreshPromise) {
      apiRefreshPromise = tryRefreshToken().finally(() => {
        apiRefreshPromise = null;
      });
    }

    const refreshed = await apiRefreshPromise;
    if (refreshed) {
      const retryHeaders = getAuthHeaders();
      const retryResponse = await fetch(`${API_BASE}${endpoint}`, { ...options, headers: retryHeaders });
      return await retryResponse.json() as ApiResponse<T>;
    }
  }

  const data: ApiResponse<T> = await response.json();
  return data;
}

// ─────────────────────────────────────────
// API de Utilizadores
// ─────────────────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export const usersApi = {
  list: (params?: string) =>
    apiFetch<UserRecord[]>(`/users${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<UserRecord>(`/users/${id}`),
  create: (data: { full_name: string; email: string; password: string; role: string }) =>
    apiFetch<UserRecord>('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { full_name?: string; email?: string; role?: string }) =>
    apiFetch<UserRecord>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deactivate: (id: string) =>
    apiFetch<UserRecord>(`/users/${id}/deactivate`, { method: 'PATCH' }),
};

// ─────────────────────────────────────────
// API de Clientes
// ─────────────────────────────────────────
export interface ClientRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  client_type: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const clientsApi = {
  list: (params?: string) =>
    apiFetch<ClientRecord[]>(`/clients${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<ClientRecord>(`/clients/${id}`),
  create: (data: {
    full_name: string;
    email?: string;
    phone?: string;
    address?: string;
    client_type: string;
    notes?: string;
  }) =>
    apiFetch<ClientRecord>('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      full_name?: string;
      email?: string;
      phone?: string;
      address?: string;
      client_type?: string;
      notes?: string;
    },
  ) =>
    apiFetch<ClientRecord>(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────
// API de Processos
// ─────────────────────────────────────────
export interface ProcessRecord {
  id: string;
  process_number: string;
  title: string;
  description: string | null;
  client_id: string;
  area: string;
  status: string;
  priority: string;
  court: string | null;
  judge: string | null;
  opposing_party: string | null;
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  client?: ClientRecord;
}

export const processesApi = {
  list: (params?: string) =>
    apiFetch<ProcessRecord[]>(`/processes${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<ProcessRecord>(`/processes/${id}`),
  create: (data: {
    process_number: string;
    title: string;
    description?: string;
    client_id: string;
    area: string;
    priority: string;
    court?: string;
    judge?: string;
    opposing_party?: string;
  }) =>
    apiFetch<ProcessRecord>('/processes', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      area?: string;
      status?: string;
      priority?: string;
      court?: string;
      judge?: string;
      opposing_party?: string;
    },
  ) =>
    apiFetch<ProcessRecord>(`/processes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  close: (id: string) =>
    apiFetch<ProcessRecord>(`/processes/${id}/close`, { method: 'PATCH' }),
  updateStatus: (id: string, status: string) =>
    apiFetch<ProcessRecord>(`/processes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  timeline: (id: string) =>
    apiFetch<TimelineEntry[]>(`/processes/${id}/timeline`),
};

// ─────────────────────────────────────────
// API de Estatísticas
// ─────────────────────────────────────────
export interface DashboardStats {
  total_processes: number;
  active_processes: number;
  total_clients: number;
  total_documents: number;
  upcoming_deadlines: number;
  recent_processes: ProcessRecord[];
  upcoming_deadlines_list: Array<{
    id: string;
    title: string;
    due_date: string;
    process_title: string;
    process_id: string;
  }>;
}

export const statsApi = {
  dashboard: () => apiFetch<DashboardStats>('/stats/dashboard'),
};

// ─────────────────────────────────────────
// API de Auditoria
// ─────────────────────────────────────────
interface AuditLogRecord {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: string | null;
  new_values: string | null;
  ip_address: string | null;
  created_at: string;
  user_name: string;
}

export const auditApi = {
  logs: (params?: string) =>
    apiFetch<AuditLogRecord[]>(`/audit/logs${params ? `?${params}` : ''}`),
};

// ─────────────────────────────────────────
// API de Prazos
// ─────────────────────────────────────────

interface CalendarDeadlineItem {
  id: string;
  title: string;
  due_date: string;
  status: string;
  process_id: string;
  process_title: string;
  process_number: string;
}

export interface CalendarDeadlinesData {
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  deadlines_by_date: Record<string, CalendarDeadlineItem[]>;
  total: number;
}

export interface DeadlineRecord {
  id: string;
  process_id: string;
  title: string;
  description: string | null;
  due_date: string;
  reminder_at: string | null;
  status: string;
  source: string;
  ai_extracted: boolean;
  created_at: string;
  updated_at: string;
  process?: {
    id: string;
    process_number: string;
    title: string;
  };
}

export const deadlinesApi = {
  list: (params?: string) =>
    apiFetch<DeadlineRecord[]>(`/deadlines${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<DeadlineRecord>(`/deadlines/${id}`),
  create: (data: {
    title: string;
    due_date: string;
    description?: string;
    process_id: string;
    reminder_at?: string;
  }) =>
    apiFetch<DeadlineRecord>('/deadlines', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      due_date?: string;
      description?: string;
      process_id?: string;
      reminder_at?: string;
      status?: string;
    },
  ) =>
    apiFetch<DeadlineRecord>(`/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  byProcess: (processId: string, params?: string) =>
    apiFetch<DeadlineRecord[]>(`/processes/${processId}/deadlines${params ? `?${params}` : ''}`),
  calendar: (params: string) =>
    apiFetch<CalendarDeadlinesData>(`/deadlines/calendar?${params}`),
};

// ─────────────────────────────────────────
// API de Documentos
// ─────────────────────────────────────────
interface DocumentRecord {
  id: string;
  firm_id: string;
  process_id: string | null;
  created_by_id: string;
  updated_by_id: string | null;
  title: string;
  description: string | null;
  file_key: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  version: number;
  parent_id: string | null;
  status: string;
  is_confidential: boolean;
  tags: string;
  ai_summary: string | null;
  ai_processed_at: string | null;
  created_at: string;
  updated_at: string;
  process?: {
    id: string;
    process_number: string;
    title: string;
  };
}

export const documentsApi = {
  list: (params?: string) =>
    apiFetch<DocumentRecord[]>(`/documents${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<DocumentRecord>(`/documents/${id}`),
  create: (data: {
    title: string;
    description?: string;
    process_id?: string;
    file_name: string;
    mime_type: string;
    file_size: number;
    tags?: string;
    is_confidential?: boolean;
  }) =>
    apiFetch<DocumentRecord>('/documents', { method: 'POST', body: JSON.stringify(data) }),
  update: (
    id: string,
    data: {
      title?: string;
      description?: string;
      process_id?: string;
      file_name?: string;
      mime_type?: string;
      file_size?: number;
      tags?: string;
      is_confidential?: boolean;
      status?: string;
    },
  ) =>
    apiFetch<DocumentRecord>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<DocumentRecord>(`/documents/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
// API de Pesquisa Global
// ─────────────────────────────────────────
export interface SearchResultItem {
  id: string;
  title: string;
  subtitle?: string;
  type: string;
  created_at: string;
}

export interface SearchGroup {
  type: string;
  label: string;
  count: number;
  items: SearchResultItem[];
}

export interface SearchResponse {
  query: string;
  type: string;
  results: SearchGroup[];
  total: number;
  meta: ApiMeta;
}

export const searchApi = {
  global: (params: string) =>
    apiFetch<SearchResponse>(`/search?${params}`),
};

// ─────────────────────────────────────────
// API de Notificações
// ─────────────────────────────────────────
export interface NotificationItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string;
  user_id: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface NotificationsData {
  notifications: NotificationItem[];
  meta: ApiMeta;
}

export const notificationsApi = {
  list: (params?: string) =>
    apiFetch<NotificationsData>(`/notifications${params ? `?${params}` : ''}`),
  unreadCount: () =>
    apiFetch<{ count: number }>('/notifications?unread-count'),
};

// ─────────────────────────────────────────
// API de Perfil do Utilizador
// ─────────────────────────────────────────
export interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  phone: string | null;
  is_active: boolean;
  email_verified: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  member_since: string;
  firm: {
    id: string;
    name: string;
    plan: string;
  };
}

export const profileApi = {
  get: () => apiFetch<ProfileData>('/profile'),
  update: (data: { full_name?: string; phone?: string }) =>
    apiFetch<ProfileData>('/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    apiFetch<{ message: string }>('/profile/password', { method: 'PATCH', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────
// API de Relatórios
// ─────────────────────────────────────────
export interface ReportOverviewData {
  firm: {
    name: string;
    plan: string;
    member_count: number;
    created_at: string;
    age_days: number;
  };
  processes: {
    total: number;
    active: number;
    suspended: number;
    closed: number;
    by_area: Record<string, number>;
    by_priority: Record<string, number>;
    avg_per_month: number;
    this_month: number;
    last_month: number;
  };
  clients: {
    total: number;
    by_type: Record<string, number>;
    new_this_month: number;
  };
  documents: {
    total: number;
    by_status: Record<string, number>;
    total_size_bytes: number;
    confidential_count: number;
  };
  deadlines: {
    total: number;
    overdue: number;
    completed: number;
    upcoming_7d: number;
    upcoming_30d: number;
  };
  activity: {
    total_audit_entries: number;
    most_active_users: Array<{ name: string; actions_count: number }>;
    recent_actions_by_type: Record<string, number>;
  };
}

export const reportsApi = {
  overview: () => apiFetch<ReportOverviewData>('/reports/overview'),
};

// ─────────────────────────────────────────
// API de Configurações do Escritório
// ─────────────────────────────────────────
export interface FirmSettings {
  id: string;
  name: string;
  slug: string;
  nif: string | null;
  oam_number: string | null;
  is_active: boolean;
  plan: string;
  created_at: string;
  member_count: number;
}

interface FirmMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export const firmApi = {
  settings: {
    get: () => apiFetch<FirmSettings>('/firm/settings'),
    update: (data: { name?: string; nif?: string; oam_number?: string }) =>
      apiFetch<FirmSettings>('/firm/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  },
  members: (params?: string) =>
    apiFetch<FirmMember[]>(`/firm/members${params ? `?${params}` : ''}`),
};

// ─────────────────────────────────────────
// API de Convites
// ─────────────────────────────────────────
export interface InvitationRecord {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  status: string;
}

export interface CreateInvitationData {
  email: string;
  role: string;
  full_name?: string;
}

export interface InvitationResult {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface ValidateInvitationData {
  firm_name: string;
  email: string;
  role: string;
  expires_at: string;
}

export const invitationsApi = {
  create: (data: CreateInvitationData) =>
    apiFetch<InvitationResult>('/invitations', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: string) =>
    apiFetch<InvitationRecord[]>(`/invitations${params ? `?${params}` : ''}`),
  validate: (token: string) =>
    apiFetch<ValidateInvitationData>(`/invitations/${token}`),
  accept: (token: string, data: { full_name: string; password: string; password_confirmation: string }) =>
    apiFetch<{ access_token: string; refresh_token: string; user: { id: string; email: string; role: string; firm_id: string; full_name: string } }>(
      `/invitations/${token}/accept`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  revoke: (token: string) =>
    apiFetch<{ message: string }>(`/invitations/${token}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
// API de Exportação CSV
// ─────────────────────────────────────────
async function apiFetchBlob(endpoint: string): Promise<Blob> {
  const { accessToken } = useAuthStore.getState();
  const headers: HeadersInit = {
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  let response = await fetch(`${API_BASE}${endpoint}`, { headers });

  // Se 401 — tentar refresh e repetir pedido
  if (response.status === 401) {
    if (!apiRefreshPromise) {
      apiRefreshPromise = tryRefreshToken().finally(() => {
        apiRefreshPromise = null;
      });
    }

    const refreshed = await apiRefreshPromise;
    if (refreshed) {
      const { accessToken: newToken } = useAuthStore.getState();
      const retryHeaders: HeadersInit = {
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      };
      response = await fetch(`${API_BASE}${endpoint}`, { headers: retryHeaders });
    }
  }

  if (!response.ok) {
    throw new Error('Erro ao exportar dados.');
  }
  return response.blob();
}

export const exportApi = {
  clients: (ids?: string[]) => apiFetchBlob(`/export/clients?format=csv${ids?.length ? `&ids=${ids.join(',')}` : ''}`),
  processes: (ids?: string[]) => apiFetchBlob(`/export/processes?format=csv${ids?.length ? `&ids=${ids.join(',')}` : ''}`),
  audit: () => apiFetchBlob('/export/audit?format=csv'),
  reportPdf: (type: 'firm_overview' | 'processes' | 'clients' | 'deadlines' = 'firm_overview') =>
    apiFetchBlob(`/export/report-pdf?type=${type}`),
};

// ─────────────────────────────────────────
// API de Importação (CSV)
// ─────────────────────────────────────────
export interface ImportResult {
  total: number;
  created: number;
  duplicates: number;
  errors: number;
  parse_warnings?: string[];
  import_errors?: string[];
}

async function importCSV<T extends ImportResult>(endpoint: string, file: File): Promise<ApiResponse<T>> {
  const token = useAuthStore.getState().accessToken;
  if (!token) return { success: false, error: { code: 'UNAUTHORIZED', message: 'Não autenticado.' } };

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  return response.json();
}

export const importApi = {
  clients: (file: File) => importCSV<ImportResult>('/import/clients', file),
};

// ─────────────────────────────────────────
// API de Autenticação (pública)
// ─────────────────────────────────────────

// Fetch sem autenticação para endpoints públicos
async function publicApiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data: ApiResponse<T> = await response.json();
  return data;
}

export const authApi = {
  forgotPassword: (email: string) =>
    publicApiFetch<{ message: string; reset_link?: string }>(
      '/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ email }) },
    ),
  resetPassword: (token: string, new_password: string, confirm_password: string) =>
    publicApiFetch<{ message: string }>(
      '/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ token, new_password, confirm_password }) },
    ),
};

// ─────────────────────────────────────────
// API de Actividade Recente
// ─────────────────────────────────────────
export interface ActivityItem {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  user_name: string;
  user_id: string | null;
  description: string;
  created_at: string;
}

interface ActivityRecentData {
  activities: ActivityItem[];
  total: number;
}

export const activityApi = {
  recent: (limit?: number) =>
    apiFetch<ActivityRecentData>(`/activity/recent${limit ? `?limit=${limit}` : ''}`),
};

// ─────────────────────────────────────────
// API de Notas
// ─────────────────────────────────────────
export interface NoteItem {
  id: string;
  firm_id: string;
  entity_type: string;
  entity_id: string | null;
  content: string;
  is_pinned: boolean;
  is_completed: boolean;
  priority: string;
  due_date: string | null;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

export const notesApi = {
  list: (entityType: string, entityId?: string | null, page?: number, limit?: number) =>
    apiFetch<NoteItem[]>(
      `/notes?entity_type=${entityType}${entityId ? `&entity_id=${entityId}` : ''}${page ? `&page=${page}` : ''}${limit ? `&limit=${limit}` : ''}`,
    ),
  create: (data: {
    entity_type: string;
    entity_id?: string | null;
    content: string;
    is_pinned?: boolean;
    is_completed?: boolean;
    priority?: string;
    due_date?: string | null;
  }) =>
    apiFetch<NoteItem>('/notes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: {
    content?: string;
    is_pinned?: boolean;
    is_completed?: boolean;
    priority?: string;
    due_date?: string | null;
  }) =>
    apiFetch<NoteItem>(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<{ id: string; deleted: boolean }>(`/notes/${id}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────
// API de Timeline do Processo
// ─────────────────────────────────────────
export interface TimelineEntry {
  id: string;
  type: 'audit' | 'deadline' | 'note';
  action: string;
  description: string;
  user_name: string;
  user_id: string | null;
  created_at: string;
  details?: Record<string, unknown>;
}

// ─────────────────────────────────────────
// API de Base de Conhecimento Jurídico
// ─────────────────────────────────────────
export interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string | null;
  tags: string;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    full_name: string;
  };
}

export interface KnowledgeStats {
  total_articles: number;
  pinned_articles: number;
  total_views: number;
  by_category: Record<string, number>;
  recent_articles: Array<{
    id: string;
    title: string;
    category: string;
    view_count: number;
    created_at: string;
    created_by: { full_name: string };
  }>;
  most_viewed: Array<{
    id: string;
    title: string;
    category: string;
    view_count: number;
  }>;
}

export const knowledgeApi = {
  list: (params?: string) =>
    apiFetch<KnowledgeArticle[]>(`/knowledge${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<KnowledgeArticle>(`/knowledge/${id}`),
  create: (data: {
    title: string;
    content: string;
    category: string;
    source?: string;
    tags?: string;
    is_pinned?: boolean;
  }) =>
    apiFetch<KnowledgeArticle>('/knowledge', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: {
    title?: string;
    content?: string;
    category?: string;
    source?: string;
    tags?: string;
    is_pinned?: boolean;
  }) =>
    apiFetch<KnowledgeArticle>(`/knowledge/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<{ id: string; deleted: boolean }>(`/knowledge/${id}`, { method: 'DELETE' }),
  stats: () =>
    apiFetch<KnowledgeStats>('/knowledge/stats'),
};

// ─────────────────────────────────────────
// API de IA — LexAssistent (Chat + Análise)
// ─────────────────────────────────────────
export interface AIChatRequest {
  message: string;
  context?: string;
}

export interface AIChatResponse {
  message: string;
  sources?: string[];
}

export interface AIAnalyzeRequest {
  text: string;
  type: 'contract' | 'petition' | 'legal_opinion' | 'general';
}

export interface AIAnalysisResponse {
  summary: string;
  key_points: string[];
  risks: string[];
  recommendations: string[];
  full_analysis: string;
}

// ─────────────────────────────────────────
// API de IA — Conversas (Enhanced Chat)
// ─────────────────────────────────────────
export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message?: string;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  knowledge_articles_used?: Array<{ id: string; title: string; category: string }>;
  created_at: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  context?: string;
  messages: ConversationMessage[];
}

// ─────────────────────────────────────────
// API de IA — Geração de Documentos
// ─────────────────────────────────────────
export interface GenerationRecord {
  id: string;
  title: string;
  generation_type: string;
  context: string;
  result: string;
  process_id?: string;
  created_at: string;
}

// ─────────────────────────────────────────
// API de IA — Extração de Prazos
// ─────────────────────────────────────────
export interface ExtractedDeadline {
  title: string;
  due_date: string;
  description: string;
  source_text: string;
}

export const aiApi = {
  // Enhanced chat with RAG + memory (non-streaming)
  chat: (data: { message: string; context?: string; conversation_id?: string }) =>
    apiFetch<{ message: string; sources: string[]; conversation_id: string; knowledge_articles_used?: Array<{ id: string; title: string; category: string }> }>('/ai/chat', { method: 'POST', body: JSON.stringify(data) }),

  // Streaming chat (SSE) — returns an async iterator of events
  chatStream: async function* (data: { message: string; context?: string; conversation_id?: string }) {
    const headers = getAuthHeaders();
    const response = await fetch(`${API_BASE}/ai/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: { message: 'Erro de conexão' } }));
      throw new Error(err?.error?.message || 'Erro no stream');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Stream não disponível');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr) {
            try {
              yield JSON.parse(jsonStr);
            } catch {
              // Ignorar JSON inválido
            }
          }
        }
      }
    }
  },

  // List conversations
  listConversations: (params?: string) =>
    apiFetch<ConversationSummary[]>('/ai/chat' + (params ? `?${params}` : '')),

  // Get conversation messages
  getConversation: (id: string) =>
    apiFetch<ConversationDetail>(`/ai/conversations/${id}`),

  // Delete conversation
  deleteConversation: (id: string) =>
    apiFetch(`/ai/conversations/${id}`, { method: 'DELETE' }),

  // Generate document
  generate: (data: { type: string; title: string; context: string; process_id?: string; template_id?: string }) =>
    apiFetch<{ id: string; title: string; result: string; generation_type: string }>('/ai/generate', { method: 'POST', body: JSON.stringify(data) }),

  // List generations
  listGenerations: (params?: string) =>
    apiFetch<GenerationRecord[]>('/ai/generate/list' + (params ? `?${params}` : '')),

  // Get generation
  getGeneration: (id: string) =>
    apiFetch<GenerationRecord>(`/ai/generate/${id}`),

  // Delete generation
  deleteGeneration: (id: string) =>
    apiFetch(`/ai/generate/${id}`, { method: 'DELETE' }),

  // Extract deadlines
  extractDeadlines: (data: { text: string; process_id?: string }) =>
    apiFetch<{ deadlines: ExtractedDeadline[] }>('/ai/extract-deadlines', { method: 'POST', body: JSON.stringify(data) }),

  // Analyze document (existing)
  analyze: (data: AIAnalyzeRequest) =>
    apiFetch<AIAnalysisResponse>('/ai/analyze', { method: 'POST', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────
// API de Modelos de Processo (Templates)
// ─────────────────────────────────────────
export interface TemplateRecord {
  id: string;
  title: string;
  description: string | null;
  area: string;
  default_priority: string;
  checklist_items: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    full_name: string;
  };
}

export interface TemplateUseResult {
  id: string;
  process_number: string;
  title: string;
  description: string | null;
  area: string;
  status: string;
  priority: string;
  opened_at: string;
  created_at: string;
  client: { id: string; full_name: string };
  deadlines_created: number;
}

export const templatesApi = {
  list: (params?: string) =>
    apiFetch<TemplateRecord[]>(`/templates${params ? `?${params}` : ''}`),
  get: (id: string) =>
    apiFetch<TemplateRecord>(`/templates/${id}`),
  create: (data: {
    title: string;
    description?: string;
    area: string;
    default_priority?: string;
    checklist_items?: Array<{ title: string; description?: string }>;
  }) =>
    apiFetch<TemplateRecord>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: {
    title?: string;
    description?: string;
    area?: string;
    default_priority?: string;
    checklist_items?: Array<{ title: string; description?: string }>;
    is_active?: boolean;
  }) =>
    apiFetch<TemplateRecord>(`/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  remove: (id: string) =>
    apiFetch<{ id: string; deleted: boolean }>(`/templates/${id}`, { method: 'DELETE' }),
  use: (id: string, data: { client_id: string; process_number: string }) =>
    apiFetch<TemplateUseResult>(`/templates/${id}/use`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────
// API de Notas do Processo (Process Notes)
// ─────────────────────────────────────────
export interface ProcessNoteRecord {
  id: string;
  process_id: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export const processNotesApi = {
  list: (processId: string) =>
    apiFetch<ProcessNoteRecord[]>(`/processes/${processId}/notes`),
  create: (processId: string, data: { content: string }) =>
    apiFetch<ProcessNoteRecord>(`/processes/${processId}/notes`, { method: 'POST', body: JSON.stringify(data) }),
};

// ─────────────────────────────────────────
// API de Plataforma (SUPER_ADMIN)
// ─────────────────────────────────────────
interface PlatformStats {
  firms: { total: number; active: number; inactive: number };
  users: { total: number; active: number; inactive: number; by_role: { role: string; count: number }[] };
  clients: { total: number };
  processes: { total: number; active: number; closed: number };
  documents: { total: number };
  deadlines: { total: number; pending: number };
  ai: { conversations: number; generations: number };
  plans: { plan: string; count: number }[];
  recent: {
    users: { id: string; email: string; full_name: string; role: string; created_at: string; firm: { name: string } }[];
    firms: { id: string; name: string; plan: string; is_active: boolean; created_at: string }[];
  };
}

interface PlatformFirm {
  id: string; name: string; slug: string; nif: string | null; oam_number: string | null;
  is_active: boolean; plan: string; created_at: string; updated_at: string;
  _count: { users: number; clients: number; processes: number; documents: number; ai_conversations: number };
}

interface PlatformUser {
  id: string; email: string; full_name: string; role: string; phone: string | null;
  is_active: boolean; email_verified: boolean; mfa_enabled: boolean;
  last_login_at: string | null; created_at: string;
  firm: { id: string; name: string; plan: string };
}

// ─────────────────────────────────────────
// API de Governança IA (SUPER_ADMIN)
// ─────────────────────────────────────────
export interface GovernanceNivelDist {
  nivel: string;
  count: number;
  percentage: number;
}

export interface GovernanceDailyTrend {
  date: string;
  total: number;
  safe_silence: number;
  avg_confidence: number | null;
}

export interface GovernanceRecentEntry {
  id: string;
  conversation_title: string;
  user_name: string;
  firm_name: string;
  confidence_score: number | null;
  nivel: string | null;
  content_preview: string;
  created_at: string;
}

export interface GovernanceData {
  period: string;
  summary: {
    total_responses: number;
    with_governance_data: number;
    governance_coverage: number;
    safe_silence_count: number;
    safe_silence_rate: number;
    avg_confidence_score: number | null;
    min_confidence_score: number | null;
    max_confidence_score: number | null;
  };
  nivel_distribution: GovernanceNivelDist[];
  score_distribution: Record<string, number>;
  source_analysis: {
    with_mozambican_source: number;
    with_penalized_source: number;
    with_no_source: number;
    sample_size: number;
  };
  daily_trend: GovernanceDailyTrend[];
  recent_governance: GovernanceRecentEntry[];
}

export const platformApi = {
  bootstrap: () =>
    apiFetch<{ message: string; user: { id: string; email: string; role: string; firm_id: string; full_name: string } }>('/platform/bootstrap', { method: 'POST' }),
  stats: () =>
    apiFetch<PlatformStats>('/platform/stats'),
  listFirms: (params?: string) =>
    apiFetch<PlatformFirm[]>(`/platform/firms${params ? `?${params}` : ''}`),
  getFirm: (id: string) =>
    apiFetch<PlatformFirm & { users: { id: string; email: string; full_name: string; role: string; is_active: boolean; last_login_at: string | null; created_at: string }[] }>(`/platform/firms/${id}`),
  deactivateFirm: (id: string) =>
    apiFetch<{ message: string }>(`/platform/firms/${id}`, { method: 'DELETE' }),
  listUsers: (params?: string) =>
    apiFetch<PlatformUser[]>(`/platform/users${params ? `?${params}` : ''}`),
  updateUser: (id: string, data: { role?: string; is_active?: boolean }) =>
    apiFetch<PlatformUser>(`/platform/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  governance: (period?: string) =>
    apiFetch<GovernanceData>(`/platform/governance${period ? `?period=${period}` : ''}`),
};
