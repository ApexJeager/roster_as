import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { seedFirestoreIfEmpty } from './firebase-seeder';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where,
  orderBy
} from 'firebase/firestore';
import { UserProfile, AppSettings, Astronaute, Session, Report, Grade, Promotion, Score, AuditLog } from '../types';

// Standard helper to generate a Firestore collection snapshot array
async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  try {
    const snapshot = await getDocs(collection(db, collectionName));
    const list: T[] = [];
    snapshot.forEach((d) => {
      list.push({ ...d.data(), id: d.id } as any);
    });
    return list;
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes('permission') || error?.code === 'permission-denied') {
      handleFirestoreError(error, OperationType.GET, collectionName);
    }
    throw error;
  }
}

export const api = {
  // Auth & Profiles
  login: async (profile_id: string, pin: string): Promise<{ profile: UserProfile; token: string }> => {
    // Check local PIN against db
    let profileDoc;
    try {
      profileDoc = await getDoc(doc(db, 'profiles', profile_id));
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('permission') || error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, `profiles/${profile_id}`);
      }
      throw error;
    }
    if (!profileDoc.exists()) {
      throw new Error('Profil non trouvé.');
    }
    const profile = profileDoc.data() as UserProfile;
    if (profile.pin !== pin) {
      throw new Error('Code PIN incorrect.');
    }
    // Return mock session token matching standard server response
    const token = 'pin_token_' + Date.now();
    return { profile, token };
  },

  getCurrentUser: async (): Promise<UserProfile | null> => {
    // In Firebase context, if a user is logged in via Auth, fetch their profile
    const firebaseUser = auth.currentUser;
    if (firebaseUser?.email) {
      try {
        const q = query(collection(db, 'profiles'), where('email', '==', firebaseUser.email));
        const res = await getDocs(q);
        if (!res.empty) {
          return { ...res.docs[0].data(), id: res.docs[0].id } as UserProfile;
        }
      } catch (error: any) {
        if (error?.message?.toLowerCase().includes('permission') || error?.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.GET, 'profiles');
        }
        throw error;
      }
    }
    return null;
  },

  getProfiles: () => fetchCollection<UserProfile>('profiles'),

  // App settings
  getAppSettings: async (): Promise<AppSettings> => {
    try {
      const docSnap = await getDoc(doc(db, 'app_settings', 'global'));
      if (docSnap.exists()) {
        return docSnap.data() as AppSettings;
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('permission') || error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.GET, 'app_settings/global');
      }
      throw error;
    }
    return { summer_pause: false, correction_window_hours: 48 };
  },

  updateAppSettings: async (settingsOrSummerPause: any, correction_window_hours_arg?: number, reason_arg?: string, actor_id_arg?: string): Promise<any> => {
    let summer_pause = false;
    let correction_window_hours = 48;
    let reason = 'Mise à jour des paramètres système';
    let actor_id = '';

    if (settingsOrSummerPause && typeof settingsOrSummerPause === 'object') {
      summer_pause = !!settingsOrSummerPause.summer_pause;
      correction_window_hours = settingsOrSummerPause.correction_window_hours ?? 48;
      reason = settingsOrSummerPause.reason || reason;
      actor_id = settingsOrSummerPause.actor_id || '';
    } else {
      summer_pause = !!settingsOrSummerPause;
      if (typeof correction_window_hours_arg === 'number') correction_window_hours = correction_window_hours_arg;
      if (reason_arg) reason = reason_arg;
      if (actor_id_arg) actor_id = actor_id_arg;
    }

    try {
      const ref = doc(db, 'app_settings', 'global');
      await setDoc(ref, {
        summer_pause,
        correction_window_hours
      }, { merge: true });

      // Handle audit log write inside firestore directly
      if (actor_id) {
        const newLogRef = doc(collection(db, 'audit_logs'));
        await setDoc(newLogRef, {
          id: newLogRef.id,
          actor_id: actor_id,
          action: 'UPDATE_SETTINGS',
          target_table: 'app_settings',
          target_id: 'global',
          old_value: {},
          new_value: { summer_pause, correction_window_hours },
          reason: reason,
          created_at: new Date().toISOString()
        });
      }
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('permission') || error?.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.WRITE, 'app_settings/global');
      }
      throw error;
    }
    return { success: true };
  },

  // Astronautes / Recruits
  getAstronautes: () => fetchCollection<Astronaute>('astronautes'),

  createAstronaute: async (data: {
    first_name: string;
    last_name: string;
    birthdate: string;
    classe: string;
    groupe: string;
    legacy_source?: string;
  }): Promise<Astronaute> => {
    const newId = 'ast_' + Date.now();
    const newAst: Astronaute = {
      id: newId,
      first_name: data.first_name,
      last_name: data.last_name,
      birthdate: data.birthdate,
      classe: data.classe as any,
      groupe: data.groupe as any,
      status: 'recrue',
      grand_total: 0,
      legacy_source: data.legacy_source || null,
      created_at: new Date().toISOString()
    };

    // Save student profile
    await setDoc(doc(db, 'astronautes', newId), newAst);

    // Save corresponding default onboarding milestone
    await setDoc(doc(db, 'onboarding', newId), {
      astronaute_id: newId,
      fridays_done: false,
      devise: false,
      verset_officiel: false,
      livres_nt: false,
      completed_at: null
    });

    return newAst;
  },

  updateOnboarding: async (astronauteId: string, dataOrField: any, valueIfSingleField?: boolean): Promise<any> => {
    const ref = doc(db, 'onboarding', astronauteId);
    
    // Read current data to merge
    const snap = await getDoc(ref);
    let currentData = {
      fridays_done: false,
      devise: false,
      verset_officiel: false,
      livres_nt: false
    };
    if (snap.exists()) {
      currentData = { ...currentData, ...snap.data() };
    }

    let finalData = { ...currentData };
    if (typeof dataOrField === 'string') {
      (finalData as any)[dataOrField] = !!valueIfSingleField;
    } else {
      finalData = { ...finalData, ...dataOrField };
    }

    // Evaluate if onboarding is completed
    const allFinished = finalData.fridays_done && finalData.devise && finalData.verset_officiel && finalData.livres_nt;
    const completed_at = allFinished ? new Date().toISOString() : null;

    const updatedOnboarding = {
      ...finalData,
      astronaute_id: astronauteId,
      completed_at
    };

    await setDoc(ref, updatedOnboarding, { merge: true });

    // Update status mapping
    const astRef = doc(db, 'astronautes', astronauteId);
    await updateDoc(astRef, {
      status: allFinished ? 'astronaute_actif' : 'recrue'
    });

    const astSnap = await getDoc(astRef);
    const astObj = astSnap.exists() ? astSnap.data() as Astronaute : null;
    
    let celebrated = false;
    if (astObj && astObj.status === 'astronaute_actif' && (!snap.exists() || !snap.data().completed_at)) {
      celebrated = true;
    }

    return { success: true, celebrated, astronaute: astObj };
  },

  // Rank / Grades & Promotions
  getGrades: () => fetchCollection<Grade>('grades'),
  getPromotions: () => fetchCollection<Promotion>('promotions'),

  validatePromotion: async (dataOrAstronauteId: any, gradeId?: string, actorId?: string): Promise<Promotion> => {
    let astronaute_id = '';
    let grade_id = '';
    let actor_id = 'system';

    if (dataOrAstronauteId && typeof dataOrAstronauteId === 'object') {
      astronaute_id = dataOrAstronauteId.astronaute_id;
      grade_id = dataOrAstronauteId.grade_id;
      actor_id = dataOrAstronauteId.actor_id || actor_id;
    } else {
      astronaute_id = dataOrAstronauteId;
      grade_id = gradeId || '';
      actor_id = actorId || actor_id;
    }

    const newId = 'prom_' + Date.now();
    const newPromotion: Promotion = {
      id: newId,
      astronaute_id,
      grade_id,
      validated_by: actor_id,
      validated_at: new Date().toISOString()
    };

    await setDoc(doc(db, 'promotions', newId), newPromotion);
    return newPromotion;
  },

  // Weekly Sessions & Pointage
  getSessions: () => fetchCollection<Session>('sessions'),

  createSession: async (dataOrSessionDate: any, classe_arg?: string, groupe_arg?: string, actor_id_arg?: string): Promise<Session> => {
    let session_date = '';
    let classe = '';
    let groupe = '';
    let actor_id = 'system';

    if (dataOrSessionDate && typeof dataOrSessionDate === 'object') {
      session_date = dataOrSessionDate.session_date;
      classe = dataOrSessionDate.classe;
      groupe = dataOrSessionDate.groupe;
      actor_id = dataOrSessionDate.actor_id || actor_id;
    } else {
      session_date = dataOrSessionDate;
      classe = classe_arg || '';
      groupe = groupe_arg || '';
      actor_id = actor_id_arg || actor_id;
    }

    const newId = 'sess_' + Date.now();
    const newSession: Session = {
      id: newId,
      session_date,
      classe: classe as any,
      groupe: groupe as any,
      locked_at: null,
      created_by: actor_id
    };

    await setDoc(doc(db, 'sessions', newId), newSession);
    return newSession;
  },

  getScores: () => fetchCollection<Score>('scores'),

  saveScore: async (
    dataOrSessionId: any,
    astronaute_id_arg?: string,
    presence_arg?: boolean,
    ponctuel_arg?: boolean,
    bible_arg?: boolean,
    verset_arg?: boolean,
    proprete_arg?: boolean,
    echarpe_arg?: boolean,
    conduite_arg?: boolean,
    visiteurs_arg?: number,
    override_reason_arg?: string,
    actor_id_arg?: string,
    score_id_arg?: string,
    is_historical_override_arg?: boolean
  ): Promise<Score> => {
    let session_id = '';
    let astronaute_id = '';
    let presence = false;
    let ponctuel = false;
    let bible = false;
    let verset = false;
    let proprete = false;
    let echarpe = false;
    let conduite = false;
    let visiteurs = 0;
    let override_reason = '';
    let actor_id = '';
    let score_id = '';

    if (dataOrSessionId && typeof dataOrSessionId === 'object') {
      session_id = dataOrSessionId.session_id;
      astronaute_id = dataOrSessionId.astronaute_id;
      presence = !!dataOrSessionId.presence;
      ponctuel = !!dataOrSessionId.ponctuel;
      bible = !!dataOrSessionId.bible;
      verset = !!dataOrSessionId.verset;
      proprete = !!dataOrSessionId.proprete;
      echarpe = !!dataOrSessionId.echarpe;
      conduite = !!dataOrSessionId.conduite;
      visiteurs = dataOrSessionId.visiteurs || dataOrSessionId.visiteur || 0;
      override_reason = dataOrSessionId.override_reason || '';
      actor_id = dataOrSessionId.actor_id || '';
      score_id = dataOrSessionId.score_id || '';
    } else {
      session_id = dataOrSessionId;
      astronaute_id = astronaute_id_arg || '';
      presence = !!presence_arg;
      ponctuel = !!ponctuel_arg;
      bible = !!bible_arg;
      verset = !!verset_arg;
      proprete = !!proprete_arg;
      echarpe = !!echarpe_arg;
      conduite = !!conduite_arg;
      visiteurs = visiteurs_arg || 0;
      override_reason = override_reason_arg || '';
      actor_id = actor_id_arg || '';
      score_id = score_id_arg || '';
    }

    // Calcul de points standard
    let scoreVal = 0;
    if (presence) scoreVal += 30;
    if (ponctuel) scoreVal += 40;
    if (bible) scoreVal += 50;
    if (verset) scoreVal += 40;
    if (proprete) scoreVal += 30;
    if (echarpe) scoreVal += 20;
    if (conduite) scoreVal += 40;
    scoreVal += (visiteurs || 0) * 25;

    const finalId = score_id || 'sc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const scoreObj: Score = {
      id: finalId,
      session_id,
      astronaute_id,
      presence,
      ponctuel,
      bible,
      verset,
      proprete,
      echarpe,
      conduite,
      visiteurs,
      total_jour: scoreVal
    };

    // Save score
    await setDoc(doc(db, 'scores', finalId), scoreObj);

    // Dynamic Recalculation loop of the grand total for this Astronaute (durable integrity)
    const allScores = await fetchCollection<Score>('scores');
    const childScores = allScores.filter(s => s.astronaute_id === astronaute_id);
    const sumTotalParts = childScores.reduce((sum, s) => sum + s.total_jour, 0);

    await updateDoc(doc(db, 'astronautes', astronaute_id), {
      grand_total: sumTotalParts
    });

    // Write audit log if overridden
    if (override_reason && actor_id) {
      const logId = 'log_' + Date.now();
      await setDoc(doc(db, 'audit_logs', logId), {
        id: logId,
        actor_id: actor_id,
        action: 'HISTORICAL_OVERRIDE',
        target_table: 'scores',
        target_id: finalId,
        old_value: {},
        new_value: scoreObj,
        reason: override_reason,
        created_at: new Date().toISOString()
      });
    }

    return scoreObj;
  },

  // Cabin Lesson Reports submission
  getReports: () => fetchCollection<Report>('reports'),

  submitReport: async (
    dataOrSessionId: any,
    notes_lesson_arg?: string,
    notes_observations_arg?: string,
    notes_discipline_arg?: string,
    actor_id_arg?: string
  ): Promise<Report> => {
    let session_id = '';
    let notes_lesson = '';
    let notes_observations = '';
    let notes_discipline = '';
    let actor_id = 'system';

    if (dataOrSessionId && typeof dataOrSessionId === 'object') {
      session_id = dataOrSessionId.session_id;
      notes_lesson = dataOrSessionId.notes_lesson;
      notes_observations = dataOrSessionId.notes_observations;
      notes_discipline = dataOrSessionId.notes_discipline || '';
      actor_id = dataOrSessionId.actor_id || actor_id;
    } else {
      session_id = dataOrSessionId;
      notes_lesson = notes_lesson_arg || '';
      notes_observations = notes_observations_arg || '';
      notes_discipline = notes_discipline_arg || '';
      actor_id = actor_id_arg || actor_id;
    }

    const q = query(collection(db, 'reports'), where('session_id', '==', session_id));
    const querySnap = await getDocs(q);
    
    let reportId = 'rep_' + Date.now();
    let existingReport: Report | null = null;
    
    if (!querySnap.empty) {
      reportId = querySnap.docs[0].id;
      existingReport = querySnap.docs[0].data() as Report;
    }

    const reportObj: Report = {
      id: reportId,
      session_id,
      notes_lesson,
      notes_observations,
      notes_discipline,
      status: 'en_attente',
      submitted_by: actor_id,
      reviewed_by: existingReport?.reviewed_by || null,
      reviewed_at: existingReport?.reviewed_at || null
    };

    await setDoc(doc(db, 'reports', reportId), reportObj);

    // Geler / Lock the session
    await updateDoc(doc(db, 'sessions', session_id), {
      locked_at: new Date().toISOString()
    });

    return reportObj;
  },

  archiveReport: async (id: string, actorId?: string): Promise<any> => {
    const ref = doc(db, 'reports', id);
    await updateDoc(ref, {
      status: 'archive',
      reviewed_by: actorId || 'system',
      reviewed_at: new Date().toISOString()
    });
    return { success: true };
  },

  requestCorrection: async (id: string, leader_note: string, actorId?: string): Promise<any> => {
    const reportRef = doc(db, 'reports', id);
    await updateDoc(reportRef, {
      status: 'correction_demandee',
      leader_note,
      reviewed_by: actorId || 'system',
      reviewed_at: new Date().toISOString()
    });

    // Unlocking corresponding session so Pilot can edit scores again
    const docSnap = await getDoc(reportRef);
    if (docSnap.exists()) {
      const repData = docSnap.data() as Report;
      await updateDoc(doc(db, 'sessions', repData.session_id), {
        locked_at: null
      });
    }

    return { success: true };
  },

  runClassMigration: async (
    dataOrTargetClass: any,
    promote_to_class_arg?: string,
    confirm_arg?: boolean,
    candidate_ids_arg?: string[],
    actor_id_arg?: string,
    reason_arg?: string
  ): Promise<any> => {
    let target_class = '';
    let promote_to_class = '';
    let confirm = false;
    let candidate_ids: string[] = [];
    let actor_id = 'system';
    let reason = 'Migration de classe début de saison';

    if (dataOrTargetClass && typeof dataOrTargetClass === 'object') {
      target_class = dataOrTargetClass.target_class;
      promote_to_class = dataOrTargetClass.promote_to_class;
      confirm = !!dataOrTargetClass.confirm;
      candidate_ids = dataOrTargetClass.candidate_ids || [];
      actor_id = dataOrTargetClass.actor_id || actor_id;
      reason = dataOrTargetClass.reason || reason;
    } else {
      target_class = dataOrTargetClass;
      promote_to_class = promote_to_class_arg || '';
      confirm = !!confirm_arg;
      candidate_ids = candidate_ids_arg || [];
      actor_id = actor_id_arg || actor_id;
      reason = reason_arg || reason;
    }

    // Standard class migration
    const snapshotObj = await getDocs(collection(db, 'astronautes'));
    const list: Astronaute[] = [];
    snapshotObj.forEach((doc) => {
      const ast = doc.data() as Astronaute;
      if (candidate_ids.includes(ast.id) && ast.classe === target_class) {
        list.push(ast);
      }
    });

    if (!confirm) {
      return {
        candidates: list,
        preview_text: `Prêt à migrer ${list.length} enfants de la classe [${target_class}] vers la classe [${promote_to_class}].`,
      };
    }

    // Apply real movement in database
    for (const ast of list) {
      await updateDoc(doc(db, 'astronautes', ast.id), {
        classe: promote_to_class
      });
    }

    // Add Audit Log
    if (actor_id) {
      const logId = 'log_migration_' + Date.now();
      await setDoc(doc(db, 'audit_logs', logId), {
        id: logId,
        actor_id: actor_id,
        action: 'CLASS_MIGRATION',
        target_table: 'astronautes',
        target_id: 'macro',
        old_value: { target_class: target_class },
        new_value: { promote_to_class, candidates: candidate_ids },
        reason: reason,
        created_at: new Date().toISOString()
      });
    }

    return { success: true, processed_count: list.length };
  },

  updateAssignment: async (
    dataOrProfileId: any,
    classe_arg?: string | null,
    groupe_arg?: string | null,
    can_enter_data_arg?: boolean
  ): Promise<any> => {
    let profile_id = '';
    let classe: string | null = null;
    let groupe: string | null = null;
    let can_enter_data = true;

    if (dataOrProfileId && typeof dataOrProfileId === 'object') {
      profile_id = dataOrProfileId.profile_id;
      classe = dataOrProfileId.classe;
      groupe = dataOrProfileId.groupe;
      can_enter_data = typeof dataOrProfileId.can_enter_data === 'boolean' ? dataOrProfileId.can_enter_data : true;
    } else {
      profile_id = dataOrProfileId;
      classe = classe_arg || null;
      groupe = groupe_arg || null;
      can_enter_data = typeof can_enter_data_arg === 'boolean' ? can_enter_data_arg : true;
    }

    const ref = doc(db, 'profiles', profile_id);
    await updateDoc(ref, {
      assignment: classe && groupe ? { classe, groupe } : null,
      can_enter_data
    });
    return { success: true };
  },

  createProfile: async (data: {
    email: string;
    full_name: string;
    role: any;
    classe: string | null;
    groupe: string | null;
    pin: string;
    can_enter_data: boolean;
  }): Promise<UserProfile> => {
    const qExists = query(collection(db, 'profiles'), where('email', '==', data.email.trim()));
    const snapExists = await getDocs(qExists);
    if (!snapExists.empty) {
      throw new Error(`L'adresse email "${data.email}" est déjà enregistrée pour un autre membre du personnel.`);
    }

    const newId = 'prof_' + Date.now();
    const newProfile: UserProfile = {
      id: newId,
      email: data.email.trim(),
      full_name: data.full_name.trim(),
      role: data.role,
      can_enter_data: data.can_enter_data,
      pin: data.pin.trim() || '0000',
      assignment: data.classe && data.groupe ? { classe: data.classe as any, groupe: data.groupe as any } : null
    };

    await setDoc(doc(db, 'profiles', newId), newProfile);
    return newProfile;
  },

  resetDb: async (): Promise<any> => {
    // For safety, clear collections. Since users like to seed, let's re-run seeder inside seeder!
    await seedFirestoreIfEmpty();
    return { success: true };
  },

  updatePin: async (dataOrProfileId: any, pin_arg?: string): Promise<any> => {
    let profile_id = '';
    let pin = '';

    if (dataOrProfileId && typeof dataOrProfileId === 'object') {
      profile_id = dataOrProfileId.profile_id;
      pin = dataOrProfileId.pin;
    } else {
      profile_id = dataOrProfileId;
      pin = pin_arg || '';
    }

    const ref = doc(db, 'profiles', profile_id);
    await updateDoc(ref, {
      pin
    });
    return { success: true };
  },

  getAuditLogs: () => fetchCollection<AuditLog>('audit_logs'),

  // --- GEMINI SERVERSIDE ASSIST APIs ---
  getPilotLessonHelper: async (prompt: {
    lesson_keywords: string;
    observations_keywords: string;
    discipline_keywords: string;
  }): Promise<{ notes_lesson: string; notes_observations: string; notes_discipline: string }> => {
    const res = await fetch('/api/gemini/pilot-helper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompt)
    });
    if (!res.ok) throw new Error("Impossible de générer le rapport intelligent via Gemini.");
    return res.json();
  },

  getLeaderDashboardBriefing: async (data: {
    reports: Report[];
    astronautes: Astronaute[];
  }): Promise<{ briefingHtml: string }> => {
    const res = await fetch('/api/gemini/leader-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Impossible de générer le briefing de commandement.");
    return res.json();
  }
};
