/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  UserProfile,
  Astronaute,
  Onboarding,
  Session,
  Score,
  Grade,
  Promotion,
  Report,
  AppSettings,
  AuditLog,
  ClasseType,
  GroupeType
} from './types';
import GroupBadge from './components/GroupBadge';
import EligibilityBadge from './components/EligibilityBadge';
import ScoreChecklist from './components/ScoreChecklist';
import RankTrack from './components/RankTrack';
import CelebrationOverlay from './components/CelebrationOverlay';
import { exportToCSV, exportRosterPDF, exportSessionScoresPDF } from './lib/exports';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Shield,
  BookOpen,
  Award,
  Settings,
  BarChart3,
  Calendar,
  Plus,
  ArrowRightLeft,
  RefreshCw,
  Bell,
  Trash2,
  FileSpreadsheet,
  FileDown,
  Lock,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  Send,
  Sliders,
  LogOut,
  Sparkles,
  HelpCircle,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  Legend
} from 'recharts';

type TabType = 'equipage' | 'onboarding' | 'pointage' | 'promotions' | 'rapports' | 'analytics' | 'admin' | 'parametres';

export default function App() {
  // Global application states
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({ summer_pause: false, correction_window_hours: 48 });
  const [astronautes, setAstronautes] = useState<Astronaute[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [scores, setScores] = useState<Score[]>([]);

  // Navigation & view states
  const [activeTab, setActiveTab] = useState<TabType>('equipage');
  const [selectedAstronauteId, setSelectedAstronauteId] = useState<string | null>(null);
  const [astronauteDetails, setAstronauteDetails] = useState<{
    astronaute: Astronaute;
    onboarding: Onboarding;
    promotions: Promotion[];
    scores: Score[];
  } | null>(null);

  // Filter/Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Active scoring session states
  const [selectedSessionDate, setSelectedSessionDate] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionScores, setSessionScores] = useState<Score[]>([]);

  // Memoized dynamic computations for selected session and RLS helper variables
  const activeCategoryRoster = useMemo<Astronaute[]>(() => {
    if (!selectedSession) return [];
    return astronautes.filter(a =>
      a.classe === selectedSession.classe &&
      a.groupe === selectedSession.groupe &&
      a.status === 'astronaute_actif'
    );
  }, [selectedSession, astronautes]);

  const selectedAstronaute = useMemo<Astronaute | null>(() => {
    return astronautes.find(a => a.id === selectedAstronauteId) || null;
  }, [selectedAstronauteId, astronautes]);

  const isHistoricalOverrideRequired = useMemo<boolean>(() => {
    if (!selectedSession) return false;
    const createdAtMs = selectedSession.locked_at ? new Date(selectedSession.locked_at).getTime() : new Date(selectedSession.session_date).getTime();
    const ageHrs = (Date.now() - createdAtMs) / (1000 * 60 * 60);
    return ageHrs > appSettings.correction_window_hours;
  }, [selectedSession, appSettings]);

  // Promotion manual validation states
  const [selectedGradeToValidate, setSelectedGradeToValidate] = useState<{ astId: string; gradeId: string } | null>(null);

  // Class migration macro tool states
  const [migrationTargetClass, setMigrationTargetClass] = useState<ClasseType>('Pionniers');
  const [migrationPromoteTo, setMigrationPromoteTo] = useState<ClasseType>('Explorateurs');
  const [migrationCandidates, setMigrationCandidates] = useState<Astronaute[]>([]);
  const [migrationCandidateIds, setMigrationCandidateIds] = useState<string[]>([]);
  const [migrationPreviewData, setMigrationPreviewData] = useState<any>(null);
  const [migrationReason, setMigrationReason] = useState("Migration de fin d'année de promotion");

  // Historic override trigger states
  const [overrideTargetScore, setOverrideTargetScore] = useState<Score | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  // Celebration state triggers
  const [celebration, setCelebration] = useState<{
    visible: boolean;
    title: string;
    subtitle: string;
    badgeText?: string;
  }>({ visible: false, title: '', subtitle: '' });

  // Creation dialog forms
  const [isAddingAstronaute, setIsAddingAstronaute] = useState(false);
  const [newAstForm, setNewAstForm] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    classe: 'Pionniers' as ClasseType,
    groupe: 'Jaune' as GroupeType,
    legacy_source: ''
  });

  // Weekly qualitative lesson reports drafts
  const [reportSessionId, setReportSessionId] = useState<string>('');
  const [reportLesson, setReportLesson] = useState('');
  const [reportObs, setReportObs] = useState('');
  const [reportDisc, setReportDisc] = useState('');

  // Toast / alert state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'danger' | 'info' } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load user assignments & permissions on load or switcher values
  const [selectedTestingUserId, setSelectedTestingUserId] = useState<string>('dev_user');

  const showToast = (message: string, type: 'success' | 'danger' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Main global API loader
  const loadGlobalData = async (userHeaderId: string) => {
    try {
      const headers = { 'x-user-id': userHeaderId, 'Content-Type': 'application/json' };
      
      // Concurrently load static and dynamic modules
      const [
        userRes,
        profilesRes,
        settingsRes,
        astRes,
        gradesRes,
        promRes,
        sessRes,
        repRes,
        logsRes,
        scoresRes
      ] = await Promise.all([
        fetch('/api/session/current-user', { headers }),
        fetch('/api/profiles', { headers }),
        fetch('/api/app-settings', { headers }),
        fetch('/api/astronautes', { headers }),
        fetch('/api/grades', { headers }),
        fetch('/api/promotions', { headers }),
        fetch('/api/sessions', { headers }),
        fetch('/api/reports', { headers }),
        fetch('/api/audit-logs', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/scores', { headers })
      ]);

      if (!userRes.ok || !profilesRes.ok || !settingsRes.ok || !astRes.ok || !scoresRes.ok) {
        throw new Error('Erreur lors de la récupération des données.');
      }

      setCurrentUser(await userRes.json());
      setAllProfiles(await profilesRes.json());
      setAppSettings(await settingsRes.json());
      setAstronautes(await astRes.json());
      setGrades(await gradesRes.json());
      setPromotions(await promRes.json());
      setSessions(await sessRes.json());
      setReports(await repRes.json());
      setAuditLogs(logsRes);
      setScores(await scoresRes.json());
      
      setIsLoaded(true);
    } catch (err: any) {
      showToast(err.message || 'Une erreur est survenue lors de l\'initialisation.', 'danger');
    }
  };

  useEffect(() => {
    loadGlobalData(selectedTestingUserId);
  }, [selectedTestingUserId]);

  // Fetch individual profiles
  const fetchAstronauteDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/astronautes/${id}`, {
        headers: { 'x-user-id': selectedTestingUserId }
      });
      if (!res.ok) throw new Error('Profil introuvable');
      const payload = await res.json();
      setAstronauteDetails(payload);
      setSelectedAstronauteId(id);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Change user testing simulator core
  const handleSwitchUser = (userId: string) => {
    setSelectedTestingUserId(userId);
    setSelectedAstronauteId(null);
    setAstronauteDetails(null);
    setSelectedSession(null);
    showToast(`Simulation activée pour : ${userId}`, 'info');
  };

  // Save score tap matrix ( optimistically update lists )
  const handleSaveScore = async (updatedScoreFields: Partial<Score>) => {
    if (appSettings.summer_pause && currentUser?.role !== 'developer') {
      showToast("La pause d'été est active. Pointage impossible.", "danger");
      throw new Error("Lock d'été");
    }

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({
          session_id: selectedSession?.id,
          override_reason: overrideReason,
          ...updatedScoreFields
        })
      });

      if (!res.ok) {
        const errPayload = await res.json();
        throw new Error(errPayload.error || 'Erreur lors de la sauvegarde du score');
      }

      const savedScore = await res.json();
      
      // Update session scores list
      setSessionScores(prev => prev.map(s => s.astronaute_id === savedScore.astronaute_id ? savedScore : s));
      
      // Refresh local copy of astronauts to reflect modified grand_total instantly!
      const astRes = await fetch('/api/astronautes', { headers: { 'x-user-id': selectedTestingUserId } });
      if (astRes.ok) {
        setAstronautes(await astRes.json());
      }

      // If active profile displayed matches
      if (selectedAstronauteId === savedScore.astronaute_id) {
        fetchAstronauteDetails(savedScore.astronaute_id);
      }

      // Clear override target modal
      setOverrideTargetScore(null);
      setOverrideReason('');
    } catch (err: any) {
      showToast(err.message, 'danger');
      throw err;
    }
  };

  // Handle onboarding gateway toggle
  const handleSaveOnboarding = async (
    astId: string,
    field: 'fridays_done' | 'devise' | 'verset_officiel' | 'livres_nt',
    currentVal: boolean
  ) => {
    try {
      const payload = { [field]: !currentVal };
      const res = await fetch(`/api/astronautes/${astId}/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const payloadErr = await res.json();
        throw new Error(payloadErr.error || 'Impossible de sauvegarder.');
      }

      const data = await res.json();
      
      // Refresh list
      const astRes = await fetch('/api/astronautes', { headers: { 'x-user-id': selectedTestingUserId } });
      if (astRes.ok) {
        setAstronautes(await astRes.json());
      }

      if (selectedAstronauteId === astId) {
        fetchAstronauteDetails(astId);
      }

      // If celebrated (became pilot from recruit!) (C3)
      if (data.celebrated) {
        setCelebration({
          visible: true,
          title: `Félicitations, Nouvelle Recrue Activée !`,
          subtitle: `Le profil de ${data.astronaute.first_name} ${data.astronaute.last_name} est déverrouillé. Il/Elle peut officiellement accumuler ses scores d\'équipage.`,
          badgeText: `Astronaute Actif`
        });
      } else {
        showToast("Onboarding mis à jour !");
      }
    } catch (e: any) {
      showToast(e.message, 'danger');
    }
  };

  // Validate eligible rank (C5)
  const handleValidatePromotion = async (astId: string, gradeId: string) => {
    try {
      const res = await fetch('/api/promotions/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({ astronaute_id: astId, grade_id: gradeId })
      });

      if (!res.ok) {
        const errPay = await res.json();
        throw new Error(errPay.error || 'Erreur lors de la validation.');
      }

      const freshProm = await res.json();
      setPromotions(prev => [...prev, freshProm]);

      const matchedGrade = grades.find(g => g.id === gradeId);
      const matchedAst = astronautes.find(a => a.id === astId);

      // Play rocket promotion celebration
      setCelebration({
        visible: true,
        title: `Nouveau Grade Décroché !`,
        subtitle: `${matchedAst?.first_name} ${matchedAst?.last_name} est promu avec succès au rang de soldat d'élite !`,
        badgeText: matchedGrade?.name || 'Gradé'
      });

      // Refresh particulars
      if (selectedAstronauteId === astId) {
        fetchAstronauteDetails(astId);
      }

      setSelectedGradeToValidate(null);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Class migration cohort list loader
  useEffect(() => {
    if (activeTab === 'admin') {
      const candidates = astronautes.filter(a => a.classe === migrationTargetClass);
      setMigrationCandidates(candidates);
      setMigrationCandidateIds(candidates.map(c => c.id));
    }
  }, [migrationTargetClass, astronautes, activeTab]);

  const handleMigrationPreview = async () => {
    try {
      const res = await fetch('/api/class-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({
          target_class: migrationTargetClass,
          promote_to_class: migrationPromoteTo,
          confirm: false,
          candidate_ids: migrationCandidateIds
        })
      });
      if (!res.ok) throw new Error('Erreur de preview.');
      const pay = await res.json();
      setMigrationPreviewData(pay);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  const handleMigrationConfirm = async () => {
    try {
      const res = await fetch('/api/class-migration', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({
          target_class: migrationTargetClass,
          promote_to_class: migrationPromoteTo,
          confirm: true,
          candidate_ids: migrationCandidateIds,
          reason: migrationReason
        })
      });

      if (!res.ok) {
        const payErr = await res.json();
        throw new Error(payErr.error || 'Erreur migration.');
      }

      const payload = await res.json();
      showToast(payload.message, 'success');
      setMigrationPreviewData(null);
      
      // Reload all
      loadGlobalData(selectedTestingUserId);
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Submit weekly report (notes metrics)
  const handleSubmitReport = async () => {
    if (!reportSessionId) {
      showToast('Sélectionnez d\'abord la séance.', 'danger');
      return;
    }
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({
          session_id: reportSessionId,
          notes_lesson: reportLesson,
          notes_observations: reportObs,
          notes_discipline: reportDisc
        })
      });

      if (!res.ok) {
        throw new Error('Impossible de soumettre le rapport d\'activité.');
      }

      const freshRep = await res.json();
      setReports(prev => {
        const unchanged = prev.filter(r => r.session_id !== reportSessionId);
        return [...unchanged, freshRep];
      });

      // Update local session lock time
      const lockSess = sessions.find(s => s.id === reportSessionId);
      if (lockSess) {
        lockSess.locked_at = new Date().toISOString();
      }

      showToast('Rapport d\'activité soumis avec succès en attente de validation.', 'success');
      setReportLesson('');
      setReportObs('');
      setReportDisc('');
      setReportSessionId('');
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Archive review by Leaders
  const handleReviewReport = async (repId: string) => {
    try {
      const res = await fetch(`/api/reports/${repId}/review`, {
        method: 'POST',
        headers: { 'x-user-id': selectedTestingUserId }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Erreur lors de l\'archivage.');
      }
      const updated = await res.json();
      setReports(prev => prev.map(r => r.id === repId ? updated : r));
      showToast('Compte-rendu validé et archivé définitivement.', 'success');
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Developer Assignments Switcher
  const handleUpdateInstructorAssignment = async (profileId: string, classe: any, groupe: any, canEnterVal: boolean) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify({
          profile_id: profileId,
          classe,
          groupe,
          can_enter_data: canEnterVal
        })
      });
      if (!res.ok) throw new Error('Impossible de modifier l\'affectation.');
      
      const updatedProfile = await res.json();
      setAllProfiles(prev => prev.map(p => p.id === profileId ? updatedProfile : p));
      showToast('Affectation instructeur modifiée.', 'success');
    } catch (e: any) {
      showToast(e.message, 'danger');
    }
  };

  // Update System Settings (Pause d'été, etc.)
  const handleUpdateSettings = async (field: 'summer_pause' | 'correction_window_hours', value: any) => {
    try {
      const payload = {
        [field]: value,
        reason: field === 'summer_pause' ? (value ? "Activation de la pause d'été d'inactivité" : "Fin de la saison d'été, reprise de pointage") : "Ajustement du délai pilote d'édition"
      };
      
      const res = await fetch('/api/app-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Action système verrouillée.');
      const freshSet = await res.json();
      setAppSettings(freshSet);
      showToast('Paramètre mis à jour avec journalisation !', 'success');

      // Refresh logs
      const logsRes = await fetch('/api/audit-logs', { headers: { 'x-user-id': selectedTestingUserId } });
      if (logsRes.ok) {
         setAuditLogs(await logsRes.json());
      }
    } catch (err: any) {
      showToast(err.message, 'danger');
    }
  };

  // Reset database entirely for testing check
  const handleResetDB = async () => {
    if (!window.confirm('Voulez-vous restaurer les 12 recrues/astronautes et sessions témoins ?')) return;
    try {
      const res = await fetch('/api/admin/reset-db', {
        method: 'POST',
        headers: { 'x-user-id': selectedTestingUserId }
      });
      if (res.ok) {
        showToast('Base de démonstration rebâtie à neuf.', 'success');
        setSelectedAstronauteId(null);
        setAstronauteDetails(null);
        setSelectedSession(null);
        loadGlobalData(selectedTestingUserId);
      }
    } catch (e: any) {
      showToast('Erreur réinitialisation.', 'danger');
    }
  };

  // Create customized weekly point sessions (C4)
  const handleCreateSession = async () => {
    if (!selectedSessionDate) {
      showToast('Spécifiez le vendredi de la séance.', 'danger');
      return;
    }
    // Room parameters based on pilot room
    if (currentUser?.role === 'pilote' || currentUser?.role === 'copilote') {
      const r = currentUser.assignment;
      if (!r) {
        showToast('Erreur : Votre compte n\'est lié à aucune cabine d\'âge.', 'danger');
        return;
      }
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': selectedTestingUserId
          },
          body: JSON.stringify({
            session_date: selectedSessionDate,
            classe: r.classe,
            groupe: r.groupe
          })
        });

        if (!res.ok) {
          const bodyEr = await res.json();
          throw new Error(bodyEr.error || 'Erreur création séance');
        }

        const freshSess = await res.json();
        setSessions(prev => {
          if (prev.some(s => s.id === freshSess.id)) return prev;
          return [...prev, freshSess];
        });
        
        setSelectedSession(freshSess);
        showToast('Séance de présence déverrouillée.', 'success');
        
        // Load session score list
        const scRes = await fetch(`/api/scores?session_id=${freshSess.id}`, {
          headers: { 'x-user-id': selectedTestingUserId }
        });
        if (scRes.ok) setSessionScores(await scRes.json());
      } catch (err: any) {
        showToast(err.message, 'danger');
      }
    } else {
      // Dev / Leader creating Session
      if (filterClass === 'all' || filterGroup === 'all') {
        showToast('Sélectionnez d\'abord une Classe + un Groupe de destination.', 'danger');
        return;
      }
      try {
        const res = await fetch('/api/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': selectedTestingUserId
          },
          body: JSON.stringify({
            session_date: selectedSessionDate,
            classe: filterClass as ClasseType,
            groupe: filterGroup as GroupeType
          })
        });

        if (!res.ok) {
          const bodyEr = await res.json();
          throw new Error(bodyEr.error || 'Erreur');
        }

        const freshSess = await res.json();
        setSessions(prev => {
          if (prev.some(s => s.id === freshSess.id)) return prev;
          return [...prev, freshSess];
        });
        setSelectedSession(freshSess);
        showToast('Séance déverrouillée.', 'success');

        const scRes = await fetch(`/api/scores?session_id=${freshSess.id}`, {
          headers: { 'x-user-id': selectedTestingUserId }
        });
        if (scRes.ok) setSessionScores(await scRes.json());
      } catch (err: any) {
        showToast(err.message, 'danger');
      }
    }
  };

  // Create new Recruit form submission
  const handleCreateAstronauteSubmit = async () => {
    try {
      const res = await fetch('/api/astronautes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': selectedTestingUserId
        },
        body: JSON.stringify(newAstForm)
      });

      if (!res.ok) {
        const payloadErr = await res.json();
        throw new Error(payloadErr.error || 'Erreur lors de la création.');
      }

      const cleanAst = await res.json();
      setAstronautes(prev => [...prev, cleanAst]);
      
      showToast(`Recrue ${cleanAst.first_name} enregistrée avec succès. Onboarding requis !`);
      setIsAddingAstronaute(false);
      setNewAstForm({
        first_name: '',
        last_name: '',
        birthdate: '',
        classe: (currentUser?.assignment?.classe || 'Pionniers') as ClasseType,
        groupe: (currentUser?.assignment?.groupe || 'Jaune') as GroupeType,
        legacy_source: ''
      });
    } catch (e: any) {
      showToast(e.message, 'danger');
    }
  };

  // Trigger historical scores list reload when selecting session
  const selectSessionToScoringBoard = async (sess: Session) => {
    setSelectedSession(sess);
    try {
      const scRes = await fetch(`/api/scores?session_id=${sess.id}`, {
        headers: { 'x-user-id': selectedTestingUserId }
      });
      if (scRes.ok) {
        setSessionScores(await scRes.json());
      }
    } catch (e) {
      showToast('Erreur chargement des pointages.', 'danger');
    }
  };

  // --- Search & Filters (Computations) ---
  const filteredAstronautes = useMemo(() => {
    return astronautes.filter(a => {
      const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
      const matchesSearch = fullName.includes(searchQuery.toLowerCase());
      
      const matchesClass = filterClass === 'all' || a.classe === filterClass;
      const matchesGroup = filterGroup === 'all' || a.groupe === filterGroup;

      return matchesSearch && matchesClass && matchesGroup;
    });
  }, [astronautes, searchQuery, filterClass, filterGroup]);

  // Recruits board (Onboarding view)
  const recruitsList = useMemo(() => {
    return astronautes.filter(a => a.status === 'recrue');
  }, [astronautes]);

  // Active astronauts eligible list (Cross 400, not validated yet)
  const eligiblePromotionsList = useMemo(() => {
    const list: Array<{ ast: Astronaute; eligibleGrades: Grade[] }> = [];
    
    astronautes.filter(a => a.status === 'astronaute_actif').forEach(a => {
      const reached = grades.filter(g => a.grand_total >= g.points_required);
      const validatedIds = new Set(promotions.filter(p => p.astronaute_id === a.id).map(p => p.grade_id));
      const pending = reached.filter(g => !validatedIds.has(g.id));
      
      if (pending.length > 0) {
        list.push({ ast: a, eligibleGrades: pending });
      }
    });

    return list;
  }, [astronautes, grades, promotions]);

  // Leaders weekly stats & trends charts calculations (recharts) (C6)
  const chartWeeklyTrendData = useMemo(() => {
    // Group all scores by session date and summarize average & counts
    const dateGroups: Record<string, { totalPoints: number; attendees: number; punctuals: number; totalBible: number; date: string }> = {};
    
    sessions.forEach(s => {
      if (!dateGroups[s.session_date]) {
         dateGroups[s.session_date] = { totalPoints: 0, attendees: 0, punctuals: 0, totalBible: 0, date: s.session_date };
      }
    });

    scores.forEach(sc => {
      const session = sessions.find(s => s.id === sc.session_id);
      if (session) {
        const grp = dateGroups[session.session_date];
        if (grp) {
          grp.totalPoints += sc.total_jour;
          if (sc.presence) grp.attendees++;
          if (sc.ponctuel) grp.punctuals++;
          if (sc.bible) grp.totalBible++;
        }
      }
    });

    return Object.values(dateGroups).sort((a, b) => a.date.localeCompare(b.date));
  }, [sessions, scores]);

  const groupAveragesData = useMemo(() => {
    const matrix: Record<string, { total: number; count: number; name: string }> = {
      Pionniers: { total: 0, count: 0, name: 'Pionniers (4-6)' },
      Explorateurs: { total: 0, count: 0, name: 'Explorateurs (7-8)' },
      Aventuriers: { total: 0, count: 0, name: 'Aventuriers (9-11)' },
      Aigles: { total: 0, count: 0, name: 'Aigles (12-14)' }
    };

    astronautes.forEach(a => {
      if (matrix[a.classe]) {
         matrix[a.classe].total += a.grand_total;
         matrix[a.classe].count++;
      }
    });

    return Object.values(matrix).map(m => ({
      name: m.name,
      'Moyenne Points': m.count > 0 ? Math.round(m.total / m.count) : 0,
      'Total Membres': m.count
    }));
  }, [astronautes]);

  // Is loading block
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#0B1120] text-slate-100 flex flex-col justify-center items-center gap-4">
        <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
        <p className="text-sm font-display text-slate-400 font-semibold uppercase tracking-widest animate-pulse">
          RAPPORT ASTRONAUTES — GHOST SYSTEMS
        </p>
      </div>
    );
  }

  // Active assigned room labeling
  const roomLabel = currentUser?.assignment
    ? `${currentUser.assignment.classe} (${currentUser.assignment.groupe})`
    : 'Vue globale';

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 font-sans flex flex-col pb-10">
      
      {/* 🛠️ GHOST SYSTEMS SIMULATOR PANEL */}
      <div className="bg-slate-950 border-b border-amber-500/20 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs z-10 sticky top-0 shadow-lg shadow-black/80">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-amber-500" />
          <span className="font-display font-bold text-slate-200">CONSOLE DE TEST DE DROITS (GHOST SYSTEMS)</span>
          <span className="bg-slate-800 text-slate-400 font-mono scale-90 px-1.5 py-0.5 rounded text-[10px]">
            PORT: 3000
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <label htmlFor="user-emulator-select" className="text-[11px] text-slate-400">Prétendre être :</label>
          <select
            id="user-emulator-select"
            value={selectedTestingUserId}
            onChange={(e) => handleSwitchUser(e.target.value)}
            className="bg-slate-900 text-amber-400 border border-slate-700 rounded px-2.5 py-1 text-xs outline-none font-semibold focus:border-amber-500"
          >
            {allProfiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.role.toUpperCase()} {p.assignment ? `— ${p.assignment.classe}` : ''})
              </option>
            ))}
          </select>
          
          <button
            id="btn-developer-db-reset"
            type="button"
            onClick={handleResetDB}
            className="bg-slate-850 hover:bg-slate-800 border border-slate-700/85 px-2.5 py-1 rounded text-[10px] text-slate-300 font-bold flex items-center gap-1 transition-all"
            title="Recalé à zéro les records de test"
          >
            <RefreshCw className="w-3 h-3 text-amber-500" />
            <span>Remettre à neuf</span>
          </button>
        </div>
      </div>

      {/* CORE FRAME LAYOUT */}
      <header className="max-w-7xl w-full mx-auto px-4 pt-6 pb-2 border-b border-slate-900">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-slate-950 font-bold font-mono text-[10px] uppercase px-1.5 py-0.5 rounded shadow">
                ASBF HAÏTI
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
                SÉCURISÉ PAR GHOST SYSTEMS
              </span>
            </div>
            <h1 className="text-3xl font-display font-extrabold text-white tracking-tight flex items-center gap-2">
              <span>RAPPORT ASTRONAUTES</span>
              {appSettings.summer_pause && (
                <span className="scale-75 text-[10px] bg-red-500/10 border border-red-500/40 text-red-500 px-2 py-0.5 rounded font-sans tracking-tight">
                  PAUSE D'ÉTÉ ACTIVE
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm">
              Pupitre opérationnel de pointage, d'onboarding et d'avancement des grades d'enfants.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-950/60 rounded-xl border border-slate-900">
            <div className="px-3 py-1 bg-slate-900 rounded-lg text-xs border border-slate-850">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Compte actif</span>
              <span className="text-amber-400 font-semibold">{currentUser?.full_name}</span>
            </div>
            <div className="px-3 py-1 bg-slate-900 rounded-lg text-xs border border-slate-850">
              <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Unité de pointage</span>
              <span className="text-slate-200 font-semibold">{roomLabel}</span>
            </div>
          </div>
        </div>

        {/* Dynamic French navigation tabs */}
        <nav className="flex flex-wrap items-center gap-1.5 mt-6 border-b border-slate-900/60 pb-1.5 overflow-x-auto">
          {[
            { id: 'equipage', label: 'Équipage (Roster)', icon: Users },
            { id: 'onboarding', label: 'Gateway Recrues', icon: BookOpen, badge: recruitsList.length },
            { id: 'pointage', label: 'Fiche Pointage', icon: Calendar },
            { id: 'promotions', label: 'Milestones & Grades', icon: Award, badge: eligiblePromotionsList.length },
            { id: 'rapports', label: 'Avis & Rapports', icon: FileText },
            { id: 'analytics', label: 'Statistiques', icon: BarChart3, restricted: ['pilote', 'copilote'] },
            { id: 'admin', label: 'Administration', icon: Shield, restricted: ['pilote', 'copilote'] },
            { id: 'parametres', label: 'Configuration', icon: Settings }
          ].map(tab => {
            if (tab.restricted && currentUser && tab.restricted.includes(currentUser.role)) {
              return null;
            }
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                id={`tab-nav-${tab.id}`}
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id as TabType);
                  setSelectedAstronauteId(null);
                  setAstronauteDetails(null);
                }}
                className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.2 rounded-full ${active ? 'bg-slate-950 text-amber-400' : 'bg-red-500/15 text-red-500 border border-red-500/20'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* VIEWPORT CANVAS */}
      <main className="max-w-7xl w-full mx-auto px-4 mt-6 flex-1">
        
        {/* --- TAB 1: EQUIPAGE ROSTER --- */}
        {activeTab === 'equipage' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              {/* Searching, sorting bar */}
              <div className="flex flex-wrap items-center gap-3 flex-1">
                <div className="relative max-w-md w-full bg-slate-950 rounded-lg border border-slate-800">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="search-roster-input"
                    type="text"
                    placeholder="Rechercher un pilote d'élite par nom complet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500/30 font-medium"
                  />
                </div>

                {/* Scoped room selector for development view */}
                {['developer', 'leader'].includes(currentUser?.role || '') && (
                  <div className="flex items-center gap-2">
                    <select
                      id="roster-class-filter"
                      value={filterClass}
                      onChange={(e) => setFilterClass(e.target.value)}
                      className="bg-slate-950 text-xs text-slate-300 border border-slate-800 rounded px-2.5 py-1.5 outline-none font-semibold focus:border-amber-500"
                    >
                      <option value="all">Secteurs classes (Tous)</option>
                      <option value="Pionniers">Pionniers (4-6 ans)</option>
                      <option value="Explorateurs">Explorateurs (7-8 ans)</option>
                      <option value="Aventuriers">Aventuriers (9-11 ans)</option>
                      <option value="Aigles">Aigles (12-14 ans)</option>
                    </select>

                    <select
                      id="roster-group-filter"
                      value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value)}
                      className="bg-slate-950 text-xs text-slate-300 border border-slate-800 rounded px-2.5 py-1.5 outline-none font-semibold focus:border-amber-500"
                    >
                      <option value="all">Équipages couleurs (Tous)</option>
                      <option value="Jaune">Jaune</option>
                      <option value="Bleu">Bleu</option>
                      <option value="Vert">Vert</option>
                      <option value="Rouge">Rouge</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="btn-excel-export"
                  type="button"
                  onClick={() => {
                    const cleanExportSet = filteredAstronautes.map(a => ({
                      ID: a.id,
                      Prenom: a.first_name,
                      Nom: a.last_name,
                      Birthdate: a.birthdate,
                      Classe: a.classe,
                      Groupe: a.groupe,
                      Status: a.status,
                      Grand_Total_Lifetime: a.grand_total,
                      Legacy_Fiche: a.legacy_source || 'Aucun'
                    }));
                    exportToCSV(cleanExportSet, `Equipage_Astronautes_${roomLabel}.csv`);
                    showToast('Fichier Excel CSV exporté avec succès !');
                  }}
                  className="bg-slate-900 border border-slate-800 p-2.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                  title="Exporter la liste sous format tableur CSV"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                  <span className="hidden sm:inline">Roster CSV</span>
                </button>

                <button
                  id="btn-pdf-export"
                  type="button"
                  onClick={() => {
                    exportRosterPDF(filteredAstronautes, roomLabel);
                    showToast('Document PDF du Roster généré !');
                  }}
                  className="bg-slate-900 border border-slate-800 p-2.5 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-95"
                  title="Imprimer une feuille de présence officielle PDF"
                >
                  <FileDown className="w-4 h-4 text-red-400" />
                  <span className="hidden sm:inline">Imprimer Roster</span>
                </button>

                {currentUser && ['developer', 'pilote', 'copilote'].includes(currentUser.role) && (
                  <button
                    id="btn-open-create-ast-modal"
                    type="button"
                    onClick={() => {
                      setIsAddingAstronaute(true);
                      setNewAstForm({
                        first_name: '',
                        last_name: '',
                        birthdate: '',
                        classe: (currentUser?.assignment?.classe || 'Pionniers') as ClasseType,
                        groupe: (currentUser?.assignment?.groupe || 'Jaune') as GroupeType,
                        legacy_source: ''
                      });
                    }}
                    className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-3 py-2.5 rounded-lg flex items-center gap-1.5 text-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nouvelle Recrue</span>
                  </button>
                )}
              </div>
            </div>

            {/* Astronaut roster container (Split layout when child details selected) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className={`space-y-3 lg:col-span-2 ${selectedAstronauteId ? 'hidden md:block' : ''}`}>
                {filteredAstronautes.length === 0 ? (
                  <div className="bg-slate-950 p-12 text-center rounded-2xl border border-slate-900 text-slate-400 font-medium">
                    <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p>Aucun pilote d'élite ne correspond à ces critères.</p>
                    <p className="text-xs text-slate-500 mt-1">Créez une nouvelle fiche d'équipage ou modifiez vos filtres.</p>
                  </div>
                ) : (
                  <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl overflow-hidden shadow-md">
                    <table className="w-full text-left text-xs text-slate-300 min-w-[500px]">
                      <thead className="bg-[#1C2942]/60 text-amber-500 font-bold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-3 pl-4">Nom complet</th>
                          <th className="p-3">Classe</th>
                          <th className="p-3">Groupe</th>
                          <th className="p-3">Statut</th>
                          <th className="p-3 text-right">Grand Total</th>
                          <th className="p-3 text-center">Fiches</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-950">
                        {filteredAstronautes.map(a => {
                          const isActive = a.status === 'astronaute_actif';
                          return (
                            <tr
                              id={`roster-row-${a.id}`}
                              key={a.id}
                              onClick={() => fetchAstronauteDetails(a.id)}
                              className={`hover:bg-slate-900/60 transition-all cursor-pointer ${
                                selectedAstronauteId === a.id ? 'bg-[#1C2942]/40 text-white font-semibold border-l-2 border-amber-500' : ''
                              }`}
                            >
                              <td className="p-3 pl-4 font-bold text-slate-100 flex items-center gap-2 focus:outline-none">
                                <span className="bg-slate-950 p-1 rounded font-mono text-[9px] text-slate-500 w-5 h-5 flex items-center justify-center">
                                  {a.first_name[0]}{a.last_name[0]}
                                </span>
                                <span>{a.first_name} {a.last_name}</span>
                              </td>
                              <td className="p-3">{a.classe}</td>
                              <td className="p-3">
                                <GroupBadge groupe={a.groupe} className="scale-90" />
                              </td>
                              <td className="p-3">
                                {isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                    Actif
                                  </span>
                                ) : a.status === 'recrue' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                    Recrue
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 rounded-full">
                                    Inactif
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right text-amber-400 font-mono font-bold tabular-nums">
                                {a.grand_total} pts
                              </td>
                              <td className="p-3 text-center">
                                <ChevronRight className="w-4 h-4 text-slate-500 mx-auto" />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail Profile Drawer Side panel */}
              <div className="lg:col-span-1">
                {astronauteDetails ? (
                  <div
                    id="astronaute-profile-details"
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5 shadow-2xl relative"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAstronauteId(null);
                        setAstronauteDetails(null);
                      }}
                      className="absolute top-4 right-4 text-xs text-slate-500 hover:text-white cursor-pointer"
                    >
                      Masquer
                    </button>

                    <div className="space-y-1">
                      <div className="bg-amber-400 text-slate-950 font-mono text-[9px] font-extrabold tracking-wider px-2 py-0.5 space-x-1 uppercase inline-block rounded">
                        Roster ID : {astronauteDetails.astronaute.id}
                      </div>
                      <h2 className="text-xl font-display font-bold text-white mt-1">
                        {astronauteDetails.astronaute.first_name} {astronauteDetails.astronaute.last_name}
                      </h2>
                      <p className="text-xs text-slate-400">
                        Date de naissance : {astronauteDetails.astronaute.birthdate}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[#1C2942]/40 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-medium">Classe / Catégorie</span>
                        <span className="font-bold text-slate-200 block mt-0.5">{astronauteDetails.astronaute.classe}</span>
                      </div>
                      <div className="bg-[#1C2942]/40 p-2 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-medium">Échelon d'équipe</span>
                        <div className="mt-0.5">
                          <GroupBadge groupe={astronauteDetails.astronaute.groupe} />
                        </div>
                      </div>
                    </div>

                    {/* Eligibility Alerts Section inside profile panel (C5, step 1) */}
                    <EligibilityBadge
                      grandTotal={astronauteDetails.astronaute.grand_total}
                      promotions={astronauteDetails.promotions}
                      allGrades={grades}
                      canValidate={currentUser ? ['developer', 'pilote', 'copilote'].includes(currentUser.role) : false}
                      onTriggerValidate={(gradeId) => {
                        setSelectedGradeToValidate({ astId: astronauteDetails.astronaute.id, gradeId });
                      }}
                    />

                    {/* Onboarding block checklist summary */}
                    <div className="p-4 bg-slate-950 rounded-xl border border-slate-850">
                      <h3 className="text-xs font-display font-bold text-slate-200 mb-2.5 uppercase tracking-wide flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                        <span>Checklist Onboarding (Ph 1)</span>
                      </h3>
                      <div className="space-y-2 text-xs">
                        {[
                          { key: 'fridays_done' as const, label: '3 Vendredis consécutifs' },
                          { key: 'devise' as const, label: 'Réciter la devise' },
                          { key: 'verset_officiel' as const, label: 'Verset officiel (2 Tim 2:16)' },
                          { key: 'livres_nt' as const, label: 'Tous les livres du NT' }
                        ].map(item => {
                          const state = !!(astronauteDetails.onboarding as any)[item.key];
                          const canEdit = currentUser && ['developer', 'pilote', 'copilote'].includes(currentUser.role);
                          return (
                            <label
                              key={item.key}
                              className={`flex items-center justify-between p-1.5 rounded ${
                                state ? 'bg-emerald-500/5 text-slate-200' : 'bg-slate-900 text-slate-500'
                              }`}
                            >
                              <span>{item.label}</span>
                              <input
                                type="checkbox"
                                checked={state}
                                disabled={!canEdit}
                                onChange={() => handleSaveOnboarding(astronauteDetails.astronaute.id, item.key, state)}
                                className="w-4 h-4 text-amber-500 cursor-pointer disabled:cursor-not-allowed rounded accent-amber-500 outline-none"
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Score lifetime summary & history list */}
                    <RankTrack
                      grandTotal={astronauteDetails.astronaute.grand_total}
                      promotions={astronauteDetails.promotions}
                      allGrades={grades}
                    />

                    <div className="space-y-2">
                      <h3 className="text-xs font-display font-bold text-slate-200 uppercase tracking-wide">
                        Historique des séances ({astronauteDetails.scores.length})
                      </h3>
                      {astronauteDetails.scores.length === 0 ? (
                        <p className="text-[11px] text-slate-500 italic">Aucune séance pointée.</p>
                      ) : (
                        <div className="text-[11px] bg-slate-950 p-2.5 rounded-lg border border-slate-850 space-y-1 max-h-[140px] overflow-y-auto">
                          {astronauteDetails.scores.map(s => {
                            const sess = sessions.find(se => se.id === s.session_id);
                            return (
                              <div key={s.id} className="flex justify-between items-center text-slate-400 hover:text-white py-1">
                                <span>Vendredi, {sess ? sess.session_date : 'Séance révolue'}</span>
                                <span className="font-mono text-amber-400 font-bold">{s.total_jour} pts</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-xl text-center text-slate-500">
                    <Info className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                    <p className="text-xs">Sélectionnez un pilote d'élite à gauche de l'écran pour inspecter son dossier militaire complet, ses avancements de grade et ses certificats requis.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 2: ONBOARDING GATEWAY (C3) --- */}
        {activeTab === 'onboarding' && (
          <div className="space-y-6">
            <div className="bg-amber-400/5 border border-amber-500/25 p-4 rounded-xl text-sm space-y-1.5 text-amber-200">
              <h3 className="font-display font-bold text-white flex items-center gap-1.5">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <span>Porte d'accès Onboarding (Ph 1)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Les recrues ont leurs fiches de points verrouillées. Remplissez les 4 conditions requises pour activer officiellement leur dossier d'accumulateur et déclencher la fusée de célébration Ghost Systems !
              </p>
            </div>

            {recruitsList.length === 0 ? (
              <div className="bg-slate-950 p-12 text-center rounded-xl border border-slate-900 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-slate-200">Zéro recrue en attente</p>
                <p className="text-xs text-slate-500 mt-1">Tous les membres de l'ASBF Astronautes de ce groupe sont de parfaits baptisés ou en statut actif.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {recruitsList.map(rec => {
                  const onb = onboardingRowForAstronaute(rec.id);
                  const canEdit = currentUser && ['developer', 'pilote', 'copilote'].includes(currentUser.role);
                  return (
                    <div key={rec.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                      <div>
                        <h4 className="text-slate-100 font-bold font-display text-sm">
                          {rec.first_name} {rec.last_name}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] bg-slate-950 text-slate-400 px-1.5 py-0.5 rounded">
                            {rec.classe}
                          </span>
                          <GroupBadge groupe={rec.groupe} className="scale-75 origin-left" />
                        </div>
                      </div>

                      <div className="space-y-2.5 text-xs bg-slate-950 p-3 rounded-lg border border-slate-850">
                        {[
                          { key: 'fridays_done' as const, label: '✓ Assister à 3 vendredis d\'affilée' },
                          { key: 'devise' as const, label: '✓ Reciter la devise sacrée' },
                          { key: 'verset_officiel' as const, label: '✓ Réciter 2 Timothée 2:16' },
                          { key: 'livres_nt' as const, label: '✓ Citer les 27 livres du NT' }
                        ].map(crit => {
                          const value = !!(onb as any)[crit.key];
                          return (
                            <button
                              id={`onboarding-crit-btn-${rec.id}-${crit.key}`}
                              key={crit.key}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => handleSaveOnboarding(rec.id, crit.key, value)}
                              className={`w-full flex items-center justify-between p-1.5 rounded transition-all text-left ${
                                value
                                  ? 'bg-emerald-500/10 text-emerald-300 font-medium'
                                  : 'text-slate-500 hover:bg-slate-900'
                              }`}
                            >
                              <span>{crit.label}</span>
                              <span className={`w-2 h-2 rounded-full ${value ? 'bg-emerald-400' : 'bg-slate-800'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 3: DAILY GRADING MATRIX POINTAGE (C4) --- */}
        {activeTab === 'pointage' && (
          <div className="space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-slate-200 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  <span>Gestionnaire de Séances de Présence</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Créez une séance pour un vendredi ou reprenez-en une existante de votre équipe pour y dresser les pointages.
                </p>
              </div>

              {/* Session Picker / Creator controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-850 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 uppercase font-bold pl-1">Sélection Date</span>
                  <input
                    id="session-date-picker"
                    type="date"
                    value={selectedSessionDate}
                    onChange={(e) => setSelectedSessionDate(e.target.value)}
                    className="bg-slate-900 text-xs text-amber-400 font-mono font-bold px-2 py-1 rounded outline-none border border-slate-700 focus:border-amber-500"
                  />
                </div>

                <button
                  id="btn-create-session"
                  type="button"
                  onClick={handleCreateSession}
                  className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold px-3 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-1 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ouvrir la Séance</span>
                </button>
              </div>
            </div>

            {/* Existing sessions board */}
            <div className="space-y-3">
              <h4 className="text-xs font-display font-medium uppercase text-slate-400 tracking-wider">
                Historique des Séances Pointées ({sessions.length})
              </h4>
              {sessions.length === 0 ? (
                <p className="text-xs text-slate-500 italic">Aucune séance pointée.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sessions.map(s => {
                    const isSelected = selectedSession?.id === s.id;
                    const reportOfSess = reports.find(r => r.session_id === s.id);
                    const isArchived = reportOfSess?.status === 'archive';

                    return (
                      <button
                        id={`btn-select-session-${s.id}`}
                        key={s.id}
                        type="button"
                        onClick={() => selectSessionToScoringBoard(s)}
                        className={`text-xs px-3 py-2 rounded-lg border flex items-center gap-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-amber-500 border-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-900/60 border-slate-850 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        <span>Vendredi {s.session_date}</span>
                        {isArchived ? (
                          <span className="bg-emerald-500/20 text-emerald-400 text-[9px] font-mono rounded px-1 ml-1 leading-normal">
                             ARCHIVÉ
                          </span>
                        ) : s.locked_at ? (
                          <span className="bg-blue-500/20 text-blue-400 text-[9px] font-mono rounded px-1 ml-1 leading-normal">
                             VERROU
                          </span>
                        ) : (
                          <span className="bg-amber-400/20 text-amber-400 text-[9px] font-mono rounded px-1 ml-1 leading-normal">
                             OUVERT
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Grading interface if selected */}
            {selectedSession ? (
              <div className="space-y-4">
                <div className="border-b border-slate-900 pb-2">
                  <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                    <span>Pointages du vendredi {selectedSession.session_date}</span>
                    <span className="text-xs font-sans text-slate-500 font-normal">
                      ({selectedSession.classe} — {selectedSession.groupe})
                    </span>
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Scope Students List */}
                  <div className="md:col-span-1 space-y-2">
                    <h4 className="text-xs font-display font-semibold uppercase text-slate-400 tracking-wider">
                      Membres de la Cabine ({activeCategoryRoster.length})
                    </h4>
                    {activeCategoryRoster.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Aucun astronaute actif dans cette pièce.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                        {activeCategoryRoster.map(kid => {
                          const pointsSession = scoreForAstronauteAndSession(kid.id, selectedSession.id);
                          return (
                            <button
                              id={`btn-select-kid-grading-${kid.id}`}
                              key={kid.id}
                              type="button"
                              onClick={() => {
                                setSelectedAstronauteId(kid.id);
                                fetchAstronauteDetails(kid.id);
                              }}
                              className={`w-full text-left p-3 rounded-lg border text-xs flex justify-between items-center transition-all cursor-pointer ${
                                selectedAstronauteId === kid.id
                                  ? 'bg-[#1C2942] border-amber-500 text-white font-bold'
                                  : 'bg-slate-900/60 border-slate-850 text-slate-400 hover:text-white'
                              }`}
                            >
                              <div>
                                <p className="font-semibold text-slate-100">{kid.first_name} {kid.last_name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">Grand total : {kid.grand_total} pts</p>
                              </div>
                              <div className="text-right">
                                <span className="bg-slate-950 px-2 py-1 rounded font-mono text-xs font-bold text-amber-400 tabular-nums">
                                  {pointsSession ? `${pointsSession.total_jour} pts` : '—'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Grading Matrix checklist card for selected child */}
                  <div className="md:col-span-2">
                    {selectedAstronauteId && activeCategoryRoster.some(k => k.id === selectedAstronauteId) ? (
                      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                          <div>
                            <h4 className="font-display font-bold text-white text-base">
                              Saisie de {selectedAstronaute?.first_name} {selectedAstronaute?.last_name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Enregistrement direct au Grand Total à vie.
                            </p>
                          </div>
                          
                          {/* Historical Override trigger (C7-3) */}
                          {isHistoricalOverrideRequired && (
                            <span className="text-[11px] text-red-400 bg-red-950/20 border border-red-500/20 px-2 py-0.5 rounded font-mono font-medium flex items-center gap-1">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Fenêtre Pilote close (Leader requis)</span>
                            </span>
                          )}
                        </div>

                        {/* Determine if we can write */}
                        {isHistoricalOverrideRequired && currentUser?.role !== 'developer' && currentUser?.role !== 'leader' ? (
                          <div className="p-4 bg-slate-950 border border-red-500/10 text-red-500/80 rounded-lg text-xs space-y-1">
                            <h5 className="font-bold text-white flex items-center gap-1.5">
                              <AlertTriangle className="w-4 h-4 text-red-500" />
                              <span>Pointage Verrouillé</span>
                            </h5>
                            <p>
                              La fenêtre autorisée d'édition de {appSettings.correction_window_hours}h est expirée. Contactez le Président Pasteur Jean-Baptiste (Leader) pour autoriser un Audit Log Override.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* If Leader is editing beyond the window hours, open explicit Override Reason field */}
                            {isHistoricalOverrideRequired && (
                              <div className="bg-red-500/5 border border-red-500/20 p-3.5 rounded-lg text-xs space-y-2">
                                <p className="font-bold text-red-300 flex items-center gap-1.5 uppercase tracking-wide">
                                  <AlertTriangle className="w-4 h-4 text-red-400" />
                                  <span>Contrôle d'Audit Historique en cours</span>
                                </p>
                                <p className="text-slate-400 leading-normal">
                                  Cette séance est expirée pour l'instructeur direct. En tant que Leader, vous procédez à un override historique. Une motivation précise est requise pour le journal :
                                </p>
                                <input
                                  id="override-reason-input"
                                  type="text"
                                  placeholder="Ex : Réclamation parents, erreur de saisie du pilote Samuel."
                                  value={overrideReason}
                                  onChange={(e) => setMigrationReason(e.target.value)} // let's share migrationReason or local state
                                  className="w-full bg-slate-950 text-slate-100 placeholder-slate-600 border border-slate-800 rounded px-3 py-1.5 outline-none focus:border-red-500"
                                  onBlur={(e) => setOverrideReason(e.target.value)}
                                />
                              </div>
                            )}

                            <ScoreChecklist
                              score={scoreForAstronauteAndSession(selectedAstronauteId, selectedSession.id) || {
                                session_id: selectedSession.id,
                                astronaute_id: selectedAstronauteId,
                                presence: false,
                                ponctuel: false,
                                bible: false,
                                verset: false,
                                proprete: false,
                                echarpe: false,
                                conduite: false,
                                visiteurs: 0
                              }}
                              onSave={handleSaveScore}
                              disabled={appSettings.summer_pause && currentUser?.role !== 'developer'}
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="bg-slate-900/20 border border-dashed border-slate-800 p-8 rounded-xl text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                        <p className="text-xs">Cliquez sur un astronaute de la cabine pour ouvrir sa matrice de pointage de vendredi.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-slate-950 p-12 text-center rounded-2xl border border-slate-900 text-slate-400">
                <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-2" />
                <p className="font-semibold text-slate-200">Sélectionnez ou créez une séance</p>
                <p className="text-xs text-slate-500 mt-1">Les modifications d'une date affectent instantanément les Grand Totaux de points.</p>
              </div>
            )}
          </div>
        )}

        {/* --- TAB 4: PROMOTIONS & GRADES (C5) --- */}
        {activeTab === 'promotions' && (
          <div className="space-y-6">
            <div className="bg-slate-905 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-display font-semibold text-slate-200 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Validation Militaire des Grades (Ph 2)</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Quand un échelon de points est franchi, l'alerte retentit. Évaluez la récitation du verset de vive voix avant d'apposer votre validation d'officier.
                </p>
              </div>
            </div>

            {eligiblePromotionsList.length === 0 ? (
              <div className="bg-slate-950 p-12 text-center rounded-xl border border-slate-900 text-slate-400">
                <CheckCircle2 className="w-12 h-12 text-slate-700 mx-auto mb-2" />
                <p className="font-semibold text-slate-200 font-display">Aucune promotion en suspens</p>
                <p className="text-xs text-slate-500 mt-1">Tous les astronautes ayant franchi un seuil de points ont déjà été approuvés par leurs instructeurs !</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {eligiblePromotionsList.map(({ ast, eligibleGrades }) => (
                  <div key={ast.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-slate-100 font-bold font-display text-sm">
                          {ast.first_name} {ast.last_name}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Total accumulé : <span className="font-mono text-amber-400 font-bold">{ast.grand_total} pts</span>
                        </p>
                      </div>
                      <GroupBadge groupe={ast.groupe} className="scale-75" />
                    </div>

                    <div className="space-y-2.5">
                      {eligibleGrades.map(g => (
                        <div key={g.id} className="bg-slate-950 p-3 rounded-lg border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <p className="text-xs font-bold text-amber-300 truncate">
                              Éligible : {g.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              Verset requis : <span className="font-mono text-amber-200">{g.verses}</span>
                            </p>
                          </div>

                          <button
                            id={`btn-manual-promote-${ast.id}-${g.id}`}
                            type="button"
                            onClick={() => setSelectedGradeToValidate({ astId: ast.id, gradeId: g.id })}
                            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] px-2.5 py-1.5 rounded uppercase flex items-center gap-1 cursor-pointer transition-all shrink-0"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verset Validé</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* --- TAB 5: REPORTS ACTIVITIES & AVANCES (C6) --- */}
        {activeTab === 'rapports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Draft Submit Card for Pilot */}
              {currentUser && ['developer', 'pilote', 'copilote'].includes(currentUser.role) && (
                <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
                  <h3 className="font-display font-semibold text-slate-200 flex items-center gap-1.5 text-base border-b border-slate-850 pb-2">
                    <FileText className="w-5 h-5 text-amber-500" />
                    <span>Rédiger Compte-Rendu</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label htmlFor="report-session-select" className="text-xs text-slate-400 block font-medium">Séance associée</label>
                      <select
                        id="report-session-select"
                        value={reportSessionId}
                        onChange={(e) => setReportSessionId(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-amber-400 border border-slate-800 rounded px-2.5 py-2 outline-none font-semibold focus:border-amber-500"
                      >
                        <option value="">Sélectionner une date pointée</option>
                        {sessions.map(s => (
                          <option key={s.id} value={s.id}>
                            Vendredi, {s.session_date} ({s.classe})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="report-lesson-input" className="text-xs text-slate-400 block font-medium">1. Thème de leçon biblique enseigné</label>
                      <textarea
                        id="report-lesson-input"
                        rows={2}
                        placeholder="Ex : L'obéissance chrétienne (Éphésiens 6:1)..."
                        value={reportLesson}
                        onChange={(e) => setReportLesson(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-slate-100 border border-slate-800 rounded p-2 outline-none focus:border-amber-500 placeholder-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="report-obs-input" className="text-xs text-slate-400 block font-medium">2. Observations générales / Jeux</label>
                      <textarea
                        id="report-obs-input"
                        rows={2}
                        placeholder="Ex : Excellente participation au jeu de ballon de fusée..."
                        value={reportObs}
                        onChange={(e) => setReportObs(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-slate-100 border border-slate-800 rounded p-2 outline-none focus:border-amber-500 placeholder-slate-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="report-disc-input" className="text-xs text-slate-400 block font-medium">3. Discipline / Notes administratives</label>
                      <textarea
                        id="report-disc-input"
                        rows={2}
                        placeholder="Ex : Deux avertissements calmes..."
                        value={reportDisc}
                        onChange={(e) => setReportDisc(e.target.value)}
                        className="w-full bg-slate-950 text-xs text-slate-100 border border-slate-800 rounded p-2 outline-none focus:border-amber-500 placeholder-slate-600"
                      />
                    </div>

                    <button
                      id="btn-submit-report"
                      type="button"
                      onClick={handleSubmitReport}
                      className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold py-2 rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Soumettre en révision</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Reports Dashboard List (C6) */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="font-display font-semibold text-slate-200 text-base uppercase tracking-wide">
                  Journaux de séance ({reports.length})
                </h3>

                {reports.length === 0 ? (
                  <div className="bg-slate-950 p-12 text-center rounded-xl border border-slate-900 text-slate-500">
                    <FileText className="w-10 h-10 mx-auto text-slate-700 mb-2" />
                    <p className="text-xs">Aucun rapport d'activité n'est actuellement consigné.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reports.map(rep => {
                      const sessMatch = sessions.find(s => s.id === rep.session_id);
                      const isPending = rep.status === 'en_attente';
                      const pilotAuthor = allProfiles.find(p => p.id === rep.submitted_by);
                      
                      return (
                        <div key={rep.id} className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3.5 shadow">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-850 pb-2">
                            <div>
                              <span className="font-display font-bold text-sm text-slate-100">
                                Leçon de vendredi, {sessMatch ? sessMatch.session_date : 'Date Révolue'}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Rédigé par: <span className="text-amber-400">{pilotAuthor ? pilotAuthor.full_name : 'Pilote Mission'}</span>
                              </p>
                            </div>

                            {isPending ? (
                              <div className="flex items-center gap-2">
                                <span className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] font-bold px-2 py-0.5 rounded">
                                  En attente de révision
                                </span>
                                {currentUser && ['developer', 'leader'].includes(currentUser.role) && (
                                  <button
                                    id={`btn-review-report-archive-${rep.id}`}
                                    type="button"
                                    onClick={() => handleReviewReport(rep.id)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-[10px] px-2.5 py-1.5 rounded cursor-pointer transition-all"
                                  >
                                    Archiver délibérément
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2.5 py-0.5 rounded">
                                Archivé & Confirmé
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                              <span className="text-[10px] text-amber-500 block font-bold uppercase tracking-wider">BIBLIO / LEÇON</span>
                              <p className="text-slate-300 mt-1">{rep.notes_lesson || 'Aucune note.'}</p>
                            </div>

                            <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                              <span className="text-[10px] text-amber-500 block font-bold uppercase tracking-wider">OBSERVATIONS</span>
                              <p className="text-slate-300 mt-1">{rep.notes_observations || 'Aucune note.'}</p>
                            </div>

                            <div className="bg-slate-950 p-2.5 rounded border border-slate-850">
                              <span className="text-[10px] text-amber-500 block font-bold uppercase tracking-wider">DISCIPLINE</span>
                              <p className="text-slate-300 mt-1">{rep.notes_discipline || 'Aucune note.'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 6: LEADERS STATISTICS ANALYTICS (C6) --- */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-slate-905 border border-slate-800 rounded-xl p-4 md:p-5">
              <h3 className="font-display font-semibold text-slate-200 text-base">
                Analyseurs de performance et de présence de l'ASBF
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Statistiques consolidées par Ghost Systems.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Point Averages Graph */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h4 className="font-display font-bold text-sm text-slate-300">
                  Moyenne des points accumulés par Classe
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupAveragesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1C2942" />
                      <XAxis dataKey="name" stroke="#94A3B8" fontSize={10} />
                      <YAxis stroke="#94A3B8" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#131C31', borderColor: '#1C2942' }} />
                      <Bar dataKey="Moyenne Points" fill="#F59E0B">
                        {groupAveragesData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#F59E0B' : '#3B82F6'} />
                        ))}
                      </Bar>
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Weekly Attendance line/area Graph */}
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-4">
                <h4 className="font-display font-bold text-sm text-slate-300">
                  Évolution de l'Audience de présence chrétienne (vendredis)
                </h4>
                <div className="h-64">
                  {chartWeeklyTrendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 italic">
                      Données d'activité insuffisantes.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartWeeklyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1C2942" />
                        <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} />
                        <YAxis stroke="#94A3B8" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#131C31', borderColor: '#1C2942' }} />
                        <Area type="monotone" dataKey="attendees" name="Présents" stroke="#22C55E" fill="#22C55E" fillOpacity={0.15} />
                        <Area type="monotone" dataKey="punctuals" name="Ponctuels" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.05} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- TAB 7: ADMINISTRATIVE TOOLS (C1/C7-2) --- */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            
            {/* Instructor Cabins Assignment Board (C1) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold text-slate-200 text-base border-b border-slate-850 pb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-500" />
                <span>Affectation des Cabines (Pilotes & Copilotes)</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allProfiles.filter(p => ['pilote', 'copilote'].includes(p.role)).map(prof => {
                  return (
                    <div key={prof.id} className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-100">{prof.full_name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Mail: {prof.email}</p>
                        </div>
                        <span className="bg-[#1C2942] uppercase font-mono px-2 py-0.5 rounded text-[9px] font-bold text-slate-300">
                          {prof.role}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label htmlFor={`admin-assign-class-${prof.id}`} className="text-[10px] text-slate-500 block mb-1">Classe d'âge</label>
                          <select
                            id={`admin-assign-class-${prof.id}`}
                            value={prof.assignment?.classe || ''}
                            onChange={(e) => handleUpdateInstructorAssignment(
                              prof.id,
                              e.target.value as any,
                              prof.assignment?.groupe || 'Jaune',
                              prof.can_enter_data
                            )}
                            className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded px-2 py-1 outline-none"
                          >
                            <option value="">Non assigné</option>
                            <option value="Pionniers">Pionniers</option>
                            <option value="Explorateurs">Explorateurs</option>
                            <option value="Aventuriers">Aventuriers</option>
                            <option value="Aigles">Aigles</option>
                          </select>
                        </div>

                        <div>
                          <label htmlFor={`admin-assign-group-${prof.id}`} className="text-[10px] text-slate-500 block mb-1">Groupe couleur</label>
                          <select
                            id={`admin-assign-group-${prof.id}`}
                            value={prof.assignment?.groupe || ''}
                            onChange={(e) => handleUpdateInstructorAssignment(
                              prof.id,
                              prof.assignment?.classe || 'Pionniers',
                              e.target.value as any,
                              prof.can_enter_data
                            )}
                            className="w-full bg-slate-900 text-slate-200 border border-slate-800 rounded px-2 py-1 outline-none"
                          >
                            <option value="">Non assigné</option>
                            <option value="Jaune">Jaune</option>
                            <option value="Bleu">Bleu</option>
                            <option value="Vert">Vert</option>
                            <option value="Rouge">Rouge</option>
                          </select>
                        </div>
                      </div>

                      {prof.role === 'copilote' && (
                        <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                          <span className="text-[10px] text-slate-400">Autorisé à modifier la base ?</span>
                          <input
                            type="checkbox"
                            checked={prof.can_enter_data}
                            onChange={(e) => handleUpdateInstructorAssignment(
                              prof.id,
                              prof.assignment?.classe || 'Pionniers',
                              prof.assignment?.groupe || 'Jaune',
                              e.target.checked
                            )}
                            className="w-4 h-4 text-amber-500 accent-amber-500 rounded cursor-pointer outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Class Migration Macro Tool (C7-2) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-lg">
              <h3 className="font-display font-semibold text-slate-200 text-base border-b border-slate-850 pb-2 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-amber-500 font-bold" />
                <span>Moteur de Migration de Promotion des Classes</span>
              </h3>
              <p className="text-xs text-slate-400 leading-normal">
                Transférez les cohortes d'astronautes d'une catégorie d'âge à une autre en début d'année ou de saison (ex: Aventuriers vers Aigles). Les Grand Totaux d'expérience sont intégralement préservés.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="migration-target-class" className="text-[10px] text-slate-500 block mb-1 uppercase">Depuis la classe cible</label>
                  <select
                    id="migration-target-class"
                    value={migrationTargetClass}
                    onChange={(e) => setMigrationTargetClass(e.target.value as ClasseType)}
                    className="w-full bg-slate-950 text-xs border border-slate-800 text-amber-400 font-bold rounded px-2.5 py-2 outline-none focus:border-amber-500"
                  >
                    <option value="Pionniers">Pionniers</option>
                    <option value="Explorateurs">Explorateurs</option>
                    <option value="Aventuriers">Aventuriers</option>
                    <option value="Aigles">Aigles</option>
                  </select>
                </div>

                <div className="flex items-center justify-center pt-4">
                  <ChevronRight className="w-6 h-6 text-slate-600 hidden sm:block" />
                </div>

                <div>
                  <label htmlFor="migration-promote-class" className="text-[10px] text-slate-500 block mb-1 uppercase">Vers la nouvelle classe</label>
                  <select
                    id="migration-promote-class"
                    value={migrationPromoteTo}
                    onChange={(e) => setMigrationPromoteTo(e.target.value as ClasseType)}
                    className="w-full bg-slate-950 text-xs border border-slate-800 text-emerald-400 font-bold rounded px-2.5 py-2 outline-none focus:border-amber-500"
                  >
                    <option value="Explorateurs">Explorateurs</option>
                    <option value="Aventuriers">Aventuriers</option>
                    <option value="Aigles">Aigles</option>
                    <option value="Diplome">Diplômé / Archiviste</option>
                  </select>
                </div>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-850">
                <p className="text-[10px] text-slate-400 font-medium">Membres éligibles détectés : {migrationCandidates.length}</p>
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-[80px] overflow-y-auto">
                  {migrationCandidates.map(c => (
                    <span key={c.id} className="bg-slate-900 border border-slate-800 text-[9px] text-slate-200 px-2 py-0.5 rounded">
                      {c.first_name} {c.last_name} ({c.grand_total} pts)
                    </span>
                  ))}
                  {migrationCandidates.length === 0 && <span className="text-slate-600 text-[10px] italic">Aucun astronaute passif</span>}
                </div>
              </div>

              {migrationCandidates.length > 0 && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    id="btn-trigger-migration-preview"
                    type="button"
                    onClick={handleMigrationPreview}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs px-2.5 py-2 rounded border border-slate-700 transition-all cursor-pointer"
                  >
                    Prévisualiser la macro
                  </button>

                  <button
                    id="btn-confirm-migration"
                    type="button"
                    onClick={handleMigrationConfirm}
                    disabled={!migrationPreviewData}
                    className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-bold text-xs px-3 py-2 rounded transition-all cursor-pointer"
                  >
                    Confirmer l'opération macro
                  </button>
                </div>
              )}

              {migrationPreviewData && (
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 rounded-lg text-xs space-y-1.5 leading-relaxed">
                  <p className="font-semibold">{migrationPreviewData.preview_text}</p>
                  <p className="text-[11px] text-slate-400">Tous les records d'activité et Grand Totaux à vie continueront de se cumuler à partir du niveau supérieur.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 8: SETTINGS & PARAMETERS (C7-1/C7-3) --- */}
        {activeTab === 'parametres' && (
          <div className="space-y-6">
            
            {/* Global Settings adjustments */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="font-display font-semibold text-slate-200 text-base border-b border-slate-850 pb-2">
                Configurations Système & Opérations de Ghost Systems
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                
                {/* Summer Pause Toggle (C7-1) */}
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl text-xs space-y-3">
                  <h4 className="font-display font-bold text-slate-100 flex items-center gap-1.5 uppercase">
                    <Settings className="h-4 w-4 text-amber-400" />
                    <span>Mode verrou d'interactivité (Pause d'Été)</span>
                  </h4>
                  <p className="text-slate-400 leading-normal">
                    L'enclenchement de la pause d'été gèle l'ensemble du système de pointage de présence en écriture pour l'entièreté des instructeurs. Seule la lecture-analytique reste exploitable.
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                    <span className="font-semibold text-slate-300">Statut de la Pause d'Été</span>
                    <button
                      id="btn-toggle-summer-pause"
                      type="button"
                      onClick={() => handleUpdateSettings('summer_pause', !appSettings.summer_pause)}
                      className={`text-xs px-4 py-1.5 rounded-lg font-bold uppercase transition-all cursor-pointer ${
                        appSettings.summer_pause
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {appSettings.summer_pause ? 'Active (MUTATION LOCK)' : 'Désactivée (OUVERT)'}
                    </button>
                  </div>
                </div>

                {/* Correction Window limit setup (C7-3) */}
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl text-xs space-y-3">
                  <h4 className="font-display font-bold text-slate-100 uppercase">
                    Délais réglementaire d'édition
                  </h4>
                  <p className="text-slate-400 leading-normal">
                    Durée d'heures après laquelle les fiches de vendredi d'un pilote se figent. Un Leader d'ASBF doit alors intervenir pour autoriser le pointage.
                  </p>

                  <div className="flex items-center justify-between pt-1 border-t border-slate-900 gap-3">
                    <span className="font-semibold text-slate-300">Fenêtre de correction</span>
                    <select
                      id="correction-window-select"
                      value={appSettings.correction_window_hours}
                      onChange={(e) => handleUpdateSettings('correction_window_hours', parseInt(e.target.value))}
                      className="bg-slate-900 border border-slate-800 rounded text-amber-400 font-bold px-2 py-1 outline-none text-xs"
                    >
                      <option value={24}>24 heures (1 jour)</option>
                      <option value={48}>48 heures (2 jours - Réglage standard)</option>
                      <option value={72}>72 heures (3 jours)</option>
                      <option value={168}>168 heures (7 jours - Large)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Logs Lists (C7-3) */}
            {['developer', 'leader'].includes(currentUser?.role || '') && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h3 className="font-display font-semibold text-slate-200 text-base border-b border-slate-850 pb-2">
                  Journaux d'Audit & Journalisation des Historiques ({auditLogs.length})
                </h3>

                {auditLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Aucune action n'a nécessité de point d'audit.</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {auditLogs.map(log => {
                      const actor = allProfiles.find(p => p.id === log.actor_id);
                      return (
                        <div key={log.id} className="bg-slate-950 p-3 rounded border border-slate-900 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
                          <div className="space-y-1">
                            <p className="font-semibold text-amber-400">
                              [{log.action}] - Modifié par {actor?.full_name || 'Utilisateur'}
                            </p>
                            <p className="text-slate-400 font-sans text-[11px] leading-normal">
                              Justification écrite: <span className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-200 font-mono italic">{log.reason}</span>
                            </p>
                            <p className="text-slate-500 text-[10px]">
                              ID Cible: {log.target_id}   |   Table: {log.target_table}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            {new Date(log.created_at).toLocaleString('fr-FR')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="max-w-7xl w-full mx-auto px-4 mt-12 text-center text-xs text-slate-500 border-t border-slate-900/60 pt-6 space-y-2">
        <p className="font-display tracking-widest font-bold">RAPPORT ASTRONAUTES © 2026 — GHOST SYSTEMS</p>
        <p className="text-[10px] leading-relaxed">
          Propulsé par la structure robuste d'ingénierie Ghost Systems. Conçu pour le lever de drapeau, le pointage de présence et la progression des grades d'enfants de l'ASBF Haïti en salle de classe numérisée.
        </p>
      </footer>

      {/* --- FLOATING NOTIFICATION TOASTS --- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            id="global-notification-toast"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={`fixed bottom-5 right-5 z-50 p-4 rounded-xl shadow-2xl border text-xs font-bold max-w-sm flex items-center gap-2.5 ${
              toast.type === 'success'
                ? 'bg-emerald-950 border-emerald-500/20 text-emerald-400'
                : toast.type === 'danger'
                  ? 'bg-red-950 border-red-500/20 text-red-400'
                  : 'bg-slate-900 border-slate-800 text-slate-200'
            }`}
          >
            <Bell className="w-5 h-5 shrink-0 animate-swing" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- ADD NEW ASTRONAUT RECRUIT DIALOG MODAL (C3) --- */}
      {isAddingAstronaute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-1.5">
              <Plus className="w-5 h-5 text-amber-500" />
              <span>Formuler l'inscription d'une nouvelle recrue</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="new-ast-firstname" className="text-slate-400 block font-medium">Prénom</label>
                  <input
                    id="new-ast-firstname"
                    type="text"
                    required
                    value={newAstForm.first_name}
                    onChange={(e) => setNewAstForm(prev => ({ ...prev, first_name: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="new-ast-lastname" className="text-slate-400 block font-medium">Nom de famille</label>
                  <input
                    id="new-ast-lastname"
                    type="text"
                    required
                    value={newAstForm.last_name}
                    onChange={(e) => setNewAstForm(prev => ({ ...prev, last_name: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-ast-birthdate" className="text-slate-400 block font-medium">Date de Naissance</label>
                <input
                  id="new-ast-birthdate"
                  type="date"
                  required
                  value={newAstForm.birthdate}
                  onChange={(e) => setNewAstForm(prev => ({ ...prev, birthdate: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 outline-none font-mono focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="new-ast-class" className="text-slate-400 block font-medium">Classe cabine</label>
                  <select
                    id="new-ast-class"
                    value={newAstForm.classe}
                    onChange={(e) => setNewAstForm(prev => ({ ...prev, classe: e.target.value as ClasseType }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 outline-none text-slate-300"
                  >
                    <option value="Pionniers">Pionniers</option>
                    <option value="Explorateurs">Explorateurs</option>
                    <option value="Aventuriers">Aventuriers</option>
                    <option value="Aigles">Aigles</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label htmlFor="new-ast-group" className="text-slate-400 block font-medium">Équipage couleur</label>
                  <select
                    id="new-ast-group"
                    value={newAstForm.groupe}
                    onChange={(e) => setNewAstForm(prev => ({ ...prev, groupe: e.target.value as GroupeType }))}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1.5 outline-none text-slate-300"
                  >
                    <option value="Jaune">Jaune</option>
                    <option value="Bleu">Bleu</option>
                    <option value="Vert">Vert</option>
                    <option value="Rouge">Rouge</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="new-ast-legacy" className="text-slate-400 block font-medium">Identifiant Historique / Source (Facultatif)</label>
                <input
                  id="new-ast-legacy"
                  type="text"
                  placeholder="Ex : Fiche papier recrue #549"
                  value={newAstForm.legacy_source}
                  onChange={(e) => setNewAstForm(prev => ({ ...prev, legacy_source: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                id="btn-confirm-add-ast"
                type="button"
                onClick={handleCreateAstronauteSubmit}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs cursor-pointer transition-all"
              >
                Inscrire la recrue
              </button>
              <button
                type="button"
                onClick={() => setIsAddingAstronaute(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- RANK VALIDATION DIALOG MODAL (C5) --- */}
      {selectedGradeToValidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-850 p-6 rounded-xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-display font-bold text-white flex items-center gap-1.5">
              <Award className="w-5 h-5 text-amber-500" />
              <span>Validation du grade d'officier d'élite</span>
            </h3>

            <p className="text-xs text-slate-300 leading-normal">
              Vous apprêtez-vous à accorder définitivement le titre d'avancement pour cet enfant ? Assurez-vous qu'il ait récité de vive voix le verset correspondant :
            </p>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded text-xs select-text">
              <p className="font-bold text-amber-400">
                {grades.find(g => g.id === selectedGradeToValidate.gradeId)?.name}
              </p>
              <p className="text-slate-400 mt-1">
                Ligne de versets requis : <span className="font-mono text-slate-300">{grades.find(g => g.id === selectedGradeToValidate.gradeId)?.verses}</span>
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                id="btn-confirm-promotion-execution"
                type="button"
                onClick={() => handleValidatePromotion(selectedGradeToValidate.astId, selectedGradeToValidate.gradeId)}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 rounded-lg text-xs cursor-pointer transition-all"
              >
                Oui, Verset certifié ✓
              </button>
              <button
                type="button"
                onClick={() => setSelectedGradeToValidate(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFETTI & ROCKET CELEBRATION PORTALS OVERLAYS */}
      <CelebrationOverlay
        isVisible={celebration.visible}
        onClose={() => setCelebration({ visible: false, title: '', subtitle: '' })}
        title={celebration.title}
        subtitle={celebration.subtitle}
        badgeText={celebration.badgeText}
      />

    </div>
  );

  // Local helper functions for rendering components clean states
  function onboardingRowForAstronaute(kidId: string): Onboarding {
    const data = astronautes.find(a => a.id === kidId);
    if (!data) return { astronaute_id: kidId, fridays_done: false, devise: false, verset_officiel: false, livres_nt: false, completed_at: null };
    
    // Find matching in full array state
    const realRow = onboardingList(kidId);
    return realRow || { astronaute_id: kidId, fridays_done: false, devise: false, verset_officiel: false, livres_nt: false, completed_at: null };
  }

  function onboardingList(kidId: string): Onboarding | undefined {
    // Return mock row or loaded
    return undefined; // Handled directly inside state or fetch detail
  }

  function scoreForAstronauteAndSession(kidId: string, sessId: string): Score | undefined {
    return sessionScores.find(s => s.session_id === sessId && s.astronaute_id === kidId);
  }

}
