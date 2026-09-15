import type { Curriculum, Student } from '../domain.js';
import { getTeachingMode } from '../data/teachingModes.js';
import type { AgendaSave, CalendarConfig, Session } from '../models/SchoolCalendar.js';
import { generateSchoolCalendar } from './SchoolCalendar.js';
import type { PlanStorage } from './ClassPreparation.js';

export class Agenda {
  private state: AgendaSave;
  message = '';
  constructor(config: CalendarConfig, readonly curriculum: Curriculum, private storage?: PlanStorage, private key = 'classroom-rpg:agenda:v1') {
    this.state = { version: 1, config: structuredClone(config), sessions: [], cursor: 0, nextId: 1 };
    generateSchoolCalendar(config);
    try { const raw = storage?.getItem(key); if (raw) { const saved = JSON.parse(raw); this.validateSave(saved); this.state = saved; } }
    catch { this.message = 'Agenda sauvegardé incompatible ou inaccessible. Un agenda initial est utilisé ; la sauvegarde précédente reste intacte tant que vous ne modifiez rien.'; }
  }
  get snapshot(): AgendaSave { return structuredClone(this.state); }
  get calendar() { return generateSchoolCalendar(this.state.config); }
  get slots() { return this.calendar.periods.flatMap(p => p.weeks.flatMap(w => w.days.flatMap(d => d.slots))); }
  get currentSlot() { return this.slots[this.state.cursor]; }
  get sessions() { return structuredClone(this.state.sessions); }
  private validateSave(s: AgendaSave) {
    if (s.version !== 1) throw new Error('Version inconnue.');
    const slots = generateSchoolCalendar(s.config).periods.flatMap(p => p.weeks.flatMap(w => w.days.flatMap(d => d.slots)));
    if (!Number.isSafeInteger(s.cursor) || s.cursor < 0 || s.cursor > slots.length || !Number.isSafeInteger(s.nextId) || s.nextId < 1 || !Array.isArray(s.sessions)) throw new Error('Temps invalide.');
    const ids = new Set<string>(), occupied = new Set<string>();
    for (const session of s.sessions) {
      this.validateActivity(session.lessonId, session.type);
      const index = slots.findIndex(slot => slot.id === session.slotId);
      if (typeof session.id !== 'string' || !session.id.trim() || ids.has(session.id) || occupied.has(session.slotId) || index < 0 || !['planned', 'completed'].includes(session.status) || (session.status === 'completed' ? index >= s.cursor : index < s.cursor)) throw new Error('Séance sauvegardée invalide.');
      ids.add(session.id); occupied.add(session.slotId);
    }
  }
  private validateActivity(lessonId: string, type: string) {
    getTeachingMode(type);
    if (!this.curriculum.lessons.some(l => l.id === lessonId && (l.availableTeachingModes ?? ['lecture']).includes(type))) throw new Error('Leçon ou approche indisponible.');
  }
  private persist() {
    try { if (!this.storage) throw new Error(); this.storage.setItem(this.key, JSON.stringify(this.state)); this.message = 'Agenda sauvegardé sur cet appareil.'; }
    catch { this.message = 'Sauvegarde impossible : les changements restent disponibles pendant cette visite.'; }
  }
  configure(config: CalendarConfig) {
    if (this.state.sessions.length || this.state.cursor) throw new Error('Configurez le calendrier avant de planifier ou de consommer du temps.');
    generateSchoolCalendar(config); this.state.config = structuredClone(config); this.persist();
  }
  place(slotId: string, lessonId: string, type: string, sessionId?: string) {
    this.validateActivity(lessonId, type);
    const existing = sessionId ? this.state.sessions.find(s => s.id === sessionId) : undefined;
    if (sessionId && (!existing || existing.status !== 'planned')) throw new Error('Séance non modifiable.');
    const index = this.slots.findIndex(s => s.id === slotId);
    if (index < this.state.cursor || index < 0 || this.state.sessions.some(s => s.slotId === slotId && s.id !== sessionId)) throw new Error('Créneau passé, inexistant ou déjà occupé.');
    if (existing) Object.assign(existing, { slotId, lessonId, type });
    else {
      let id: string;
      do { id = `session-${this.state.nextId++}`; } while (this.state.sessions.some(s => s.id === id));
      this.state.sessions.push({ id, slotId, lessonId, type, status: 'planned' });
    }
    this.persist();
  }
  remove(id: string) {
    const s = this.state.sessions.find(s => s.id === id);
    if (!s || s.status !== 'planned') throw new Error('Séance non supprimable.');
    this.state.sessions = this.state.sessions.filter(s => s.id !== id); this.persist();
  }
  nextSession(): Session {
    const session = this.state.sessions.find(s => s.slotId === this.currentSlot?.id);
    if (!session) throw new Error('Planifiez une séance sur le créneau courant dans l’agenda.');
    if (getTeachingMode(session.type).resolution !== 'classroom') throw new Error('Les devoirs sont planifiables ; leur résolution différée arrivera ultérieurement. Modifiez ou déplacez cette séance pour poursuivre en classe.');
    return structuredClone(session);
  }
  consume(id: string) {
    const session = this.nextSession();
    if (session.id !== id) throw new Error('La séance ne correspond pas au temps courant.');
    this.state.sessions.find(s => s.id === id)!.status = 'completed'; this.state.cursor++; this.persist();
  }
  skip() {
    if (!this.currentSlot || this.state.sessions.some(s => s.slotId === this.currentSlot!.id)) throw new Error('Seul un créneau courant vide peut être laissé libre.');
    this.state.cursor++; this.persist();
  }
  indicators(students: readonly Student[], deadlineSlotId?: string) {
    const slots = this.slots, remaining = slots.length - this.state.cursor;
    const learned = new Set(this.state.sessions.filter(s => s.status === 'completed').map(s => s.lessonId));
    const mastery = this.curriculum.lessons.map(l => ({ lessonId: l.id, average: students.length ? students.reduce((sum, s) => sum + (s.lessonMastery?.[l.id] ?? 0), 0) / students.length : 0 }));
    const unaddressed = mastery.filter(m => !learned.has(m.lessonId) && !students.some(s => (s.lessonMastery?.[m.lessonId] ?? 0) > 0)).map(m => m.lessonId);
    const insufficient = mastery.filter(m => m.average < this.state.config.masteryThreshold).map(m => m.lessonId);
    const deadline = deadlineSlotId ? slots.findIndex(s => s.id === deadlineSlotId) : slots.length - 1;
    if (deadlineSlotId && deadline < 0) throw new Error('Échéance inconnue.');
    return { remaining, free: remaining - this.state.sessions.filter(s => s.status === 'planned').length, unaddressed, insufficient, mastery,
      slotsBeforeDeadline: Math.max(0, deadline + 1 - this.state.cursor), minimumCoverageMargin: remaining - unaddressed.length };
  }
}
