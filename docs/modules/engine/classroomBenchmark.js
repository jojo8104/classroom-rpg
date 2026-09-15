import { CLASSROOM_CONFIG } from '../data/classroomConfig.js';
import { createFullClassPrototype } from '../data/fullClassPrototype.js';
import { createClassroomActionRules } from '../data/rules.js';
import { Simulation } from './simulation.js';
export function benchmarkClassroom(options = {}) {
    const rows = options.rows ?? CLASSROOM_CONFIG.rows, columns = options.columns ?? CLASSROOM_CONFIG.columns;
    const ticks = options.ticks ?? 100, lessons = options.lessons ?? 1, seed = options.seed ?? 701;
    if (!Number.isSafeInteger(ticks) || ticks < 1 || !Number.isSafeInteger(lessons) || lessons < 1)
        throw new Error('Ticks et leçons entiers positifs requis.');
    const scenario = createFullClassPrototype({ rows, columns, maxStudents: rows * columns });
    scenario.lesson.roundCount = ticks;
    const rules = createClassroomActionRules(scenario.students.length), samples = [];
    let events = 0, interactions = 0, maximumQueue = 0, maximumChain = 0, mainActions = 0, positiveEffects = 0, negativeEffects = 0;
    const behavior = new Map();
    const started = performance.now();
    for (let lesson = 0; lesson < lessons; lesson++) {
        const simulation = new Simulation(scenario, (seed + lesson) >>> 0, rules);
        while (simulation.state !== 'LESSON_FINISHED') {
            const before = performance.now();
            const tickEvents = simulation.resolveTick();
            samples.push(performance.now() - before);
            for (const event of tickEvents)
                if (event.type === 'STUDENT_ACTION') {
                    let stats = behavior.get(event.actorId);
                    if (!stats) {
                        stats = { work: 0, support: 0, disrupt: 0, recover: 0 };
                        behavior.set(event.actorId, stats);
                    }
                    stats[event.actionId.toLowerCase()]++;
                }
            simulation.acknowledgeRoundResult();
            simulation.skipTeacherIntervention();
        }
        const metrics = simulation.debugMetrics;
        events += metrics.events;
        interactions += metrics.secondaryInteractions;
        mainActions += metrics.mainActions;
        positiveEffects += metrics.positiveEffects;
        negativeEffects += metrics.negativeEffects;
        maximumQueue = Math.max(maximumQueue, metrics.maximumQueue);
        maximumChain = Math.max(maximumChain, metrics.maximumChain);
        const result = simulation.getResult();
        scenario.students = result.nextLessonStudents;
        if (result.classRelations)
            scenario.classRelations = result.classRelations;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    return { rows, columns, students: scenario.students.length, ticks: samples.length, lessons, events, interactions, mainActions, positiveEffects, negativeEffects, maximumQueue, maximumChain,
        averageTickMs: samples.reduce((sum, s) => sum + s, 0) / samples.length, p95TickMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))], maximumTickMs: sorted.at(-1), totalMs: performance.now() - started,
        queueBudget: rules.maxActionsPerRound, chainBudget: rules.maxChainDepth, behavior: Object.fromEntries(behavior) };
}
