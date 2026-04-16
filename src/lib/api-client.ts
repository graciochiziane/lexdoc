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
