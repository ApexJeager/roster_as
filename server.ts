/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
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
  GroupeType,
  LoginSession
} from './src/types';

declare global {
  namespace Express {
    interface Request {
      user: UserProfile;
    }
  }
}

const DB_FILE = path.join(process.cwd(), 'db.json');

// Exact grades from Section C5
const DEFAULT_GRADES: Grade[] = [
  { id: 'g1', points_required: 400, name: 'Astronaute 3e classe', verses: 'Jean 3:16-18', sort_order: 1 },
  { id: 'g2', points_required: 800, name: 'Astronaute 2e classe', verses: 'Rom 10:9, 10, 13', sort_order: 2 },
  { id: 'g3', points_required: 1300, name: 'Astronaute 1e classe', verses: '1 Jean 2:2-5', sort_order: 3 },
  { id: 'g4', points_required: 1800, name: 'Sergent', verses: 'Ps 23', sort_order: 4 },
  { id: 'g5', points_required: 2300, name: 'Sergent Chef', verses: 'Ps 1', sort_order: 5 },
  { id: 'g6', points_required: 2900, name: 'Adjudant', verses: 'Jn 14:6; Jn 8:24; Jn 10:12; Héb 7:25', sort_order: 6 },
  { id: 'g7', points_required: 3500, name: 'Adjudant Chef', verses: 'Es 12:2; Actes 4:12; 2 Cor 6:2; Jean 1:12', sort_order: 7 },
  { id: 'g8', points_required: 4000, name: 'Sous-lieutenant', verses: 'Rom 8:37-39', sort_order: 8 },
  { id: 'g9', points_required: 4500, name: 'Lieutenant', verses: 'Ésaïe 53:1-6', sort_order: 9 },
  { id: 'g10', points_required: 5100, name: 'Capitaine', verses: 'Phil. 2:5-11', sort_order: 10 },
  { id: 'g11', points_required: 5700, name: 'Major', verses: '2 Tim. 1:7-14', sort_order: 11 },
  { id: 'g12', points_required: 6400, name: 'Lieutenant-Colonel', verses: '1 Thes 4:13-18', sort_order: 12 },
  { id: 'g13', points_required: 7100, name: 'Colonel', verses: 'Eph 6:11-17', sort_order: 13 },
  { id: 'g14', points_required: 7900, name: 'Brigadier Général', verses: 'Jean 10:1-11', sort_order: 14 },
  { id: 'g15', points_required: 8800, name: 'Major Général', verses: 'Prov. 3:1-10', sort_order: 15 },
  { id: 'g16', points_required: 9700, name: 'Lieutenant-Général', verses: 'Jean 1:1-14', sort_order: 16 },
  { id: 'g17', points_required: 10700, name: 'Général', verses: 'Ps 91', sort_order: 17 },
  { id: 'g18', points_required: 12000, name: 'Coupe de Timothée', verses: '1 Tim 4:1-16', sort_order: 18 }
];

const DEFAULT_PROFILES: UserProfile[] = [
  { id: 'dev_user', email: 'dev@rapport-astronautes.org', full_name: 'Luc (Ghost Systems)', role: 'developer', can_enter_data: true, pin: '0000', assignment: null },
  { id: 'leader_user', email: 'president@rapport-astronautes.org', full_name: 'Pasteur Jean-Baptiste', role: 'leader', can_enter_data: false, pin: '1111', assignment: null },
  { id: 'pilote_a', email: 'pilote.aventuriers@rapport-astronautes.org', full_name: 'Frère Marc', role: 'pilote', can_enter_data: true, pin: '2222', assignment: { classe: 'Aventuriers', groupe: 'Vert' } },
  { id: 'pilote_b', email: 'pilote.aigles@rapport-astronautes.org', full_name: 'Sœur Élisabeth', role: 'pilote', can_enter_data: true, pin: '3333', assignment: { classe: 'Aigles', groupe: 'Rouge' } },
  { id: 'copilote_a', email: 'copilote.aventuriers@rapport-astronautes.org', full_name: 'Frère Samuel', role: 'copilote', can_enter_data: true, pin: '4444', assignment: { classe: 'Aventuriers', groupe: 'Vert' } }
];

// Seed 12 Astronautes spread across rooms with varied points
const DEFAULT_ASTRONAUTES: Astronaute[] = [
  // Aventuriers Vert (Marc/Samuel)
  { id: 'ast_1', first_name: 'Dieuseul', last_name: 'Pierre', birthdate: '2015-08-14', classe: 'Aventuriers', groupe: 'Vert', status: 'astronaute_actif', grand_total: 1950, legacy_source: null, created_at: '2024-09-01T10:00:00Z' },
  { id: 'ast_2', first_name: 'Marie-Claire', last_name: 'Joseph', birthdate: '2016-03-22', classe: 'Aventuriers', groupe: 'Vert', status: 'recrue', grand_total: 0, legacy_source: null, created_at: '2026-05-10T14:30:00Z' },
  { id: 'ast_3', first_name: 'Jean-René', last_name: 'Noel', birthdate: '2015-11-05', classe: 'Aventuriers', groupe: 'Vert', status: 'astronaute_actif', grand_total: 380, legacy_source: null, created_at: '2025-10-15T09:00:00Z' },
  { id: 'ast_4', first_name: 'Esther', last_name: 'Gabriel', birthdate: '2016-01-19', classe: 'Aventuriers', groupe: 'Vert', status: 'astronaute_actif', grand_total: 950, legacy_source: 'Ancienne Fiche-A', created_at: '2025-01-20T10:00:00Z' },
  
  // Aigles Rouge (Élisabeth)
  { id: 'ast_5', first_name: 'Peterson', last_name: 'Altidor', birthdate: '2013-05-30', classe: 'Aigles', groupe: 'Rouge', status: 'astronaute_actif', grand_total: 3100, legacy_source: null, created_at: '2023-09-02T08:00:00Z' },
  { id: 'ast_6', first_name: 'Naomi', last_name: 'Jean', birthdate: '2014-12-11', classe: 'Aigles', groupe: 'Rouge', status: 'astronaute_actif', grand_total: 0, legacy_source: null, created_at: '2026-06-01T15:00:00Z' },
  { id: 'ast_7', first_name: 'Woodley', last_name: 'Chery', birthdate: '2012-04-18', classe: 'Aigles', groupe: 'Rouge', status: 'astronaute_actif', grand_total: 5200, legacy_source: null, created_at: '2022-09-10T10:00:00Z' },
  { id: 'ast_8', first_name: 'Ruthna', last_name: 'Saint-Phard', birthdate: '2013-10-09', classe: 'Aigles', groupe: 'Rouge', status: 'inactif', grand_total: 150, legacy_source: null, created_at: '2024-09-15T11:00:00Z' },
  
  // Developer/Leader exploration rooms
  { id: 'ast_9', first_name: 'Clerge', last_name: 'Bennett', birthdate: '2020-01-12', classe: 'Pionniers', groupe: 'Jaune', status: 'astronaute_actif', grand_total: 450, legacy_source: null, created_at: '2026-02-01T09:00:00Z' },
  { id: 'ast_10', first_name: 'Manoach', last_name: 'Dorvil', birthdate: '2018-06-03', classe: 'Explorateurs', groupe: 'Bleu', status: 'astronaute_actif', grand_total: 820, legacy_source: null, created_at: '2025-09-20T10:00:00Z' },
  { id: 'ast_11', first_name: 'Sarah', last_name: 'Theodore', birthdate: '2020-05-15', classe: 'Pionniers', groupe: 'Bleu', status: 'recrue', grand_total: 0, legacy_source: null, created_at: '2026-05-01T10:00:00Z' },
  { id: 'ast_12', first_name: 'Toussaint', last_name: 'Louverture', birthdate: '2011-10-30', classe: 'Aigles', groupe: 'Vert', status: 'astronaute_actif', grand_total: 12500, legacy_source: 'Archive-R8', created_at: '2021-09-01T10:00:00Z' }
];

