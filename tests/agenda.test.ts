import { describe, expect, it } from 'vitest';
import { defaultCalendarConfig } from '../src/data/calendarConfig.js';
import { generateSchoolCalendar } from '../src/systems/SchoolCalendar.js';
import { Agenda } from '../src/systems/Agenda.js';
import { curriculum } from '../src/data/curriculum.js';
import { createPrototype } from '../src/data/prototype.js';
import { ClassPreparation } from '../src/systems/ClassPreparation.js';
import { selectLessonActivity } from '../src/systems/Curriculum.js';
import { Simulation } from '../src/engine/simulation.js';

const lessonId = curriculum.lessons[0]!.id;
const storage = () => { const map = new Map<string, string>(); return { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); } }; };
const alternate = () => ({ ...structuredClone(defaultCalendarConfig), teachingWeeks: 3, workingDays: ['mon', 'thu'], slotsPerDay: 3,
  periods: [{ id: 'a', name: 'A', teachingWeeks: 1, holidayWeeksAfter: 1 }, { id: 'b', name: 'B', teachingWeeks: 2, holidayWeeksAfter: 0 }],
  specialDays: [{ week: 1, dayId: 'mon', status: 'event' as const, label: 'Sortie' }, { week: 3, dayId: 'thu', status: 'holiday' as const, label: 'Férié' }] });

