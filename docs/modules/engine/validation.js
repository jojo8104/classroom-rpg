import { statBounds } from '../data/rules.js';
import { validateReactionSetup } from './reactions.js';
import { validateProgression } from './progression.js';
import { validateLayout } from '../systems/ClassroomLayoutSystem.js';
// Retourner toutes les erreurs permet de corriger un scénario en une seule passe.
export function validateScenario(scenario) {
    const errors = [];
    const { classroom, students, lesson } = scenario;
    if (classroom.currentLayout)
        errors.push(...validateLayout(classroom.currentLayout, students));
    errors.push(...validateReactionSetup(students, { learningRules: scenario.learningRules, interactionRules: scenario.interactionRules, classroom, archetypes: scenario.archetypes,
        classRelations: scenario.classRelations, relations: scenario.relations ?? [], abilities: scenario.reactionAbilities ?? [] }));
    function uniqueIds(items, label) {
        const ids = new Set();
        for (const item of items) {
            if (!item.id.trim())
                errors.push(`${label} : identifiant vide.`);
            if (ids.has(item.id))
                errors.push(`${label} : identifiant dupliqué ${item.id}.`);
            ids.add(item.id);
        }
        return ids;
    }
    function checkStat(value, label) {
        if (!Number.isFinite(value) || value < statBounds.min || value > statBounds.max) {
            errors.push(`${label} : valeur attendue entre ${statBounds.min} et ${statBounds.max}.`);
        }
    }
    if (!Number.isInteger(classroom.rows) || classroom.rows < 1 ||
        !Number.isInteger(classroom.columns) || classroom.columns < 1) {
        errors.push('Salle : dimensions entières positives requises.');
    }
    if (classroom.seats.length > classroom.rows * classroom.columns) {
        errors.push('Salle : nombre de sièges supérieur à la capacité.');
    }
    const seatIds = uniqueIds(classroom.seats, 'Siège');
    const positions = new Set();
    for (const seat of classroom.seats) {
        if (!Number.isInteger(seat.row) || !Number.isInteger(seat.column) ||
            seat.row < 0 || seat.row >= classroom.rows || seat.column < 0 || seat.column >= classroom.columns) {
            errors.push(`Siège ${seat.id} : position hors grille.`);
        }
        const position = `${seat.row}:${seat.column}`;
        if (positions.has(position))
            errors.push(`Siège ${seat.id} : position déjà utilisée.`);
        positions.add(position);
    }
    uniqueIds(students, 'Élève');
    const archetypeIds = uniqueIds(scenario.archetypes, 'Archétype');
    const occupiedSeats = new Set();
    for (const student of students) {
        errors.push(...validateProgression(student));
        if (student.progression && !scenario.interactionRules)
            errors.push('La progression exige les règles de maîtrise.');
        if (student.disruptionChance !== undefined && (!Number.isFinite(student.disruptionChance) || student.disruptionChance < 0 || student.disruptionChance > 1))
            errors.push('Probabilité de perturbation invalide.');
        if (!classroom.currentLayout && student.present !== false) {
            if (!student.seatId || !seatIds.has(student.seatId))
                errors.push(`Élève ${student.id} : siège inconnu ${student.seatId}.`);
            if (student.seatId && occupiedSeats.has(student.seatId))
                errors.push(`Élève ${student.id} : siège déjà occupé ${student.seatId}.`);
            if (student.seatId)
                occupiedSeats.add(student.seatId);
        }
        if (student.present !== undefined && typeof student.present !== 'boolean')
            errors.push('Présence invalide.');
        if (student.lessonMastery)
            for (const value of Object.values(student.lessonMastery))
                checkStat(value, 'Maîtrise de leçon');
        if (student.knowledge)
            for (const value of Object.values(student.knowledge))
                checkStat(value, 'Connaissance');
        if (student.seatPreferences && (!Array.isArray(student.seatPreferences.likes) || !Array.isArray(student.seatPreferences.dislikes) ||
            [...student.seatPreferences.likes, ...student.seatPreferences.dislikes].some(t => typeof t !== 'string')))
            errors.push('Préférences invalides.');
        if (!archetypeIds.has(student.archetypeId))
            errors.push(`Élève ${student.id} : archétype inconnu.`);
        for (const stat of ['intelligence', 'discipline', 'concentration', 'morale']) {
            checkStat(student[stat], `Élève ${student.id}, ${stat}`);
        }
    }
    for (const stat of ['pedagogy', 'authority', 'patience']) {
        checkStat(scenario.teacher[stat], `Professeur, ${stat}`);
    }
    if (scenario.teacher.maxPatience !== undefined) {
        checkStat(scenario.teacher.maxPatience, 'Patience maximale');
        if (scenario.teacher.maxPatience < scenario.teacher.patience)
            errors.push('Patience maximale inférieure à la patience actuelle.');
    }
    if (scenario.topic.subjectId !== scenario.subject.id)
        errors.push('Thème : matière inconnue.');
    if (lesson.topicId !== scenario.topic.id)
        errors.push('Leçon : thème inconnu.');
    checkStat(lesson.complexity, 'Complexité');
    checkStat(lesson.pressure, 'Pression');
    if (!Number.isFinite(lesson.requiredProgress) || lesson.requiredProgress <= 0)
        errors.push('Progression requise : valeur positive requise.');
    const conceptIds = uniqueIds(scenario.concepts, 'Concept');
    for (const id of lesson.conceptIds) {
        if (!conceptIds.has(id))
            errors.push(`Leçon : concept inconnu ${id}.`);
    }
    if (new Set(lesson.conceptIds).size !== lesson.conceptIds.length)
        errors.push('Leçon : référence de concept dupliquée.');
    if (scenario.program && scenario.subject.programId !== scenario.program.id)
        errors.push('Matière : programme inconnu.');
    const poolIds = new Set();
    for (const entry of lesson.conceptPool ?? []) {
        if (!conceptIds.has(entry.conceptId) || poolIds.has(entry.conceptId) || !Number.isFinite(entry.baseRate) || entry.baseRate < 0 || entry.baseRate > 1)
            errors.push('Pool de Concepts invalide.');
        poolIds.add(entry.conceptId);
    }
    if (!Number.isSafeInteger(lesson.roundCount) || lesson.roundCount < 1)
        errors.push('Leçon : nombre de rounds entier positif requis.');
    return errors;
}
