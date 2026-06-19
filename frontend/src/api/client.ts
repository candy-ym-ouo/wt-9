const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

async function uploadFile(path: string, file: File, params?: Record<string, string>) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('file', file);
  const query = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${BASE}${path}${query}`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function downloadFile(id: number) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}/materials/${id}/download`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  const blob = await res.blob();
  const contentDisposition = res.headers.get('content-disposition') || '';
  const match = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)/i);
  const filename = match ? decodeURIComponent(match[1]) : `material-${id}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    register: (data: any) =>
      request<any>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    profile: () => request<any>('/auth/profile'),
  },
  users: {
    list: () => request<any[]>('/users'),
    updateRole: (id: number, role: string) =>
      request<any>(`/users/${id}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
    freeze: (id: number) =>
      request<any>(`/users/${id}/freeze`, { method: 'PUT' }),
    unfreeze: (id: number) =>
      request<any>(`/users/${id}/unfreeze`, { method: 'PUT' }),
    remove: (id: number) => request<any>(`/users/${id}`, { method: 'DELETE' }),
  },
  auditLogs: {
    list: (params?: { targetUserId?: number; action?: string; limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.targetUserId) searchParams.set('targetUserId', String(params.targetUserId));
      if (params?.action) searchParams.set('action', params.action);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const q = searchParams.toString();
      return request<any[]>(`/audit-logs${q ? '?' + q : ''}`);
    },
  },
  rehearsals: {
    list: (params?: {
      start?: string;
      end?: string;
      location?: string;
      participantId?: number;
      timeSlot?: string;
      attendanceStatus?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.start) searchParams.set('start', params.start);
      if (params?.end) searchParams.set('end', params.end);
      if (params?.location) searchParams.set('location', params.location);
      if (params?.participantId) searchParams.set('participantId', String(params.participantId));
      if (params?.timeSlot) searchParams.set('timeSlot', params.timeSlot);
      if (params?.attendanceStatus) searchParams.set('attendanceStatus', params.attendanceStatus);
      const q = searchParams.toString();
      return request<any[]>(`/rehearsals${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/rehearsals/${id}`),
    checkConflicts: (data: { startTime: string; endTime: string; participantIds?: number[]; excludeId?: number }) =>
      request<any>('/rehearsals/check-conflicts', { method: 'POST', body: JSON.stringify(data) }),
    create: (data: any) =>
      request<any>('/rehearsals', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/rehearsals/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/rehearsals/${id}`, { method: 'DELETE' }),
    updateAttendance: (id: number, updates: Array<{ userId: number; status: 'present' | 'absent' | 'late' | null; absentReason?: string }>) =>
      request<any>(`/rehearsals/${id}/attendance`, { method: 'PUT', body: JSON.stringify({ updates }) }),
    getStatistics: (params?: { start?: string; end?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.start) searchParams.set('start', params.start);
      if (params?.end) searchParams.set('end', params.end);
      const q = searchParams.toString();
      return request<any>(`/rehearsals/statistics/summary${q ? '?' + q : ''}`);
    },
  },
  roles: {
    list: () => request<any[]>('/roles'),
    get: (id: number) => request<any>(`/roles/${id}`),
    create: (data: any) =>
      request<any>('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/roles/${id}`, { method: 'DELETE' }),
    addSubstitute: (roleId: number, actorId: number) =>
      request<any>(`/roles/${roleId}/substitutes`, { method: 'POST', body: JSON.stringify({ actorId }) }),
    removeSubstitute: (roleId: number, actorId: number) =>
      request<any>(`/roles/${roleId}/substitutes/${actorId}`, { method: 'DELETE' }),
  },
  annotations: {
    list: (scene?: string) => {
      const params = scene ? `?scene=${scene}` : '';
      return request<any[]>(`/annotations${params}`);
    },
    get: (id: number) => request<any>(`/annotations/${id}`),
    create: (data: any) =>
      request<any>('/annotations', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/annotations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/annotations/${id}`, { method: 'DELETE' }),
    getVersions: (id: number) => request<any[]>(`/annotations/${id}/versions`),
    getVersion: (id: number, versionId: number) =>
      request<any>(`/annotations/${id}/versions/${versionId}`),
    restoreToVersion: (id: number, versionId: number) =>
      request<any>(`/annotations/${id}/versions/${versionId}/restore`, { method: 'POST' }),
  },
  materials: {
    list: (params?: { category?: string; categories?: string; tags?: string; keyword?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.category) searchParams.set('category', params.category);
      if (params?.categories) searchParams.set('categories', params.categories);
      if (params?.tags) searchParams.set('tags', params.tags);
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      const q = searchParams.toString();
      return request<any[]>(`/materials${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/materials/${id}`),
    getReferences: (id: number) => request<any[]>(`/materials/${id}/references`),
    upload: (file: File, params?: { category?: string; description?: string; categories?: string; tags?: string; downloadRoles?: string }) => {
      const uploadParams: Record<string, string> = {};
      if (params?.category) uploadParams.category = params.category;
      if (params?.description) uploadParams.description = params.description;
      if (params?.categories) uploadParams.categories = params.categories;
      if (params?.tags) uploadParams.tags = params.tags;
      if (params?.downloadRoles) uploadParams.downloadRoles = params.downloadRoles;
      return uploadFile('/materials/upload', file, uploadParams);
    },
    update: (id: number, data: any) =>
      request<any>(`/materials/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/materials/${id}`, { method: 'DELETE' }),
    download: (id: number) => downloadFile(id),
    getCategories: () => request<string[]>('/materials/meta/categories'),
    getTags: () => request<string[]>('/materials/meta/tags'),
  },
  search: {
    query: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),
    advanced: (params: {
      q?: string;
      modules?: string[];
      dateFrom?: string;
      dateTo?: string;
      dateField?: string;
      tags?: string[];
      sortBy?: string;
      sortOrder?: string;
      groupByModule?: boolean;
    }) => {
      const searchParams = new URLSearchParams();
      if (params.q) searchParams.set('q', params.q);
      if (params.modules && params.modules.length > 0) searchParams.set('modules', params.modules.join(','));
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params.dateField) searchParams.set('dateField', params.dateField);
      if (params.tags && params.tags.length > 0) searchParams.set('tags', params.tags.join(','));
      if (params.sortBy) searchParams.set('sortBy', params.sortBy);
      if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
      if (params.groupByModule !== undefined) searchParams.set('groupByModule', String(params.groupByModule));
      const q = searchParams.toString();
      return request<any>(`/search${q ? '?' + q : ''}`);
    },
    getTags: () => request<string[]>('/search/meta/tags'),
  },
  reminders: {
    summary: () => request<any>('/reminders/summary'),
    todayTasks: () => request<any[]>('/reminders/today-tasks'),
    unreadCount: () => request<{ count: number }>('/reminders/unread-count'),
    upcoming: (days?: number) => {
      const params = days ? `?days=${days}` : '';
      return request<any[]>(`/reminders/upcoming${params}`);
    },
    list: (params?: { status?: string; type?: string; limit?: number; offset?: number }) => {
      const searchParams = new URLSearchParams();
      if (params?.status) searchParams.set('status', params.status);
      if (params?.type) searchParams.set('type', params.type);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const q = searchParams.toString();
      return request<{ items: any[]; total: number }>(`/reminders${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/reminders/${id}`),
    markAsRead: (id: number) => request<any>(`/reminders/${id}/read`, { method: 'PUT' }),
    markAllAsRead: () => request<any>('/reminders/read-all', { method: 'PUT' }),
    dismiss: (id: number) => request<any>(`/reminders/${id}/dismiss`, { method: 'PUT' }),
    create: (data: any) =>
      request<any>('/reminders', { method: 'POST', body: JSON.stringify(data) }),
    configs: {
      list: () => request<any[]>('/reminders/configs'),
      get: (id: number) => request<any>(`/reminders/configs/${id}`),
      create: (data: any) =>
        request<any>('/reminders/configs', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: number, data: any) =>
        request<any>(`/reminders/configs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: number) =>
        request<any>(`/reminders/configs/${id}`, { method: 'DELETE' }),
    },
    generateDaily: () => request<any>('/reminders/generate-daily', { method: 'POST' }),
    initDefaults: () => request<any>('/reminders/init-defaults', { method: 'POST' }),
  },
  leaves: {
    list: (params?: { actorId?: number; status?: string; roleId?: number; startDate?: string; endDate?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.actorId) searchParams.set('actorId', String(params.actorId));
      if (params?.status) searchParams.set('status', params.status);
      if (params?.roleId) searchParams.set('roleId', String(params.roleId));
      if (params?.startDate) searchParams.set('startDate', params.startDate);
      if (params?.endDate) searchParams.set('endDate', params.endDate);
      const q = searchParams.toString();
      return request<any[]>(`/leaves${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/leaves/${id}`),
    create: (data: any) =>
      request<any>('/leaves', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/leaves/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/leaves/${id}`, { method: 'DELETE' }),
    approve: (id: number, substituteActorId?: number) =>
      request<any>(`/leaves/${id}/approve`, { method: 'POST', body: JSON.stringify({ substituteActorId }) }),
    reject: (id: number, rejectionReason: string) =>
      request<any>(`/leaves/${id}/reject`, { method: 'POST', body: JSON.stringify({ rejectionReason }) }),
    statistics: () => request<any>('/leaves/statistics'),
  },
};
