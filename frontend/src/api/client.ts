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
    remove: (id: number) => request<any>(`/users/${id}`, { method: 'DELETE' }),
  },
  rehearsals: {
    list: (start?: string, end?: string) => {
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const q = params.toString();
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
    list: (category?: string) => {
      const params = category ? `?category=${category}` : '';
      return request<any[]>(`/materials${params}`);
    },
    get: (id: number) => request<any>(`/materials/${id}`),
    upload: (file: File, category?: string, description?: string) =>
      uploadFile('/materials/upload', file, { category: category || 'general', description: description || '' }),
    remove: (id: number) => request<any>(`/materials/${id}`, { method: 'DELETE' }),
    download: (id: number) => downloadFile(id),
  },
  search: {
    query: (q: string) => request<any>(`/search?q=${encodeURIComponent(q)}`),
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
