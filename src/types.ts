/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RoleType = 'developer' | 'leader' | 'pilote' | 'copilote';

export type ClasseType = 'Pionniers' | 'Explorateurs' | 'Aventuriers' | 'Aigles';

export type GroupeType = 'Jaune' | 'Bleu' | 'Vert' | 'Rouge';

export type OnboardingStatus = 'recrue' | 'astronaute_actif' | 'inactif';

export type ReportStatus = 'en_attente' | 'archive' | 'correction_demandee';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: RoleType;
  can_enter_data: boolean;
  pin: string;
  assignment: {
    classe: ClasseType;
    groupe: GroupeType;
  } | null;
}

export interface Astronaute {
  id: string;
  first_name: string;
  last_name: string;
  birthdate: string; // YYYY-MM-DD
  classe: ClasseType;
  groupe: GroupeType;
  status: OnboardingStatus;
  grand_total: number;
  legacy_source: string | null;
  created_at: string;
}

export interface Onboarding {
  astronaute_id: string;
  fridays_done: boolean;
  devise: boolean;
  verset_officiel: boolean;
  livres_nt: boolean;
  completed_at: string | null;
}

export interface Session {
  id: string;
  session_date: string; // YYYY-MM-DD
  classe: ClasseType;
  groupe: GroupeType;
  locked_at: string | null;
  created_by: string;
}

export interface Score {
  id: string;
  session_id: string;
  astronaute_id: string;
  presence: boolean;
  ponctuel: boolean;
  bible: boolean;
  verset: boolean;
  proprete: boolean;
  echarpe: boolean;
  conduite: boolean;
  visiteurs: number; // counter
  total_jour: number; // calculated on-the-fly or saved
}

export interface Grade {
  id: string;
  points_required: number;
  name: string;
  verses: string;
  sort_order: number;
}

export interface Promotion {
  id: string;
  astronaute_id: string;
  grade_id: string;
  validated_by: string;
  validated_at: string;
}

export interface Report {
  id: string;
  session_id: string;
  notes_lesson: string;
  notes_observations: string;
  notes_discipline: string;
  status: ReportStatus;
  submitted_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  leader_note?: string;
}

export interface AppSettings {
  summer_pause: boolean;
  correction_window_hours: number;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  target_table: string;
  target_id: string;
  old_value: any;
  new_value: any;
  reason: string;
  created_at: string;
}

// Client status structures
export interface ClientAuthPayload {
  currentUser: UserProfile | null;
}

export interface LoginSession {
  token: string;
  profile_id: string;
  created_at: string;
}

// RLS Scope helper
export function canUserWriteRoom(
  user: UserProfile,
  classe: ClasseType,
  groupe: GroupeType
): boolean {
  if (user.role === 'developer') return true;
  if (user.role === 'leader') return false; // Leader cannot input raw scoring unless developer
  
  // For pilotes and copilotes, check room matching and can_enter_data if copilote
  if (user.role === 'pilote') {
    return user.assignment?.classe === classe && user.assignment?.groupe === groupe;
  }
  if (user.role === 'copilote') {
    return (
      user.can_enter_data &&
      user.assignment?.classe === classe &&
      user.assignment?.groupe === groupe
    );
  }
  return false;
}

export function canUserViewRoom(
  user: UserProfile,
  classe: ClasseType,
  groupe: GroupeType
): boolean {
  if (user.role === 'developer' || user.role === 'leader') return true;
  return user.assignment?.classe === classe && user.assignment?.groupe === groupe;
}
