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
    list: (params?: {
      targetUserId?: number;
      operatorId?: number;
      action?: string;
      module?: string;
      targetType?: string;
      keyword?: string;
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.targetUserId) searchParams.set('targetUserId', String(params.targetUserId));
      if (params?.operatorId) searchParams.set('operatorId', String(params.operatorId));
      if (params?.action) searchParams.set('action', params.action);
      if (params?.module) searchParams.set('module', params.module);
      if (params?.targetType) searchParams.set('targetType', params.targetType);
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params?.limit) searchParams.set('limit', String(params.limit));
      if (params?.offset) searchParams.set('offset', String(params.offset));
      const q = searchParams.toString();
      return request<any>(`/audit-logs${q ? '?' + q : ''}`);
    },
    meta: () => request<any>('/audit-logs/meta'),
    get: (id: number) => request<any>(`/audit-logs/${id}`),
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
    getRoleAssignments: (id: number) => request<any[]>(`/rehearsals/${id}/roles`),
    checkConflicts: (data: { startTime: string; endTime: string; participantIds?: number[]; excludeId?: number; location?: string }) =>
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
    getLastWeekSchedule: () =>
      request<any[]>('/rehearsals/last-week/schedule'),
    copyToNextWeek: (id: number) =>
      request<any>(`/rehearsals/${id}/copy-to-next-week`, { method: 'POST' }),
    copyLastWeekAll: () =>
      request<any>('/rehearsals/copy-last-week-all', { method: 'POST' }),
  },
  roles: {
    list: () => request<any[]>('/roles'),
    get: (id: number) => request<any>(`/roles/${id}`),
    getRehearsals: (id: number) => request<any[]>(`/roles/${id}/rehearsals`),
    create: (data: any) =>
      request<any>('/roles', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/roles/${id}`, { method: 'DELETE' }),
    addSubstitute: (roleId: number, actorId: number) =>
      request<any>(`/roles/${roleId}/substitutes`, { method: 'POST', body: JSON.stringify({ actorId }) }),
    removeSubstitute: (roleId: number, actorId: number) =>
      request<any>(`/roles/${roleId}/substitutes/${actorId}`, { method: 'DELETE' }),
    updatePriorities: (updates: Array<{ id: number; priority: number }>) =>
      request<any[]>('/roles/priorities/batch', { method: 'PUT', body: JSON.stringify({ updates }) }),
  },
  annotations: {
    list: (scene?: string) => {
      const params = scene ? `?scene=${scene}` : '';
      return request<any[]>(`/annotations${params}`);
    },
    listGroupedByScene: (search?: string) => {
      const params = search ? `?search=${encodeURIComponent(search)}` : '';
      return request<any>(`/annotations/grouped/by-scene${params}`);
    },
    get: (id: number) => request<any>(`/annotations/${id}`),
    getTags: () => request<{ name: string; color: string | null }[]>('/annotations/meta/tags'),
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
    checkDuplicate: (filename: string) =>
      request<{ exists: boolean; materials: any[] }>(`/materials/check-duplicate?filename=${encodeURIComponent(filename)}`),
    upload: (file: File, params?: { category?: string; description?: string; categories?: string; tags?: string; downloadRoles?: string; onDuplicate?: 'new_version' | 'overwrite'; overwriteTargetId?: number }) => {
      const uploadParams: Record<string, string> = {};
      if (params?.category) uploadParams.category = params.category;
      if (params?.description) uploadParams.description = params.description;
      if (params?.categories) uploadParams.categories = params.categories;
      if (params?.tags) uploadParams.tags = params.tags;
      if (params?.downloadRoles) uploadParams.downloadRoles = params.downloadRoles;
      if (params?.onDuplicate) uploadParams.onDuplicate = params.onDuplicate;
      if (params?.overwriteTargetId) uploadParams.overwriteTargetId = String(params.overwriteTargetId);
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
    getTags: () => request<{ name: string; color: string | null }[]>('/search/meta/tags'),
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
  dashboard: {
    overview: () => request<any>('/dashboard/overview'),
  },
  reports: {
    getReports: (params?: {
      dateFrom?: string;
      dateTo?: string;
      actorId?: number;
      scriptId?: number;
      materialCategory?: string;
      annotationTag?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.dateFrom) searchParams.set('dateFrom', params.dateFrom);
      if (params?.dateTo) searchParams.set('dateTo', params.dateTo);
      if (params?.actorId) searchParams.set('actorId', String(params.actorId));
      if (params?.scriptId) searchParams.set('scriptId', String(params.scriptId));
      if (params?.materialCategory) searchParams.set('materialCategory', params.materialCategory);
      if (params?.annotationTag) searchParams.set('annotationTag', params.annotationTag);
      const q = searchParams.toString();
      return request<any>(`/reports${q ? '?' + q : ''}`);
    },
    getFilterOptions: () => request<any>('/reports/filter-options'),
  },
  performances: {
    list: (params?: {
      start?: string;
      end?: string;
      venue?: string;
      theater?: string;
      status?: string;
      roleId?: string;
      keyword?: string;
      tags?: string;
    }) => {
      const searchParams = new URLSearchParams();
      if (params?.start) searchParams.set('start', params.start);
      if (params?.end) searchParams.set('end', params.end);
      if (params?.venue) searchParams.set('venue', params.venue);
      if (params?.theater) searchParams.set('theater', params.theater);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.roleId) searchParams.set('roleId', params.roleId);
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      if (params?.tags) searchParams.set('tags', params.tags);
      const q = searchParams.toString();
      return request<any[]>(`/performances${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/performances/${id}`),
    getRoles: (id: number) => request<any[]>(`/performances/${id}/roles`),
    getMaterials: (id: number) => request<any[]>(`/performances/${id}/materials`),
    listByDateRange: (start: string, end: string) =>
      request<any[]>(`/performances/date-range?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
    checkConflicts: (data: { startTime: string; endTime: string; excludeId?: number; venue?: string; theater?: string }) =>
      request<any>('/performances/check-conflicts', { method: 'POST', body: JSON.stringify(data) }),
    create: (data: any) =>
      request<any>('/performances', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/performances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    updateStatus: (id: number, status: string) =>
      request<any>(`/performances/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    remove: (id: number) => request<any>(`/performances/${id}`, { method: 'DELETE' }),
    bindRole: (performanceId: number, roleId: number, castAssignment?: any) =>
      request<any>(`/performances/${performanceId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ roleId, castAssignment }),
      }),
    unbindRole: (performanceId: number, roleId: number) =>
      request<any>(`/performances/${performanceId}/roles/${roleId}`, { method: 'DELETE' }),
    updateRoleCast: (performanceId: number, roleId: number, castAssignment: any) =>
      request<any>(`/performances/${performanceId}/roles/${roleId}/cast`, {
        method: 'PUT',
        body: JSON.stringify(castAssignment),
      }),
    bindMaterial: (performanceId: number, materialId: number) =>
      request<any>(`/performances/${performanceId}/materials`, {
        method: 'POST',
        body: JSON.stringify({ materialId }),
      }),
    unbindMaterial: (performanceId: number, materialId: number) =>
      request<any>(`/performances/${performanceId}/materials/${materialId}`, { method: 'DELETE' }),
    getTags: () => request<string[]>('/performances/meta/tags'),
    getVenues: () => request<string[]>('/performances/meta/venues'),
    getTheaters: () => request<string[]>('/performances/meta/theaters'),
  },
  scripts: {
    list: (params?: { keyword?: string; status?: string; tags?: string; author?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.keyword) searchParams.set('keyword', params.keyword);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.tags) searchParams.set('tags', params.tags);
      if (params?.author) searchParams.set('author', params.author);
      const q = searchParams.toString();
      return request<any[]>(`/scripts${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/scripts/${id}`),
    getStructure: (id: number) => request<any>(`/scripts/${id}/structure`),
    search: (q: string, scriptId?: number) => {
      const params = new URLSearchParams({ q });
      if (scriptId) params.set('scriptId', String(scriptId));
      return request<any[]>(`/scripts/search?${params.toString()}`);
    },
    getTags: () => request<string[]>('/scripts/tags'),
    getAuthors: () => request<string[]>('/scripts/authors'),
    getCharacterNames: (scriptId?: number) => {
      const params = new URLSearchParams();
      if (scriptId) params.set('scriptId', String(scriptId));
      const q = params.toString();
      return request<string[]>(`/scripts/characters${q ? '?' + q : ''}`);
    },
    create: (data: {
      title: string;
      originalTitle?: string;
      author?: string;
      translator?: string;
      description?: string;
      synopsis?: string;
      genre?: string[];
      estimatedDuration?: number;
      rawContent: string;
      parsedContent?: string;
      tags?: string[];
      chapters?: any[];
      scenes?: any[];
    }) => request<any>('/scripts', { method: 'POST', body: JSON.stringify(data) }),
    uploadScript: (data: {
      title: string;
      content: string;
      fileName?: string;
      mimeType?: string;
      fileSize?: number;
      format?: string;
      author?: string;
      description?: string;
      autoParse?: boolean;
    }) => request<any>('/scripts/upload', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: {
      title?: string;
      originalTitle?: string;
      author?: string;
      translator?: string;
      description?: string;
      synopsis?: string;
      genre?: string[];
      estimatedDuration?: number;
      status?: string;
      rawContent?: string;
      parsedContent?: string;
      tags?: string[];
      characterNames?: string[];
      changeNote?: string;
    }) => request<any>(`/scripts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/scripts/${id}`, { method: 'DELETE' }),
    publish: (id: number) => request<any>(`/scripts/${id}/publish`, { method: 'POST' }),
    archive: (id: number) => request<any>(`/scripts/${id}/archive`, { method: 'POST' }),
    reparse: (id: number) => request<any>(`/scripts/${id}/reparse`, { method: 'POST' }),
    getChapter: (scriptId: number, chapterId: number) =>
      request<any>(`/scripts/${scriptId}/chapters/${chapterId}`),
    updateChapter: (scriptId: number, chapterId: number, data: any) =>
      request<any>(`/scripts/${scriptId}/chapters/${chapterId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getChapterAnnotations: (scriptId: number, chapterId: number) =>
      request<any[]>(`/scripts/${scriptId}/chapters/${chapterId}/annotations`),
    getScene: (scriptId: number, sceneId: number) =>
      request<any>(`/scripts/${scriptId}/scenes/${sceneId}`),
    updateScene: (scriptId: number, sceneId: number, data: any) =>
      request<any>(`/scripts/${scriptId}/scenes/${sceneId}`, { method: 'PUT', body: JSON.stringify(data) }),
    getSceneAnnotations: (scriptId: number, sceneId: number) =>
      request<any[]>(`/scripts/${scriptId}/scenes/${sceneId}/annotations`),
    getAnnotations: (scriptId: number) =>
      request<any[]>(`/scripts/${scriptId}/annotations`),
    getAnnotationsGrouped: (scriptId: number) =>
      request<any[]>(`/scripts/${scriptId}/annotations/grouped`),
    getVersions: (scriptId: number) =>
      request<any[]>(`/scripts/${scriptId}/versions`),
    getVersion: (scriptId: number, versionId: number) =>
      request<any>(`/scripts/${scriptId}/versions/${versionId}`),
    restoreVersion: (scriptId: number, versionId: number) =>
      request<any>(`/scripts/${scriptId}/versions/${versionId}/restore`, { method: 'POST' }),
  },
  dramas: {
    list: (status?: string) => {
      const q = status ? `?status=${status}` : '';
      return request<any[]>(`/dramas${q}`);
    },
    search: (q: string) => request<any[]>(`/dramas/search?q=${encodeURIComponent(q)}`),
    get: (id: number) => request<any>(`/dramas/${id}`),
    getStats: (id: number) => request<any>(`/dramas/${id}/stats`),
    getPermissions: (id: number) => request<any[]>(`/dramas/${id}/permissions`),
    create: (data: {
      title: string;
      description?: string;
      synopsis?: string;
      genres?: string[];
      premiereDate?: string;
      finalDate?: string;
      venue?: string;
      status?: string;
      tags?: string[];
    }) => request<any>('/dramas', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: any) =>
      request<any>(`/dramas/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/dramas/${id}`, { method: 'DELETE' }),
    grantPermission: (dramaId: number, userId: number, role: string) =>
      request<any>(`/dramas/${dramaId}/permissions`, {
        method: 'POST',
        body: JSON.stringify({ userId, role }),
      }),
    updatePermission: (dramaId: number, userId: number, role: string) =>
      request<any>(`/dramas/${dramaId}/permissions/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      }),
    revokePermission: (dramaId: number, userId: number) =>
      request<any>(`/dramas/${dramaId}/permissions/${userId}`, { method: 'DELETE' }),
  },
  tags: {
    list: (params?: { dramaId?: number; category?: string }) => {
      const searchParams = new URLSearchParams();
      if (params?.dramaId) searchParams.set('dramaId', String(params.dramaId));
      if (params?.category) searchParams.set('category', params.category);
      const q = searchParams.toString();
      return request<any[]>(`/tags${q ? '?' + q : ''}`);
    },
    get: (id: number) => request<any>(`/tags/detail/${id}`),
    create: (data: { name: string; color?: string; categories?: string[]; dramaId?: number }) =>
      request<any>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ name: string; color: string; categories: string[] }>) =>
      request<any>(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: number) => request<any>(`/tags/${id}`, { method: 'DELETE' }),
    attach: (data: { tagIds: number[]; targetType: string; targetId: number; dramaId?: number }) =>
      request<any>('/tags/attach', { method: 'POST', body: JSON.stringify(data) }),
    batchAttach: (data: { items: Array<{ tagIds: number[]; targetType: string; targetId: number }>; dramaId?: number }) =>
      request<any>('/tags/batch-attach', { method: 'POST', body: JSON.stringify(data) }),
    detach: (data: { tagId: number; targetType: string; targetId: number }) =>
      request<any>('/tags/detach', { method: 'DELETE', body: JSON.stringify(data) }),
    getTagsForTarget: (targetType: string, targetId: number) =>
      request<any[]>(`/tags/${targetType}/${targetId}`),
    getTargetsForTag: (tagId: number, targetType?: string) => {
      const params = targetType ? `?targetType=${targetType}` : '';
      return request<any[]>(`/tags/targets/${tagId}${params}`);
    },
    filterByTags: (tagIds: number[], targetType: string, dramaId?: number) => {
      const searchParams = new URLSearchParams();
      searchParams.set('tagIds', tagIds.join(','));
      searchParams.set('targetType', targetType);
      if (dramaId) searchParams.set('dramaId', String(dramaId));
      const q = searchParams.toString();
      return request<{ targetType: string; targetIds: number[] }>(`/tags/filter?${q}`);
    },
    getStatistics: (dramaId?: number) => {
      const params = dramaId ? `?dramaId=${dramaId}` : '';
      return request<any>(`/tags/statistics${params}`);
    },
  },
};
