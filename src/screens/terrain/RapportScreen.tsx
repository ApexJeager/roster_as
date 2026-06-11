import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AppSettings, Astronaute, Session, Report, Score } from '../../types';
import { api } from '../../lib/api';
import { Send, FileText, CheckCircle, AlertTriangle, Play, Lock, FileSpreadsheet, LockKeyhole } from 'lucide-react';

interface RapportScreenProps {
  currentUser: UserProfile;
  appSettings: AppSettings;
  astronautes: Astronaute[];
  sessions: Session[];
  reports: Report[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
}

export default function RapportScreen({
  currentUser,
  appSettings,
  astronautes,
  sessions,
  reports,
  onRefresh,
  showToast
}: RapportScreenProps) {
  // Current cabin/assignment details
  const myClass = currentUser.assignment?.classe || 'Aventuriers';
  const myGroup = currentUser.assignment?.groupe || 'Vert';

  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionScores, setSessionScores] = useState<Score[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [lessonContent, setLessonContent] = useState('');
  const [obsContent, setObsContent] = useState('');
  const [discContent, setDiscContent] = useState('');

  // Find cabin sessions
  const mySessions = useMemo(() => {
    return sessions
      .filter(s => s.classe === myClass && s.groupe === myGroup)
      .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
  }, [sessions, myClass, myGroup]);

  // Read-only logic check for copilote
  const isReadOnlyMode = useMemo(() => {
    if (currentUser.role === 'developer') return false;
    if (currentUser.role === 'copilote' && !currentUser.can_enter_data) return true;
    return false;
  }, [currentUser]);

  // Find active session from list
  useEffect(() => {
    if (mySessions.length > 0) {
      // Find today's session or select the latest one
      const todayString = new Date().toISOString().split('T')[0];
      const todaySess = mySessions.find(s => s.session_date === todayString);
      if (todaySess) {
        setActiveSession(todaySess);
      } else {
        setActiveSession(mySessions[0]);
      }
    } else {
      setActiveSession(null);
    }
  }, [mySessions]);

  // Load scores & pre-populate existing report fields for the active session
  useEffect(() => {
    if (activeSession) {
      loadSessionScores(activeSession.id);
      
      const existingRep = reports.find(r => r.session_id === activeSession.id);
      if (existingRep) {
        setLessonContent(existingRep.notes_lesson || '');
        setObsContent(existingRep.notes_observations || '');
        setDiscContent(existingRep.notes_discipline || '');
      } else {
        setLessonContent('');
        setObsContent('');
        setDiscContent('');
      }
    } else {
      setSessionScores([]);
    }
  }, [activeSession?.id, reports]);

  const loadSessionScores = async (sessionId: string) => {
    try {
      const allScores = await api.getScores();
      const filtered = allScores.filter(s => s.session_id === sessionId);
      setSessionScores(filtered);
    } catch {}
  };

  // Find if a report exists for the selected session
  const currentReport = useMemo(() => {
    if (!activeSession) return null;
    return reports.find(r => r.session_id === activeSession.id) || null;
  }, [activeSession, reports]);

  // Compute daily stats
  const activeClassRoster = useMemo(() => {
    return astronautes.filter(a => a.classe === myClass && a.groupe === myGroup && a.status === 'astronaute_actif');
  }, [astronautes, myClass, myGroup]);

  const presentsCount = useMemo(() => {
    return sessionScores.filter(s => s.presence).length;
  }, [sessionScores]);

  const absentsCount = useMemo(() => {
    return Math.max(0, activeClassRoster.length - presentsCount);
  }, [activeClassRoster, presentsCount]);

  const absentListNames = useMemo(() => {
    const presentIds = new Set(sessionScores.filter(s => s.presence).map(s => s.astronaute_id));
    return activeClassRoster
      .filter(a => !presentIds.has(a.id))
      .map(a => `${a.first_name} ${a.last_name}`)
      .join(', ');
  }, [activeClassRoster, sessionScores]);

  const biblesCount = useMemo(() => {
    return sessionScores.filter(s => s.presence && s.bible).length;
  }, [sessionScores]);

  const totalPointsGained = useMemo(() => {
    let sum = 0;
    sessionScores.forEach(sc => {
      if (sc.presence) sum += 30;
      if (sc.ponctuel) sum += 40;
      if (sc.bible) sum += 50;
      if (sc.verset) sum += 40;
      if (sc.proprete) sum += 30;
      if (sc.echarpe) sum += 20;
      if (sc.conduite) sum += 40;
      sum += (sc.visiteur || 0) * 25;
    });
    return sum;
  }, [sessionScores]);

  // Submit action
  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyMode) return;
    if (!activeSession) {
      showToast("Aucune séance active sélectionnée.", 'danger');
      return;
    }
    if (!lessonContent.trim() || !obsContent.trim()) {
      showToast("Veuillez renseigner la leçon étudiée et les observations.", 'danger');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.submitReport({
        session_id: activeSession.id,
        notes_lesson: lessonContent,
        notes_observations: obsContent,
        notes_discipline: discContent
      });
      showToast("Rapport envoyé avec succès! La séance est maintenant verrouillée.", 'success');
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'envoi du rapport.", 'danger');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter previous historic sessions of the cabin that have reports
  const historicReports = useMemo(() => {
    if (!activeSession) return [];
    return reports
      .filter(r => r.session_id !== activeSession.id && sessions.some(s => s.id === r.session_id && s.classe === myClass && s.groupe === myGroup))
      .sort((a, b) => b.id.localeCompare(a.id)); // approx sorting
  }, [reports, activeSession, sessions, myClass, myGroup]);

  // Summer pause poster display
  if (appSettings.summer_pause && currentUser.role !== 'developer') {
    return (
      <div className="flex flex-col items-center justify-center space-y-5 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-750 p-8 rounded-2xl text-center shadow-lg my-10 max-w-sm mx-auto select-none">
        <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/30 flex items-center justify-center animate-bounce">
          <LockKeyhole className="w-8 h-8 text-orange-500" />
        </div>
        <div className="space-y-2">
          <h3 className="text-2xl font-extrabold text-white">Pause d'Été ASBF</h3>
          <p className="text-slate-400 text-sm leading-relaxed">
            Le verrou de vacances d'été est actuellement <strong className="text-orange-400">Activé</strong> par le Pasteur président de l'ASBF.
          </p>
          <div className="p-3 bg-slate-950/50 rounded-xl mt-3 text-xs border border-slate-800/80 prose text-indigo-200">
             ⛱️ Saisie désactivée. Passez d'excellentes vacances en famille et rendez-vous à la rentrée !
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 flex flex-col h-full">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" />
          <span>Rapport Hebdomadaire</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Renseignez la partie théologique et qualitative de la séance d'aujourd'hui.
        </p>
      </div>

      {activeSession ? (
        <div className="space-y-5">
          {/* Active Session Stats Preview Card */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-750/60 shadow-md grid grid-cols-2 gap-3">
            <div className="col-span-2 border-b border-slate-800 pb-2 mb-1">
              <span className="text-[10px] font-mono tracking-wider font-bold text-slate-400 block uppercase">
                CABINE METRICS • SÉANCE DU {activeSession.session_date}
              </span>
            </div>
            
            <div className="p-3 bg-slate-900 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">Présents / Absents</span>
              <p className="text-base text-white font-bold mt-1">
                {presentsCount} / <span className="text-slate-400 font-normal">{absentsCount}</span>
              </p>
            </div>
            
            <div className="p-3 bg-slate-900 rounded-lg">
              <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">Bibles Apportées</span>
              <p className="text-base text-amber-400 font-bold mt-1">
                {biblesCount} <span className="text-xs text-slate-500 font-normal">/ {presentsCount}</span>
              </p>
            </div>

            <div className="p-3 bg-slate-900 rounded-lg col-span-2">
              <span className="text-[10px] uppercase font-semibold text-slate-400 font-mono">Total Points d'Équipage Récoltés</span>
              <p className="text-lg text-emerald-400 font-mono font-bold mt-0.5">
                +{totalPointsGained} pts
              </p>
            </div>

            {absentsCount > 0 && (
              <div className="col-span-2 bg-slate-900 px-3 py-2 rounded-lg text-xs">
                <span className="font-semibold text-slate-450 block">Absents :</span>
                <span className="text-slate-400 italic block mt-0.5">{absentListNames || 'Aucun'}</span>
              </div>
            )}
          </div>

          {/* Leader Correction Alert feedback loops (D) */}
          {currentReport && currentReport.status === 'correction_demandee' && (
            <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-rose-450">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h4 className="font-extrabold text-sm uppercase tracking-wide">CORRECTION DEMANDÉE • PRÉSIDENT</h4>
              </div>
              <p className="text-xs text-rose-300 font-medium bg-rose-950 px-3 py-2.5 rounded-lg border border-rose-900/60 leading-relaxed italic">
                "{currentReport.leader_note}"
              </p>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Le Pasteur pasteur a rejeté ce rapport. Veuillez ajuster les notes qualitatives ou relancer le pointage pour corriger l'erreur, puis cliquez sur "Renvoyer" pour re-verrouiller la fiche.
              </p>
            </div>
          )}

          {/* Form write fields */}
          {currentReport && currentReport.status === 'archive' ? (
            /* Locked because archived status (Read only) */
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center space-y-3 shadow-inner">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-400 font-bold">
                 ✓
              </div>
              <div>
                <h4 className="font-extrabold text-white">Rapport Archivé</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Ce rapport a été officiellement archivé et validé par Pasteur Jean-Baptiste. Les scores de vie de l'équipage sont gelés définitivement.
                </p>
              </div>

              <div className="text-left font-normal space-y-3 pt-3 text-sm bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                <div>
                  <strong className="text-slate-400 text-xs block uppercase">LEÇON DU JOUR</strong>
                  <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_lesson}</p>
                </div>
                <div>
                  <strong className="text-slate-400 text-xs block uppercase">OBSERVATIONS GENERALE</strong>
                  <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_observations}</p>
                </div>
                {currentReport.notes_discipline && (
                  <div>
                    <strong className="text-slate-400 text-xs block uppercase">DISCIPLINE ENREGISTRÉE</strong>
                    <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_discipline}</p>
                  </div>
                )}
              </div>
            </div>
          ) : currentReport && currentReport.status === 'en_attente' ? (
            /* Pending Approval block */
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center space-y-3 shadow-inner">
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-full flex items-center justify-center mx-auto text-amber-400 font-bold animate-pulse">
                …
              </div>
              <div>
                <h4 className="font-extrabold text-white">Rapport en attente de vérification</h4>
                <p className="text-xs text-slate-400 mt-1">
                  Le pointage est gelé. Le président de l'ASBF examine actuellement ce rapport hebdomadaire.
                </p>
              </div>

              <div className="text-left font-normal space-y-3 pt-3 text-sm bg-slate-950/40 p-4 rounded-xl border border-slate-850">
                <div>
                  <strong className="text-slate-400 text-xs block uppercase">LEÇON DU JOUR</strong>
                  <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_lesson}</p>
                </div>
                <div>
                  <strong className="text-slate-400 text-xs block uppercase">OBSERVATIONS GENERALE</strong>
                  <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_observations}</p>
                </div>
                {currentReport.notes_discipline && (
                  <div>
                    <strong className="text-slate-400 text-xs block uppercase">DISCIPLINE</strong>
                    <p className="mt-1 text-slate-250 font-medium">{currentReport.notes_discipline}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Open drafting form (en_attente/null) */
            <form onSubmit={handleSendReport} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block mb-1">
                  1. THÈME OU LEÇON ÉTUDIÉE *
                </label>
                <textarea
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Ex. L'histoire de Gédéon et les 300 soldats. Récit de courage..."
                  disabled={isReadOnlyMode || isSubmitting}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-amber-500 outline-none rounded-lg p-3 text-sm text-white h-20 placeholder:text-slate-650 resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block mb-1">
                  2. REMARQUES GÉNÉRALES / OBSERVATIONS ATTITUDE *
                </label>
                <textarea
                  value={obsContent}
                  onChange={(e) => setObsContent(e.target.value)}
                  placeholder="Ex. Excellente écoute générale aujourd'hui, les filles du groupe Vert ont posé bcp de questions."
                  disabled={isReadOnlyMode || isSubmitting}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-amber-500 outline-none rounded-lg p-3 text-sm text-white h-20 placeholder:text-slate-650 resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase block mb-1">
                  3. RAPPORT DISCIPLINE (FACULTATIF)
                </label>
                <textarea
                  value={discContent}
                  onChange={(e) => setDiscContent(e.target.value)}
                  placeholder="Ex. Un jalon d'avertissement pour Marc en raison de bavardages repetés lors de la prière."
                  disabled={isReadOnlyMode || isSubmitting}
                  className="w-full bg-slate-900 border border-slate-700/80 focus:border-amber-500 outline-none rounded-lg p-3 text-sm text-white h-20 placeholder:text-slate-650 resize-none"
                />
              </div>

              {!isReadOnlyMode ? (
                <button
                  type="submit"
                  disabled={isSubmitting || !lessonContent.trim() || !obsContent.trim()}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm py-3 rounded-xl shadow transition duration-150 active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? "Envoi..." : "Geler & Envoyer le Rapport"}</span>
                </button>
              ) : (
                <div className="p-3.5 bg-slate-800/60 rounded-xl text-center text-xs text-slate-400 border border-slate-750">
                  Accès en lecture seule : Votre compte ne peut pas soumettre le rapport de cabine.
                </div>
              )}
            </form>
          )}

          {/* Historical view at the bottom */}
          {historicReports.length > 0 && (
            <div className="space-y-2.5 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-mono tracking-widest text-slate-400 font-bold uppercase block">
                RECORDS HISTORIQUES ({historicReports.length})
              </h3>
              
              <div className="space-y-2.5">
                {historicReports.map(rep => {
                  const sess = sessions.find(s => s.id === rep.session_id);
                  return (
                    <div key={rep.id} className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-1.5 mb-1 text-slate-400 font-medium">
                        <span>Séance du {sess?.session_date || 'Date inconnue'}</span>
                        <span className="uppercase font-mono text-[9px] text-slate-500">Archivé</span>
                      </div>
                      <p className="text-slate-350"><strong>Leçon:</strong> {rep.notes_lesson}</p>
                      <p className="text-slate-350"><strong>Obs:</strong> {rep.notes_observations}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-8 bg-slate-900 border border-slate-850 rounded-xl text-slate-400 text-sm">
           Veuillez d'abord initialiser la séance d'aujourd'hui dans le premier onglet.
        </div>
      )}
    </div>
  );
}
