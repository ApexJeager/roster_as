import React, { useState, useMemo } from 'react';
import { UserProfile, Astronaute, Grade, Promotion } from '../../types';
import { api } from '../../lib/api';
import { Plus, Users, Award, BookOpen, Check, HelpCircle, Shield, UserPlus, Sparkles, Trophy, CheckCircle2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import EligibilityBadge from '../../components/EligibilityBadge';
import RankTrack from '../../components/RankTrack';

interface MesEnfantsScreenProps {
  currentUser: UserProfile;
  astronautes: Astronaute[];
  grades: Grade[];
  promotions: Promotion[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
  triggerCelebration: (title: string, subtitle: string, badgeText: string) => void;
}

export default function MesEnfantsScreen({
  currentUser,
  astronautes,
  grades,
  promotions,
  onRefresh,
  showToast,
  triggerCelebration
}: MesEnfantsScreenProps) {
  const [expandedAstronauteId, setExpandedAstronauteId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newFirst, setNewFirst] = useState('');
  const [newLast, setNewLast] = useState('');
  const [newBirth, setNewBirth] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  const myClass = currentUser.assignment?.classe || 'Aventuriers';
  const myGroup = currentUser.assignment?.groupe || 'Vert';

  // Read-only logic check for copilote
  const isReadOnlyMode = useMemo(() => {
    if (currentUser.role === 'developer') return false;
    if (currentUser.role === 'copilote' && !currentUser.can_enter_data) return true;
    return false;
  }, [currentUser]);

  // Volunteers filter classmates
  const myAstronautes = useMemo(() => {
    return astronautes.filter(a => a.classe === myClass && a.groupe === myGroup);
  }, [astronautes, myClass, myGroup]);

  // Divide into Active and Recruits
  const activeChildren = useMemo(() => {
    return myAstronautes.filter(a => a.status === 'astronaute_actif');
  }, [myAstronautes]);

  const recruits = useMemo(() => {
    return myAstronautes.filter(a => a.status === 'recrue');
  }, [myAstronautes]);

  // Actions
  const handleOnboardingCheck = async (astId: string, field: 'fridays_done' | 'devise' | 'verset_officiel' | 'livres_nt', curVal: boolean) => {
    if (isReadOnlyMode) {
      showToast("Accès restreint : Votre compte copilote n'a pas l'autorisation d'entrer les données.", 'danger');
      return;
    }
    try {
      const saved = await api.updateOnboarding(astId, field, !curVal);
      await onRefresh();
      
      if (saved.celebrated) {
        triggerCelebration(
          `Félicitations, Nouvelle Recrue Activée !`,
          `Le profil de ${saved.astronaute.first_name} ${saved.astronaute.last_name} est déverrouillé ! Il/Elle peut officiellement accumuler ses scores d'équipage.`,
          `Astronaute Actif`
        );
      } else {
        showToast("Étape de démarrage mise à jour!", 'success');
      }
    } catch (err: any) {
      showToast(err.message || "Erreur de mise à jour.", 'danger');
    }
  };

  const handleValidateRank = async (astId: string, gradeId: string) => {
    if (isReadOnlyMode) {
      showToast("Accès restreint : Vous n'avez pas l'autorisation de valider les grades.", 'danger');
      return;
    }
    try {
      const prom = await api.validatePromotion(astId, gradeId);
      const mGrade = grades.find(g => g.id === gradeId);
      const mAst = astronautes.find(a => a.id === astId);
      
      await onRefresh();
      triggerCelebration(
        `Nouveau Grade Décroché !`,
        `Félicitations ! ${mAst?.first_name} est promu avec succès au rang de soldat d'élite !`,
        mGrade?.name || 'Gradé'
      );
    } catch (err: any) {
      showToast(err.message || "Erreur de promotion.", 'danger');
    }
  };

  const handleAddChild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyMode) return;
    if (!newFirst.trim() || !newLast.trim() || !newBirth) {
      showToast("Veuillez remplir tous les champs requis.", 'danger');
      return;
    }

    setIsSubmittingNew(true);
    try {
      await api.createAstronaute({
        first_name: newFirst,
        last_name: newLast,
        birthdate: newBirth,
        classe: myClass,
        groupe: myGroup
      });
      showToast(`Recrue ${newFirst} ajoutée avec succès! Remplissez ses 4 étapes pour l'activer.`, 'success');
      setNewFirst('');
      setNewLast('');
      setNewBirth('');
      setIsAdding(false);
      await onRefresh();
    } catch (err: any) {
      showToast(err.message || "Erreur de création de recrue.", 'danger');
    } finally {
      setIsSubmittingNew(false);
    }
  };

  // Helper current rank label for child
  const getAstronauteRankLabel = (ast: Astronaute) => {
    const astProms = promotions.filter(p => p.astronaute_id === ast.id);
    if (astProms.length === 0) return 'Recrue';
    
    // Find highest rank sort_order
    const validatedGrades = grades.filter(g => astProms.some(p => p.grade_id === g.id));
    if (validatedGrades.length === 0) return 'Astronaute Standard';
    
    const sorted = validatedGrades.sort((a, b) => b.sort_order - a.sort_order);
    return sorted[0].name;
  };

  return (
    <div className="space-y-5 flex flex-col h-full">
      {/* Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-amber-500" />
          <span>Fiches d'Équipage</span>
        </h2>
        
        {!isReadOnlyMode && (
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-900 font-extrabold text-xs px-3.5 py-2 rounded-lg cursor-pointer transition active:scale-[0.98] shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAdding ? 'Fermer' : 'Ajouter un enfant'}</span>
          </button>
        )}
      </div>

      {/* Add form */}
      {isAdding && (
        <form onSubmit={handleAddChild} className="bg-slate-800 p-4 border border-slate-700/60 rounded-xl space-y-4 shadow-lg">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">NOUVEL ENFANT — CLASSE DE VOL</h3>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Prénom</label>
              <input
                type="text"
                value={newFirst}
                onChange={e => setNewFirst(e.target.value)}
                placeholder="Ex. Samuel"
                className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">Nom</label>
              <input
                type="text"
                value={newLast}
                onChange={e => setNewLast(e.target.value)}
                placeholder="Ex. Étienne"
                className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Date de Naissance</span>
            </label>
            <input
              type="date"
              value={newBirth}
              onChange={e => setNewBirth(e.target.value)}
              className="w-full bg-slate-900 text-white border border-slate-700 rounded-lg p-2 text-sm outline-none focus:border-amber-500"
              required
            />
          </div>

          <div className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] text-slate-400 leading-relaxed space-y-1">
            <p>• Cabine: <strong className="text-slate-200">{myClass} ({myGroup})</strong></p>
            <p>• Rôle initial: <strong className="text-amber-500">Recrue en observation</strong></p>
          </div>

          <button
            type="submit"
            disabled={isSubmittingNew}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg cursor-pointer transition text-sm flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" />
            <span>{isSubmittingNew ? 'Sauvegarde...' : 'Ajouter à l\'équipage'}</span>
          </button>
        </form>
      )}

      {/* Recruits List Checkpoint Gate */}
      {recruits.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-mono tracking-widest text-slate-400 font-bold uppercase block">
            PASSERELLE DE DÉMARRAGE ({recruits.length})
          </h3>
          
          <div className="grid grid-cols-1 gap-3">
            {recruits.map(rec => {
              // Read onboarding fields
              const hasCheck_1 = rec.onboarding?.fridays_done || false;
              const hasCheck_2 = rec.onboarding?.devise || false;
              const hasCheck_3 = rec.onboarding?.verset_officiel || false;
              const hasCheck_4 = rec.onboarding?.livres_nt || false;
              
              const completedCount = [hasCheck_1, hasCheck_2, hasCheck_3, hasCheck_4].filter(Boolean).length;
              const isExpanded = expandedAstronauteId === rec.id;

              return (
                <div key={rec.id} className="bg-slate-800/80 border border-sky-800/40 rounded-xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-950/60 border border-sky-800/40 text-sky-400 font-bold flex items-center justify-center font-mono">
                        R
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-base">
                          {rec.first_name} {rec.last_name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Jalons complétés : <strong className="text-sky-400 font-mono">{completedCount}/4</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setExpandedAstronauteId(isExpanded ? null : rec.id)}
                      className="text-xs py-1.5 px-3 bg-slate-900 rounded-lg hover:bg-slate-750 text-slate-300 font-bold flex items-center gap-1 cursor-pointer border border-slate-700/60"
                    >
                      <span>{isExpanded ? 'Masquer' : 'Jalons'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  {/* Onboarding Steps Checklist (Expanded) */}
                  {isExpanded && (
                    <div className="space-y-2 pt-1 bg-slate-900/45 p-3 rounded-lg border border-slate-700/45">
                      {/* Checkbox 1 */}
                      <button
                        onClick={() => handleOnboardingCheck(rec.id, 'fridays_done', hasCheck_1)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          hasCheck_1 ? 'bg-sky-950/20 border-sky-800/40 text-sky-300' : 'bg-slate-800 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${hasCheck_1 ? 'bg-sky-400 border-sky-400 text-slate-950' : 'border-slate-600 bg-slate-900'}`}>
                            {hasCheck_1 && <Check className="w-3 h-3 font-extrabold" />}
                          </div>
                          <span>1. Présence à 3 séances de vendredi</span>
                        </div>
                      </button>

                      {/* Checkbox 2 */}
                      <button
                        onClick={() => handleOnboardingCheck(rec.id, 'devise', hasCheck_2)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          hasCheck_2 ? 'bg-sky-950/20 border-sky-800/40 text-sky-300' : 'bg-slate-800 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${hasCheck_2 ? 'bg-sky-400 border-sky-400 text-slate-950' : 'border-slate-600 bg-slate-900'}`}>
                            {hasCheck_2 && <Check className="w-3 h-3 font-extrabold" />}
                          </div>
                          <span>2. Savoir réciter la devise Astronautes</span>
                        </div>
                      </button>

                      {/* Checkbox 3 */}
                      <button
                        onClick={() => handleOnboardingCheck(rec.id, 'verset_officiel', hasCheck_3)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          hasCheck_3 ? 'bg-sky-950/20 border-sky-800/40 text-sky-300' : 'bg-slate-800 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${hasCheck_3 ? 'bg-sky-400 border-sky-400 text-slate-950' : 'border-slate-600 bg-slate-900'}`}>
                            {hasCheck_3 && <Check className="w-3 h-3 font-extrabold" />}
                          </div>
                          <span>3. Reciter le verset officiel d'onboarding</span>
                        </div>
                      </button>

                      {/* Checkbox 4 */}
                      <button
                        onClick={() => handleOnboardingCheck(rec.id, 'livres_nt', hasCheck_4)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left cursor-pointer transition ${
                          hasCheck_4 ? 'bg-sky-950/20 border-sky-800/40 text-sky-300' : 'bg-slate-800 border-slate-700/60 text-slate-400'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-xs">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${hasCheck_4 ? 'bg-sky-400 border-sky-400 text-slate-950' : 'border-slate-600 bg-slate-900'}`}>
                            {hasCheck_4 && <Check className="w-3 h-3 font-extrabold" />}
                          </div>
                          <span>4. Réciter les livres du Nouveau Testament</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Active Astronautes */}
      <div className="space-y-3 flex-1 overflow-y-auto">
        <h3 className="text-sm font-mono tracking-widest text-slate-400 font-bold uppercase block">
           ASTRONAUTES ACTIFS ({activeChildren.length})
        </h3>

        {activeChildren.length === 0 ? (
          <div className="text-center p-8 bg-slate-900 border border-slate-850 rounded-xl text-slate-400 text-sm">
             Aucun enfant actif dans cette classe pour l'instant.
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeChildren.map(ast => {
              const currentRank = getAstronauteRankLabel(ast);
              const astProms = promotions.filter(p => p.astronaute_id === ast.id);
              const isExpanded = expandedAstronauteId === ast.id;

              return (
                <div key={ast.id} className="bg-slate-800 border border-slate-700/60 rounded-xl p-4 space-y-4">
                  {/* Summary row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700 text-slate-300 flex items-center justify-center font-bold">
                        {ast.first_name[0]}{ast.last_name[0]}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-base leading-tight">
                          {ast.first_name} {ast.last_name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-xs text-slate-300 font-bold">{currentRank}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-semibold block text-slate-400 uppercase tracking-wider">Score Total</span>
                      <span className="font-mono text-lg font-extrabold text-amber-400">{ast.grand_total} pts</span>
                    </div>
                  </div>

                  {/* Rank eligibility container (Promote banner) */}
                  <EligibilityBadge
                    grandTotal={ast.grand_total}
                    promotions={astProms}
                    allGrades={grades}
                    canValidate={!isReadOnlyMode}
                    onTriggerValidate={(gId) => handleValidateRank(ast.id, gId)}
                  />

                  {/* Expansion for Points / Rank details */}
                  <div className="border-t border-slate-700/50 pt-3">
                    <button
                      onClick={() => setExpandedAstronauteId(isExpanded ? null : ast.id)}
                      className="w-full flex items-center justify-between text-xs text-slate-400 font-bold hover:text-white cursor-pointer"
                    >
                      <span>{isExpanded ? 'Masquer la jauge de grade' : 'Voir la jauge de grade'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    
                    {isExpanded && (
                      <div className="pt-3">
                        <RankTrack
                          grandTotal={ast.grand_total}
                          promotions={astProms}
                          allGrades={grades}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
