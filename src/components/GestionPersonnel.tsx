import React, { useState, useEffect } from 'react';
import { UserProfile, ClasseType, GroupeType, RoleType } from '../types';
import { api } from '../lib/api';
import { db } from '../lib/firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, Check, AlertCircle, ShieldAlert, Loader2, PlusCircle, Trash2 } from 'lucide-react';

interface GestionPersonnelProps {
  allProfiles: UserProfile[];
  onRefresh: () => Promise<void>;
  showToast: (msg: string, type: 'success' | 'danger' | 'info') => void;
  currentUser?: UserProfile | null;
}

export default function GestionPersonnel({
  allProfiles,
  onRefresh,
  showToast,
  currentUser
}: GestionPersonnelProps) {
  // Deletion modals state
  const [profileToDelete, setProfileToDelete] = useState<UserProfile | null>(null);
  const [deletingProfiles, setDeletingProfiles] = useState<Record<string, boolean>>({});

  // Dev can manage all profiles, standard Leaders can only manage 'pilote', 'copilote', and 'aide'
  const personnelProfiles = React.useMemo(() => {
    const isDev = currentUser && (currentUser.role === 'developer' || (currentUser.role as any) === 'Dev');
    if (isDev) {
      return allProfiles;
    }
    return allProfiles.filter(
      (p) => p.role === 'pilote' || p.role === 'copilote' || (p.role as string) === 'aide'
    );
  }, [allProfiles, currentUser]);

  const availableRoles = React.useMemo(() => {
    const isDev = currentUser && (currentUser.role === 'developer' || (currentUser.role as any) === 'Dev');
    if (isDev) {
      return [
        { value: 'pilote', label: 'Pilote (Chef de cabine)' },
        { value: 'copilote', label: 'Copilote (Assistant)' },
        { value: 'aide', label: 'Aide (Observateur)' },
        { value: 'leader', label: 'Leader (Administrateur)' },
        { value: 'developer', label: 'Dev (Super-Admin / GHOST)' }
      ];
    } else {
      return [
        { value: 'pilote', label: 'Pilote (Chef de cabine)' },
        { value: 'copilote', label: 'Copilote (Assistant)' },
        { value: 'aide', label: 'Aide (Observateur)' }
      ];
    }
  }, [currentUser]);

  // Local state representing the current UI state of personnel (for optimistic updates)
  const [personnelList, setPersonnelList] = useState<UserProfile[]>([]);
  
  // Track draft selections for dropdowns (class, group, and role) per profile
  const [drafts, setDrafts] = useState<Record<string, { classe: string; groupe: string; role: string }>>({});
  
  // Track loading state per profile ID
  const [updatingProfiles, setUpdatingProfiles] = useState<Record<string, boolean>>({});

  // Issue 3: form states for creating a new member
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<RoleType>('pilote');
  const [newClass, setNewClass] = useState<ClasseType | ''>('');
  const [newGroup, setNewGroup] = useState<GroupeType | ''>('');
  const [newCanEnterData, setNewCanEnterData] = useState(true);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);

  // Reset local lists when allProfiles prop updates
  useEffect(() => {
    setPersonnelList(personnelProfiles);
    
    // Initialize drafts map
    const initialDrafts: Record<string, { classe: string; groupe: string; role: string }> = {};
    personnelProfiles.forEach((p) => {
      initialDrafts[p.id] = {
        classe: p.assignment?.classe || '',
        groupe: p.assignment?.groupe || '',
        role: p.role || 'pilote'
      };
    });
    setDrafts(initialDrafts);
  }, [personnelProfiles]);

  // Handle local change in dropdowns before clicking "Update"
  const handleDropdownChange = (
    profileId: string,
    field: 'classe' | 'groupe' | 'role',
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
    const nextRole = draft.role as RoleType;

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
            assignment: nextAssignment,
            role: nextRole
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
        assignment: nextAssignment,
        role: nextRole
      });

      // 2. Try to hit backend PUT API for sync if setup
      try {
        await fetch(`/api/profiles/${profileId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: nextRole,
            assignment: nextAssignment
          })
        });
      } catch (err) {
        console.warn("Failed to sync role update to local backend database (this is fine if in pure Firestore mode):", err);
      }

      // 3. Fetch fresh data from Firebase via the parent callback to synchronize everything
      await onRefresh();
      
      showToast("Le rôle de l'utilisateur a été mis à jour avec succès.", 'success');
    } catch (error: any) {
      // ROLLBACK: Revert the local state list to the backup in case of error
      setPersonnelList(backupPersonnelList);
      
      // Keep drafts synchronized with the actual persistent state
      const revertedProfile = backupPersonnelList.find((p) => p.id === profileId);
      setDrafts((prev) => ({
        ...prev,
        [profileId]: {
          classe: revertedProfile?.assignment?.classe || '',
          groupe: revertedProfile?.assignment?.groupe || '',
          role: revertedProfile?.role || 'pilote'
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

  const handleDeleteProfile = async (profileId: string) => {
    setDeletingProfiles((prev) => ({ ...prev, [profileId]: true }));
    try {
      // 1. Delete from Firestore profiles collection using client api or direct deleteDoc
      await deleteDoc(doc(db, 'profiles', profileId));
      
      // Also try to delete from users collection just in case
      try {
        await deleteDoc(doc(db, 'users', profileId));
      } catch (err) {
        console.warn("Could not delete from users collection:", err);
      }

      // 2. Try to hit backend DELETE API if setup
      try {
        await fetch(`/api/profiles/${profileId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.warn("Failed to notify local Express DB (this is fine if in pure Firestore mode):", err);
      }

      showToast("Membre du personnel supprimé avec succès.", "success");
      setProfileToDelete(null);
      await onRefresh();
    } catch (error: any) {
      console.error(error);
      showToast(error.message || "Erreur lors de la suppression.", "danger");
    } finally {
      setDeletingProfiles((prev) => ({ ...prev, [profileId]: false }));
    }
  };

  const handleCreateProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPin.trim()) {
      showToast("Veuillez remplir tous les champs obligatoires (Nom complet, Email, PIN).", "danger");
      return;
    }

    setIsCreatingProfile(true);
    try {
      await api.createProfile({
        email: newEmail.trim(),
        full_name: newFullName.trim(),
        role: newRole,
        classe: newClass || null,
        groupe: newGroup || null,
        pin: newPin.trim(),
        can_enter_data: newCanEnterData
      });

      showToast("Nouveau membre du personnel créé avec succès.", "success");
      
      // Reset form fields
      setNewFullName('');
      setNewEmail('');
      setNewPin('');
      setNewRole('pilote');
      setNewClass('');
      setNewGroup('');
      setNewCanEnterData(true);
      setIsFormExpanded(false);

      // Trigger standard model sync
      await onRefresh();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Impossible de créer le profil.", "danger");
    } finally {
      setIsCreatingProfile(false);
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

      {/* Accordion creator form module to keep UI spacious */}
      <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4 space-y-3 shadow-inner">
        <button
          type="button"
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          className="flex justify-between items-center w-full text-left font-bold text-slate-200 hover:text-amber-400 transition"
        >
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-amber-500" />
            <span className="text-sm">Créer un nouveau membre du personnel</span>
          </div>
          <span className="text-[11px] text-slate-450 hover:text-slate-200 font-mono tracking-wide bg-slate-900 px-2 py-0.5 rounded transition">
            {isFormExpanded ? "Masquer ▲" : "Ouvrir ▼"}
          </span>
        </button>

        {isFormExpanded && (
          <form onSubmit={handleCreateProfileSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-3 border-t border-slate-850">
            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Nom complet *
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Ex. Sœur Marie-Ange"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Adresse Email *
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nom@rapport-astronautes.org"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Code PIN provisoire (4 chiffres) *
              </label>
              <input
                type="password"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN d'accès (ex. 7777)"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Rôle cabine *
              </label>
              <select
                value={newRole}
                onChange={(e) => {
                  const val = e.target.value as RoleType;
                  setNewRole(val);
                  if (val === 'aide') {
                    setNewCanEnterData(false);
                  } else {
                    setNewCanEnterData(true);
                  }
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:border-amber-500 outline-none"
              >
                {availableRoles.map((roleOpt) => (
                  <option key={roleOpt.value} value={roleOpt.value}>
                    {roleOpt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Classe de vol (Facultatif)
              </label>
              <select
                value={newClass}
                onChange={(e) => setNewClass(e.target.value as ClasseType | '')}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:border-amber-500 outline-none"
              >
                <option value="">-- Non affecté --</option>
                <option value="Pionniers">Pionniers (4-6 ans)</option>
                <option value="Explorateurs">Explorateurs (7-8 ans)</option>
                <option value="Aventuriers">Aventuriers (9-11 ans)</option>
                <option value="Aigles">Aigles (12-14 ans)</option>
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-mono tracking-wide text-slate-400 block mb-1">
                Groupe / Unité (Facultatif)
              </label>
              <select
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value as GroupeType | '')}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-350 focus:border-amber-500 outline-none"
              >
                <option value="">-- Non affecté --</option>
                <option value="Jaune">Jaune</option>
                <option value="Bleu">Bleu</option>
                <option value="Vert">Vert</option>
                <option value="Rouge">Rouge</option>
              </select>
            </div>

            <div className="md:col-span-2 flex items-center pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-400 font-medium hover:text-slate-200 transition">
                <input
                  type="checkbox"
                  checked={newCanEnterData}
                  onChange={(e) => setNewCanEnterData(e.target.checked)}
                  disabled={newRole === 'aide'}
                  className="rounded border-slate-800 bg-slate-900 text-amber-500 focus:ring-0 w-4 h-4 cursor-pointer"
                />
                <span>Autoriser la saisie directe de pointages hebdomadaires</span>
              </label>
            </div>

            <div className="flex justify-end items-center pt-2">
              <button
                type="submit"
                disabled={isCreatingProfile}
                className="w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2 rounded-lg flex items-center justify-center gap-1.5 transition text-xs font-bold leading-none shadow hover:shadow-amber-550/15 disabled:opacity-50 cursor-pointer"
              >
                {isCreatingProfile ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Créer le profil</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {personnelList.length === 0 ? (
        <div className="p-8 text-center text-slate-500 italic">
          Aucun membre du personnel avec rôle de pilote, copilote ou aide trouvé.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="gp-grid">
          {personnelList.map((p) => {
            const currentDraft = drafts[p.id] || { classe: '', groupe: '', role: p.role || 'pilote' };
            const isUpdating = updatingProfiles[p.id];
            
            // Check if actual saved value differs from the draft selection
            const isModified =
              (p.assignment?.classe || '') !== currentDraft.classe ||
              (p.assignment?.groupe || '') !== currentDraft.groupe ||
              (p.role || '') !== currentDraft.role;

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
                      p.role === 'developer' || (p.role as any) === 'Dev'
                        ? 'bg-purple-950/40 text-purple-400 border-purple-800/45'
                        : p.role === 'leader'
                        ? 'bg-rose-950/40 text-rose-400 border-rose-800/45'
                        : p.role === 'pilote'
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

                <div className="grid grid-cols-3 gap-2 pt-1.5 text-xs">
                  <div>
                    <label className="text-[10px] font-mono font-bold tracking-wide text-slate-450 block mb-1">
                      Rôle cabine
                    </label>
                    <select
                      id={`role-select-${p.id}`}
                      value={currentDraft.role || p.role}
                      onChange={(e) => handleDropdownChange(p.id, 'role', e.target.value)}
                      disabled={isUpdating}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-300 font-bold focus:border-amber-500 outline-none"
                    >
                      {availableRoles.map((roleOpt) => (
                        <option key={roleOpt.value} value={roleOpt.value}>
                          {roleOpt.value === 'developer' ? 'DEV' : roleOpt.value.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

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

                <div className="flex justify-end pt-1 gap-2">
                  {currentUser && (currentUser.role === 'developer' || (currentUser.role as any) === 'Dev') && (
                    <button
                      id={`gp-delete-btn-${p.id}`}
                      type="button"
                      onClick={() => setProfileToDelete(p)}
                      disabled={deletingProfiles[p.id]}
                      className="text-xs font-bold px-3.5 py-2 bg-red-600 hover:bg-red-500 hover:shadow-md text-white rounded-lg flex items-center gap-1.5 transition duration-150 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Supprimer</span>
                    </button>
                  )}
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

      {/* Confirmation Modal for user deletion */}
      {profileToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" id="gp-delete-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 bg-red-950/40 text-red-500 border border-red-800/50 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-lg font-extrabold text-white">Confirmation de suppression</h3>
              <p className="text-sm text-slate-400">
                Êtes-vous sûr de vouloir supprimer définitivement le membre du personnel{" "}
                <strong className="text-white font-black">{profileToDelete.full_name}</strong> ({profileToDelete.email}) ?
                Cette action est irréversible et supprimera également son accès.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                type="button"
                onClick={() => setProfileToDelete(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-lg text-xs cursor-pointer transition"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProfile(profileToDelete.id)}
                disabled={deletingProfiles[profileToDelete.id]}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
              >
                {deletingProfiles[profileToDelete.id] ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Suppression...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Oui, Supprimer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
