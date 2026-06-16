import React, { useState, useMemo } from 'react';
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
} from '../types';
import { api } from '../lib/api';
import { exportToCSV, exportRosterPDF, exportSessionScoresPDF } from '../lib/exports';
import GroupBadge from '../components/GroupBadge';
import EligibilityBadge from '../components/EligibilityBadge';
import ScoreChecklist from '../components/ScoreChecklist';
import RankTrack from '../components/RankTrack';
import GestionPersonnel from '../components/GestionPersonnel';
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
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  UserPlus,
  Check
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

type CommandTabType = 'equipage' | 'onboarding' | 'pointage' | 'promotions' | 'rapports' | 'analytics' | 'admin' | 'parametres';

interface CommandModeProps {
  currentUser: UserProfile;
  allProfiles: UserProfile[];
  appSettings: AppSettings;
  astronautes: Astronaute[];
  sessions: Session[];
  reports: Report[];
  grades: Grade[];
  promotions: Promotion[];
  scores: Score[];
  auditLogs: AuditLog[];
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
  triggerCelebration: (title: string, subtitle: string, badgeText: string) => void;
  onSwitchMode?: () => void;
  isOnline: boolean;
}

export default function CommandMode({
  currentUser,
  allProfiles,
  appSettings,
  astronautes,
  sessions,
  reports,
  grades,
  promotions,
  scores,
  auditLogs,
  onRefresh,
  onLogout,
  showToast,
  triggerCelebration,
  onSwitchMode,
  isOnline
}: CommandModeProps) {
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<CommandTabType>('equipage');
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');

  // Particular selected details
  const [selectedAstronauteId, setSelectedAstronauteId] = useState<string | null>(null);
  const [isAddingAstronaute, setIsAddingAstronaute] = useState(false);
  
  // Recruits onboarding checklist toggles state
  const [onboardingTogglesLoading, setOnboardingTogglesLoading] = useState<string | null>(null);

  // Active scoring board helper states
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionScores, setSessionScores] = useState<Score[]>([]);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideTargetScore, setOverrideTargetScore] = useState<Score | null>(null);
  const [isApplyingOverride, setIsApplyingOverride] = useState(false);

  // Report correction loop text / state
  const [selectedReportToCorrect, setSelectedReportToCorrect] = useState<Report | null>(null);
  const [leaderCorrectionNote, setLeaderCorrectionNote] = useState('');
  const [isSavingCorrection, setIsSavingCorrection] = useState(false);
  const [isProcessingReportId, setIsProcessingReportId] = useState<string | null>(null);

  // Class migration state
  const [migrationTargetClass, setMigrationTargetClass] = useState<ClasseType>('Pionniers');
  const [migrationPromoteTo, setMigrationPromoteTo] = useState<ClasseType>('Explorateurs');
  const [migrationCandidateIds, setMigrationCandidateIds] = useState<string[]>([]);
  const [migrationReason, setMigrationReason] = useState("Promotion annuelle de transition");
  const [migrationPreview, setMigrationPreview] = useState<any>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  // Gemini AI Strategic Briefing State
  const [aiBriefing, setAiBriefing] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerateAiBriefing = async () => {
    setAiLoading(true);
    try {
      const res = await api.getLeaderDashboardBriefing({ reports, astronautes });
      setAiBriefing(res.briefingHtml);
      showToast("Briefing stratégique rédigé par Gemini !", "success");
    } catch (err) {
      showToast("Impossible de joindre Gemini pour le briefing.", "danger");
    } finally {
      setAiLoading(false);
    }
  };

  // Profile assignment state
  const [assigningProfileId, setAssigningProfileId] = useState<string | null>(null);
  const [assignClass, setAssignClass] = useState<ClasseType | ''>('');
  const [assignGroup, setAssignGroup] = useState<GroupeType | ''>('');
  const [assignCanEnter, setAssignCanEnter] = useState(true);

  // New Astronaute Form State
  const [newAstForm, setNewAstForm] = useState({
    first_name: '',
    last_name: '',
    birthdate: '',
    classe: 'Pionniers' as ClasseType,
    groupe: 'Jaune' as GroupeType,
    legacy_source: ''
  });
  const [isCreatingAstronaute, setIsCreatingAstronaute] = useState(false);

  // Settings modification
  const [settingsPause, setSettingsPause] = useState(appSettings.summer_pause);
  const [settingsWindow, setSettingsWindow] = useState(appSettings.correction_window_hours);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // --- COMPUTES & CACHED SEARCH ---
  const eligiblePromotionsCount = useMemo(() => {
    // computes overall count of kids meeting thresholds but lacking checked milestones
    let count = 0;
    astronautes.filter(a => a.status === 'astronaute_actif').forEach(ast => {
      const astProms = promotions.filter(p => p.astronaute_id === ast.id);
      const reachedGrades = grades.filter(g => ast.grand_total >= g.points_required);
      const validatedGradeIds = new Set(astProms.map(p => p.grade_id));
      const pending = reachedGrades.filter(g => !validatedGradeIds.has(g.id));
      if (pending.length > 0) count++;
    });
    return count;
  }, [astronautes, promotions, grades]);

  const pendingReportsCount = useMemo(() => {
    return reports.filter(r => r.status === 'en_attente').length;
  }, [reports]);

  const filteredAstronautes = useMemo(() => {
    return astronautes.filter(a => {
      const fullName = `${a.first_name} ${a.last_name}`.toLowerCase();
      const matchSearch = fullName.includes(searchQuery.toLowerCase());
      
      const matchClass = filterClass === 'all' || a.classe === filterClass;
      const matchGroup = filterGroup === 'all' || a.groupe === filterGroup;
      
      return matchSearch && matchClass && matchGroup;
    });
  }, [astronautes, searchQuery, filterClass, filterGroup]);

  const activeRoster = useMemo(() => {
    return filteredAstronautes.filter(a => a.status === 'astronaute_actif');
  }, [filteredAstronautes]);

  const recruitsList = useMemo(() => {
    return filteredAstronautes.filter(a => a.status === 'recrue');
  }, [filteredAstronautes]);

  const selectedAstronaute = useMemo<Astronaute | null>(() => {
    return astronautes.find(a => a.id === selectedAstronauteId) || null;
  }, [selectedAstronauteId, astronautes]);

  const selectedAstronauteDetails = useMemo(() => {
    if (!selectedAstronaute) return null;
    const kidsPromotions = promotions.filter(p => p.astronaute_id === selectedAstronaute.id);
    const kidsScores = scores.filter(s => s.astronaute_id === selectedAstronaute.id);
    // Find initial onboarding steps or return empty
    // It is safer to queryrec's onboarding directly
    return {
      astronaute: selectedAstronaute,
      onboarding: selectedAstronaute.onboarding || {
        astronaute_id: selectedAstronaute.id,
        fridays_done: false,
        devise: false,
        verset_officiel: false,
        livres_nt: false,
        completed_at: null
      },
      promotions: kidsPromotions,
      scores: kidsScores
    };
  }, [selectedAstronaute, promotions, scores]);

  // Handle onboarding toggle in Command view
  const handleOnboardingToggle = async (astId: string, field: 'fridays_done' | 'devise' | 'verset_officiel' | 'livres_nt', curVal: boolean) => {
    setOnboardingTogglesLoading(`${astId}_${field}`);
    try {
      const saved = await api.updateOnboarding(astId, field, !curVal);
      await onRefresh();
      if (saved.celebrated) {
        triggerCelebration(
          `Félicitations, Nouvelle Recrue Activée !`,
          `Le profil de ${saved.astronaute.first_name} ${saved.astronaute.last_name} est maintenant officiellement déverrouillé !`,
          `Astronaute Actif`
        );
      } else {
        showToast("Gateway d'onboarding mis à jour.", 'success');
      }
    } catch (e: any) {
      showToast(e.message || "Erreur lors du changement.", 'danger');
    } finally {
      setOnboardingTogglesLoading(null);
    }
  };

  // Add kid roster form
  const handleCreateAstronauteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAstForm.first_name.trim() || !newAstForm.last_name.trim() || !newAstForm.birthdate) {
      showToast("Veuillez renseigner les valeurs obligatoires.", 'danger');
      return;
    }
    setIsCreatingAstronaute(true);
    try {
      await api.createAstronaute({
        first_name: newAstForm.first_name,
        last_name: newAstForm.last_name,
        birthdate: newAstForm.birthdate,
        classe: newAstForm.classe,
        groupe: newAstForm.groupe,
        legacy_source: newAstForm.legacy_source || undefined
      });
      showToast("Fiche d'onboarding créée pour la nouvelle recrue.", 'success');
      setNewAstForm({
        first_name: '',
        last_name: '',
        birthdate: '',
        classe: 'Pionniers',
        groupe: 'Jaune',
        legacy_source: ''
      });
      setIsAddingAstronaute(false);
      await onRefresh();
    } catch (e: any) {
      showToast(e.message || "Erreur de création", 'danger');
    } finally {
      setIsCreatingAstronaute(false);
    }
  };

  // Select historical session
  const handleSelectSession = async (sess: Session) => {
    setSelectedSession(sess);
    try {
      const allScores = await api.getScores();
      setSessionScores(allScores.filter(s => s.session_id === sess.id));
    } catch (e) {
      showToast('Erreur lors du chargement des scores de la séance.', 'danger');
    }
  };

  const isHistoricalOverrideRequired = useMemo(() => {
    if (!selectedSession) return false;
    if (currentUser.role === 'developer' || currentUser.role === 'leader') return false;
    const createdAtMs = selectedSession.locked_at ? new Date(selectedSession.locked_at).getTime() : new Date(selectedSession.session_date).getTime();
    const ageHrs = (Date.now() - createdAtMs) / (1000 * 60 * 60);
    return ageHrs > appSettings.correction_window_hours;
  }, [selectedSession, appSettings, currentUser]);

  const handleToggleScoreFieldInCommand = async (scoreObj: Score, field: 'presence' | 'ponctuel' | 'bible' | 'verset' | 'proprete' | 'echarpe' | 'conduite') => {
    const updatedVal = !scoreObj[field];
    if (isHistoricalOverrideRequired) {
      // open prompt
      setOverrideTargetScore({ ...scoreObj, [field]: updatedVal } as Score);
      setOverrideReason('');
      return;
    }

    try {
      const saved = await api.saveScore({
        session_id: scoreObj.session_id,
        astronaute_id: scoreObj.astronaute_id,
        presence: field === 'presence' ? updatedVal : scoreObj.presence,
        ponctuel: field === 'ponctuel' ? updatedVal : scoreObj.ponctuel,
        bible: field === 'bible' ? updatedVal : scoreObj.bible,
        verset: field === 'verset' ? updatedVal : scoreObj.verset,
        proprete: field === 'proprete' ? updatedVal : scoreObj.proprete,
        echarpe: field === 'echarpe' ? updatedVal : scoreObj.echarpe,
        conduite: field === 'conduite' ? updatedVal : scoreObj.conduite,
        visiteurs: scoreObj.visiteurs || 0,
      });
      setSessionScores(prev => prev.map(s => s.id === saved.id ? saved : s));
      showToast("Score mis à jour.", 'success');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de sauvegarde", 'danger');
    }
  };

  const submitHistoricalOverride = async () => {
    if (!overrideTargetScore || !overrideReason.trim()) {
      showToast("Motivation de dérogation obligatoire.", 'danger');
      return;
    }
    setIsApplyingOverride(true);
    try {
      const saved = await api.saveScore({
        session_id: overrideTargetScore.session_id,
        astronaute_id: overrideTargetScore.astronaute_id,
        presence: overrideTargetScore.presence,
        ponctuel: overrideTargetScore.ponctuel,
        bible: overrideTargetScore.bible,
        verset: overrideTargetScore.verset,
        proprete: overrideTargetScore.proprete,
        echarpe: overrideTargetScore.echarpe,
        conduite: overrideTargetScore.conduite,
        visiteurs: overrideTargetScore.visiteurs || 0,
        is_historical_override: true,
        override_reason: overrideReason
      });
      setSessionScores(prev => prev.map(s => s.astronaute_id === saved.astronaute_id ? saved : s));
      showToast("Dérogation validée avec motif.", 'success');
      setOverrideTargetScore(null);
      setOverrideReason('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de dérogation", 'danger');
    } finally {
      setIsApplyingOverride(false);
    }
  };

  // --- REPORT REVIEW CORRECTION LOOP ACTIONS ---
  const handleReviewArchiveReport = async (reportId: string) => {
    if (currentUser.role !== 'developer' && currentUser.role !== 'leader') {
      showToast("Droits de président requis.", 'danger');
      return;
    }
    setIsProcessingReportId(reportId);
    try {
      await api.archiveReport(reportId);
      showToast("Rapport hebdomadaire archivé et validé définitivement.", 'success');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'archivage.", 'danger');
    } finally {
      setIsProcessingReportId(null);
    }
  };

  const submitCorrectionDemand = async () => {
    if (!selectedReportToCorrect || !leaderCorrectionNote.trim()) {
      showToast("Veuillez saisir des explications pour le pilote.", 'danger');
      return;
    }
    setIsSavingCorrection(true);
    try {
      await api.requestCorrection(selectedReportToCorrect.id, leaderCorrectionNote);
      showToast("Rapport déverrouillé et renvoyé à la cabine pour correction.", 'success');
      setSelectedReportToCorrect(null);
      setLeaderCorrectionNote('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur lors du renvoi.", 'danger');
    } finally {
      setIsSavingCorrection(false);
    }
  };

  // --- CLASSES MIGRATIONS COHORT ---
  const handleCohortMigrationPreview = async () => {
    try {
      setIsMigrating(true);
      const candidates = astronautes.filter(a => a.classe === migrationTargetClass && a.status === 'astronaute_actif');
      setMigrationCandidateIds(candidates.map(c => c.id));
      
      const previewRes = await api.runClassMigration(
        migrationTargetClass,
        migrationPromoteTo,
        false, // preview only
        candidates.map(c => c.id),
        migrationReason
      );
      setMigrationPreview(previewRes);
    } catch (e: any) {
      showToast(e.message || "Erreur lors de la simulation.", 'danger');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleApplyCohortMigration = async () => {
    if (!migrationPreview) return;
    if (!window.confirm(`Êtes-vous sûr de vouloir migrer définitivement ces ${migrationCandidateIds.length} élèves vers la classe ${migrationPromoteTo} ?`)) {
      return;
    }
    setIsMigrating(true);
    try {
      const res = await api.runClassMigration(
        migrationTargetClass,
        migrationPromoteTo,
        true, // confirm
        migrationCandidateIds,
        migrationReason
      );
      showToast(res.message || "Migration terminée.", 'success');
      setMigrationPreview(null);
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de migration.", 'danger');
    } finally {
      setIsMigrating(false);
    }
  };

  // --- INSTRUCTORS ASSIGNMENTS PANEL ---
  const handleAssignInstructorsSubmit = async (profileId: string) => {
    if (!assignClass || !assignGroup) {
      showToast("Sélectionnez d'abord une classe et un groupe.", 'danger');
      return;
    }
    try {
      await api.updateAssignment({
        profile_id: profileId,
        classe: assignClass,
        groupe: assignGroup,
        can_enter_data: assignCanEnter
      });
      showToast("Assignation de la cabine enregistrée avec succès.", 'success');
      setAssigningProfileId(null);
      await onRefresh();
    } catch (e: any) {
      showToast(e.message || "Erreur d'assignation.", 'danger');
    }
  };

  // --- DEVELOPERS RESET DB ( relocates exactly into Administration tab ) ---
  const handleResetDbCTA = async () => {
    if (!window.confirm("IMPORTANT: Voulez-vous restaurer les 12 recrues/astronautes et rebâtir le réseau de test à zéro ?")) {
      return;
    }
    try {
      await api.resetDb();
      showToast("Toute la base de démonstration a été restaurée à l'état initial.", 'success');
      setSelectedSession(null);
      setSelectedAstronauteId(null);
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de réinitialisation.", 'danger');
    }
  };

  // --- SYSTEM SETTINGS UPDATE ---
  const handleSaveSettingsSubmit = async () => {
    setIsSavingSettings(true);
    try {
      await api.updateAppSettings({
        summer_pause: settingsPause,
        correction_window_hours: settingsWindow
      });
      showToast("Réglages système sauvegardés avec succès.", 'success');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de sauvegarde.", 'danger');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // --- PROMOTION VALIDATION MATRIX ---
  const handleValidatePromotionDirect = async (astId: string, gradeId: string) => {
    try {
      const promObj = await api.validatePromotion(astId, gradeId);
      const mG = grades.find(g => g.id === gradeId);
      const mA = astronautes.find(a => a.id === astId);
      
      triggerCelebration(
        `Nouveau Grade Décroché !`,
        `Félicitations de Pasteur Jean-Baptiste ! ${mA?.first_name} ${mA?.last_name} est certifié au rang d'élite !`,
        mG?.name || 'Gradé'
      );
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de certification.", 'danger');
    }
  };

  // --- EXPORTS HELPERS ---
  const handleExportRosterPDF = () => {
    exportRosterPDF(filteredAstronautes, filterClass === 'all' ? 'Toutes les classes' : filterClass);
  };

  const handleExportSessionScoresPDF = () => {
    if (!selectedSession) return;
    exportSessionScoresPDF(
      selectedSession.session_date,
      `${selectedSession.classe} - ${selectedSession.groupe}`,
      sessionScores,
      activeRoster
    );
  };

  const handleExportCSV = () => {
    exportToCSV(filteredAstronautes, 'Roster_Astronautes.csv');
  };

  // Compute stats helper lists
  const classTotalsArray = useMemo(() => {
    const list = ['Pionniers', 'Explorateurs', 'Aventuriers', 'Aigles'];
    return list.map(cl => {
      const count = astronautes.filter(a => a.classe === cl && a.status === 'astronaute_actif').length;
      return { name: cl, total: count };
    });
  }, [astronautes]);

  const auditChronology = useMemo(() => {
    return auditLogs.slice(0, 10);
  }, [auditLogs]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Top Banner Header */}
      <header className="bg-slate-900 border-b border-slate-800 shadow px-6 py-4 sticky top-0 z-40 select-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 uppercase flex items-center gap-1.5">
                <span>MODE COMMANDEMENT</span>
                <span 
                  className={`w-1.5 h-1.5 rounded-full inline-block ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/55 animate-pulse' : 'bg-red-500 shadow-sm shadow-red-500/55'}`} 
                  title={isOnline ? "Base de données Firebase connectée" : "Connexion Firebase perdue (Hors-ligne)"}
                />
              </span>
              {onSwitchMode && (
                <button
                  type="button"
                  onClick={onSwitchMode}
                  className="text-xs text-sky-400 hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>→ Consulter en Mode Terrain</span>
                </button>
              )}
            </div>
            <h1 className="text-2xl font-black mt-1.5 text-white tracking-tight leading-none">
              PUPITRE OPÉRATIONNEL ASBF • <span className="text-amber-400">COMMANDEMENT</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Validation des promotions militaires, gestion administrative et archivage des comptes.
            </p>
          </div>

          {/* Connected Admin Profile Info */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold text-white leading-none">{currentUser.full_name}</p>
              <p className="text-[10px] font-mono font-bold tracking-wider text-slate-450 uppercase mt-1">
                {currentUser.role === 'developer' ? 'INGÉNIEUR GHOST SYSTEMS' : 'PRÉSIDENT ASBF'}
              </p>
            </div>
            
            <button
              onClick={onLogout}
              className="p-2.5 bg-slate-800 hover:bg-slate-755 border border-slate-700/60 text-slate-400 hover:text-white rounded-lg transition active:scale-95 cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unified French Tabs list (C8-UX) */}
        <nav className="flex flex-wrap items-center gap-1.5 mt-6 border-b border-slate-900/60 pb-1 w-full overflow-x-auto">
          {[
            { id: 'equipage' as CommandTabType, label: 'Équipage', icon: Users },
            { id: 'onboarding' as CommandTabType, label: 'Recrues', icon: BookOpen, badge: recruitsList.length },
            { id: 'pointage' as CommandTabType, label: 'Pointage', icon: Calendar },
            { id: 'promotions' as CommandTabType, label: 'Promotions', icon: Award, badge: eligiblePromotionsCount },
            { id: 'rapports' as CommandTabType, label: 'Rapports', icon: FileText, badge: pendingReportsCount },
            { id: 'analytics' as CommandTabType, label: 'Statistiques', icon: BarChart3 },
            { id: 'admin' as CommandTabType, label: 'Administration', icon: Shield },
            { id: 'parametres' as CommandTabType, label: 'Réglages', icon: Settings }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                id={`tab-nav-${tab.id}`}
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSelectedAstronauteId(null);
                }}
                className={`py-2 px-3.5 text-xs sm:text-sm font-bold rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-850/50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[10px] font-bold font-mono px-2 py-0.2 rounded-full ${active ? 'bg-slate-950 text-amber-500' : 'bg-red-500/15 text-red-400 border border-red-500/20 shadow-inner'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main workspace container */}
      <main className="max-w-7xl w-full mx-auto px-6 mt-6 flex-1 text-sm pb-10">
        
        {/* TAB 1: EQUIPAGE ROSTER */}
        {activeTab === 'equipage' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search query placeholder changed (C8-1-5) */}
                <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-lg">
                  <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="search-roster-input"
                    type="text"
                    placeholder="Rechercher par nom complet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-transparent pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-amber-500/30"
                  />
                </div>

                <select
                  id="roster-class-filter"
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-amber-500"
                >
                  <option value="all">Secteur: Toutes les classes</option>
                  <option value="Pionniers">Pionniers (4-6 ans)</option>
                  <option value="Explorateurs">Explorateurs (7-8 ans)</option>
                  <option value="Aventuriers">Aventuriers (9-11 ans)</option>
                  <option value="Aigles">Aigles (12-14 ans)</option>
                </select>

                <select
                  id="roster-group-filter"
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs font-bold rounded-lg px-3 py-2 outline-none focus:border-amber-500"
                >
                  <option value="all">Unité: Tous les groupes</option>
                  <option value="Vert">Vert</option>
                  <option value="Rouge">Rouge</option>
                  <option value="Bleu">Bleu</option>
                  <option value="Jaune">Jaune</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportRosterPDF}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-rose-450" />
                  <span>Rapport PDF</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Fiche CSV</span>
                </button>
                <button
                  onClick={() => setIsAddingAstronaute(!isAddingAstronaute)}
                  className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs px-4.5 py-2 rounded-lg cursor-pointer transition shadow"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Nouvel élève</span>
                </button>
              </div>
            </div>

            {/* Form insert new kid */}
            {isAddingAstronaute && (
              <form onSubmit={handleCreateAstronauteSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 max-w-xl shadow-lg">
                <h3 className="font-bold text-white text-sm uppercase tracking-wider">Formulaire de création d'Émulation</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Prénom *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white"
                      value={newAstForm.first_name}
                      onChange={e => setNewAstForm(prev => ({ ...prev, first_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Nom *</label>
                    <input
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-sm text-white"
                      value={newAstForm.last_name}
                      onChange={e => setNewAstForm(prev => ({ ...prev, last_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Date de Naissance *</label>
                    <input
                      type="date"
                      className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-white"
                      value={newAstForm.birthdate}
                      onChange={e => setNewAstForm(prev => ({ ...prev, birthdate: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Classe de Vol *</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 font-bold"
                      value={newAstForm.classe}
                      onChange={e => setNewAstForm(prev => ({ ...prev, classe: e.target.value as ClasseType }))}
                    >
                      <option value="Pionniers">Pionniers</option>
                      <option value="Explorateurs">Explorateurs</option>
                      <option value="Aventuriers">Aventuriers</option>
                      <option value="Aigles">Aigles</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1">Groupe Cabinet *</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 font-bold"
                      value={newAstForm.groupe}
                      onChange={e => setNewAstForm(prev => ({ ...prev, groupe: e.target.value as GroupeType }))}
                    >
                      <option value="Vert">Vert</option>
                      <option value="Rouge">Rouge</option>
                      <option value="Bleu">Bleu</option>
                      <option value="Jaune">Jaune</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Fiche Legacy d'origine (Optionnel)</label>
                  <input
                    type="text"
                    placeholder="Ex. Report papier Fiche-A 2025"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                    value={newAstForm.legacy_source}
                    onChange={e => setNewAstForm(prev => ({ ...prev, legacy_source: e.target.value }))}
                  />
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAstronaute(false)}
                    className="bg-slate-800 hover:bg-slate-750 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAstronaute}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2 rounded-lg cursor-pointer disabled:opacity-50"
                  >
                    {isCreatingAstronaute ? "Création..." : "Enregistrer la recrue"}
                  </button>
                </div>
              </form>
            )}

            {/* List and Details Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Roster list */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-3 shadow shadow-slate-950">
                <h3 className="font-extrabold text-white text-base">Fiches Astronautes Actifs</h3>
                
                {activeRoster.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">Aucun élève ne correspond aux critères.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-450 uppercase text-[10px] font-mono tracking-wider">
                          <th className="py-2.5">Astronaute</th>
                          <th className="py-2.5">Classe</th>
                          <th className="py-2.5">Groupe</th>
                          <th className="py-2.5 text-right">Points à vie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {activeRoster.map((ast) => (
                          <tr
                            key={ast.id}
                            onClick={() => setSelectedAstronauteId(ast.id)}
                            className={`hover:bg-slate-800/40 cursor-pointer transition ${
                              selectedAstronauteId === ast.id ? 'bg-slate-800/60 font-semibold' : ''
                            }`}
                          >
                            <td className="py-3">
                              <span className="text-slate-100 font-bold">{ast.first_name} {ast.last_name}</span>
                            </td>
                            <td className="py-3 text-slate-300">{ast.classe}</td>
                            <td className="py-3">
                              <GroupBadge groupe={ast.groupe} />
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-amber-500">
                              {ast.grand_total} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Detail side panels */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-5 shadow shadow-slate-950 h-fit">
                {selectedAstronauteDetails ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                      <div>
                        <h3 className="font-extrabold text-white text-lg">
                          {selectedAstronauteDetails.astronaute.first_name} {selectedAstronauteDetails.astronaute.last_name}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Né le {selectedAstronauteDetails.astronaute.birthdate}</p>
                      </div>
                      <span className="bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-400">
                        {selectedAstronauteDetails.astronaute.grand_total} pts
                      </span>
                    </div>

                    {/* Progress track display */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-slate-450 block uppercase">JAUGE DES GRADES MILITAIRES</span>
                      <RankTrack
                        grandTotal={selectedAstronauteDetails.astronaute.grand_total}
                        promotions={selectedAstronauteDetails.promotions}
                        allGrades={grades}
                      />
                    </div>

                    {/* Eligible promotions banner */}
                    <EligibilityBadge
                      grandTotal={selectedAstronauteDetails.astronaute.grand_total}
                      promotions={selectedAstronauteDetails.promotions}
                      allGrades={grades}
                      canValidate={true}
                      onTriggerValidate={(gId) => handleValidatePromotionDirect(selectedAstronauteDetails.astronaute.id, gId)}
                    />

                    {/* Promotion records history */}
                    <div className="space-y-2.5 pt-2 border-t border-slate-800">
                      <span className="text-[10px] font-mono font-bold tracking-wider text-slate-450 block uppercase">DIPLÔMES ET GRADATIONS CERTIFIÉES</span>
                      {selectedAstronauteDetails.promotions.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Aucun grade encore décerné.</p>
                      ) : (
                        <div className="space-y-1.5 font-mono text-[11px] text-slate-350">
                          {selectedAstronauteDetails.promotions.map(prom => {
                            const gr = grades.find(g => g.id === prom.grade_id);
                            return (
                              <div key={prom.id} className="flex justify-between p-2 bg-slate-950 rounded border border-slate-850">
                                <span className="font-bold text-slate-200">{gr?.name || 'Astronaute'}</span>
                                <span className="text-slate-500">{prom.validated_at.split('T')[0]}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-500">
                    <Info className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                    <p className="text-xs">Sélectionnez un élève dans le tableau pour visualiser ses jalons, son radar de grades et valider ses promotions.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PASSERELLE RECRUES */}
        {activeTab === 'onboarding' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow">
            <div>
              <h3 className="font-extrabold text-white text-base">Passerelle de validation d'accueil (Onboarding Recrues)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Les recrues ne participent pas au pointage régulier des points. Elles doivent impérativement valider ces 4 prerequisites initiaux.
              </p>
            </div>

            {recruitsList.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Aucune recrue en cours d'onboarding.</div>
            ) : (
              <div className="overflow-x-auto pt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-450 font-mono text-[10px] uppercase">
                      <th className="py-2.5">Recrue</th>
                      <th className="py-2.5">Secteur</th>
                      <th className="py-2.5 text-center">1. 3 Présences</th>
                      <th className="py-2.5 text-center">2. Devise Récitée</th>
                      <th className="py-2.5 text-center">3. Verset Signé</th>
                      <th className="py-2.5 text-center">4. Livres NT</th>
                      <th className="py-2.5 text-right font-mono">Progression</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {recruitsList.map(rec => {
                      const onb = rec.onboarding || { fridays_done: false, devise: false, verset_officiel: false, livres_nt: false };
                      
                      const check_1 = onb.fridays_done;
                      const check_2 = onb.devise;
                      const check_3 = onb.verset_officiel;
                      const check_4 = onb.livres_nt;
                      
                      const sumCount = [check_1, check_2, check_3, check_4].filter(Boolean).length;
                      const percentage = sumCount * 25;

                      return (
                        <tr key={rec.id} className="hover:bg-slate-800/20">
                          <td className="py-3 font-bold text-white">{rec.first_name} {rec.last_name}</td>
                          <td className="py-3 text-slate-400">{rec.classe} ({rec.groupe})</td>
                          
                          {/* Step 1 */}
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleOnboardingToggle(rec.id, 'fridays_done', check_1)}
                              disabled={onboardingTogglesLoading === `${rec.id}_fridays_done`}
                              className={`w-5 h-5 mx-auto rounded border flex items-center justify-center cursor-pointer transition ${
                                check_1 ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {check_1 && <Check className="w-3.5 h-3.5 font-black" />}
                            </button>
                          </td>

                          {/* Step 2 */}
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleOnboardingToggle(rec.id, 'devise', check_2)}
                              disabled={onboardingTogglesLoading === `${rec.id}_devise`}
                              className={`w-5 h-5 mx-auto rounded border flex items-center justify-center cursor-pointer transition ${
                                check_2 ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {check_2 && <Check className="w-3.5 h-3.5 font-black" />}
                            </button>
                          </td>

                          {/* Step 3 */}
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleOnboardingToggle(rec.id, 'verset_officiel', check_3)}
                              disabled={onboardingTogglesLoading === `${rec.id}_verset_officiel`}
                              className={`w-5 h-5 mx-auto rounded border flex items-center justify-center cursor-pointer transition ${
                                check_3 ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {check_3 && <Check className="w-3.5 h-3.5 font-black" />}
                            </button>
                          </td>

                          {/* Step 4 */}
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleOnboardingToggle(rec.id, 'livres_nt', check_4)}
                              disabled={onboardingTogglesLoading === `${rec.id}_livres_nt`}
                              className={`w-5 h-5 mx-auto rounded border flex items-center justify-center cursor-pointer transition ${
                                check_4 ? 'bg-sky-500 border-sky-500 text-slate-950' : 'border-slate-700 hover:border-slate-500'
                              }`}
                            >
                              {check_4 && <Check className="w-3.5 h-3.5 font-black" />}
                            </button>
                          </td>

                          {/* Progression state */}
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="font-mono text-xs font-bold text-sky-450">{percentage}%</span>
                              <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div className="h-full bg-sky-500 transition-all" style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: HISTORIQUE DES POINTAGES */}
        {activeTab === 'pointage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Sessions List */}
              <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-3.5 shadow">
                <h3 className="font-extrabold text-white text-base">Dossier des séances de vendredi</h3>
                
                <div className="space-y-2 max-h-[350px] overflow-y-auto">
                  {sessions.sort((a,b) => b.session_date.localeCompare(a.session_date)).map(sess => (
                    <button
                      key={sess.id}
                      onClick={() => handleSelectSession(sess)}
                      className={`w-full p-3 text-left border rounded-lg transition text-xs cursor-pointer flex justify-between items-center ${
                        selectedSession?.id === sess.id
                          ? 'bg-slate-800 border-amber-500/50'
                          : 'bg-slate-950 border-slate-800/80 hover:bg-slate-900/60'
                      }`}
                    >
                      <div>
                        <strong className="text-white block text-sm mb-0.5">{sess.session_date}</strong>
                        <span className="text-slate-400">{sess.classe} • {sess.groupe}</span>
                      </div>
                      
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                        sess.locked_at ? 'bg-slate-900 text-slate-550 border border-slate-800' : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      }`}>
                        {sess.locked_at ? 'Scellée' : 'Active'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scoring spreadsheet overview for selected session */}
              <div className="col-span-2 bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-3 gap-3">
                  <div>
                    <h3 className="font-extrabold text-white text-base">
                      {selectedSession ? `Séance du ${selectedSession.session_date}` : "Sélectionnez une séance d'enseignement"}
                    </h3>
                    {selectedSession && (
                      <p className="text-xs text-slate-400 mt-1">
                        Classe de {selectedSession.classe} ({selectedSession.groupe})
                      </p>
                    )}
                  </div>

                  {selectedSession && (
                    <button
                      onClick={handleExportSessionScoresPDF}
                      className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-rose-450" />
                      <span>Exporter PDF de pointage</span>
                    </button>
                  )}
                </div>

                {!selectedSession ? (
                  <div className="text-center p-8 text-slate-500 italic">
                     Sélectionnez une séance à gauche pour auditer et éditer les pointages d'équipage.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Read-only notes */}
                    {isHistoricalOverrideRequired && (
                      <div className="p-3 bg-amber-950/20 border border-amber-800 rounded-lg text-xs text-amber-300 flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <span>Séance historique fermée. Les modifications de score nécessitent une Dérogation formelle avec motif.</span>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-450 uppercase text-[9px] font-mono tracking-wider">
                            <th className="py-2">Astronaute</th>
                            <th className="py-2 text-center">Présence</th>
                            <th className="py-2 text-center">Bible</th>
                            <th className="py-2 text-center">Verset</th>
                            <th className="py-2 text-center">Propreté</th>
                            <th className="py-2 text-center">Conduite</th>
                            <th className="py-2 text-center">Visiteur</th>
                            <th className="py-2 text-right">Points</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/40">
                          {sessionScores.map(sc => {
                            const ast = astronautes.find(a => a.id === sc.astronaute_id);
                            if (!ast) return null;

                            // sum computed points
                            let pts = 0;
                            if (sc.presence) pts += 30;
                            if (sc.ponctuel) pts += 40;
                            if (sc.bible) pts += 50;
                            if (sc.verset) pts += 40;
                            if (sc.proprete) pts += 30;
                            if (sc.echarpe) pts += 20;
                            if (sc.conduite) pts += 40;
                            pts += (sc.visiteur || 0) * 25;

                            return (
                              <tr key={sc.id} className="hover:bg-slate-850/30">
                                <td className="py-2 font-bold text-slate-200">{ast.first_name} {ast.last_name}</td>
                                
                                {/* Presence */}
                                <td className="py-2 text-center">
                                  <button
                                    onClick={() => handleToggleScoreFieldInCommand(sc, 'presence')}
                                    className={`w-5.5 h-5.5 rounded mx-auto overflow-hidden border flex items-center justify-center font-bold text-xs ${
                                      sc.presence ? 'bg-amber-500 border-amber-500 text-slate-900' : 'bg-slate-950 border-slate-750 hover:border-slate-600'
                                    }`}
                                  >
                                    {sc.presence ? "✓" : ""}
                                  </button>
                                </td>

                                {/* Bible */}
                                <td className="py-2 text-center">
                                  <button
                                    disabled={!sc.presence}
                                    onClick={() => handleToggleScoreFieldInCommand(sc, 'bible')}
                                    className={`w-5.5 h-5.5 rounded mx-auto overflow-hidden border flex items-center justify-center font-bold text-xs disabled:opacity-30 ${
                                      sc.bible ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-950 border-slate-755'
                                    }`}
                                  >
                                    {sc.bible ? "B" : ""}
                                  </button>
                                </td>

                                {/* Verset */}
                                <td className="py-2 text-center">
                                  <button
                                    disabled={!sc.presence}
                                    onClick={() => handleToggleScoreFieldInCommand(sc, 'verset')}
                                    className={`w-5.5 h-5.5 rounded mx-auto overflow-hidden border flex items-center justify-center font-bold text-xs disabled:opacity-30 ${
                                      sc.verset ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-950 border-slate-755'
                                    }`}
                                  >
                                    {sc.verset ? "V" : ""}
                                  </button>
                                </td>

                                {/* Propreté */}
                                <td className="py-2 text-center">
                                  <button
                                    disabled={!sc.presence}
                                    onClick={() => handleToggleScoreFieldInCommand(sc, 'proprete')}
                                    className={`w-5.5 h-5.5 rounded mx-auto overflow-hidden border flex items-center justify-center font-bold text-xs disabled:opacity-30 ${
                                      sc.proprete ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-950 border-slate-755'
                                    }`}
                                  >
                                    {sc.proprete ? "P" : ""}
                                  </button>
                                </td>

                                {/* Conduite */}
                                <td className="py-2 text-center">
                                  <button
                                    disabled={!sc.presence}
                                    onClick={() => handleToggleScoreFieldInCommand(sc, 'conduite')}
                                    className={`w-5.5 h-5.5 rounded mx-auto overflow-hidden border flex items-center justify-center font-bold text-xs disabled:opacity-30 ${
                                      sc.conduite ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-950 border-slate-755'
                                    }`}
                                  >
                                    {sc.conduite ? "C" : ""}
                                  </button>
                                </td>

                                {/* Visiteur */}
                                <td className="py-2 text-center font-mono font-bold text-slate-350">{sc.visiteur || 0}</td>

                                {/* Sum points */}
                                <td className="py-2 text-right font-mono font-bold text-slate-300">+{pts} pts</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CERTIFICATIONS DES GRADES (PROMOTIONS) */}
        {activeTab === 'promotions' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="font-extrabold text-white text-base">Matrice de validation et octroi des grades d'élites</h3>
              <p className="text-xs text-slate-400 mt-1">
                La liste ci-dessous regroupe les astronautes actifs qui ont atteint le seuil requis pour un nouveau grade mais dont le verset d'acquisition n'a pas encore été vérifié lors du grand examen de passage.
              </p>
            </div>

            {astronautes.filter(a => a.status === 'astronaute_actif').length === 0 ? (
              <p className="p-5 text-center text-slate-500">Aucun astronaute actif n'est enregistré dans la base.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {astronautes.filter(a => a.status === 'astronaute_actif').map(ast => {
                  const astProms = promotions.filter(p => p.astronaute_id === ast.id);
                  const reachedGrades = grades.filter(g => ast.grand_total >= g.points_required);
                  const validatedGradeIds = new Set(astProms.map(p => p.grade_id));
                  const pending = reachedGrades.filter(g => !validatedGradeIds.has(g.id)).sort((a,b) => b.sort_order - a.sort_order);

                  if (pending.length === 0) return null;

                  // most prestigious pending grade
                  const topPending = pending[0];

                  return (
                    <div key={ast.id} className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-850 flex items-center justify-center font-extrabold text-xs">
                          {ast.first_name[0]}{ast.last_name[0]}
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base leading-tight">{ast.first_name} {ast.last_name}</h4>
                          <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
                             Secteur: <strong className="text-amber-500">{ast.classe}</strong> • Score: <strong className="text-white font-mono">{ast.grand_total} pts</strong>
                          </p>
                        </div>
                      </div>

                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 max-w-sm w-full flex items-center justify-between gap-3 text-xs leading-relaxed">
                        <div>
                          <span className="font-bold text-amber-400 block uppercase text-[10px] tracking-wider">MARQUER COMME ACQUIS ?</span>
                          <span className="text-white block font-extrabold mt-0.5">{topPending.name}</span>
                          <span className="text-slate-400 block mt-1">Épreuve verset: <strong className="font-mono text-amber-200">{topPending.verses}</strong></span>
                        </div>

                        <button
                          onClick={() => handleValidatePromotionDirect(ast.id, topPending.id)}
                          className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black px-3.5 py-2 rounded-lg cursor-pointer transition shadow"
                        >
                          Décerner ✓
                        </button>
                      </div>
                    </div>
                  );
                })}
                
                {eligiblePromotionsCount === 0 && (
                  <div className="p-6 text-center text-slate-500 bg-slate-950 rounded-xl border border-slate-850">
                     Tous les grades acquis ont été visés. Aucun élève n'est en attente d'évaluation de verset.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: RAPPORTS HEBDOMADAIRES DES CABINES (Qualitative Pasteur review) (F) */}
        {activeTab === 'rapports' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-4 shadow">
              <div>
                <h3 className="font-extrabold text-white text-base">Revue théologique des cabines de vendredi</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Les rapports ci-dessous sont soumis par les Pilotes de cabine. Veuillez passer en revue les leçons enseignées et décider d'archiver (sceller) les scores de la semaine ou de exiger des révisions.
                </p>
              </div>

              {reports.length === 0 ? (
                <div className="p-8 text-center text-slate-550">Aucun rapport hebdomadaire n'est encore enregistré.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reports.map((rep) => {
                    const sess = sessions.find(s => s.id === rep.session_id);
                    if (!sess) return null;

                    const isPending = rep.status === 'en_attente';
                    const isCorrection = rep.status === 'correction_demandee';
                    const isArchived = rep.status === 'archive';

                    return (
                      <div
                        key={rep.id}
                        id={`pastor-report-card-${rep.id}`}
                        className={`p-4 border rounded-xl space-y-3 shadow-md flex flex-col justify-between ${
                          isPending ? 'bg-slate-850 border-amber-500/30' :
                          isCorrection ? 'bg-rose-950/20 border-rose-800/40' :
                          'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="space-y-2.5">
                          {/* Card Header metadata */}
                          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                            <div>
                              <strong className="text-white text-base block">Pointage du {sess.session_date}</strong>
                              <span className="text-slate-400 text-xs">
                                Cabine: <strong className="text-slate-200">{sess.classe} — Groupe {sess.groupe}</strong>
                              </span>
                            </div>
                            
                            <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${
                              isPending ? 'bg-amber-955 text-amber-400 border-amber-800' :
                              isCorrection ? 'bg-rose-955 text-rose-400 border-rose-850' :
                              'bg-slate-800 text-slate-450 border-slate-750'
                            }`}>
                              {isPending ? 'En attente de revue' : isCorrection ? 'Correction demandée' : 'Archivé'}
                            </span>
                          </div>

                          {/* qualitative logs */}
                          <div className="space-y-2 text-xs leading-relaxed">
                            <div>
                              <em className="text-slate-450 uppercase font-mono text-[9px] block">Thème de la leçon enseignée</em>
                              <p className="font-semibold text-slate-200 mt-0.5">"{rep.notes_lesson || 'Aucun'}"</p>
                            </div>
                            <div>
                              <em className="text-slate-450 uppercase font-mono text-[9px] block">Observations comportement/attitude</em>
                              <p className="text-slate-350 mt-0.5">"{rep.notes_observations || 'Aucun'}"</p>
                            </div>
                            {rep.notes_discipline && (
                              <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-850">
                                <em className="text-slate-400 uppercase font-mono text-[9px] block">Incidents de discipline signalés</em>
                                <p className="text-rose-300 mt-0.5">"{rep.notes_discipline}"</p>
                              </div>
                            )}

                            {/* Show previous revision instructions if correction requested */}
                            {isCorrection && rep.leader_note && (
                              <div className="bg-rose-950/50 p-2 rounded border border-rose-900 text-[11px] text-rose-300">
                                <strong>Raison du rejet :</strong> "{rep.leader_note}"
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions (Only visiable for pending review status) */}
                        {isPending && (
                          <div className="flex gap-2 pt-3 border-t border-slate-800">
                            <button
                              onClick={() => setSelectedReportToCorrect(rep)}
                              className="flex-1 hover:bg-slate-800 text-slate-300 border border-slate-750 font-bold py-2 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-450" />
                              <span>Correction</span>
                            </button>
                            <button
                              onClick={() => handleReviewArchiveReport(rep.id)}
                              disabled={isProcessingReportId === rep.id}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-extrabold py-2 rounded-lg text-xs cursor-pointer transition shadow"
                            >
                              {isProcessingReportId === rep.id ? 'Octroi...' : '✓ Archiver'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: STATISTIQUES (ANALYTICS) */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Briefing de Commandement Intelligent (Gemini AI) */}
            <div id="gemini-commander-brief" className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/20 p-6 rounded-2xl shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    <span className="text-xs font-mono font-bold tracking-widest text-amber-400 uppercase">Cabinet de Commandement • Gemini AI</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">Rapport de Synthèse & Analyse Pastorale</h3>
                  <p className="text-xs text-slate-400 max-w-2xl">
                    Commandez une analyse stratégique basée sur les rapports de cours soumis et l'activation des grades. Idéal pour repérer les baisses de morale et guider l'action pastorale.
                  </p>
                </div>
                <button
                  id="generate-brief-btn"
                  onClick={handleGenerateAiBriefing}
                  disabled={aiLoading}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 duration-150 disabled:opacity-50 shrink-0 self-start md:self-center"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Analyse pastorale...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Rédiger le Briefing
                    </>
                  )}
                </button>
              </div>

              {aiBriefing && (
                <div className="mt-5 border-t border-slate-800 pt-5 text-slate-300">
                  <div className="bg-slate-950/50 p-5 rounded-xl border border-slate-850 overflow-auto max-h-[400px] leading-relaxed select-text font-sans text-sm prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: aiBriefing }} />
                </div>
              )}
            </div>
            {/* Overview Indicators */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow shadow-slate-950">
                <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-bold">Total Astronautes inscrits</span>
                <p className="text-3xl font-extrabold text-white mt-1">{astronautes.length}</p>
                <p className="text-xs text-slate-500 mt-1">Actifs: {astronautes.filter(a => a.status === 'astronaute_actif').length} • Recrues: {astronautes.filter(a => a.status === 'recrue').length}</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow shadow-slate-950">
                <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-bold">Total Promotions décernées</span>
                <p className="text-3xl font-extrabold text-white mt-1">{promotions.length}</p>
                <p className="text-xs text-slate-500 mt-1">Incitations et progression d'élite</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow shadow-slate-950">
                <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-bold">Points cumulés en Haiti</span>
                <p className="text-3xl font-extrabold text-amber-400 font-mono mt-1 mt-0.5">
                  {astronautes.reduce((sum, current) => sum + current.grand_total, 0)} pts
                </p>
                <p className="text-xs text-slate-500 mt-1">Valeur d'émulation gamifiée ASBF</p>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow shadow-slate-950">
                <span className="text-[10px] font-mono tracking-widest text-slate-450 uppercase block font-bold">Total Séances enseignées</span>
                <p className="text-3xl font-extrabold text-white mt-1">{sessions.length}</p>
                <p className="text-xs text-slate-500 mt-1">Archivées: {reports.filter(r => r.status === 'archive').length}</p>
              </div>
            </div>

            {/* Area and Bar charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow">
                <h4 className="font-extrabold text-white text-base">Effectif des cabines d'équipage (Actifs)</h4>
                <div className="h-64 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classTotalsArray}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                      <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                      <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }} />
                      <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                        {classTotalsArray.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#fbbf24' : '#38bdf8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3.5 shadow">
                <div className="flex justify-between items-center">
                  <h4 className="font-extrabold text-white text-base">Distribution globale des points décernés</h4>
                  <span className="text-[10px] font-mono font-medium text-slate-500">MOTEUR ASBF</span>
                </div>
                
                <p className="text-xs text-slate-450 leading-relaxed font-normal">
                   Les pointages sont accordés selon l'échelle suivante: Présence 30, À l'heure 40, Bible 50, Verset réussi 40, Propreté/Hygiène 30, Écharpe officielle 20, Bonne Conduite 40, Visiteur 25pts par invité.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: CONSOLE D'ADMINISTRATION */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            {/* Class Migration Module */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow">
              <div className="border-b border-slate-800 pb-3 mb-1">
                <h3 className="font-extrabold text-white text-base">Macro-moteur d'avancement des classes (Fin de Saison)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Déplace automatiquement une cohorte d'enfants d'une classe vers le niveau supérieur lors de la transition d'âge annuelle. Les points à vie restent intacts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="text-slate-450 block mb-1 font-bold">1. CLASSE SOURCE À VALIDER</label>
                  <select
                     value={migrationTargetClass}
                     onChange={e => setMigrationTargetClass(e.target.value as ClasseType)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300 font-bold"
                  >
                     <option value="Pionniers">Pionniers</option>
                     <option value="Explorateurs">Explorateurs</option>
                     <option value="Aventuriers">Aventuriers</option>
                     <option value="Aigles">Aigles</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-450 block mb-1 font-bold">2. CLASSE CIBLE DE DESTINATION</label>
                  <select
                     value={migrationPromoteTo}
                     onChange={e => setMigrationPromoteTo(e.target.value as ClasseType)}
                     className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-2 text-slate-300 font-bold"
                  >
                     <option value="Explorateurs">Explorateurs</option>
                     <option value="Aventuriers">Aventuriers</option>
                     <option value="Aigles">Aigles</option>
                     <option value="Archived">Archivé (Sortie de l'ASBF)</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleCohortMigrationPreview}
                    disabled={isMigrating}
                    className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 font-bold text-xs py-2 rounded-lg cursor-pointer flex justify-center items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isMigrating ? "animate-spin" : ""}`} />
                    <span>Calculer la simulation</span>
                  </button>
                </div>
              </div>

              {migrationPreview && (
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3.5 text-xs">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Candidats repérés : <strong className="text-white font-bold">{migrationPreview.candidates.length} astronautes</strong></span>
                    <span className="font-mono text-amber-500 font-bold uppercase text-[9px] tracking-wider">Simulation prête</span>
                  </div>
                  
                  <p className="text-slate-400 italic">"{migrationPreview.preview_text}"</p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMigrationPreview(null)}
                      className="bg-slate-900 border border-slate-800 text-slate-450 hover:text-white px-4 py-2 rounded-lg cursor-pointer"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleApplyCohortMigration}
                      disabled={isMigrating}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-6 py-2 rounded-lg cursor-pointer flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isMigrating ? "Enregistrement..." : "Appliquer l'avancement"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Assignments Matrix / Gestion du Personnel panel */}
            <GestionPersonnel
              allProfiles={allProfiles}
              onRefresh={onRefresh}
              showToast={showToast}
              currentUser={currentUser}
            />

            {/* AUDIT LOG EVENTS */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow">
              <div className="border-b border-slate-800 pb-3 mb-1 w-full">
                <h3 className="font-extrabold text-white text-base">Journaux d'audit de sécurité (GHOST SYSTEMS)</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Tous les événements de migrations cohortes, validations de grades d'élite ou modifications de codes s'enregistrent dans cette timeline infalsifiable.
                </p>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto">
                {auditLogs.sort((a,b) => b.created_at.localeCompare(a.created_at)).map(log => (
                  <div key={log.id} className="p-3 bg-slate-950 rounded-lg border border-slate-850/60 flex items-start justify-between text-xs gap-4 leading-relaxed font-normal">
                    <div>
                      <strong className="text-amber-500 font-bold uppercase font-mono text-[10px] tracking-wider block">{log.action}</strong>
                      <span className="text-slate-400 font-medium block mt-0.5 italic">"{log.reason}"</span>
                      <span className="text-[10px] text-slate-500 block mt-1 font-mono">Acteur: {log.actor_id} • Cible: {log.target_table} ({log.target_id})</span>
                    </div>
                    
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">{log.created_at.split('T')[0]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* DEV REBUILT MATRIX ONLY - Moving "Remettre à neuf" button to Administration, ONLY visible to developer (Requirement Group F-5) */}
            {currentUser.role === 'developer' && (
              <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-xl space-y-3 shadow shadow-red-950/20">
                <span className="text-[10px] font-mono tracking-widest text-rose-500 font-bold uppercase block">CONSOLE INGÉNIEUR DE DÉMONSTRATION</span>
                <p className="text-xs text-slate-400 leading-relaxed font-normal">
                   Cet outil de recalage à zéro est STRICTEMENT réservé à l'ingénieur de Ghost Systems de la plateforme d'évaluation. Il restaure tous les enregistrements fictifs de demo, les grades initiales ainsi que les pointages de test.
                </p>
                <button
                  id="btn-developer-db-reset-relocated"
                  type="button"
                  onClick={handleResetDbCTA}
                  className="bg-red-950 border border-red-800/80 hover:bg-red-900 text-rose-300 font-extrabold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Remettre à neuf la base</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: REGLAGES SYSTEME (SETTINGS) */}
        {activeTab === 'parametres' && (
          <div className="bg-slate-900 border border-slate-800/80 rounded-xl p-5 space-y-6 max-w-2xl shadow">
            <div>
              <h3 className="font-extrabold text-white text-base">Réglages Système globaux (ASBF)</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ajustez les seuils temporels de modifications ou verrouillez l'ensemble de la base de données.
              </p>
            </div>

            <div className="space-y-4">
              {/* Summer lock check */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between">
                <div>
                  <label className="font-bold text-white block text-sm flex items-center gap-1.5">
                    <span>Verrou de Pause d'Été</span>
                  </label>
                  <span className="text-slate-400 text-xs mt-1 block">
                    Gèle globalement toute la saisie de pointages ou demandes d'onboarding de cabines. Seul l'ingénieur Ghost Systems garde un accès en écriture.
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setSettingsPause(!settingsPause)}
                  className={`w-14 h-8 rounded-full flex items-center p-1 transition cursor-pointer ${
                    settingsPause ? 'bg-orange-500 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow" />
                </button>
              </div>

              {/* Correction hours window */}
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-850 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <div>
                    <label className="font-bold text-white block text-sm">Fenêtre de correction des pointages</label>
                    <span className="text-slate-400 text-xs mt-1 block">Durée accordée aux Pilotes pour corriger ou modifier les pointages des séances passées (en heures).</span>
                  </div>
                  <span className="font-mono font-extrabold text-amber-500 text-base">{settingsWindow} heures</span>
                </div>

                <input
                  type="range"
                  min={12}
                  max={120}
                  step={12}
                  value={settingsWindow}
                  onChange={e => setSettingsWindow(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <button
                onClick={handleSaveSettingsSubmit}
                disabled={isSavingSettings}
                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm py-2.5 rounded-xl cursor-pointer shadow transition duration-100 disabled:opacity-50"
              >
                {isSavingSettings ? 'Enregistrement...' : 'Sauvegarder les réglages système'}
              </button>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950 text-center text-xs text-slate-600 font-mono">
         PUPITRE ASBF • SÉCURITÉ GHOST SYSTEMS • MICRO-DÉPLOYEMENT EN CLOUD RUN CONTAINER
      </footer>

      {/* REPORT REVISION INPUT DIALOG (Correction Loop dialog modal) */}
      {selectedReportToCorrect && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl select-none">
            <div className="flex items-center gap-3 text-rose-450">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-white text-lg">Demander une révision</h3>
                <p className="text-xs text-slate-400">Rapport retourné à l'enseignant pour correction</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              Décrivez l'anomalie ou l'omission identifiée (ex: "Nom du visiteur de Samuel absent des notes" ou "Relancez le pointage verset de Dieuseul"). Ceci déverrouillera instantanément leur session pour saisie.
            </p>

            <div>
              <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold block mb-1">NOTES AUX PILOTES DE CABINE</label>
              <textarea
                value={leaderCorrectionNote}
                onChange={(e) => setLeaderCorrectionNote(e.target.value)}
                placeholder="Spécifiez précisément les corrections attendues..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-rose-500 outline-none h-24 placeholder:text-slate-600 resize-none font-medium text-slate-300"
              />
            </div>

            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setSelectedReportToCorrect(null);
                  setLeaderCorrectionNote('');
                }}
                className="flex-1 bg-slate-800 hover:bg-slate-755 text-slate-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={submitCorrectionDemand}
                disabled={isSavingCorrection || !leaderCorrectionNote.trim()}
                className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-extrabold text-xs py-2.5 rounded-xl cursor-pointer transition active:scale-[0.98]"
              >
                {isSavingCorrection ? 'Rejet en cours...' : 'Renvoyer à la cabine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historical Override Modal Dialog */}
      {overrideTargetScore && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl select-none">
            <div className="flex items-center gap-3 text-amber-500">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-white text-lg">Dérogation Historique</h3>
                <p className="text-xs text-slate-400">Modification de score fermée ({appSettings.correction_window_hours}h écoulées)</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-normal">
              La fenêtre de pointage de cette séance est expirée. Saisissez le motif de cette dérogation à des fins d'audit d'équipage :
            </p>

            <div>
              <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold block mb-1">MOTIF DE LA DÉROGATION</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ex. Re-vérification du verset du vendredi par Pasteur..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-amber-500 outline-none h-20 placeholder:text-slate-650 resize-none font-medium"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOverrideTargetScore(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={submitHistoricalOverride}
                disabled={isApplyingOverride || !overrideReason.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-extrabold text-xs py-2.5 rounded-xl cursor-pointer transition active:scale-[0.98]"
              >
                {isApplyingOverride ? 'Application...' : 'Appliquer'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
