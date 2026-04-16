// ═══════════════════════════════════════════════════════════════
// LEXDOC — Cliente API para pedidos autenticados
// Reutiliza o token de auth.store.ts
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
// Fetch genérico com headers de autenticação
// ─────────────────────────────────────────
async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const { accessToken } = useAuthStore.getState();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
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
interface ClientRecord {
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
interface ProcessRecord {
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

interface DeadlineRecord {
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

  const response = await fetch(`${API_BASE}${endpoint}`, { headers });
  if (!response.ok) {
    throw new Error('Erro ao exportar dados.');
  }
  return response.blob();
}

export const exportApi = {
  clients: () => apiFetchBlob('/export/clients?format=csv'),
  processes: () => apiFetchBlob('/export/processes?format=csv'),
  audit: () => apiFetchBlob('/export/audit?format=csv'),
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
