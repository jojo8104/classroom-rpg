import { chapterCapacity, combinedGain, pressureDamage, roundValue, workGain } from './combat.js';
import { effectiveStats } from './effects.js';
function resolveProgress(context, gain) {
    const { state, lesson, chapterId, events } = context;
    const chapter = state.chapters.find(c => c.chapterId === chapterId);
    const before = state.lessonUnderstanding;
    chapter.progress = Math.min(chapterCapacity(lesson), roundValue(chapter.progress + gain));
    state.lessonUnderstanding = roundValue(Math.min(100, 100 * state.chapters.reduce((sum, c) => sum + c.progress, 0) / lesson.requiredProgress));
    events.push({ type: 'CHAPTER_PROGRESS_CHANGED', studentId: state.studentId, ...chapter });
    events.push({ type: 'UNDERSTANDING_CHANGED', studentId: state.studentId, before,
        after: state.lessonUnderstanding, amount: roundValue(state.lessonUnderstanding - before) });
}
function resolveRetaliation(context) {
    const { student, state, lesson, rules, events } = context;
    const effective = effectiveStats(student, state);
    const damage = Math.min(state.concentration, pressureDamage(effective, effective.morale, lesson, rules));
    events.push({ type: 'LESSON_RETALIATED', studentId: student.id, damage });
    context.changeConcentration(state, state.concentration - damage, 'pressure');
}
// Chaque yield suspend réellement le tour. L'appelant pourra résoudre les réactions
// bornées de cette fenêtre avant de demander l'étape suivante, sans récursion.
export function* resolveWorkTurn(context) {
    const { student, state, lesson, chapterId, rules, random, events } = context;
    const chapter = state.chapters.find(c => c.chapterId === chapterId);
    if (chapter.progress >= chapterCapacity(lesson))
        return;
    yield 'BEFORE_STUDENT_ATTACK';
    yield 'DURING_STUDENT_ATTACK';
    const critical = random.next() < rules.criticalChance;
    const effective = effectiveStats(student, state);
    const variation = random.next();
    const multiplier = critical ? rules.criticalMultiplier : 1;
    const gain = workGain(effective, effective.morale, lesson, rules, variation) * multiplier;
    if (critical)
        events.push({ type: 'CRITICAL_HIT', studentId: student.id });
    const combination = context.modifiers?.combined;
    if (combination) {
        // Les deux contributions utilisent le même tirage et la même complexité.
        // Le partenaire n'obtient pas de progression pendant le tour de l'élève actif.
        const partner = combination.partner;
        const result = combinedGain(gain, workGain(partner, partner.morale, lesson, rules, variation) * multiplier, combination.synergyRatio);
        const before = chapter.progress;
        resolveProgress(context, result.potentialGain);
        events.push({ type: 'COMBINED_ATTACK_RESOLVED', sourceId: partner.id, targetId: student.id,
            ...result, appliedProgress: roundValue(chapter.progress - before) });
    }
    else
        resolveProgress(context, gain);
    yield 'AFTER_STUDENT_ATTACK';
    // Les exemptions de riposte de Roadmap 1.1 restent prioritaires.
    if (critical || chapter.progress >= chapterCapacity(lesson))
        return;
    yield 'BEFORE_LESSON_ATTACK';
    yield 'DURING_LESSON_ATTACK';
    resolveRetaliation(context);
    yield 'AFTER_LESSON_ATTACK';
}
