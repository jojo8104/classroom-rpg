import { createPrototype } from '../data/prototype.js';
import { Simulation } from '../engine/simulation.js';
import type { GameEvent } from '../events.js';

const scenario = createPrototype();
let simulation = new Simulation(scenario, 12345);
let selected = scenario.students[0]!.id;
let shown = new Map(scenario.students.map(s => [s.id, 0]));
let shownStates = new Map(simulation.studentStates.map(s => [s.studentId, s]));
let busy = false;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const advance = el<HTMLButtonElement>('advance');
const seed = el<HTMLInputElement>('seed');
const restart = el<HTMLFormElement>('restart');
const log = el<HTMLOListElement>('log');
const studentName = (id: string) => scenario.students.find(s => s.id === id)!.name;

function renderStudents() {
  for (const student of scenario.students) {
    const button = el<HTMLButtonElement>(student.id);
    button.setAttribute('aria-pressed', String(selected === student.id));
    button.setAttribute('aria-label', `${student.name}, ${shown.get(student.id)} % de compréhension`);
    button.querySelector('b')!.textContent = `${shown.get(student.id)} %`;
    button.querySelector('progress')!.value = shown.get(student.id)!;
    const state = shownStates.get(student.id)!;
    button.classList.toggle('disengaged', state.concentration === 0);
    button.querySelector('.hp-label')!.textContent = `Concentration ${state.concentration} / 100`;
    button.querySelector<HTMLProgressElement>('.hp')!.value = state.concentration;
    button.querySelector('.learning-state')!.textContent = state.concentration === 0 ? 'Décroché · repos au prochain tour' : 'En apprentissage';
  }
  const student = scenario.students.find(s => s.id === selected)!;
  const role = scenario.archetypes.find(a => a.id === student.archetypeId)!.name;
  const state = shownStates.get(selected)!;
  el('student-detail').innerHTML = `<h2>${student.name}</h2><span class="role ${student.archetypeId}">${role}</span><div class="understanding">${shown.get(selected)} %</div><p>Compréhension de la leçon</p><dl>${[['Intelligence',student.intelligence],['Discipline',student.discipline],['Concentration (HP)',state.concentration],['Moral',state.morale]].map(([name,value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><h3>Acquis par chapitre</h3>${state.chapters.map(c => `<p>${scenario.lesson.chapters.find(d => d.id === c.chapterId)!.name} : ${c.progress} / ${scenario.lesson.requiredProgress / scenario.lesson.chapters.length}<br><small>${c.missedRounds} étape(s) manquée(s)</small></p>`).join('')}`;
}
for (const student of scenario.students) {
  const seat = scenario.classroom.seats.find(s => s.id === student.seatId)!;
  const button = document.createElement('button');
  button.id = student.id; button.className = `seat ${student.archetypeId}`;
  button.style.gridRow = String(seat.row + 1); button.style.gridColumn = String(seat.column + 1);
  button.innerHTML = `<span class="seat-top"><span class="avatar">${student.name.slice(0,1)}</span><strong>${student.name}</strong></span><span class="score"><b>0 %</b><small>compris</small></span><progress max="100" value="0" aria-label="Compréhension de ${student.name}"></progress>`;
  const feedback = document.createElement('span');
  const health = document.createElement('span');
  health.innerHTML = `<span class="hp-label"></span><progress class="hp" max="100" aria-label="Concentration de ${student.name}"></progress><span class="learning-state"></span>`;
  button.append(health);
  feedback.className = 'seat-feedback'; feedback.setAttribute('aria-hidden', 'true');
  button.append(feedback);
  button.addEventListener('click', () => { selected = student.id; renderStudents(); });
  el('seats').append(button);
}
function note(text: string) {
  const item = document.createElement('li'); item.textContent = text; log.prepend(item);
  while (log.children.length > 12) log.lastElementChild!.remove();
}
function syncControls() {
  advance.disabled = busy;
  seed.disabled = busy;
  restart.querySelector('button')!.disabled = busy;
  if (busy) { advance.textContent = 'Les élèves travaillent…'; return; }
  if (simulation.state === 'TEACHER_INTERVENTION') {
    el('phase').textContent = 'À vous, professeur';
    el('status').textContent = 'Observez la classe. Aucune intervention disponible pour le moment.';
    advance.textContent = 'Continuer sans intervenir →';
  } else if (simulation.state === 'LESSON_FINISHED') {
    el('phase').textContent = 'Leçon terminée'; el('status').textContent = 'Chaque élève a son résultat. Sélectionnez un pupitre pour le consulter.';
    advance.textContent = 'Leçon terminée'; advance.disabled = true;
  } else {
    el('phase').textContent = 'La classe est prête';
    el('status').textContent = 'Les élèves sont installés.'; advance.textContent = 'Commencer la leçon →';
  }
}
function clearActionFeedback() {
  document.querySelectorAll('.seat').forEach(seat => {
    seat.classList.remove('active', 'receiving');
    seat.querySelector('.seat-feedback')!.textContent = '';
  });
}
function feedback(studentId: string, text: string) {
  el(studentId).querySelector('.seat-feedback')!.textContent = text;
}
async function showEvents(events: GameEvent[]) {
  for (const event of events) {
    if (event.type === 'STUDENT_ACTION') {
      clearActionFeedback();
      el(event.actorId).classList.add('active');
      if (event.actionId === 'SUPPORT') {
        el(event.targetId).classList.add('receiving');
        feedback(event.actorId, `Aide ${studentName(event.targetId)}`);
        el('status').textContent = `${studentName(event.actorId)} aide ${studentName(event.targetId)}.`;
      } else if (event.actionId === 'RECOVER') {
        feedback(event.actorId, 'Se repose');
        el('status').textContent = `${studentName(event.actorId)} se repose et manque cette partie de la leçon.`;
      } else {
        feedback(event.actorId, event.extra ? 'Travaille à nouveau' : 'Travaille');
        el('status').textContent = `${studentName(event.actorId)} travaille${event.extra ? ' à nouveau' : ''}.`;
      }
      note(event.actionId === 'RECOVER' ? `${studentName(event.actorId)} se repose.` : event.actionId === 'WORK' ? `${studentName(event.actorId)} travaille${event.extra ? ' à nouveau' : ''}.` : `${studentName(event.actorId)} soutient ${studentName(event.targetId)}.`);
    } else if (event.type === 'CHAPTER_PROGRESS_CHANGED') {
      const chapter = shownStates.get(event.studentId)!.chapters.find(c => c.chapterId === event.chapterId)!;
      chapter.progress = event.progress; chapter.missedRounds = event.missedRounds;
      renderStudents();
    } else if (event.type === 'CONCENTRATION_CHANGED') {
      shownStates.get(event.studentId)!.concentration = event.after; renderStudents();
      if (event.reason !== 'support') feedback(event.studentId, event.reason === 'pressure' ? `−${Math.round((event.before - event.after)*100)/100} HP` : `+${Math.round((event.after-event.before)*100)/100} HP · reprise au prochain tour`);
    } else if (event.type === 'MORALE_CHANGED') {
      shownStates.get(event.studentId)!.morale = event.after; renderStudents();
      note(`${studentName(event.studentId)} : moral ${event.before} → ${event.after}.`);
    } else if (event.type === 'STUDENT_DROPPED_OUT') {
      feedback(event.studentId, 'Décroche'); note(`${studentName(event.studentId)} décroche : concentration épuisée.`);
    } else if (event.type === 'STUDENT_RESUMED') {
      note(`${studentName(event.studentId)} retrouve de la concentration et pourra reprendre.`);
    } else if (event.type === 'CRITICAL_HIT') {
      note(`${studentName(event.studentId)} : critique, aucune riposte !`);
    } else if (event.type === 'LESSON_RETALIATED') {
      el('status').textContent = `La pression de la leçon atteint ${studentName(event.studentId)} : −${event.damage} concentration.`;
      note(`La leçon riposte sur ${studentName(event.studentId)} : −${event.damage} HP.`);
    } else if (event.type === 'UNDERSTANDING_CHANGED') {
      shown.set(event.studentId, event.after); renderStudents();
      feedback(event.studentId, `+${event.amount} compréhension`);
    } else if (event.type === 'EFFECT_APPLIED') {
      feedback(event.targetId, `+${event.amount} concentration`);
      el('status').textContent = `${studentName(event.sourceId)} aide ${studentName(event.targetId)} : +${event.amount} HP de concentration.`;
      note(`${studentName(event.targetId)} : concentration restaurée de ${event.amount} HP.`);
    } else if (event.type === 'EXTRA_ACTION_CREATED') {
      feedback(event.studentId, 'Action bonus prévue');
      note(`${studentName(event.studentId)} obtient une action supplémentaire.`);
    } else if (event.type === 'ROUND_ENDED') {
      shownStates = new Map(event.students.map(s => [s.studentId, structuredClone(s)]));
      shown = new Map(event.students.map(s => [s.studentId, s.lessonUnderstanding])); renderStudents();
      el<HTMLProgressElement>('lesson-progress').value = event.round;
    }
    if (event.type === 'UNDERSTANDING_CHANGED' || event.type === 'EFFECT_APPLIED' || event.type === 'EXTRA_ACTION_CREATED' || event.type === 'CONCENTRATION_CHANGED' && event.reason !== 'support' || event.type === 'STUDENT_DROPPED_OUT') {
      // Conserver le temps de lecture même lorsque les mouvements sont désactivés.
      await new Promise(resolve => setTimeout(resolve, event.type === 'EFFECT_APPLIED' ? 1100 : 650));
    }
  }
  clearActionFeedback();
}
async function advanceLesson() {
  if (busy) return;
  busy = true; syncControls();
  try {
    if (simulation.state === 'TEACHER_INTERVENTION') simulation.skipTeacherIntervention();
    if (simulation.state === 'ROUND_READY') {
      const events = simulation.resolveRound();
      const chapterId = events[0]!.chapterId;
      const index = scenario.lesson.chapters.findIndex(c => c.id === chapterId);
      el('chapter').textContent = scenario.lesson.chapters[index]!.name;
      el('chapter-count').textContent = `CHAPITRE ${index + 1} / 2`;
      el('phase').textContent = 'Les élèves travaillent';
      el('status').textContent = 'Observez leurs progrès et leurs interactions.';
      await showEvents(events);
      simulation.acknowledgeRoundResult();
    }
  } catch (error) { note(error instanceof Error ? error.message : 'La leçon a rencontré une erreur.'); }
  finally { clearActionFeedback(); busy = false; syncControls(); }
}
advance.addEventListener('click', () => { void advanceLesson(); });
restart.addEventListener('submit', event => {
  event.preventDefault(); if (busy || !restart.reportValidity()) return;
  simulation = new Simulation(scenario, Number(seed.value));
  shownStates = new Map(simulation.studentStates.map(s => [s.studentId,s]));
  shown = new Map(scenario.students.map(s => [s.id, 0]));
  log.replaceChildren(); note('Une nouvelle leçon commence.');
  el('chapter').textContent = 'Découvrir'; el('chapter-count').textContent = 'CHAPITRE 1 / 2';
  el<HTMLProgressElement>('lesson-progress').value = 0;
  renderStudents(); syncControls();
});
renderStudents(); syncControls();
const lessonStats = document.createElement('p');
lessonStats.className = 'lesson-stats';
lessonStats.textContent = `Complexité ${scenario.lesson.complexity} · Pression ${scenario.lesson.pressure} · Objectif individuel ${scenario.lesson.requiredProgress}`;
document.querySelector('.board')!.append(lessonStats);

// Interface facultative : les navigateurs ordinaires n'ont pas ce registre.
interface ModelContext {
  registerTool(tool: { name: string; description: string; inputSchema: object;
    annotations: { readOnlyHint: boolean }; execute(input: unknown): unknown },
    options: { signal: AbortSignal }): void | Promise<void>;
}
const context = (document as Document & { modelContext?: ModelContext }).modelContext;
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
        async execute(input: unknown) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Objet vide attendu.');
          if (!readOnly) {
            if (busy || simulation.state === 'LESSON_FINISHED') throw new Error('La leçon ne peut pas avancer maintenant.');
            await advanceLesson();
          }
          return { phase: simulation.state, busy, students: Object.fromEntries(shown) };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Le jeu reste utilisable si le registre facultatif est indisponible. */ }
  }
}