const DEFAULT_ONBOARDING: Onboarding[] = [
  { astronaute_id: 'ast_1', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2024-10-12T17:00:00Z' },
  { astronaute_id: 'ast_2', fridays_done: false, devise: true, verset_officiel: true, livres_nt: false, completed_at: null },
  { astronaute_id: 'ast_3', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2026-01-15T17:00:00Z' },
  { astronaute_id: 'ast_4', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2025-11-20T17:00:00Z' },
  
  { astronaute_id: 'ast_5', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2024-09-08T17:00:00Z' },
  { astronaute_id: 'ast_6', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2026-06-10T15:00:00Z' },
  { astronaute_id: 'ast_7', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2023-11-15T17:00:00Z' },
  { astronaute_id: 'ast_8', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2025-02-18T17:00:00Z' },
  
  { astronaute_id: 'ast_9', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2026-02-11T17:00:00Z' },
  { astronaute_id: 'ast_10', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2025-12-14T17:00:00Z' },
  { astronaute_id: 'ast_11', fridays_done: true, devise: false, verset_officiel: false, livres_nt: false, completed_at: null },
  { astronaute_id: 'ast_12', fridays_done: true, devise: true, verset_officiel: true, livres_nt: true, completed_at: '2021-09-10T17:00:00Z' }
];

const DEFAULT_PROMOTIONS: Promotion[] = [
  // Dieuseul Pierre: validated up to 1e Classe
  { id: 'prom_1', astronaute_id: 'ast_1', grade_id: 'g1', validated_by: 'pilote_a', validated_at: '2024-11-15T18:00:00Z' },
  { id: 'prom_2', astronaute_id: 'ast_1', grade_id: 'g2', validated_by: 'pilote_a', validated_at: '2025-01-20T18:30:00Z' },
  { id: 'prom_3', astronaute_id: 'ast_1', grade_id: 'g3', validated_by: 'pilote_a', validated_at: '2026-04-03T18:00:00Z' },
  
  // Esther Gabriel: validated up to 2e Classe
  { id: 'prom_4', astronaute_id: 'ast_4', grade_id: 'g1', validated_by: 'pilote_a', validated_at: '2025-12-19T18:00:00Z' },
  { id: 'prom_5', astronaute_id: 'ast_4', grade_id: 'g2', validated_by: 'pilote_a', validated_at: '2026-03-27T18:15:00Z' },
  
  // Peterson Altidor
  { id: 'prom_6', astronaute_id: 'ast_5', grade_id: 'g1', validated_by: 'pilote_b', validated_at: '2023-11-03T18:00:00Z' },
  { id: 'prom_7', astronaute_id: 'ast_5', grade_id: 'g2', validated_by: 'pilote_b', validated_at: '2024-02-16T18:00:00Z' },
  { id: 'prom_8', astronaute_id: 'ast_5', grade_id: 'g3', validated_by: 'pilote_b', validated_at: '2024-11-29T18:00:00Z' },
  { id: 'prom_9', astronaute_id: 'ast_5', grade_id: 'g4', validated_by: 'pilote_b', validated_at: '2025-05-09T18:00:00Z' },
  { id: 'prom_10', astronaute_id: 'ast_5', grade_id: 'g5', validated_by: 'pilote_b', validated_at: '2026-02-06T18:00:00Z' },
  
  // Woodley Chery: validated all up to Lieutenant
  { id: 'prom_11', astronaute_id: 'ast_7', grade_id: 'g1', validated_by: 'pilote_b', validated_at: '2023-11-10T18:00:00Z' },
  { id: 'prom_12', astronaute_id: 'ast_7', grade_id: 'g2', validated_by: 'pilote_b', validated_at: '2024-01-12T18:00:00Z' },
  { id: 'prom_13', astronaute_id: 'ast_7', grade_id: 'g3', validated_by: 'pilote_b', validated_at: '2024-05-10T18:00:00Z' },
  { id: 'prom_14', astronaute_id: 'ast_7', grade_id: 'g4', validated_by: 'pilote_b', validated_at: '2024-11-08T18:00:00Z' },
  { id: 'prom_15', astronaute_id: 'ast_7', grade_id: 'g5', validated_by: 'pilote_b', validated_at: '2025-03-14T18:00:00Z' },
  { id: 'prom_16', astronaute_id: 'ast_7', grade_id: 'g6', validated_by: 'pilote_b', validated_at: '2025-05-23T18:00:00Z' },
  { id: 'prom_17', astronaute_id: 'ast_7', grade_id: 'g7', validated_by: 'pilote_b', validated_at: '2025-10-17T18:00:00Z' },
  { id: 'prom_18', astronaute_id: 'ast_7', grade_id: 'g8', validated_by: 'pilote_b', validated_at: '2026-01-16T18:00:00Z' },
  { id: 'prom_19', astronaute_id: 'ast_7', grade_id: 'g9', validated_by: 'pilote_b', validated_at: '2026-04-10T18:00:00Z' },
  
  // Toussaint (seeded all 18 ranks)
  ...DEFAULT_GRADES.map((g, idx) => ({
    id: `prom_toussaint_${idx}`,
    astronaute_id: 'ast_12',
    grade_id: g.id,
    validated_by: 'dev_user',
    validated_at: '2024-05-20T18:00:00Z'
  }))
];

// Seed Friday Sessions & Scores for beautiful analytics
const DEFAULT_SESSIONS: Session[] = [
  { id: 'sess_1', session_date: '2026-05-22', classe: 'Aventuriers', groupe: 'Vert', locked_at: '2026-05-22T20:00:00Z', created_by: 'pilote_a' },
  { id: 'sess_2', session_date: '2026-05-29', classe: 'Aventuriers', groupe: 'Vert', locked_at: '2026-05-29T20:00:00Z', created_by: 'pilote_a' },
  { id: 'sess_3', session_date: '2026-06-05', classe: 'Aventuriers', groupe: 'Vert', locked_at: null, created_by: 'pilote_a' },
  
  { id: 'sess_4', session_date: '2026-05-29', classe: 'Aigles', groupe: 'Rouge', locked_at: '2026-05-29T21:00:00Z', created_by: 'pilote_b' },
  { id: 'sess_5', session_date: '2026-06-05', classe: 'Aigles', groupe: 'Rouge', locked_at: null, created_by: 'pilote_b' }
];

const DEFAULT_SCORES: Score[] = [
  // sess_1 (2026-05-22) - Aventuriers Vert
  { id: 'sc_1_1', session_id: 'sess_1', astronaute_id: 'ast_1', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_1_3', session_id: 'sess_1', astronaute_id: 'ast_3', presence: true, ponctuel: false, bible: true, verset: true, proprete: true, echarpe: true, conduite: false, visiteurs: 1, total_jour: 215 },
  { id: 'sc_1_4', session_id: 'sess_1', astronaute_id: 'ast_4', presence: true, ponctuel: true, bible: true, verset: false, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 210 },
  
  // sess_2 (2026-05-29) - Aventuriers Vert
  { id: 'sc_2_1', session_id: 'sess_2', astronaute_id: 'ast_1', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 1, total_jour: 275 },
  { id: 'sc_2_3', session_id: 'sess_2', astronaute_id: 'ast_3', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_2_4', session_id: 'sess_2', astronaute_id: 'ast_4', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },

  // sess_3 (2026-06-05) - Aventuriers Vert (Editable & Pending Report)
  { id: 'sc_3_1', session_id: 'sess_3', astronaute_id: 'ast_1', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_3_3', session_id: 'sess_3', astronaute_id: 'ast_3', presence: true, ponctuel: false, bible: true, verset: true, proprete: true, echarpe: false, conduite: true, visiteurs: 0, total_jour: 190 },
  { id: 'sc_3_4', session_id: 'sess_3', astronaute_id: 'ast_4', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 2, total_jour: 275 },

  // sess_4 (2026-05-29) - Aigles Rouge
  { id: 'sc_4_5', session_id: 'sess_4', astronaute_id: 'ast_5', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_4_6', session_id: 'sess_4', astronaute_id: 'ast_6', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_4_7', session_id: 'sess_4', astronaute_id: 'ast_7', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 1, total_jour: 275 },

  // sess_5 (2026-06-05) - Aigles Rouge (Pending Report)
  { id: 'sc_5_5', session_id: 'sess_5', astronaute_id: 'ast_5', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_5_6', session_id: 'sess_5', astronaute_id: 'ast_6', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 },
  { id: 'sc_5_7', session_id: 'sess_5', astronaute_id: 'ast_7', presence: true, ponctuel: true, bible: true, verset: true, proprete: true, echarpe: true, conduite: true, visiteurs: 0, total_jour: 250 }
];

const DEFAULT_REPORTS: Report[] = [
  { id: 'rep_1', session_id: 'sess_1', notes_lesson: 'La fondation sur le Roc (Matthieu 7)', notes_observations: 'Les enfants étaient très concentrés ce vendredi. Excellente participation.', notes_discipline: 'Rien à signaler.', status: 'archive', submitted_by: 'pilote_a', reviewed_by: 'leader_user', reviewed_at: '2026-05-23T10:00:00Z' },
  { id: 'rep_2', session_id: 'sess_2', notes_lesson: 'La Parabole du Semeur (Marc 4)', notes_observations: 'Petite baisse de concentration au moment de réciter le verset.', notes_discipline: 'Un rappel à l\'ordre nécessaire pour deux pilotes chuchoteurs.', status: 'archive', submitted_by: 'pilote_a', reviewed_by: 'leader_user', reviewed_at: '2026-05-30T10:00:00Z' },
  { id: 'rep_4', session_id: 'sess_4', notes_lesson: 'L\'armure complète de Dieu (Éphésiens 6)', notes_observations: 'Woodley a récité parfaitement le long verset.', notes_discipline: 'Génial.', status: 'archive', submitted_by: 'pilote_b', reviewed_by: 'leader_user', reviewed_at: '2026-05-30T10:00:00Z' }
];

// Global DB Structure
interface DatabaseSchema {
  profiles: UserProfile[];
  astronautes: Astronaute[];
  onboarding: Onboarding[];
  sessions: Session[];
  scores: Score[];
  grades: Grade[];
  promotions: Promotion[];
  reports: Report[];
  app_settings: AppSettings;
  audit_log: AuditLog[];
  login_sessions?: LoginSession[];
}

let dbCache: DatabaseSchema | null = null;

// Read / Write with fallback & caching
function readDB(): DatabaseSchema {
  if (dbCache) return dbCache;
  if (!fs.existsSync(DB_FILE)) {
    const initData: DatabaseSchema = {
      profiles: DEFAULT_PROFILES,
      astronautes: DEFAULT_ASTRONAUTES,
      onboarding: DEFAULT_ONBOARDING,
      sessions: DEFAULT_SESSIONS,
      scores: DEFAULT_SCORES,
      grades: DEFAULT_GRADES,
      promotions: DEFAULT_PROMOTIONS,
      reports: DEFAULT_REPORTS,
      app_settings: {
        summer_pause: false,
        correction_window_hours: 48
      },
      audit_log: [],
      login_sessions: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initData, null, 2), 'utf-8');
    dbCache = initData;
    return initData;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    dbCache = JSON.parse(raw);
    
    // Auto-migration for schema upgrades
    let modified = false;
    if (!dbCache!.login_sessions) {
      dbCache!.login_sessions = [];
      modified = true;
    }
    
    // Ensure each profile has a pin
    if (dbCache!.profiles) {
      dbCache!.profiles.forEach(p => {
        if (!p.pin) {
          const defaultProf = DEFAULT_PROFILES.find(dp => dp.id === p.id);
          p.pin = defaultProf?.pin || '2222';
          modified = true;
        }
      });
    }

    if (modified) {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), 'utf-8');
    }

    return dbCache!;
  } catch (err) {
    console.error('Error reading db.json, returning defaults', err);
    return {
      profiles: DEFAULT_PROFILES,
      astronautes: DEFAULT_ASTRONAUTES,
      onboarding: DEFAULT_ONBOARDING,
      sessions: DEFAULT_SESSIONS,
      scores: DEFAULT_SCORES,
      grades: DEFAULT_GRADES,
      promotions: DEFAULT_PROMOTIONS,
      reports: DEFAULT_REPORTS,
      app_settings: {
        summer_pause: false,
        correction_window_hours: 48
      },
      audit_log: [],
      login_sessions: []
    };
  }
}

function writeDB(data: DatabaseSchema) {
  dbCache = data;
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Grand Total recalculation loop
function recomputeGrandTotal(astronauteId: string, data: DatabaseSchema) {
  const scores = data.scores.filter(s => s.astronaute_id === astronauteId);
  const total = scores.reduce((sum, s) => sum + s.total_jour, 0);
  const ast = data.astronautes.find(a => a.id === astronauteId);
  if (ast) {
    ast.grand_total = total;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json());

  // Log in server output
  console.log('Rapport Astronautes core engine initializing...');
  const initialData = readDB();
  console.log(`Loaded ${initialData.astronautes.length} astronautes, ${initialData.scores.length} scores from DB.`);

  // Custom Authentication with PIN login support and secure mutating route validation
  app.use((req, res, next) => {
    const data = readDB();
    const sessionToken = req.headers['x-session-token'] as string;
    let authUser: UserProfile | null = null;

    if (sessionToken) {
      const foundSession = (data.login_sessions || []).find(s => s.token === sessionToken);
      if (foundSession) {
        const profile = data.profiles.find(p => p.id === foundSession.profile_id);
        if (profile) {
          authUser = profile;
        }
      }
    }

    // Fallback block for development tests and backward compatibility if no token is provided but x-user-id exists
    if (!authUser) {
      const headerUserId = req.headers['x-user-id'] as string;
      if (headerUserId) {
        const profile = data.profiles.find(p => p.id === headerUserId);
        if (profile) {
          authUser = profile;
        }
      }
    }

    req.user = authUser!;

    // Mutating Endpoint Check: Any write operations MUST supply a valid token in login_sessions
    const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    // Ignore initial login endpoint
    if (isWrite && req.path !== '/api/login') {
      if (!sessionToken) {
        return res.status(401).json({ error: 'Token de session absent. Veuillez vous connecter.' });
      }
      const sessionExists = (data.login_sessions || []).some(s => s.token === sessionToken);
      if (!sessionExists) {
        return res.status(401).json({ error: 'Votre session a expiré ou est invalide. Veuillez vous reconnecter.' });
      }
    }

    next();
  });

  // Helper inside route to enforce Summer Pause check on mutated methods
  function guardSummerPause(req: express.Request, res: express.Response): boolean {
    const data = readDB();
    if (data.app_settings.summer_pause && req.user.role !== 'developer') {
      res.status(403).json({ error: 'La pause d\'été est active. Toutes les modifications de données sont verrouillées.' });
      return true;
    }
    return false;
  }

  // Helpers to test if a pilote/copilote is allowed to write specific room
  function guardRoomWrite(req: express.Request, res: express.Response, classe: ClasseType, groupe: GroupeType): boolean {
    const user = req.user;
    if (user.role === 'developer') return false; // allowed
    if (user.role === 'leader') {
      res.status(403).json({ error: 'Seuls les pilotes, copilotes autorisés et développeurs peuvent modifier les pointages directs.' });
      return true;
    }
    const match = user.assignment?.classe === classe && user.assignment?.groupe === groupe;
    if (!match) {
      res.status(403).json({ error: 'Accès refusé : Vous n\'êtes pas affecté à cette classe ou ce groupe.' });
      return true;
    }
    if (user.role === 'copilote' && !user.can_enter_data) {
      res.status(403).json({ error: 'Accès restreint : Votre compte copilote n\'a pas l\'autorisation d\'entrer les données.' });
      return true;
    }
    return false;
  }

  // --- API ROUTES ---

  // Auth/Session Switcher
  app.get('/api/session/current-user', (req, res) => {
    res.json(req.user);
  });

  app.get('/api/profiles', (req, res) => {
    const data = readDB();
    res.json(data.profiles);
  });

  app.post('/api/profiles', (req, res) => {
    const isDev = req.user.role === 'developer';
    const isLeader = req.user.role === 'leader';

    if (!isDev && !isLeader) {
      return res.status(403).json({ error: 'Autorisation refusée.' });
    }

    const data = readDB();
    const { email, full_name, role, classe, groupe, pin, can_enter_data } = req.body;

    if (!email || !full_name || !role) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : email, full_name, role.' });
    }

    // Protection against privilege escalation: only Dev can assign Leader or developer role
    if (role === 'leader' || role === 'developer') {
      if (!isDev) {
        return res.status(403).json({ error: "Autorisation refusée. Seul l'ingénieur GHOST SYSTEMS (Dev) peut créer ou assigner des rôles Leader ou Dev." });
      }
    }

    const emailTrim = email.trim().toLowerCase();
    const exists = data.profiles.some(p => p.email.toLowerCase() === emailTrim);
    if (exists) {
      return res.status(400).json({ error: 'Cet email est déjà enregistré.' });
    }

    const newId = 'prof_' + Date.now();
    const newProfile: UserProfile = {
      id: newId,
      email: email.trim(),
      full_name: full_name.trim(),
      role: role,
      can_enter_data: !!can_enter_data,
      pin: pin?.trim() || '0000',
      assignment: classe && groupe ? { classe, groupe } : null
    };

    data.profiles.push(newProfile);
    writeDB(data);

    res.status(201).json(newProfile);
  });

  app.put('/api/profiles/:id', (req, res) => {
    const isDev = req.user.role === 'developer';
    const isLeader = req.user.role === 'leader';

    if (!isDev && !isLeader) {
      return res.status(403).json({ error: 'Autorisation refusée.' });
    }

    const { id } = req.params;
    const { role, full_name, assignment, can_enter_data } = req.body;

    const data = readDB();
    const idx = data.profiles.findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Profil non trouvé dans la base locale." });
    }

    const profile = data.profiles[idx];

    // Protection against privilege escalation when assigning higher roles
    if (role && (role === 'leader' || role === 'developer')) {
      if (!isDev) {
        return res.status(403).json({ error: "Autorisation refusée. Seul l'ingénieur GHOST SYSTEMS (Dev) peut élever un rôle au niveau Leader ou Dev." });
      }
    }

    // Protection against modifying already existing Leader or developer roles
    if (profile.role === 'leader' || profile.role === 'developer') {
      if (!isDev) {
        return res.status(403).json({ error: "Autorisation refusée. Seul l'ingénieur GHOST SYSTEMS (Dev) peut modifier un profil Leader ou Dev." });
      }
    }

    if (role !== undefined) profile.role = role;
    if (full_name !== undefined) profile.full_name = full_name;
    if (assignment !== undefined) profile.assignment = assignment;
    if (can_enter_data !== undefined) profile.can_enter_data = !!can_enter_data;

    writeDB(data);

    console.log(`[BACKEND SHADOW SYSTEMS] Profile updated: ${profile.email}`);

    res.json({
      success: true,
      message: `Profil de ${profile.full_name} mis à jour avec succès.`,
      profile
    });
  });

  app.delete('/api/profiles/:id', (req, res) => {
    // Verify requester role is developer
    if (req.user.role !== 'developer') {
      return res.status(403).json({ error: "Autorisation refusée. Seul l'ingénieur GHOST SYSTEMS (Dev) peut supprimer un membre du personnel." });
    }

    const { id } = req.params;
    const data = readDB();

    const idx = data.profiles.findIndex(p => p.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: "Profil non trouvé dans la base locale." });
    }

    const targetUser = data.profiles[idx];

    // Protection to prevent deleting the final 'developer' profile
    if (targetUser.role === 'developer') {
      const remainingDevs = data.profiles.filter(p => p.id !== id && p.role === 'developer');
      if (remainingDevs.length === 0) {
        return res.status(400).json({ error: "Impossible de supprimer le compte GHOST SYSTEMS. C'est le dernier profil Dev." });
      }
    }

    data.profiles.splice(idx, 1);

    // Filter login sessions
    if (data.login_sessions) {
      data.login_sessions = data.login_sessions.filter(s => s.profile_id !== id);
    }

    writeDB(data);

    console.log(`[BACKEND SHADOW SYSTEMS] Dev deleted user: ${targetUser.email} / ID: ${id}`);

    res.json({
      success: true,
      message: `Profil de ${targetUser.full_name} supprimé avec succès de la base et de la synchronisation Auth.`
    });
  });

  // App Settings APIs
  app.get('/api/app-settings', (req, res) => {
    const data = readDB();
    res.json(data.app_settings);
  });

  app.post('/api/app-settings', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const data = readDB();
    
    // Only Developer and Leader can change global settings
    if (req.user.role !== 'developer' && req.user.role !== 'leader') {
      return res.status(403).json({ error: 'Autorisation refusée.' });
    }

    const oldVal = { ...data.app_settings };
    const { summer_pause, correction_window_hours } = req.body;
    
    if (typeof summer_pause === 'boolean') {
      data.app_settings.summer_pause = summer_pause;
    }
    if (typeof correction_window_hours === 'number') {
      data.app_settings.correction_window_hours = correction_window_hours;
    }

    // Write log
    const log: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      actor_id: req.user.id,
      action: 'UPDATE_SETTINGS',
      target_table: 'app_settings',
      target_id: 'global',
      old_value: oldVal,
      new_value: data.app_settings,
      reason: req.body.reason || 'Mise à jour des paramètres système',
      created_at: new Date().toISOString()
    };
    data.audit_log.unshift(log);

    writeDB(data);
    res.json(data.app_settings);
  });

  // Astronautes (with full RLS enforcement)
  app.get('/api/astronautes', (req, res) => {
    const data = readDB();
    const user = req.user;

    // RLS Filter
    let list = data.astronautes;
    if (user.role === 'pilote' || user.role === 'copilote') {
      const assigned = user.assignment;
      if (assigned) {
        list = list.filter(a => a.classe === assigned.classe && a.groupe === assigned.groupe);
      } else {
        list = [];
      }
    }
    res.json(list);
  });

  // Create Astronaute
  app.post('/api/astronautes', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const { first_name, last_name, birthdate, classe, groupe, legacy_source } = req.body;
    if (!first_name || !last_name || !birthdate || !classe || !groupe) {
      return res.status(400).json({ error: 'Champs manquants' });
    }

    // RLS room restriction
    if (guardRoomWrite(req, res, classe, groupe)) return;

    const data = readDB();
    const newId = 'ast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newAst: Astronaute = {
      id: newId,
      first_name,
      last_name,
      birthdate,
      classe,
      groupe,
      status: 'recrue', // recruits by default (C3)
      grand_total: 0,
      legacy_source: legacy_source || null,
      created_at: new Date().toISOString()
    };

    // Create matching onboarding row unlocked
    const newOnboarding: Onboarding = {
      astronaute_id: newId,
      fridays_done: false,
      devise: false,
      verset_officiel: false,
      livres_nt: false,
      completed_at: null
    };

    data.astronautes.push(newAst);
    data.onboarding.push(newOnboarding);
    writeDB(data);

    res.status(201).json(newAst);
  });

  // Get active user's details and onboarding status
  app.get('/api/astronautes/:id', (req, res) => {
    const data = readDB();
    const user = req.user;
    const ast = data.astronautes.find(a => a.id === req.params.id);
    if (!ast) {
      return res.status(404).json({ error: 'Astronaute non trouvé' });
    }

    // Scoping check
    if (user.role === 'pilote' || user.role === 'copilote') {
      const assigned = user.assignment;
      if (!assigned || ast.classe !== assigned.classe || ast.groupe !== assigned.groupe) {
        return res.status(403).json({ error: 'Accès refusé' });
      }
    }

    const onboarding = data.onboarding.find(o => o.astronaute_id === ast.id);
    const promotions = data.promotions.filter(p => p.astronaute_id === ast.id);
    const scores = data.scores.filter(s => s.astronaute_id === ast.id);

    // Calculate score details
    res.json({
      astronaute: ast,
      onboarding: onboarding || { astronaute_id: ast.id, fridays_done: false, devise: false, verset_officiel: false, livres_nt: false, completed_at: null },
      promotions,
      scores
    });
  });

  // Onboarding Gateway updating (C3)
  app.post('/api/astronautes/:id/onboarding', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const data = readDB();
    const ast = data.astronautes.find(a => a.id === req.params.id);
    if (!ast) {
      return res.status(404).json({ error: 'Astronaute non trouvé' });
    }

    if (guardRoomWrite(req, res, ast.classe, ast.groupe)) return;

    let onboarding = data.onboarding.find(o => o.astronaute_id === ast.id);
    if (!onboarding) {
      onboarding = {
        astronaute_id: ast.id,
        fridays_done: false,
        devise: false,
        verset_officiel: false,
        livres_nt: false,
        completed_at: null
      };
      data.onboarding.push(onboarding);
    }

    const oldStatus = ast.status;
    const { fridays_done, devise, verset_officiel, livres_nt } = req.body;
    
    if (typeof fridays_done === 'boolean') onboarding.fridays_done = fridays_done;
    if (typeof devise === 'boolean') onboarding.devise = devise;
    if (typeof verset_officiel === 'boolean') onboarding.verset_officiel = verset_officiel;
    if (typeof livres_nt === 'boolean') onboarding.livres_nt = livres_nt;

    const allFinished = onboarding.fridays_done && onboarding.devise && onboarding.verset_officiel && onboarding.livres_nt;
    if (allFinished) {
      if (!onboarding.completed_at) {
        onboarding.completed_at = new Date().toISOString();
      }
      ast.status = 'astronaute_actif';
    } else {
      onboarding.completed_at = null;
      ast.status = 'recrue';
    }

    writeDB(data);
    res.json({
      astronaute: ast,
      onboarding,
      celebrated: oldStatus === 'recrue' && ast.status === 'astronaute_actif'
    });
  });

  // Grades list
  app.get('/api/grades', (req, res) => {
    const data = readDB();
    res.json(data.grades);
  });

  // Promotions / rank ups (C5)
  app.get('/api/promotions', (req, res) => {
    const data = readDB();
    res.json(data.promotions);
  });

  app.post('/api/promotions/validate', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const { astronaute_id, grade_id } = req.body;
    if (!astronaute_id || !grade_id) {
      return res.status(400).json({ error: 'Paramètres invalides' });
    }

    const data = readDB();
    const ast = data.astronautes.find(a => a.id === astronaute_id);
    const grade = data.grades.find(g => g.id === grade_id);

    if (!ast || !grade) {
      return res.status(404).json({ error: 'Astronaute ou grade non trouvé' });
    }

    // Checking Room limit
    if (guardRoomWrite(req, res, ast.classe, ast.groupe)) return;

    // Check if score crossed points_required
    if (ast.grand_total < grade.points_required) {
      return res.status(400).json({ error: `Grand Total insuffisant pour le grade de ${grade.name} (Requis : ${grade.points_required} pts)` });
    }

    // Verify duplication
    const alreadyPromoted = data.promotions.some(p => p.astronaute_id === astronaute_id && p.grade_id === grade_id);
    if (alreadyPromoted) {
      return res.status(400).json({ error: 'Grade déjà validé' });
    }

    const newPromotion: Promotion = {
      id: 'prom_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      astronaute_id,
      grade_id,
      validated_by: req.user.id,
      validated_at: new Date().toISOString()
    };

    data.promotions.push(newPromotion);
    writeDB(data);

    res.status(201).json(newPromotion);
  });

  // Sessions and scoring endpoints (C4)
  app.get('/api/sessions', (req, res) => {
    const data = readDB();
    const user = req.user;

    let list = data.sessions;
    if (user.role === 'pilote' || user.role === 'copilote') {
      const assigned = user.assignment;
      if (assigned) {
        list = list.filter(s => s.classe === assigned.classe && s.groupe === assigned.groupe);
      } else {
        list = [];
      }
    }
    res.json(list);
  });

  app.post('/api/sessions', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const { session_date, classe, groupe } = req.body;
    if (!session_date || !classe || !groupe) {
      return res.status(400).json({ error: 'Spécifiez la date, la classe et le groupe' });
    }

    if (guardRoomWrite(req, res, classe, groupe)) return;

    const data = readDB();
    // Unique session per date/classe/groupe
    const existing = data.sessions.find(s => s.session_date === session_date && s.classe === classe && s.groupe === groupe);
    if (existing) {
      return res.json(existing);
    }

    const newId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const newSession: Session = {
      id: newId,
      session_date,
      classe,
      groupe,
      locked_at: null,
      created_by: req.user.id
    };

    data.sessions.push(newSession);
    writeDB(data);

    res.status(201).json(newSession);
  });

  // Scores lookup (with optional session_id query)
  app.get('/api/scores', (req, res) => {
    const data = readDB();
    const sessionId = req.query.session_id as string;
    const user = req.user;

    if (sessionId) {
      const session = data.sessions.find(s => s.id === sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session non trouvée' });
      }

      // Scoping RLS Check
      if (user.role === 'pilote' || user.role === 'copilote') {
        const assigned = user.assignment;
        if (!assigned || session.classe !== assigned.classe || session.groupe !== assigned.groupe) {
          return res.status(403).json({ error: 'Accès refusé aux pointages de cette pièce' });
        }
      }

      const sessionScores = data.scores.filter(s => s.session_id === sessionId);
      return res.json(sessionScores);
    } else {
      // Return scoped/unscoped list of scores
      let list = data.scores;
      if (user.role === 'pilote' || user.role === 'copilote') {
        const assigned = user.assignment;
        if (assigned) {
          const validSessionIds = new Set(data.sessions.filter(s => s.classe === assigned.classe && s.groupe === assigned.groupe).map(s => s.id));
          list = list.filter(sc => validSessionIds.has(sc.session_id));
        } else {
          list = [];
        }
      }
      return res.json(list);
    }
  });

  // Day point tracking POST (TAP-FAST, C4)
  app.post('/api/scores', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const {
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
      override_reason
    } = req.body;

    if (!session_id || !astronaute_id) {
      return res.status(400).json({ error: 'session_id et astronaute_id requis' });
    }

    const data = readDB();
    const session = data.sessions.find(s => s.id === session_id);
    const ast = data.astronautes.find(a => a.id === astronaute_id);
    if (!session || !ast) {
      return res.status(404).json({ error: 'Session ou Astronaute introuvable' });
    }

    // Recruits check - cannot receive points
    if (ast.status === 'recrue') {
      return res.status(400).json({ error: 'Le profil de cet enfant est Verrouillé tant qu\'il est à l\'état de Recrue.' });
    }

    // Room limit check
    if (guardRoomWrite(req, res, session.classe, session.groupe)) return;

    // Window logic (C7)
    const isOwnerRole = req.user.role === 'pilote' || req.user.role === 'copilote';
    const createdAtMs = session.locked_at ? new Date(session.locked_at).getTime() : new Date(session.session_date).getTime();
    const ageHrs = (Date.now() - createdAtMs) / (1000 * 60 * 60);

    if (isOwnerRole && ageHrs > data.app_settings.correction_window_hours) {
      return res.status(403).json({
        error: `La fenêtre de modification de ${data.app_settings.correction_window_hours}h est expirée. Seul un Leader de Ghost Systems peut modifier cette séance.`
      });
    }

    // If Leader/Dev is overriding outside window, require reason
    if (!isOwnerRole && ageHrs > data.app_settings.correction_window_hours) {
      if (!override_reason || override_reason.trim() === '') {
        return res.status(400).json({ error: 'Une justification écrite est obligatoire pour procéder à un override Historique.' });
      }
    }

    // Calculate sum du jour
    let scoreVal = 0;
    if (presence) scoreVal += 30;
    if (ponctuel) scoreVal += 40;
    if (bible) scoreVal += 50;
    if (verset) scoreVal += 40;
    if (proprete) scoreVal += 30;
    if (echarpe) scoreVal += 20;
    if (conduite) scoreVal += 40;
    const vCount = typeof visiteurs === 'number' ? visiteurs : 0;
    scoreVal += vCount * 25; // standard guest

    let scoreObj = data.scores.find(s => s.session_id === session_id && s.astronaute_id === astronaute_id);
    const oldScoreObj = scoreObj ? { ...scoreObj } : null;

    if (!scoreObj) {
      scoreObj = {
        id: 'sc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        session_id,
        astronaute_id,
        presence: !!presence,
        ponctuel: !!ponctuel,
        bible: !!bible,
        verset: !!verset,
        proprete: !!proprete,
        echarpe: !!echarpe,
        conduite: !!conduite,
        visiteurs: vCount,
        total_jour: scoreVal
      };
      data.scores.push(scoreObj);
    } else {
      scoreObj.presence = !!presence;
      scoreObj.ponctuel = !!ponctuel;
      scoreObj.bible = !!bible;
      scoreObj.verset = !!verset;
      scoreObj.proprete = !!proprete;
      scoreObj.echarpe = !!echarpe;
      scoreObj.conduite = !!conduite;
      scoreObj.visiteurs = vCount;
      scoreObj.total_jour = scoreVal;
    }

    // Calculate grand_total delta integrity!
    recomputeGrandTotal(astronaute_id, data);

    // Audit logs for over-the-window changes as a Leader/Developer
    if (ageHrs > data.app_settings.correction_window_hours) {
      const log: AuditLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        actor_id: req.user.id,
        action: 'HISTORICAL_OVERRIDE',
        target_table: 'scores',
        target_id: scoreObj.id,
        old_value: oldScoreObj,
        new_value: scoreObj,
        reason: override_reason || 'Raison non spécifiée',
        created_at: new Date().toISOString()
      };
      data.audit_log.unshift(log);
    }

    writeDB(data);
    res.json(scoreObj);
  });

  // Lesson reports submission and review (C6)
  app.get('/api/reports', (req, res) => {
    const data = readDB();
    const user = req.user;

    let list = data.reports;
    if (user.role === 'pilote' || user.role === 'copilote') {
      const assigned = user.assignment;
      if (assigned) {
        // match session rooms
        const matchingSessionIds = data.sessions
          .filter(s => s.classe === assigned.classe && s.groupe === assigned.groupe)
          .map(s => s.id);
        list = list.filter(r => matchingSessionIds.includes(r.session_id));
      } else {
        list = [];
      }
    }
    res.json(list);
  });

  app.post('/api/reports', (req, res) => {
    if (guardSummerPause(req, res)) return;
    const { session_id, notes_lesson, notes_observations, notes_discipline } = req.body;
    if (!session_id) {
      return res.status(400).json({ error: 'session_id requis' });
    }

    const data = readDB();
    const session = data.sessions.find(s => s.id === session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    if (guardRoomWrite(req, res, session.classe, session.groupe)) return;

    let report = data.reports.find(r => r.session_id === session_id);
    if (!report) {
      report = {
        id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        session_id,
        notes_lesson: notes_lesson || '',
        notes_observations: notes_observations || '',
        notes_discipline: notes_discipline || '',
        status: 'en_attente',
        submitted_by: req.user.id,
        reviewed_by: null,
        reviewed_at: null
      };
      data.reports.push(report);
    } else {
      report.notes_lesson = notes_lesson || '';
      report.notes_observations = notes_observations || '';
      report.notes_discipline = notes_discipline || '';
      report.status = 'en_attente';
      report.submitted_by = req.user.id;
    }

    // lock session timestamp from changes
    session.locked_at = new Date().toISOString();

    writeDB(data);
    res.json(report);
  });

  // Archive review by Leaders
  app.post('/api/reports/:id/review', (req, res) => {
    if (guardSummerPause(req, res)) return;
    if (req.user.role !== 'developer' && req.user.role !== 'leader') {
      return res.status(403).json({ error: 'Seul le président (Leader) peut valider ou archiver les rapports.' });
    }

    const data = readDB();
    const rep = data.reports.find(r => r.id === req.params.id);
    if (!rep) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }

    rep.status = 'archive';
    rep.reviewed_by = req.user.id;
    rep.reviewed_at = new Date().toISOString();

    writeDB(data);
    res.json(rep);
  });

  // PIN LOGIN ENDPOINT (does not trigger mutating blocked action)
  app.post('/api/login', (req, res) => {
    const { profile_id, pin } = req.body;
    if (!profile_id || !pin) {
      return res.status(400).json({ error: 'ID de profil et code PIN requis.' });
    }

    const data = readDB();
    const profile = data.profiles.find(p => p.id === profile_id);
    if (!profile) {
      return res.status(404).json({ error: 'Profil non trouvé.' });
    }

    if (profile.pin !== pin) {
      return res.status(401).json({ error: 'Code PIN incorrect.' });
    }

    // Create session token
    const token = 'token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const newSession: LoginSession = {
      token,
      profile_id,
      created_at: new Date().toISOString()
    };

    if (!data.login_sessions) {
      data.login_sessions = [];
    }
    data.login_sessions.push(newSession);
    writeDB(data);

    res.json({
      profile,
      token
    });
  });

  // Demander une correction on reports
  app.post('/api/reports/:id/correction', (req, res) => {
    if (guardSummerPause(req, res)) return;
    if (req.user.role !== 'developer' && req.user.role !== 'leader') {
      return res.status(403).json({ error: 'Seul le président (Leader) peut demander des corrections.' });
    }

    const { leader_note } = req.body;
    if (!leader_note || leader_note.trim() === '') {
      return res.status(400).json({ error: 'Une note d\'explication est obligatoire.' });
    }

    const data = readDB();
    const rep = data.reports.find(r => r.id === req.params.id);
    if (!rep) {
      return res.status(404).json({ error: 'Rapport non trouvé' });
    }

    rep.status = 'correction_demandee';
    rep.leader_note = leader_note;
    rep.reviewed_by = req.user.id;
    rep.reviewed_at = new Date().toISOString();

    // Unlock corresponding session for pilot editing
    const session = data.sessions.find(s => s.id === rep.session_id);
    if (session) {
      session.locked_at = null; // unlock so pilote can edit scores again!
    }

    writeDB(data);
    res.json(rep);
  });

  // Class Migration Engine (Macro Tool) (C7-2)
  // Moves students to next level when they age or season starts
  // Pionniers -> Explorateurs -> Aventuriers -> Aigles -> (Archived/ 졸업)
  app.post('/api/class-migration', (req, res) => {
    if (guardSummerPause(req, res)) return;
    if (req.user.role !== 'developer' && req.user.role !== 'leader') {
      return res.status(403).json({ error: 'Macro Class-Migration restreinte aux administrateurs.' });
    }

    const { target_class, promote_to_class, confirm, candidate_ids } = req.body;
    if (!target_class || !promote_to_class || !candidate_ids || !Array.isArray(candidate_ids)) {
      return res.status(400).json({ error: 'Paramètres erronés' });
    }

    const data = readDB();
    const candidates = data.astronautes.filter(a => candidate_ids.includes(a.id) && a.classe === target_class);

    if (!confirm) {
      // Just preview
      return res.json({
        candidates,
        preview_text: `Prêt à migrer ${candidates.length} enfants de la classe [${target_class}] vers la classe [${promote_to_class}].`,
        candidates_unaffected: data.astronautes.filter(a => a.classe === target_class && !candidate_ids.includes(a.id))
      });
    }

    // Apply real transition! Keep grand total intact (C7)
    const oldValsSnapshot = JSON.parse(JSON.stringify(candidates));
    
    candidates.forEach(a => {
      a.classe = promote_to_class;
    });

    const audit: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      actor_id: req.user.id,
      action: 'CLASS_MIGRATION',
      target_table: 'astronautes',
      target_id: 'bulk_migration_' + target_class + '_to_' + promote_to_class,
      old_value: oldValsSnapshot,
      new_value: candidates,
      reason: req.body.reason || `Migration groupée de niveau de fin d'année`,
      created_at: new Date().toISOString()
    };
    data.audit_log.unshift(audit);

    writeDB(data);
    res.json({
      success: true,
      message: `${candidates.length} astronautes ont été migrés avec succès vers ${promote_to_class}. Leurs scores à vie ont été préservés.`,
      migrated: candidates
    });
  });

  // Assignments Matrix updating (Developer only) (C1)
  app.post('/api/assignments', (req, res) => {
    if (guardSummerPause(req, res)) return;
    if (req.user.role !== 'developer') {
      return res.status(403).json({ error: 'Seul l\'ingénieur de Ghost Systems (Developer) peut assigner les pilotes.' });
    }

    const { profile_id, classe, groupe, can_enter_data } = req.body;
    if (!profile_id) {
       return res.status(400).json({ error: 'ID de l\'instructeur requis' });
    }

    const data = readDB();
    const profile = data.profiles.find(p => p.id === profile_id);
    if (!profile) {
      return res.status(404).json({ error: 'Instructeur non trouvé' });
    }

    const oldProfile = { ...profile };

    if (classe === null || groupe === null) {
      profile.assignment = null;
    } else {
      profile.assignment = { classe, groupe };
    }
    if (typeof can_enter_data === 'boolean') {
      profile.can_enter_data = can_enter_data;
    }

    // Logs
    const log: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      actor_id: req.user.id,
      action: 'UPDATE_ASSIGNMENT',
      target_table: 'profiles',
      target_id: profile.id,
      old_value: oldProfile,
      new_value: profile,
      reason: `Réassignation de cabine pour l'instructeur ${profile.full_name}`,
      created_at: new Date().toISOString()
    };
    data.audit_log.unshift(log);

    writeDB(data);
    res.json(profile);
  });

  // Update PIN API (Developer only)
  app.post('/api/admin/update-pin', (req, res) => {
    if (guardSummerPause(req, res)) return;
    if (req.user.role !== 'developer') {
      return res.status(403).json({ error: 'Seul l\'ingénieur de Ghost Systems (Developer) peut modifier les codes PIN.' });
    }

    const { profile_id, pin } = req.body;
    if (!profile_id || !pin || pin.length !== 4 || isNaN(Number(pin))) {
      return res.status(400).json({ error: 'ID de profil requis et le PIN doit faire exactement 4 chiffres.' });
    }

    const data = readDB();
    const profile = data.profiles.find(p => p.id === profile_id);
    if (!profile) {
      return res.status(404).json({ error: 'Profil non trouvé' });
    }

    profile.pin = pin;
    
    // Logs
    const log: AuditLog = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      actor_id: req.user.id,
      action: 'UPDATE_PIN',
      target_table: 'profiles',
      target_id: profile.id,
      old_value: { pin: '****' },
      new_value: { pin: pin },
      reason: `Mise à jour du code PIN de ${profile.full_name}`,
      created_at: new Date().toISOString()
    };
    data.audit_log.unshift(log);

    writeDB(data);
    res.json({ success: true, profile });
  });

  // Audit Logs (Leader/Dev only)
  app.get('/api/audit-logs', (req, res) => {
    const user = req.user;
    if (user.role !== 'developer' && user.role !== 'leader') {
      return res.status(403).json({ error: 'Accès interdit aux journaux d\'audit.' });
    }
    const data = readDB();
    res.json(data.audit_log);
  });

  // Quick Roster reset to Seed state (useful for tester review)
  app.post('/api/admin/reset-db', (req, res) => {
    if (req.user?.role !== 'developer') {
      return res.status(403).json({ error: "Autorisation refusée. Seul l'ingénieur GHOST SYSTEMS (Dev) peut réinitialiser la base de données." });
    }
    const freshDb: DatabaseSchema = {
      profiles: DEFAULT_PROFILES,
      astronautes: DEFAULT_ASTRONAUTES,
      onboarding: DEFAULT_ONBOARDING,
      sessions: DEFAULT_SESSIONS,
      scores: DEFAULT_SCORES,
      grades: DEFAULT_GRADES,
      promotions: DEFAULT_PROMOTIONS,
      reports: DEFAULT_REPORTS,
      app_settings: {
        summer_pause: false,
        correction_window_hours: 48
      },
      audit_log: []
    };
    writeDB(freshDb);
    res.json({ message: 'Base de données réinitialisée aux valeurs de démonstration.' });
  });

  // --- GEMINI INTELLIGENCE ASSIST ENDPOINTS ---

  // 1. Pilot helper: Low latency lessons narrative writer
  app.post('/api/gemini/pilot-helper', async (req, res) => {
    const { lesson_keywords, observations_keywords, discipline_keywords } = req.body;
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined. Returning smart mock simulation.");
        return res.json({
          notes_lesson: `[Intelligence Simulée] Thème: ${lesson_keywords || "Armure Spirituelle"}. Aujourd'hui, nous avons exploré comment équiper moralement nos astronautes de l'ASBF contre les épreuves. Enseignement dynamique.`,
          notes_observations: `[Intelligence Simulée] Obs: ${observations_keywords || "Excellente écoute"}. Les enfants ont suivi avec attention l'animation et ont posé des questions d'approfondissement intéressantes.`,
          notes_discipline: `[Intelligence Simulée] Discipline: ${discipline_keywords || "Aucun incident"}. Cadre respectueux apprécié de tous.`
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const systemPrompt = `You are an expert French-speaking youth pastor and session companion.
Take these draft lesson keywords and formulate a high-quality, inspiring and coherent report in French suited to Haiti's children church context.
Your French must be natural, respectful, encouraging and grammatically perfect.

Format your response strictly as a JSON object with three properties:
- notes_lesson: "A structured, detailed summary narrative of the lesson taught"
- notes_observations: "A coherent and comprehensive report of children's reactions, engagement, and positive milestones during this Friday session"
- notes_discipline: "A caring, constructive wrap up of behavior, adjustments, or special discussions"

Draft inputs:
- Class Bible lesson theme/keywords: ${lesson_keywords || "Non spécifié"}
- Behaviour/Observations: ${observations_keywords || "Non spécifié"}
- Discipline discussions/Remonstrances: ${discipline_keywords || "Non spécifié"}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite', // low latency
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              notes_lesson: { type: Type.STRING },
              notes_observations: { type: Type.STRING },
              notes_discipline: { type: Type.STRING }
            },
            required: ['notes_lesson', 'notes_observations', 'notes_discipline']
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("No text returned from Gemini model.");
      }

      const parsedJSON = JSON.parse(responseText.trim());
      res.json(parsedJSON);
    } catch (error: any) {
      console.error("Gemini Pilot Helper execution error:", error);
      res.json({
        notes_lesson: `Thème abordé: ${lesson_keywords || 'Leçon de foi'}. (Note: Le service de rédaction automatique Gemini est temporairement indisponible, mais vos saisies de base ont été enregistrées).`,
        notes_observations: observations_keywords || 'Les enfants ont écouté.',
        notes_discipline: discipline_keywords || 'RAS.'
      });
    }
  });

  // 2. Leader Briefing: Command strategic insights builder
  app.post('/api/gemini/leader-brief', async (req, res) => {
    const { reports, astronautes } = req.body;
    
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({
          briefingHtml: "<p class='text-sm text-slate-400 italic'>Activer la clé d'API GEMINI_API_KEY dans les réglages système pour débloquer le rapport de commandement stratégique automatisé par l'IA.</p>"
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const statsText = `Currently tracking ${astronautes?.length || 0} active astronauts.
Past weekly reports submitted by pilots:
${(reports || []).map((r: any, idx: number) => `Report #${idx + 1}:
  Lesson: ${r.notes_lesson}
  Observations: ${r.notes_observations}
  Discipline Notes: ${r.notes_discipline || "None"}`).join('\n')}`;

      const systemPrompt = `You are a strategic Command advisor for the President of the "Astronautes" youth ministry.
You must synthesize the past lesson reports and roster size to write a beautiful, powerful and encouraging command report (Rapport de Commandement) in French.
Do not output raw Markdown or wrapper code blocks. Output ONLY clean and elegant HTML (wrapped in divs, p, strong, and lists) styled with sleek modern layout structures.
Section suggestions:
1. "Etat Moral de l'Équipage" ( morale, attendance highlights)
2. "Enseignement et Avancée Spirituelle" (summarizing what general themes were taught)
3. "Points Vigilance de l'Amirauté" (discipline, and specific children actions)
4. "Recommandation d'Action Pastorale" (concrete custom action for next Friday)

Keep the writing encouraging, military-themed and professional French.
Inputs:
${statsText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash', // high quality general tasks
        contents: systemPrompt
      });

      const responseText = response.text || "<p>Erreur lors de la rédaction par l'IA.</p>";
      res.json({ briefingHtml: responseText });
    } catch (error) {
      console.error("Gemini Leader Briefing execution error:", error);
      res.json({ briefingHtml: "<p class='text-red-400 text-xs'>Échec de la rédaction du briefing par l'IA : " + String(error) + "</p>" });
    }
  });

  // --- VITE MIDDLEWARE OR STATIC SERVING ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    // Fallback for newer express/vite path matchers
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Rapport Astronautes fully powered on http://localhost:${PORT}`);
  });
}

startServer();
