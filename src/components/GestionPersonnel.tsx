import React, { useState, useEffect } from 'react';
import { UserProfile, ClasseType, GroupeType } from '../types';
import { api } from '../lib/api';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Users, Check, AlertCircle, ShieldAlert, Loader2 } from 'lucide-react';

interface GestionPersonnelProps {
  allProfiles: UserProfile[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
}

export default function GestionPersonnel({
  allProfiles,
  onRefresh,
  showToast
}: GestionPersonnelProps) {
  // Filter all profiles to get only 'pilote', 'copilote', or 'aide' roles
  const personnelProfiles = React.useMemo(() => {
    return allProfiles.filter(
      (p) => p.role === 'pilote' || p.role === 'copilote' || (p.role as string) === 'aide'
    );
  }, [allProfiles]);

  // Local state representing the current UI state of personnel (for optimistic updates)
  const [personnelList, setPersonnelList] = useState<UserProfile[]>([]);
  
  // Track draft selections for dropdowns (class and group) per profile
  const [drafts, setDrafts] = useState<Record<string, { classe: string; groupe: string }>>({});
  
  // Track loading state per profile ID
  const [updatingProfiles, setUpdatingProfiles] = useState<Record<string, boolean>>({});

  // Reset local lists when allProfiles prop updates
  useEffect(() => {
    setPersonnelList(personnelProfiles);
    
    // Initialize drafts map
    const initialDrafts: Record<string, { classe: string; groupe: string }> = {};
    personnelProfiles.forEach((p) => {
      initialDrafts[p.id] = {
        classe: p.assignment?.classe || '',
        groupe: p.assignment?.groupe || ''
      };
    });
    setDrafts(initialDrafts);
  }, [personnelProfiles]);

  // Handle local change in dropdowns before clicking "Update"
  const handleDropdownChange = (
    profileId: string,
    field: 'classe' | 'groupe',
    value: string
  ) => {
    setDrafts((prev) => ({
      ...prev,
      [profileId]: {
        ...prev[profileId],
        [field]: value
      }
    }));
  };

  // Perform optimistic update to Firestore 'profiles' collection
  const handleUpdateAssignment = async (profileId: string) => {
    const draft = drafts[profileId];
    if (!draft) return;

    const nextClass = draft.classe as ClasseType | '';
    const nextGroup = draft.groupe as GroupeType | '';

    // Create the backup of current personnel list (before optimistic change)
    const backupPersonnelList = [...personnelList];

    // Formulate the target assignment object
    const nextAssignment = nextClass && nextGroup ? { classe: nextClass, groupe: nextGroup } : null;

    // Perform the optimistic update on the local state list immediately
    setPersonnelList((prev) =>
      prev.map((p) => {
        if (p.id === profileId) {
          return {
            ...p,
            assignment: nextAssignment
          };
        }
        return p;
      })
    );

    // Set loading indicator
    setUpdatingProfiles((prev) => ({ ...prev, [profileId]: true }));
    showToast(`Mise à jour optimiste initiée pour ce profil...`, 'info');

    try {
      // 1. Update Firestore database directly
      const profileRef = doc(db, 'profiles', profileId);
      await updateDoc(profileRef, {
        assignment: nextAssignment
      });

      // 2. Fetch fresh data from Firebase via the parent callback to synchronize everything
      await onRefresh();
      
      showToast('Affectation cabine sauvegardée à vie dans le réseau.', 'success');
    } catch (error: any) {
      // ROLLBACK: Revert the local state list to the backup in case of error
      setPersonnelList(backupPersonnelList);
      
      // Keep drafts synchronized with the actual persistent state
      const revertedProfile = backupPersonnelList.find((p) => p.id === profileId);
      setDrafts((prev) => ({
        ...prev,
        [profileId]: {
          classe: revertedProfile?.assignment?.classe || '',
          groupe: revertedProfile?.assignment?.groupe || ''
        }
      }));

      console.error('Optimistic assignment update failed:', error);
      showToast(
        `Échec de la mise à jour (Restauration effectuée) : ${error?.message || 'Permission refusée'}`,
        'danger'
      );
    } finally {
      // Clear loading indicator
      setUpdatingProfiles((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow" id="gestion-personnel-module">
      <div className="border-b border-slate-800 pb-3 mb-1">
        <div className="flex items-center gap-2 text-amber-500">
          <Users className="w-5 h-5" id="gp-icon" />
          <h3 className="font-extrabold text-white text-base">Gestion du Personnel Cabine (Pilotes & Aides)</h3>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Affectez directement des classes de vol et des couleurs de groupe aux pilotes, copilotes et aides de cabine.
        </p>
      </div>

      {personnelList.length === 0 ? (
        <div className="p-8 text-center text-slate-500 italic">
          Aucun membre du personnel avec rôle de pilote, copilote ou aide trouvé.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="gp-grid">
          {personnelList.map((p) => {
            const currentDraft = drafts[p.id] || { classe: '', groupe: '' };
            const isUpdating = updatingProfiles[p.id];
            
            // Check if actual saved value differs from the draft selection
            const isModified =
              (p.assignment?.classe || '') !== currentDraft.classe ||
              (p.assignment?.groupe || '') !== currentDraft.groupe;

            return (
              <div
                key={p.id}
                className="p-4 bg-slate-950 rounded-xl border border-slate-850 flex flex-col justify-between space-y-3 hover:border-slate-800 transition"
                id={`gp-card-${p.id}`}
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <strong className="text-white text-base block font-bold">{p.full_name}</strong>
                      <span className="text-xs text-slate-500 font-mono block mt-0.5">{p.email}</span>
                    </div>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                      p.role === 'pilote'
                        ? 'bg-amber-950/40 text-amber-500 border-amber-800/45'
                        : p.role === 'copilote'
                        ? 'bg-sky-950/40 text-sky-400 border-sky-800/45'
                        : 'bg-emerald-950/40 text-emerald-400 border-emerald-800/45'
                    }`}>
                      {p.role}
                    </span>
                  </div>

                  {/* Badge showing currently persistent/optimistic value for visual clarity */}
                  <div className="mt-2 text-xs">
                    {p.assignment ? (
                      <span className="text-[10.5px] bg-slate-900 border border-slate-800 text-slate-350 px-2.5 py-0.5 rounded font-mono font-bold leading-none inline-block">
                        En poste : {p.assignment.classe.toUpperCase()} • UNITÉ {p.assignment.groupe.toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[10.5px] text-slate-550 italic font-medium">
                        Non affecté à une cabine de vol
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1.5 text-xs">
                  <div>
                    <label className="text-[10px] font-mono font-bold tracking-wide text-slate-450 block mb-1">
                      Classe de vol
                    </label>
                    <select
                      id={`class-select-${p.id}`}
                      value={currentDraft.classe}
                      onChange={(e) => handleDropdownChange(p.id, 'classe', e.target.value)}
                      disabled={isUpdating}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 font-bold focus:border-amber-500 outline-none"
                    >
                      <option value="">-- Non affecté --</option>
                      <option value="Pionniers">Pionniers (4-6 ans)</option>
                      <option value="Explorateurs">Explorateurs (7-8 ans)</option>
                      <option value="Aventuriers">Aventuriers (9-11 ans)</option>
                      <option value="Aigles">Aigles (12-14 ans)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono font-bold tracking-wide text-slate-450 block mb-1">
                      Groupe / Unité
                    </label>
                    <select
                      id={`group-select-${p.id}`}
                      value={currentDraft.groupe}
                      onChange={(e) => handleDropdownChange(p.id, 'groupe', e.target.value)}
                      disabled={isUpdating}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 font-bold focus:border-amber-500 outline-none"
                    >
                      <option value="">-- Non affecté --</option>
                      <option value="Vert">Vert</option>
                      <option value="Rouge">Rouge</option>
                      <option value="Bleu">Bleu</option>
                      <option value="Jaune">Jaune</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    id={`gp-update-btn-${p.id}`}
                    type="button"
                    onClick={() => handleUpdateAssignment(p.id)}
                    disabled={isUpdating || !isModified}
                    className={`text-xs font-black tracking-wide px-4 py-2 rounded-lg flex items-center gap-1.5 transition duration-150 cursor-pointer text-slate-950 font-extrabold ${
                      isModified
                        ? 'bg-amber-500 hover:bg-amber-400 hover:shadow-md'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-850'
                    }`}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mise à jour...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Mettre à jour</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
