import { sessionRules } from '../data/sessionRules.js';
import { estimateMastery } from './LearningMemory.js';
import { getTeachingMode } from '../data/teachingModes.js';
import { generateSchoolCalendar } from './SchoolCalendar.js';
export class Agenda {
    curriculum;
    storage;
    key;
    state;
    message = '';
    constructor(config, curriculum, storage, key = 'classroom-rpg:agenda:v1') {
        this.curriculum = curriculum;
        this.storage = storage;
        this.key = key;
        this.state = { version: 1, config: structuredClone(config), sessions: [], cursor: 0, nextId: 1 };
        generateSchoolCalendar(config);
        try {
            const raw = storage?.getItem(key);
            if (raw) {
                const saved = JSON.parse(raw);
                this.validateSave(saved);
                this.state = saved;
            }
        }
        catch {
            this.message = 'Agenda sauvegardé incompatible ou inaccessible. Un agenda initial est utilisé ; la sauvegarde précédente reste intacte tant que vous ne modifiez rien.';
        }
    }
    get snapshot() { return structuredClone(this.state); }
    get calendar() { return generateSchoolCalendar(this.state.config); }
    get slots() { return this.calendar.periods.flatMap(p => p.weeks.flatMap(w => w.days.flatMap(d => d.slots))); }
    get currentSlot() { return this.slots[this.state.cursor]; }
    get currentDay() {
        const weeks = this.calendar.periods.flatMap(p => p.weeks);
        const weekLength = Math.max(7, this.state.config.days.length);
        for (const week of weeks) {
            const index = week.days.findIndex(d => d.slots.some(s => s.id === this.currentSlot?.id));
            if (index >= 0)
                return (week.number - 1) * weekLength + index;
        }
        return weeks.length * weekLength;
    }
    get sessions() { return structuredClone(this.state.sessions); }
    validateSave(s) {
        if (s.version !== 1)
            throw new Error('Version inconnue.');
        const slots = generateSchoolCalendar(s.config).periods.flatMap(p => p.weeks.flatMap(w => w.days.flatMap(d => d.slots)));
        if (!Number.isSafeInteger(s.cursor) || s.cursor < 0 || s.cursor > slots.length || !Number.isSafeInteger(s.nextId) || s.nextId < 1 || !Array.isArray(s.sessions))
            throw new Error('Temps invalide.');
        const ids = new Set(), occupied = new Set();
        for (const session of s.sessions) {
            this.validateActivity(session.lessonId, session.type);
            if (session.sessionType && session.sessionType !== session.type)
                throw new Error('Types incohérents.');
            this.validateDifficulty(session.difficulty);
            const index = slots.findIndex(slot => slot.id === session.slotId);
            if (typeof session.id !== 'string' || !session.id.trim() || ids.has(session.id) || occupied.has(session.slotId + (session.type === 'homework' ? '/homework' : '/class')) || index < 0 || !['planned', 'completed'].includes(session.status) || (session.status === 'completed' ? (session.type === 'homework' ? index > s.cursor : index >= s.cursor) : index < s.cursor))
                throw new Error('Séance sauvegardée invalide.');
            ids.add(session.id);
            occupied.add(session.slotId + (session.type === 'homework' ? '/homework' : '/class'));
        }
        const preparation = new Map();
        for (const session of s.sessions.filter(v => v.type === 'homework')) {
            const day = session.slotId.slice(0, session.slotId.lastIndexOf('/'));
            preparation.set(day, (preparation.get(day) ?? 0) + sessionRules.homeworkMinutes);
        }
        if ([...preparation.values()].some(minutes => minutes > sessionRules.dailyPreparationMinutes))
            throw new Error('Temps de préparation invalide.');
    }
    validateActivity(lessonId, type) {
        getTeachingMode(type);
        if (!this.curriculum.lessons.some(l => l.id === lessonId && (l.availableTeachingModes ?? ['lecture']).includes(type)))
            throw new Error('Leçon ou approche indisponible.');
    }
    validateDifficulty(difficulty) {
        if (difficulty !== undefined && (!Number.isFinite(difficulty) || difficulty < 0 || difficulty > 100))
            throw new Error('Difficulté attendue entre 0 et 100.');
    }
    persist() {
        try {
            if (!this.storage)
                throw new Error();
            this.storage.setItem(this.key, JSON.stringify(this.state));
            this.message = 'Agenda sauvegardé sur cet appareil.';
        }
        catch {
            this.message = 'Sauvegarde impossible : les changements restent disponibles pendant cette visite.';
        }
    }
    configure(config) {
        if (this.state.sessions.length || this.state.cursor)
            throw new Error('Configurez le calendrier avant de planifier ou de consommer du temps.');
        generateSchoolCalendar(config);
        this.state.config = structuredClone(config);
        this.persist();
    }
    place(slotId, lessonId, type, sessionId, difficulty) {
        this.validateDifficulty(difficulty);
        this.validateActivity(lessonId, type);
        const existing = sessionId ? this.state.sessions.find(s => s.id === sessionId) : undefined;
        if (sessionId && (!existing || existing.status !== 'planned'))
            throw new Error('Séance non modifiable.');
        const index = this.slots.findIndex(s => s.id === slotId);
        if (index < this.state.cursor || index < 0 || this.state.sessions.some(s => s.slotId === slotId && s.id !== sessionId && (s.type === 'homework') === (type === 'homework')))
            throw new Error('Créneau passé, inexistant ou déjà occupé.');
        if (type === 'homework') {
            const dayId = slotId.slice(0, slotId.lastIndexOf('/'));
            const count = this.state.sessions.filter(s => s.type === 'homework' && s.id !== sessionId && s.slotId.startsWith(dayId + '/')).length;
            if ((count + 1) * sessionRules.homeworkMinutes > sessionRules.dailyPreparationMinutes)
                throw new Error('Temps libre de préparation épuisé pour cette journée.');
        }
        if (existing) {
            Object.assign(existing, { slotId, lessonId, type, sessionType: type });
            if (difficulty === undefined)
                delete existing.difficulty;
            else
                existing.difficulty = difficulty;
        }
        else {
            let id;
            do {
                id = `session-${this.state.nextId++}`;
            } while (this.state.sessions.some(s => s.id === id));
            this.state.sessions.push({ id, slotId, lessonId, type, sessionType: type, ...(difficulty === undefined ? {} : { difficulty }), status: 'planned' });
        }
        this.persist();
    }
    remove(id) {
        const s = this.state.sessions.find(s => s.id === id);
        if (!s || s.status !== 'planned')
            throw new Error('Séance non supprimable.');
        this.state.sessions = this.state.sessions.filter(s => s.id !== id);
        this.persist();
    }
    nextSession() {
        const available = this.state.sessions.filter(s => s.slotId === this.currentSlot?.id && s.status === 'planned');
        const session = available.find(s => s.type === 'homework') ?? available[0];
        if (!session)
            throw new Error('Planifiez une séance sur le créneau courant dans l’agenda.');
        return structuredClone(session);
    }
    consume(id) {
        const session = this.nextSession();
        if (session.id !== id)
            throw new Error('La séance ne correspond pas au temps courant.');
        this.state.sessions.find(s => s.id === id).status = 'completed';
        if (session.type !== 'homework')
            this.state.cursor++;
        this.persist();
    }
    skip() {
        if (!this.currentSlot || this.state.sessions.some(s => s.slotId === this.currentSlot.id && s.status === 'planned'))
            throw new Error('Seul un créneau courant vide peut être laissé libre.');
        this.state.cursor++;
        this.persist();
    }
    indicators(students, deadlineSlotId, pedagogy = 0) {
        const slots = this.slots, remaining = slots.length - this.state.cursor;
        const learned = new Set(this.state.sessions.filter(s => s.status === 'completed').map(s => s.lessonId));
        const mastery = this.curriculum.lessons.map(l => ({ lessonId: l.id, average: students.length ? students.reduce((sum, s) => sum + (s.lessonMastery?.[l.id] ?? 0), 0) / students.length : 0 }));
        const unaddressed = mastery.filter(m => !learned.has(m.lessonId) && !students.some(s => (s.lessonMastery?.[m.lessonId] ?? 0) > 0)).map(m => m.lessonId);
        const insufficient = mastery.filter(m => m.average < this.state.config.masteryThreshold).map(m => m.lessonId);
        const deadline = deadlineSlotId ? slots.findIndex(s => s.id === deadlineSlotId) : slots.length - 1;
        if (deadlineSlotId && deadline < 0)
            throw new Error('Échéance inconnue.');
        const estimates = this.curriculum.lessons.map(l => { const values = students.map(s => estimateMastery(s, l.id, { pedagogy }, this.currentDay)); return { lessonId: l.id, low: values.length ? Math.floor(values.reduce((sum, v) => sum + v.low, 0) / values.length) : 0, high: values.length ? Math.ceil(values.reduce((sum, v) => sum + v.high, 0) / values.length) : 100 }; });
        return { estimates, remaining, free: remaining - this.state.sessions.filter(s => s.status === 'planned' && s.type !== 'homework').length, unaddressed, insufficient, mastery,
            slotsBeforeDeadline: Math.max(0, deadline + 1 - this.state.cursor), minimumCoverageMargin: remaining - unaddressed.length };
    }
}
