import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Score } from '../../types';
import { api } from '../../lib/api';
import { Calendar, Plus, ChevronDown, ChevronUp, Check, AlertTriangle, HelpCircle, Lock, RefreshCw, UserCheck } from 'lucide-react';
import VisitorCounter from '../../components/VisitorCounter';

interface PointageScreenProps {
  currentUser: UserProfile;
  appSettings: AppSettings;
  astronautes: Astronaute[];
  sessions: Session[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
}

export default function PointageScreen({
  currentUser,
  appSettings,
  astronautes,
  sessions,
  onRefresh,
  showToast
}: PointageScreenProps) {
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionScores, setSessionScores] = useState<Score[]>([]);
  const [expandedAstronauteId, setExpandedAstronauteId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingScoreId, setIsSavingScoreId] = useState<string | null>(null);
  
  // Historical override state
  const [overrideTargetScore, setOverrideTargetScore] = useState<Score | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isSavingOverride, setIsSavingOverride] = useState(false);

  // Volunteer's Cabin/Assignment
  const myClass = currentUser.assignment?.classe || 'Aventuriers';
  const myGroup = currentUser.assignment?.groupe || 'Vert';

  // Find all sessions for current volunteer's assignment
  const mySessions = useMemo(() => {
    return sessions
      .filter(s => s.classe === myClass && s.groupe === myGroup)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  }, [sessions, myClass, myGroup]);

  // Determine today's date formatted as YYYY-MM-DD
  const todayFormatted = useMemo(() => {
    const d = new Date();
    // Adjust if needed, but simple ISO date represents today well
    return d.toISOString().split('T')[0];
  }, []);

  // Filter astronauts active in the same cabin
  const myActiveAstronautes = useMemo(() => {
    return astronautes.filter(a => a.classe === myClass && a.groupe === myGroup);
  }, [astronautes, myClass, myGroup]);

  // Split into active scoring astronauts vs onboarding recruits
  const activeScorers = useMemo(() => {
    return myActiveAstronautes.filter(a => a.status === 'astronaute_actif');
  }, [myActiveAstronautes]);

  const recruits = useMemo(() => {
    return myActiveAstronautes.filter(a => a.status === 'recrue');
  }, [myActiveAstronautes]);

  // Load scores for selected session
  useEffect(() => {
    if (activeSession) {
      loadScoresForSession(activeSession.id);
    } else {
      // Auto-select latest session or today's session on mounting
      const todaySession = mySessions.find(s => s.session_date === todayFormatted);
      if (todaySession) {
        setActiveSession(todaySession);
      } else if (mySessions.length > 0) {
        setActiveSession(mySessions[0]);
      } else {
        setActiveSession(null);
        setSessionScores([]);
      }
    }
  }, [activeSession?.id, mySessions, todayFormatted]);

  const loadScoresForSession = async (sessionId: string) => {
    try {
      const scores = await api.getScores();
      const filtered = scores.filter(s => s.session_id === sessionId);
      setSessionScores(filtered);
    } catch (e) {
      showToast('Erreur lors du chargement des scores.', 'danger');
    }
  };

  const handleCreateTodaySession = async () => {
    if (appSettings.summer_pause && currentUser.role !== 'developer') {
      showToast("La pause d'été est active. Impossible d'ouvrir une séance.", 'danger');
      return;
    }
    setIsCreating(true);
    try {
      const newSession = await api.createSession({
        session_date: todayFormatted,
        classe: myClass,
        groupe: myGroup
      });
      showToast(`Séance du ${todayFormatted} déverrouillée avec succès!`, 'success');
      await onRefresh();
      setActiveSession(newSession);
    } catch (err: any) {
      showToast(err.message || "Erreur de création de séance.", 'danger');
    } finally {
      setIsCreating(false);
    }
  };

  // RLS Checks
  const isReadOnlyMode = useMemo(() => {
    if (currentUser.role === 'developer') return false;
    // Check if copilote lacks write rights
    if (currentUser.role === 'copilote' && !currentUser.can_enter_data) {
      return true;
    }
    return false;
  }, [currentUser]);

  const isSessionPastCorrectionWindow = useMemo(() => {
    if (!activeSession) return false;
    if (currentUser.role === 'developer' || currentUser.role === 'leader') return false;
    if (!activeSession.locked_at) return false;
    
    // Check locked window settings
    const lockedTime = new Date(activeSession.locked_at).getTime();
    const hrsGone = (Date.now() - lockedTime) / (1000 * 60 * 60);
    return hrsGone > appSettings.correction_window_hours;
  }, [activeSession, appSettings, currentUser]);

  const isLockedForVolunteer = useMemo(() => {
    if (isReadOnlyMode) return true;
    if (appSettings.summer_pause && currentUser.role !== 'developer') return true;
    if (isSessionPastCorrectionWindow) return true;
    // Standard locked state (if activeSession is locked but correction window hasn't expired, they can modify optimistically, unless expired)
    return false;
  }, [isReadOnlyMode, appSettings, isSessionPastCorrectionWindow, currentUser]);

  type ScoreBooleanField = 'presence' | 'ponctuel' | 'bible' | 'verset' | 'proprete' | 'echarpe' | 'conduite';

  const handleToggleScoreField = async (astId: string, field: ScoreBooleanField) => {
    if (isLockedForVolunteer) {
      if (isSessionPastCorrectionWindow) {
        // Prepare historical override
        const currentScore = sessionScores.find(s => s.astronaute_id === astId);
        if (currentScore) {
          // Trigger modal
          setOverrideTargetScore({ ...currentScore, [field]: !currentScore[field] } as Score);
          setOverrideReason('');
        }
        return;
      }
      showToast("Modifications verrouillées ou droits d'accès insuffisants.", 'danger');
      return;
    }

    const currentScore = sessionScores.find(s => s.astronaute_id === astId);
    if (!currentScore) return;

    const updatedFieldVal = !currentScore[field];
    
    // Optimistic Update
    setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? { ...s, [field]: updatedFieldVal } as Score : s));
    setIsSavingScoreId(astId);

    try {
      const saved = await api.saveScore({
        session_id: activeSession!.id,
        astronaute_id: astId,
        presence: field === 'presence' ? updatedFieldVal : currentScore.presence,
        ponctuel: field === 'ponctuel' ? updatedFieldVal : currentScore.ponctuel,
        bible: field === 'bible' ? updatedFieldVal : currentScore.bible,
        verset: field === 'verset' ? updatedFieldVal : currentScore.verset,
        proprete: field === 'proprete' ? updatedFieldVal : currentScore.proprete,
        echarpe: field === 'echarpe' ? updatedFieldVal : currentScore.echarpe,
        conduite: field === 'conduite' ? updatedFieldVal : currentScore.conduite,
        visiteurs: currentScore.visiteurs || 0,
      });
      // Update with exact payload
      setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? saved : s));
    } catch (err: any) {
      // Revert on error
      setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? currentScore : s));
      showToast(err.message || "Erreur de sauvegarde", 'danger');
    } finally {
      setIsSavingScoreId(null);
    }
  };

  const handleVisitorChange = async (astId: string, val: number) => {
    if (isLockedForVolunteer) {
      if (isSessionPastCorrectionWindow) {
        showToast("Modification historique impossible pour le compteur visiteur. Contactez un administrateur.", 'info');
        return;
      }
      return;
    }
    const currentScore = sessionScores.find(s => s.astronaute_id === astId);
    if (!currentScore) return;

    // Optimistic update
    setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? { ...s, visiteurs: val } as Score : s));
    setIsSavingScoreId(astId);

    try {
      const saved = await api.saveScore({
        session_id: activeSession!.id,
        astronaute_id: astId,
        presence: currentScore.presence,
        ponctuel: currentScore.ponctuel,
        bible: currentScore.bible,
        verset: currentScore.verset,
        proprete: currentScore.proprete,
        echarpe: currentScore.echarpe,
        conduite: currentScore.conduite,
        visiteurs: val
      });
      setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? saved : s));
    } catch (err: any) {
      setSessionScores(prev => prev.map(s => s.astronaute_id === astId ? currentScore : s));
      showToast(err.message || "Erreur de sauvegarde", 'danger');
    } finally {
      setIsSavingScoreId(null);
    }
  };

  const submitHistoricalOverride = async () => {
    if (!overrideTargetScore || !overrideReason.trim()) {
      showToast("Une justification écrite est obligatoire.", "danger");
      return;
    }
    setIsSavingOverride(true);
    try {
      const saved = await api.saveScore({
        session_id: activeSession!.id,
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
      showToast(`Dérogation historique appliquée pour ${overrideReason}!`, 'success');
      setOverrideTargetScore(null);
      setOverrideReason('');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Impossible d'appliquer la dérogation.", 'danger');
    } finally {
      setIsSavingOverride(false);
    }
  };

  // Score display helper
  const getAstronauteScore = (astId: string) => {
    const sc = sessionScores.find(s => s.astronaute_id === astId);
    if (!sc) return 0;
    
    // compute point sum
    let total = 0;
    if (sc.presence) total += 30;
    if (sc.ponctuel) total += 40;
    if (sc.bible) total += 50;
    if (sc.verset) total += 40;
    if (sc.proprete) total += 30;
    if (sc.echarpe) total += 20;
    if (sc.conduite) total += 40;
    total += (sc.visiteur || 0) * 25;
    return total;
  };

  const isPresent = (astId: string) => {
    const sc = sessionScores.find(s => s.astronaute_id === astId);
    return sc ? sc.presence : false;
  };

  const hasSessionForToday = mySessions.some(s => s.session_date === todayFormatted);

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Session Selection/Creation Banner */}
      <div className="bg-slate-800 p-4 rounded-xl border border-slate-700/60 shadow-md">
        <label className="text-[11px] font-mono tracking-widest text-slate-400 block mb-1.5 font-bold uppercase">
          SÉANCE ACTIVE • CABINE {myClass.toUpperCase()} {myGroup.toUpperCase()}
        </label>
        
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-amber-500" />
            {mySessions.length > 0 ? (
              <select
                id="session-select"
                value={activeSession?.id || ''}
                onChange={(e) => {
                  const s = mySessions.find(sess => sess.id === e.target.value);
                  if (s) setActiveSession(s);
                }}
                className="bg-slate-900 text-white border border-slate-700 rounded-lg px-3 py-1.5 text-base font-bold outline-none focus:border-amber-500 max-w-[200px]"
              >
                {mySessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Pointage du {s.session_date}
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-300 text-sm">Aucune séance ouverte</span>
            )}
          </div>

          {!hasSessionForToday && (
            <button
              onClick={handleCreateTodaySession}
              disabled={isCreating}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm px-4 py-2 rounded-lg shadow cursor-pointer disabled:opacity-50 transition active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>{isCreating ? 'Création...' : `Créer la séance du ${todayFormatted}`}</span>
            </button>
          )}
        </div>

        {/* Read-only notes */}
        {isReadOnlyMode && (
          <div className="mt-3 flex items-center gap-2 text-xs text-teal-300 bg-teal-950/50 p-2.5 rounded-lg border border-teal-800/50 leading-relaxed font-medium">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-teal-400" />
            <span>Accès restreint : Votre compte copilote n'a pas l'autorisation d'entrer les données.</span>
          </div>
        )}

        {appSettings.summer_pause && currentUser.role !== 'developer' && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-950/50 p-2.5 rounded-lg border border-red-800/50 leading-relaxed">
            <Lock className="w-4 h-4 flex-shrink-0" />
            <span>La pause d'été est active. Toutes les modifications de données sont verrouillées.</span>
          </div>
        )}

        {isSessionPastCorrectionWindow && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 p-2.5 rounded-lg border border-amber-800/50 leading-relaxed">
            <Lock className="w-4 h-4 flex-shrink-0 text-amber-500" />
            <span>La fenêtre de modification de {appSettings.correction_window_hours}h est expirée. Une justification sera requise pour modifier les scores (Dérogation).</span>
          </div>
        )}
      </div>

      {/* Main Roster List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Astronautes de ma classe</span>
            <span className="text-xs font-mono font-normal text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700/60">
              {activeScorers.length} actifs
            </span>
          </h2>
          {isSavingScoreId && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400 animate-pulse font-mono font-medium">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Auto-enregistrement...
            </span>
          )}
        </div>

        {activeScorers.length === 0 ? (
          <div className="text-center p-8 bg-slate-900 border border-slate-850 rounded-xl text-slate-400">
             Aucun astronaute actif n'est configuré dans cette classe.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeScorers.map((ast) => {
              const score = sessionScores.find(s => s.astronaute_id === ast.id);
              const totalPt = getAstronauteScore(ast.id);
              const present = isPresent(ast.id);
              const isExpanded = expandedAstronauteId === ast.id;

              return (
                <div
                  key={ast.id}
                  id={`pointage-row-${ast.id}`}
                  className={`bg-slate-800 border rounded-xl overflow-hidden shadow transition duration-150 ${
                    present ? 'border-amber-500/20 shadow-amber-500/5' : 'border-slate-700/60'
                  }`}
                >
                  {/* Collapsed Header Bar */}
                  <button
                    id={`ast-header-btn-${ast.id}`}
                    onClick={() => setExpandedAstronauteId(isExpanded ? null : ast.id)}
                    className="w-full flex items-center justify-between p-4 bg-slate-800 text-left hover:bg-slate-750 transition active:bg-slate-800 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-extrabold text-sm ${
                        present ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-slate-700 text-slate-400 border border-slate-650'
                      }`}>
                        {ast.first_name[0]}{ast.last_name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base leading-tight">
                          {ast.first_name} {ast.last_name}
                        </h4>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mt-0.5">
                          Total Vie: <span className="text-amber-400 font-mono text-xs">{ast.grand_total} pts</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Current Session Total Score */}
                      <div className="text-right">
                        <span className={`text-xs font-extrabold block uppercase tracking-wider ${
                          present ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          Séance
                        </span>
                        <span className={`font-mono font-bold text-base leading-none block mt-0.5 ${
                          present ? 'text-amber-400 text-lg' : 'text-slate-400'
                        }`}>
                          +{totalPt}
                        </span>
                      </div>
                      
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Detail Area */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-900/55 border-t border-slate-700/50 space-y-4">
                      {/* Quick reminder if they are absent */}
                      {!present && (
                        <div className="text-xs text-slate-450 bg-slate-850 p-3 rounded-lg border border-slate-800 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 flex-shrink-0 text-amber-500/70" />
                          <span>Cochez "Présence" ci-dessous pour déverrouiller sa fiche de pointage de ce Vendredi.</span>
                        </div>
                      )}

                      {/* Toggles Panel */}
                      <div className="space-y-2">
                        {/* 1. Presence (Always active unless read-only) */}
                        <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                          <div>
                            <span className="font-bold block text-sm text-white">Présence</span>
                            <span className="text-slate-400 text-xs mt-0.5 block">L'enfant est présent aujourd'hui (+30 pts)</span>
                          </div>
                          <button
                            id={`toggle-presence-${ast.id}`}
                            onClick={() => handleToggleScoreField(ast.id, 'presence')}
                            className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                              present ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                            } ${isReadOnlyMode || (appSettings.summer_pause && currentUser.role !== 'developer') ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <div className="w-6 h-6 rounded-full bg-white shadow flex items-center justify-center">
                              {present && <Check className="w-3.5 h-3.5 text-amber-600 font-extrabold" />}
                            </div>
                          </button>
                        </div>

                        {/* Interactive items (Disabled if absent) */}
                        <div className={`space-y-2 transition-opacity ${present ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                          {/* 2. Ponctuel */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">À l'heure</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">Arrivé avant la prière d'introduction (+40 pts)</span>
                            </div>
                            <button
                              id={`toggle-ponctuel-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'ponctuel')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.ponctuel ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 3. Bible */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">Apporter sa Bible</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">A sa propre Bible physique avec lui (+50 pts)</span>
                            </div>
                            <button
                              id={`toggle-bible-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'bible')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.bible ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 4. Verset */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">Verset récité</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">Récitation fidèle et fluide de mémoire (+40 pts)</span>
                            </div>
                            <button
                              id={`toggle-verset-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'verset')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.verset ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 5. Propreté */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">Hygiène/Propreté</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">Uniforme propre, ongles coupés (+30 pts)</span>
                            </div>
                            <button
                              id={`toggle-propreté-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'proprete')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.proprete ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 6. Écharpe */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">Écharpe/Cardigan</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">Port de l'écharpe régimentaire officielle (+20 pts)</span>
                            </div>
                            <button
                              id={`toggle-echarpe-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'echarpe')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.echarpe ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 7. Conduite */}
                          <div className="flex items-center justify-between p-3.5 bg-slate-800 rounded-xl border border-slate-700/45">
                            <div>
                              <span className="font-bold block text-sm text-white">Bonne Conduite</span>
                              <span className="text-slate-400 text-xs mt-0.5 block">Écoute active, pas de discipline (+40 pts)</span>
                            </div>
                            <button
                              id={`toggle-conduite-${ast.id}`}
                              onClick={() => handleToggleScoreField(ast.id, 'conduite')}
                              className={`w-14 h-8 rounded-full transition duration-200 flex items-center p-1 cursor-pointer ${
                                score?.conduite ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                              }`}
                            >
                              <div className="w-6 h-6 rounded-full bg-white shadow" />
                            </button>
                          </div>

                          {/* 8. Visiteur Counter */}
                          <VisitorCounter
                            value={score?.visiteurs || 0}
                            onChange={(val) => handleVisitorChange(ast.id, val)}
                            disabled={isLockedForVolunteer}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recruits Section Reminder (Sub-header) */}
      {recruits.length > 0 && (
        <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
              <span>Recrues en observation</span>
              <span className="text-[10px] font-mono bg-sky-950 text-sky-400 px-2 py-0.5 rounded-full border border-sky-800">
                {recruits.length} Recrue(s)
              </span>
            </h3>
          </div>
          
          <p className="text-xs text-slate-400 leading-relaxed font-normal">
            Le profil de ces enfants est <span className="font-bold text-amber-500">Verrouillé</span> tant qu'ils sont à l'état de Recrue. Ils ne peuvent accumuler de points réguliers. Accompagnez-les à travers les 4 jalons de la passerelle de démarrage dans l'onglet <strong className="text-slate-200 font-bold">"Mes Enfants"</strong> pour activer leur profil.
          </p>

          <div className="space-y-1.5 pt-1">
            {recruits.map(rec => (
              <div key={rec.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-lg border border-slate-850">
                <span className="text-xs font-bold text-slate-300">{rec.first_name} {rec.last_name}</span>
                <span className="text-[10px] uppercase font-mono tracking-wide text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-900">Pas de pointage</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historical Override Modal Dialog */}
      {overrideTargetScore && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-8 h-8 flex-shrink-0" />
              <div>
                <h3 className="font-extrabold text-white text-lg">Dérogation Historique</h3>
                <p className="text-xs text-slate-400">Séance expirée ({appSettings.correction_window_hours}h passées)</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Pour modifier le pointage de cette séance historique, vous devez fournir une explication claire. Cette action sera enregistrée dans les journaux d'audit de Ghost Systems.
            </p>

            <div>
              <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-bold block mb-1">MOTIF DE LA DÉROGATION</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Ex. Erreur d'entrée de Frère Marc, oubli de pointage verset..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:border-amber-500 outline-none h-20 placeholder:text-slate-600 resize-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setOverrideTargetScore(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-sm py-2.5 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={submitHistoricalOverride}
                disabled={isSavingOverride || !overrideReason.trim()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 font-extrabold text-sm py-2.5 rounded-xl cursor-pointer transition active:scale-[0.98]"
              >
                {isSavingOverride ? 'Envoi...' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
