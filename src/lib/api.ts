import { getSessionToken } from './session';

async function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['x-session-token'] = token;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(url, config);
  
  if (!response.ok) {
    let errorMsg = `Server error: ${response.statusText}`;
    try {
      const errJson = await response.json();
      errorMsg = errJson.error || errorMsg;
    } catch {}
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  login: (profile_id: string, pin: string) =>
    request<{ profile: any; token: string }>('/api/login', 'POST', { profile_id, pin }),

  // Read collections
  getCurrentUser: () => request<any>('/api/session/current-user'),
  getProfiles: () => request<any[]>('/api/profiles'),
  getAppSettings: () => request<any>('/api/app-settings'),
  getAstronautes: () => request<any[]>('/api/astronautes'),
  getGrades: () => request<any[]>('/api/grades'),
  getPromotions: () => request<any[]>('/api/promotions'),
  getSessions: () => request<any[]>('/api/sessions'),
  getReports: () => request<any[]>('/api/reports'),
  getScores: () => request<any[]>('/api/scores'),
  getAuditLogs: () => request<any[]>('/api/audit-logs'),

  // Write collections
  updateAppSettings: (settings: { summer_pause: boolean; correction_window_hours: number }) =>
    request<any>('/api/app-settings', 'POST', settings),
  
  createAstronaute: (data: {
    first_name: string;
    last_name: string;
    birthdate: string;
    classe: string;
    groupe: string;
    legacy_source?: string;
  }) => request<any>('/api/astronautes', 'POST', data),

  updateOnboarding: (astronauteId: string, checkpointId: string, done: boolean) =>
    request<any>(`/api/astronautes/${astronauteId}/onboarding`, 'POST', { checkpoint_id: checkpointId, done }),

  validatePromotion: (astronauteId: string, gradeId: string) =>
    request<any>('/api/promotions/validate', 'POST', { astronaute_id: astronauteId, grade_id: gradeId }),

  createSession: (data: { session_date: string; classe: string; groupe: string }) =>
    request<any>('/api/sessions', 'POST', data),

  saveScore: (data: {
    session_id: string;
    astronaute_id: string;
    presence: boolean;
    ponctuel: boolean;
    bible: boolean;
    verset: boolean;
    proprete: boolean;
    echarpe: boolean;
    conduite: boolean;
    visiteurs: number;
    is_historical_override?: boolean;
    override_reason?: string;
  }) => request<any>('/api/scores', 'POST', data),

  submitReport: (data: {
    session_id: string;
    notes_lesson: string;
    notes_observations: string;
    notes_discipline: string;
  }) => request<any>('/api/reports', 'POST', data),

  archiveReport: (id: string) => request<any>(`/api/reports/${id}/review`, 'POST'),

  requestCorrection: (id: string, leader_note: string) =>
    request<any>(`/api/reports/${id}/correction`, 'POST', { leader_note }),

  runClassMigration: (target_class: string, promote_to_class: string, confirm: boolean, candidate_ids: string[], reason: string) =>
    request<any>('/api/class-migration', 'POST', { target_class, promote_to_class, confirm, candidate_ids, reason }),

  updateAssignment: (data: { profile_id: string; classe: string | null; groupe: string | null; can_enter_data?: boolean }) =>
    request<any>('/api/assignments', 'POST', data),

  resetDb: () => request<any>('/api/admin/reset-db', 'POST'),

  updatePin: (profile_id: string, pin: string) =>
    request<any>('/api/admin/update-pin', 'POST', { profile_id, pin })
};
