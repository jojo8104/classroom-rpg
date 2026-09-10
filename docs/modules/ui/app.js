import { createPrototype } from '../data/prototype.js';
import { Simulation } from '../engine/simulation.js';
const scenario = createPrototype();
let simulation = new Simulation(scenario, 12345);
let selected = scenario.students[0].id;
let shown = new Map(scenario.students.map(s => [s.id, 0]));
let busy = false;
const el = (id) => document.getElementById(id);
const advance = el('advance');
const seed = el('seed');
const restart = el('restart');
const log = el('log');
const studentName = (id) => scenario.students.find(s => s.id === id).name;
function renderStudents() {
    for (const student of scenario.students) {
        const button = el(student.id);
        button.setAttribute('aria-pressed', String(selected === student.id));
        button.setAttribute('aria-label', `${student.name}, ${shown.get(student.id)} % de compréhension`);
        button.querySelector('b').textContent = `${shown.get(student.id)} %`;
        button.querySelector('progress').value = shown.get(student.id);
    }
    const student = scenario.students.find(s => s.id === selected);
    const role = scenario.archetypes.find(a => a.id === student.archetypeId).name;
    el('student-detail').innerHTML = `<h2>${student.name}</h2><span class="role ${student.archetypeId}">${role}</span><div class="understanding">${shown.get(selected)} %</div><p>Compréhension de la leçon</p><dl>${[['Intelligence', student.intelligence], ['Discipline', student.discipline], ['Concentration', student.concentration], ['Moral', student.morale]].map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl>`;
}
for (const student of scenario.students) {
    const seat = scenario.classroom.seats.find(s => s.id === student.seatId);
    const button = document.createElement('button');
    button.id = student.id;
    button.className = `seat ${student.archetypeId}`;
    button.style.gridRow = String(seat.row + 1);
    button.style.gridColumn = String(seat.column + 1);
    button.innerHTML = `<span class="seat-top"><span class="avatar">${student.name.slice(0, 1)}</span><strong>${student.name}</strong></span><span class="score"><b>0 %</b><small>compris</small></span><progress max="100" value="0" aria-label="Compréhension de ${student.name}"></progress>`;
    button.addEventListener('click', () => { selected = student.id; renderStudents(); });
    el('seats').append(button);
}
function note(text) {
    const item = document.createElement('li');
    item.textContent = text;
    log.prepend(item);
    while (log.children.length > 12)
        log.lastElementChild.remove();
}
function syncControls() {
    advance.disabled = busy;
    seed.disabled = busy;
    restart.querySelector('button').disabled = busy;
    if (busy) {
        advance.textContent = 'Les élèves travaillent…';
        return;
    }
    if (simulation.state === 'TEACHER_INTERVENTION') {
        el('phase').textContent = 'À vous, professeur';
        el('status').textContent = 'Observez la classe. Aucune intervention disponible pour le moment.';
        advance.textContent = 'Continuer sans intervenir →';
    }
    else if (simulation.state === 'LESSON_FINISHED') {
        el('phase').textContent = 'Leçon terminée';
        el('status').textContent = 'Chaque élève a son résultat. Sélectionnez un pupitre pour le consulter.';
        advance.textContent = 'Leçon terminée';
        advance.disabled = true;
    }
    else {
        el('phase').textContent = 'La classe est prête';
        el('status').textContent = 'Les élèves sont installés.';
        advance.textContent = 'Commencer la leçon →';
    }
}
async function showEvents(events) {
    for (const event of events) {
        if (event.type === 'STUDENT_ACTION') {
            document.querySelectorAll('.seat.active').forEach(s => s.classList.remove('active'));
            el(event.actorId).classList.add('active');
            note(event.actionId === 'WORK' ? `${studentName(event.actorId)} travaille${event.extra ? ' à nouveau' : ''}.` : `${studentName(event.actorId)} soutient ${studentName(event.targetId)}.`);
        }
        else if (event.type === 'UNDERSTANDING_CHANGED') {
            shown.set(event.studentId, event.after);
            renderStudents();
        }
        else if (event.type === 'EFFECT_APPLIED') {
            note(`${studentName(event.targetId)} : concentration +${event.amount} pour cette étape.`);
        }
        else if (event.type === 'ROUND_ENDED') {
            shown = new Map(event.students.map(s => [s.studentId, s.lessonUnderstanding]));
            renderStudents();
            el('lesson-progress').value = event.round;
        }
        if (event.type === 'UNDERSTANDING_CHANGED' || event.type === 'EFFECT_APPLIED') {
            await new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 230));
        }
    }
    document.querySelectorAll('.seat.active').forEach(s => s.classList.remove('active'));
}
async function advanceLesson() {
    if (busy)
        return;
    busy = true;
    syncControls();
    try {
        if (simulation.state === 'TEACHER_INTERVENTION')
            simulation.skipTeacherIntervention();
        if (simulation.state === 'ROUND_READY') {
            const events = simulation.resolveRound();
            const chapterId = events[0].chapterId;
            const index = scenario.lesson.chapters.findIndex(c => c.id === chapterId);
            el('chapter').textContent = scenario.lesson.chapters[index].name;
            el('chapter-count').textContent = `CHAPITRE ${index + 1} / 2`;
            el('phase').textContent = 'Les élèves travaillent';
            el('status').textContent = 'Observez leurs progrès et leurs interactions.';
            await showEvents(events);
            simulation.acknowledgeRoundResult();
        }
    }
    catch (error) {
        note(error instanceof Error ? error.message : 'La leçon a rencontré une erreur.');
    }
    finally {
        busy = false;
        syncControls();
    }
}
advance.addEventListener('click', () => { void advanceLesson(); });
restart.addEventListener('submit', event => {
    event.preventDefault();
    if (busy || !restart.reportValidity())
        return;
    simulation = new Simulation(scenario, Number(seed.value));
    shown = new Map(scenario.students.map(s => [s.id, 0]));
    log.replaceChildren();
    note('Une nouvelle leçon commence.');
    el('chapter').textContent = 'Découvrir';
    el('chapter-count').textContent = 'CHAPITRE 1 / 2';
    el('lesson-progress').value = 0;
    renderStudents();
    syncControls();
});
renderStudents();
syncControls();
const context = document.modelContext;
if (context) {
    const lifecycle = new AbortController();
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
    for (const readOnly of [true, false]) {
        try {
            void Promise.resolve(context.registerTool({
                name: readOnly ? 'read_classroom' : 'advance_lesson',
                description: readOnly ? 'Lire la phase et la compréhension affichée des neuf élèves.' : 'Avancer une étape de la leçon, sans intervention du professeur, et attendre son affichage.',
                inputSchema: { type: 'object', properties: {}, additionalProperties: false },
                annotations: { readOnlyHint: readOnly },
                async execute(input) {
                    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length)
                        throw new Error('Objet vide attendu.');
                    if (!readOnly) {
                        if (busy || simulation.state === 'LESSON_FINISHED')
                            throw new Error('La leçon ne peut pas avancer maintenant.');
                        await advanceLesson();
                    }
                    return { phase: simulation.state, busy, students: Object.fromEntries(shown) };
                },
            }, { signal: lifecycle.signal })).catch(() => { });
        }
        catch { /* Le jeu reste utilisable si le registre facultatif est indisponible. */ }
    }
}