describe('Roadmap 10 — calendrier', () => {
  it('génère 36 semaines scolaires plus les vacances et des IDs stables', () => {
    const config = structuredClone(defaultCalendarConfig), calendar = generateSchoolCalendar(config);
    const weeks = calendar.periods.flatMap(p => p.weeks);
    expect(weeks.filter(w => w.teaching)).toHaveLength(36);
    expect(weeks).toHaveLength(44);
    expect(weeks.filter(w => !w.teaching).flatMap(w => w.days).every(d => d.status === 'holiday' && d.slots.length === 0)).toBe(true);
    expect(new Agenda(config, curriculum).slots).toHaveLength(360);
    expect(generateSchoolCalendar(config)).toEqual(calendar);
    expect(config).toEqual(defaultCalendarConfig);
  });
  it('accepte trois semaines, deux jours travaillés, trois créneaux et exceptions', () => {
    const a = new Agenda(alternate(), curriculum);
    expect(a.slots).toHaveLength(12);
    expect(a.calendar.periods[0]!.weeks[0]!.days[0]!.status).toBe('event');
    expect(a.calendar.periods.flatMap(p => p.weeks)).toHaveLength(4);
  });
  it('refuse configurations incohérentes, doublons et enseignement en vacances', () => {
    expect(() => generateSchoolCalendar({ ...alternate(), teachingWeeks: 36 })).toThrow();
    expect(() => generateSchoolCalendar({ ...alternate(), slotsPerDay: -1 })).toThrow();
    expect(() => generateSchoolCalendar({ ...alternate(), workingDays: ['unknown'] })).toThrow();
    expect(() => generateSchoolCalendar({ ...alternate(), specialDays: [{ week: 2, dayId: 'mon', status: 'school', label: '' }] })).toThrow();
    expect(() => generateSchoolCalendar({ ...alternate(), specialDays: [alternate().specialDays[0]!, alternate().specialDays[0]!] })).toThrow();
  });
});
describe('Roadmap 10 — séances, temps et sauvegarde', () => {
  it('conserve une configuration personnalisée et bloque sa modification après planification', () => {
    const disk = storage(), a = new Agenda(defaultCalendarConfig, curriculum, disk);
    a.configure(alternate());
    expect(new Agenda(defaultCalendarConfig, curriculum, disk).snapshot.config).toEqual(alternate());
    a.place(a.currentSlot!.id, lessonId, 'lecture');
    expect(() => a.configure(defaultCalendarConfig)).toThrow();
  });
  it('termine une année sans recréer de temps disponible', () => {
    const a = new Agenda({ ...alternate(), teachingWeeks: 1, periods: [{ id: 'only', name: 'Unique', teachingWeeks: 1, holidayWeeksAfter: 0 }], specialDays: [], workingDays: ['mon'], slotsPerDay: 1 }, curriculum);
    a.place(a.currentSlot!.id, lessonId, 'assessment'); a.consume(a.nextSession().id);
    expect(a.currentSlot).toBeUndefined(); expect(a.indicators([]).remaining).toBe(0);
    expect(() => a.skip()).toThrow(); expect(() => a.nextSession()).toThrow();
  });
  it('place plusieurs approches sur la même leçon, modifie, déplace et supprime', () => {
    const a = new Agenda(alternate(), curriculum), original = structuredClone(curriculum);
    a.place(a.slots[0]!.id, lessonId, 'lecture'); a.place(a.slots[1]!.id, lessonId, 'exercise');
    const first = a.sessions[0]!;
    a.place(a.slots[2]!.id, lessonId, 'revision', first.id);
    expect(a.sessions[0]).toMatchObject({ slotId: a.slots[2]!.id, type: 'revision' });
    a.remove(first.id); expect(a.sessions).toHaveLength(1);
    expect(curriculum).toEqual(original);
    expect(Object.keys(a.sessions[0]!)).toEqual(['id', 'slotId', 'lessonId', 'type', 'sessionType', 'status']);
  });
  it('refuse conflits, références cassées et créneaux non scolaires sans mutation', () => {
    const a = new Agenda(alternate(), curriculum); a.place(a.slots[0]!.id, lessonId, 'lecture'); const before = a.snapshot;
    for (const [slot, lesson, type] of [[a.slots[0]!.id, lessonId, 'exercise'], ['holiday-slot', lessonId, 'lecture'], [a.slots[1]!.id, 'missing', 'lecture'], [a.slots[1]!.id, lessonId, 'missing']]) expect(() => a.place(slot!, lesson!, type!)).toThrow();
    expect(a.snapshot).toEqual(before);
  });
  it('consomme une unité seulement à la clôture et interdit le recyclage du passé', () => {
    const a = new Agenda(alternate(), curriculum); a.place(a.currentSlot!.id, lessonId, 'lecture');
    const session = a.nextSession(); expect(a.snapshot.cursor).toBe(0);
    a.consume(session.id); expect(a.snapshot.cursor).toBe(1);
    expect(() => a.remove(session.id)).toThrow(); expect(() => a.place(session.slotId, lessonId, 'exercise')).toThrow();
    expect(() => a.consume(session.id)).toThrow(); a.skip(); expect(a.snapshot.cursor).toBe(2);
  });
  it('résout les devoirs sans consommer de créneau scolaire', () => {
    const a = new Agenda(alternate(), curriculum); a.place(a.currentSlot!.id, lessonId, 'homework');
    const session = a.nextSession(); a.consume(session.id); expect(a.snapshot.cursor).toBe(0); expect(a.sessions[0]!.status).toBe('completed');
  });
  it('restaure configuration, séances et temps à côté des sauvegardes précédentes', () => {
    const disk = storage(), scenario = createPrototype(), preparation = new ClassPreparation(scenario, disk);
    preparation.save(); const original = disk.getItem(`classroom-rpg:${scenario.classroom.id}:preparation:v1`);
    const a = new Agenda(alternate(), curriculum, disk); a.place(a.currentSlot!.id, lessonId, 'lecture'); a.consume(a.nextSession().id);
    a.place(a.currentSlot!.id, lessonId, 'assessment');
    const restored = new Agenda(defaultCalendarConfig, curriculum, disk);
    expect(restored.snapshot).toEqual(a.snapshot);
    expect(disk.getItem(`classroom-rpg:${scenario.classroom.id}:preparation:v1`)).toBe(original);
    expect(new ClassPreparation(createPrototype(), disk).scenario.students).toEqual(preparation.scenario.students);
  });
  it('préserve les données corrompues et signale les erreurs de stockage', () => {
    const disk = storage(); disk.setItem('classroom-rpg:agenda:v1', '{broken');
    const a = new Agenda(alternate(), curriculum, disk); expect(a.message).toMatch(/incompatible/);
    expect(disk.getItem('classroom-rpg:agenda:v1')).toBe('{broken');
    const b = new Agenda(alternate(), curriculum, { getItem: () => null, setItem: () => { throw new Error(); } });
    b.place(b.currentSlot!.id, lessonId, 'lecture'); expect(b.message).toMatch(/impossible/); expect(b.sessions).toHaveLength(1);
  });
  it('compare programme et maîtrise sans assimiler planification et acquisition', () => {
    const a = new Agenda(alternate(), curriculum), students = createPrototype().students;
    a.place(a.currentSlot!.id, lessonId, 'lecture');
    expect(a.indicators(students)).toMatchObject({ remaining: 12, free: 11, unaddressed: [lessonId], insufficient: [lessonId] });
    students.forEach(s => { s.lessonMastery = { [lessonId]: 90 }; });
    expect(a.indicators(students, a.slots[2]!.id)).toMatchObject({ unaddressed: [], insufficient: [], slotsBeforeDeadline: 3 });
  });
  it('résout une séance avec le moteur existant sans changer ses résultats', () => {
    const a = new Agenda(alternate(), curriculum), scenario = createPrototype();
    a.place(a.currentSlot!.id, lessonId, 'exercise'); const session = a.nextSession();
    const selected = selectLessonActivity(scenario, curriculum, { lessonId: session.lessonId, teachingMode: session.type });
    const before = structuredClone(scenario);
    const result = new Simulation(selected, 42).runToCompletion();
    expect(result).toEqual(new Simulation(selectLessonActivity(scenario, curriculum, { lessonId, teachingMode: 'exercise' }), 42).runToCompletion());
    a.consume(session.id); expect(scenario).toEqual(before);
  });
});

