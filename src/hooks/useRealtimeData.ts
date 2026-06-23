import { useState, useEffect } from 'react';
import { onSnapshot, collection, doc, query, where, DocumentData } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, AppSettings, Astronaute, Onboarding, Session, Report, Grade, Promotion, Score, AuditLog } from '../types';

export function useRealtimeUsers(currentUser: UserProfile | null) {
  const [data, setData] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { users: data, loading, error };
}

export function useRealtimeAstronautes(currentUser: UserProfile | null) {
  const [data, setData] = useState<Astronaute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    let rawAstros: Astronaute[] = [];
    let rawOnboardings: Record<string, Onboarding> = {};

    const checkAndSet = () => {
      if (!active) return;
      const merged = rawAstros.map(ast => ({
        ...ast,
        onboarding: rawOnboardings[ast.id] || {
          astronaute_id: ast.id,
          fridays_done: false,
          devise: false,
          verset_officiel: false,
          livres_nt: false,
          completed_at: null
        }
      }));
      setData(merged);
    };

    const unsubAstros = onSnapshot(
      collection(db, 'astronautes'),
      (snap) => {
        if (!active) return;
        const list: Astronaute[] = [];
        snap.forEach((d) => {
          list.push({ ...d.data(), id: d.id } as Astronaute);
        });
        rawAstros = list;
        checkAndSet();
        setLoading(false);
      },
      (err) => {
        if (!active) return;
        console.error('Error in useRealtimeAstronautes onSnapshot:', err);
        setError(err);
        setLoading(false);
      }
    );

    const unsubOnboard = onSnapshot(
      collection(db, 'onboarding'),
      (snap) => {
        if (!active) return;
        const dict: Record<string, Onboarding> = {};
        snap.forEach((d) => {
          dict[d.id] = { ...d.data(), astronaute_id: d.id } as Onboarding;
        });
        rawOnboardings = dict;
        checkAndSet();
      },
      (err) => {
        console.error('Error in useRealtimeOnboarding onSnapshot:', err);
      }
    );

    return () => {
      active = false;
      unsubAstros();
      unsubOnboard();
    };
  }, [currentUser]);

  return { astronautes: data, loading, error };
}

export function useRealtimeSessions(currentUser: UserProfile | null) {
  const [data, setData] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { sessions: data, loading, error };
}

export function useRealtimeReports(currentUser: UserProfile | null) {
  const [data, setData] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { reports: data, loading, error };
}

export function useRealtimeGrades(currentUser: UserProfile | null) {
  const [data, setData] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { grades: data, loading, error };
}

export function useRealtimePromotions(currentUser: UserProfile | null) {
  const [data, setData] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { promotions: data, loading, error };
}

export function useRealtimeScores(currentUser: UserProfile | null) {
  const [data, setData] = useState<Score[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { scores: data, loading, error };
}

export function useRealtimeAppSettings(currentUser: UserProfile | null) {
  const [data, setData] = useState<AppSettings>({ summer_pause: false, correction_window_hours: 48 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { appSettings: data, loading, error };
}

export function useRealtimeAuditLogs(currentUser: UserProfile | null) {
  const [data, setData] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
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
  }, [currentUser]);

  return { auditLogs: data, loading, error };
}

