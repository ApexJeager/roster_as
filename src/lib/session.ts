import { UserProfile } from '../types';

export interface RASession {
  profile: UserProfile;
  token: string;
}

export const getSessionToken = (): string | null => {
  try {
    const raw = localStorage.getItem('ra_session');
    if (raw) {
      const parsed = JSON.parse(raw) as RASession;
      return parsed.token || null;
    }
  } catch {}
  return null;
};

export const getSessionProfile = (): UserProfile | null => {
  try {
    const raw = localStorage.getItem('ra_session');
    if (raw) {
      const parsed = JSON.parse(raw) as RASession;
      return parsed.profile || null;
    }
  } catch {}
  return null;
};

export const saveSession = (profile: UserProfile, token: string) => {
  const session: RASession = { profile, token };
  localStorage.setItem('ra_session', JSON.stringify(session));
};

export const clearSession = () => {
  localStorage.removeItem('ra_session');
};
