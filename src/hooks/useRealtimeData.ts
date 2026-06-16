import { useState, useEffect } from 'react';
import { onSnapshot, collection, doc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion, Score, AuditLog } from '../types';

export function useRealtimeUsers() {
  const [data, setData] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'profiles'),
      (snap) => {
        if (!active) return;
        const list: UserProfile[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as UserProfile);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeUsers onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { users: data, loading, error };
}

export function useRealtimeAstronautes() {
  const [data, setData] = useState<Astronaute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'astronautes'),
      (snap) => {
        if (!active) return;
        const list: Astronaute[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Astronaute);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeAstronautes onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { astronautes: data, loading, error };
}

export function useRealtimeSessions() {
  const [data, setData] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'sessions'),
      (snap) => {
        if (!active) return;
        const list: Session[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Session);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeSessions onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { sessions: data, loading, error };
}

export function useRealtimeReports() {
  const [data, setData] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'reports'),
      (snap) => {
        if (!active) return;
        const list: Report[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Report);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeReports onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { reports: data, loading, error };
}

export function useRealtimeGrades() {
  const [data, setData] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'grades'),
      (snap) => {
        if (!active) return;
        const list: Grade[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Grade);
        });
        list.sort((a, b) => a.sort_order - b.sort_order);
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeGrades onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { grades: data, loading, error };
}

export function useRealtimePromotions() {
  const [data, setData] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'promotions'),
      (snap) => {
        if (!active) return;
        const list: Promotion[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Promotion);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimePromotions onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { promotions: data, loading, error };
}

export function useRealtimeScores() {
  const [data, setData] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'scores'),
      (snap) => {
        if (!active) return;
        const list: Score[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Score);
        });
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeScores onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { scores: data, loading, error };
}

export function useRealtimeAppSettings() {
  const [data, setData] = useState<AppSettings>({ summer_pause: false, correction_window_hours: 48 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      doc(db, 'app_settings', 'global'),
      (docSnap) => {
        if (!active) return;
        if (docSnap.exists()) {
          setData(docSnap.data() as AppSettings);
        }
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeAppSettings onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { appSettings: data, loading, error };
}

export function useRealtimeAuditLogs() {
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let active = true;
    const unsub = onSnapshot(
      collection(db, 'audit_logs'),
      (snap) => {
        if (!active) return;
        const list: AuditLog[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as AuditLog);
        });
        list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setData(list);
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeAuditLogs onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return { auditLogs: data, loading, error };
}
