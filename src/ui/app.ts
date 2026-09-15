import { estimateMastery, erodeLearning } from '../systems/LearningMemory.js';
import type { SessionType } from '../domain.js';
import { Agenda } from '../systems/Agenda.js';
import { AgendaView } from './AgendaView.js';
import { defaultCalendarConfig } from '../data/calendarConfig.js';
import { curriculum } from '../data/curriculum.js';
import { selectLessonActivity } from '../systems/Curriculum.js';
import { lessonProgress } from '../systems/Curriculum.js';
import { getTeachingMode } from '../data/teachingModes.js';
import { ClassroomRenderer, type GraphicsQuality } from '../rendering/ClassroomRenderer.js';
import { getRelation, modifyRelation, personalityLabels, personalityTraits } from '../engine/social.js';
import { summarizeRound } from './roundSummary.js';
import { lessonMastery, masteryRequirement, moraleChances } from '../engine/interactions.js';
import { moraleMultiplier } from '../engine/combat.js';
import { createFullClassPrototype } from '../data/fullClassPrototype.js';
import { createClassroomActionRules } from '../data/rules.js';
import { getClassMetrics } from '../systems/ClassMetrics.js';
import { visualEvents, type SimulationSpeed } from './eventPlayback.js';
import { ClassPreparation, GAME_STATE, type PlanStorage } from '../systems/ClassPreparation.js';
import { ClassroomPreparationView } from './ClassroomPreparationView.js';
import { abilities as abilityCatalog, specializations } from '../data/abilities.js';
import { specializationTrends } from '../engine/progression.js';
import { getRequiredXpForLevel, progressionRules, rewardLabels } from '../data/progressionRules.js';
import { Simulation } from '../engine/simulation.js';
import type { TeacherAction, TeacherActionKind, StudentLessonState } from '../domain.js';
import type { GameEvent } from '../events.js';
import { areAdjacent } from '../engine/reactions.js';
import { createTeacherRules } from '../data/teacherRules.js';
import { createActionRules } from '../data/rules.js';
import { effectiveStats } from '../engine/effects.js';
import { effectiveAbility } from '../engine/abilities.js';

const scenario = createFullClassPrototype();
let storage: PlanStorage | undefined;
try { storage = window.localStorage; } catch { /* Le jeu reste disponible sans stockage. */ }
const preparation = new ClassPreparation(scenario, storage);
const agenda = new Agenda(defaultCalendarConfig, curriculum, storage, `classroom-rpg:${scenario.classroom.id}:agenda:v1`);
const syncLearningTime = (save = true) => {
  erodeLearning(scenario.students, agenda.currentDay);
  scenario.activity = { ...(scenario.activity ?? { lessonId: scenario.lesson.id, teachingMode: 'lecture' }), day: agenda.currentDay };
  if (save) preparation.save();
};
syncLearningTime(false);
let activeSessionId: string | undefined;
let agendaView: AgendaView | undefined;
let gameState: typeof GAME_STATE[keyof typeof GAME_STATE] = GAME_STATE.CLASS_PREPARATION;
let simulation: Simulation;
let renderer: ClassroomRenderer | undefined;
let detailOpen = true;
let preparationView: ClassroomPreparationView | undefined;
let shownRelations = scenario.classRelations!;
let selected = scenario.students[0]!.id;
let shown = new Map(scenario.students.map(s => [s.id, 0]));
let shownStates = new Map<string, StudentLessonState>();
let busy = false;
let completedRounds = 0;
let shownTeacher = { ...scenario.teacher, maxPatience: scenario.teacher.maxPatience ?? scenario.teacher.patience };
const reactionsUsed = new Map<string, number>();
const reactionFeedback = new Map<string, string>();
const statNames = { intelligence: 'Intelligence', discipline: 'Discipline', morale: 'Moral', complexityReduction: 'Réduction de complexité', disruptionReduction: 'Réduction des perturbations' };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const advance = el<HTMLButtonElement>('advance');
const seed = el<HTMLInputElement>('seed');
const speed = el<HTMLSelectElement>('simulation-speed');
const metricsPanel=el('class-metrics');
let totalRounds=scenario.lesson.roundCount;
el<HTMLProgressElement>('lesson-progress').max=totalRounds;
el('class-size').textContent=`LA CLASSE · ${scenario.classroom.rows} × ${scenario.classroom.columns} · ${scenario.students.length} élèves`;
for(const direction of [-1,1]) el(direction<0 ? 'scroll-left' : 'scroll-right').onclick=()=>el('seat-viewport').scrollBy({left:direction*240,behavior:'smooth'});
function renderMetrics() {
  const states=gameState===GAME_STATE.CLASS_PREPARATION ? scenario.students.filter(s=>s.present!==false).map(s=>({studentId:s.id,lessonUnderstanding:lessonProgress(s, scenario.lesson.id).mastery,concentration:s.concentration,morale:s.morale,effects:[],progress:0,missedRounds:0})) : [...shownStates.values()];
  const m=getClassMetrics(scenario.students,states);
  metricsPanel.textContent = `${m.count} présents · Concentration ${m.averageConcentration.toFixed(0)} · Moral ${m.averageMorale.toFixed(0)} · Discipline ${m.averageDiscipline.toFixed(0)} · Consultez les estimations individuelles.`;
}
const restart = el<HTMLFormElement>('restart');
const log = el<HTMLOListElement>('log');
const lessonPanel = document.createElement('section');
lessonPanel.id = 'lesson-results'; lessonPanel.className = 'round-result'; lessonPanel.hidden = true;
lessonPanel.setAttribute('aria-label', 'Bilan de la leçon');
el('round-result').after(lessonPanel);
const studentName = (id: string) => scenario.students.find(s => s.id === id)?.name ?? 'Professeur';

function renderStudents() {
  if (gameState === GAME_STATE.CLASS_PREPARATION || !selected) return;
  renderMetrics();
  const matrixOpen = el('student-detail').querySelector<HTMLDetailsElement>('#relations-debug')?.open ?? false;
  const extendedOpen = el('student-detail').querySelector<HTMLDetailsElement>('.extended-student')?.open ?? false;
  const persistent = simulation.persistentStudents;
  const observations = scenario.students.map(student => ({ id: student.id, ...estimateMastery(persistent.find(s => s.id === student.id) ?? student, scenario.lesson.id, shownTeacher, agenda.currentDay) }));
  renderer?.render(shownStates, new Map(observations.map(e => [e.id, (e.low + e.high) / 2])), detailOpen ? selected : '', new Map(observations.map(e => [e.id, e.label])));
  el('student-detail').hidden = !detailOpen;
  if (!detailOpen) return;
  const student = scenario.students.find(s => s.id === selected)!;
  const role = scenario.archetypes.find(a => a.id === student.archetypeId)!.name;
  const state = shownStates.get(selected)!;
  el('student-detail').innerHTML = `<h2>${student.name}</h2><span class="role ${student.archetypeId}">${role}</span><div class="understanding">${estimateMastery(simulation.persistentStudents.find(s => s.id === selected)!, scenario.lesson.id, shownTeacher, agenda.currentDay).label}</div><p>Observation du professeur</p><dl>${[['Intelligence',student.intelligence],['Discipline',student.discipline],['Concentration (HP)',state.concentration],['Moral',state.morale]].map(([name,value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><h3>Progression de la leçon</h3><p>${estimateMastery(simulation.persistentStudents.find(s => s.id === selected)!, scenario.lesson.id, shownTeacher, agenda.currentDay).feedback}<br><small>${state.missedRounds} round(s) manqué(s)</small></p>`;
  const mastery = lessonMastery(state);
  const morale = moraleMultiplier(effectiveStats(student, state).morale);
  const chances = moraleChances(morale, scenario.interactionRules!);
  const behaviorInfo = document.createElement('p');
  behaviorInfo.textContent = `Moral effectif : ×${morale.toFixed(2)}. Occasion positive : ${Math.round(chances.positive * 10000) / 100} % · risque négatif : ${Math.round(chances.negative * 10000) / 100} %. Deux tirages indépendants.`;
  el('student-detail').append(behaviorInfo);
  if (reactionFeedback.has(selected)) {
    const last = document.createElement('p'); last.textContent = reactionFeedback.get(selected)!;
    el('student-detail').append(last);
  }
  const reactionIds = student.progression?.unlockedAbilities ?? student.reactionIds ?? scenario.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
  const abilities = scenario.reactionAbilities?.filter(ability => reactionIds.includes(ability.id)).map(a => effectiveAbility(student, a)) ?? [];
  if (abilities.length) {
    const info = document.createElement('p');
    info.textContent = `Réactions : ${reactionsUsed.get(selected) ?? 0} / ${createActionRules().maxReactionsPerStudent} utilisée ce round. Un élève décroché ou au repos ne réagit pas.`;
    el('student-detail').append(info);
    for (const ability of abilities) {
      const description = document.createElement('p');
      const timing = ability.window === 'BEFORE_STUDENT_ATTACK' ? 'avant l’attaque' : ability.window === 'DURING_STUDENT_ATTACK' ? 'pendant l’attaque' : 'après une progression réussie';
      switch (ability.effect) {
        case 'REDUCE_PRESSURE': description.textContent = `Protège un voisin contre la riposte · relation ≥ ${ability.minRelation}/100.`; break;
        case 'REDUCE_COMPLEXITY': description.textContent = `Affaiblit la complexité pour l’attaque d’un voisin · relation ≥ ${ability.minRelation}/100.`; break;
        case 'COMBINED_ATTACK': description.textContent = `Attaque combinée avec un voisin · relation ≥ ${ability.minRelation}/100. Remplace l’affaiblissement simple ; le camarade reçoit la progression.`; break;
        case 'APPLY_TEMPORARY_EFFECT': description.textContent = `${statNames[ability.stat]} + : ${timing}, pendant ${ability.durationInRounds} rounds (round actuel inclus) · relation ≥ ${ability.minRelation}/100.`; break;
      }
      const requirement = masteryRequirement(ability, scenario.interactionRules!);
      description.textContent += requirement.minimum > 0
        ? ` Maîtrise requise : ${requirement.minimum} %${ability.effect === 'COMBINED_ATTACK' ? ' chez les deux élèves' : ''}.`
        : ' Accessible sans maîtrise minimale.';
      el('student-detail').append(description);
    }
  }
  if (state.effects.length) {
    const heading = document.createElement('h3'); heading.textContent = 'Bonus actifs';
    el('student-detail').append(heading);
    const effective = effectiveStats(student, state);
    for (const effect of state.effects) {
      const info = document.createElement('p');
      info.textContent = `${statNames[effect.stat]} +${effect.value} · ${studentName(effect.sourceId)} · ${effect.remainingRounds} round(s) restant(s). Valeur effective : ${effect.stat === 'complexityReduction' ? Math.max(0, scenario.lesson.complexity - effect.value) + ' de complexité' : effect.stat === 'disruptionReduction' ? effect.value + ' % de réduction' : effective[effect.stat] + ' / 100'}.`;
      el('student-detail').append(info);
    }
  }
  const traits = document.createElement('p');
  traits.textContent = 'Personnalité : ' + personalityTraits.map(key => personalityLabels[key] + ' ' + (student.personality?.[key] ?? 0).toFixed(1)).join(' · ');
  el('student-detail').append(traits);
  const relations = document.createElement('p');
  relations.textContent = 'Relations avec les voisins : ' + scenario.students
    .filter(other => areAdjacent(student, other, scenario.classroom))
    .map(other => `${other.name} ${getRelation(shownRelations, student.id, other.id)}/100`).join(' · ');
  el('student-detail').append(relations);
  if (matrixOpen) {
  const matrix = document.createElement('details'); matrix.id = 'relations-debug'; matrix.open = true;
  const summary = document.createElement('summary'); summary.textContent = 'Relations orientées · matrice de debug'; matrix.append(summary);
  const scroll = document.createElement('div'); scroll.style.overflowX = 'auto';
  const table = document.createElement('table');
  table.innerHTML = '<caption>Ligne → colonne · −100 à +100</caption><thead><tr><th scope="col">Élève</th>' + scenario.students.map(s => '<th scope="col">' + s.name + '</th>').join('') + '</tr></thead><tbody>' + scenario.students.map(a => '<tr><th scope="row">' + a.name + '</th>' + scenario.students.map(b => '<td>' + (a.id === b.id ? '—' : getRelation(shownRelations, a.id, b.id)) + '</td>').join('') + '</tr>').join('') + '</tbody>';
  scroll.append(table); matrix.append(scroll); el('student-detail').append(matrix);
  } else {
    const matrix=document.createElement('details'); matrix.id = 'relations-debug';
    const summary=document.createElement('summary');summary.textContent='Relations orientées · matrice de debug';matrix.append(summary);
    matrix.addEventListener('toggle',()=>{if(matrix.open) renderStudents();},{once:true});el('student-detail').append(matrix);
  }
  const p = student.progression;
  if (p) {
    const section = document.createElement('section');
    const heading = document.createElement('h3'); heading.textContent = 'Progression RPG'; section.append(heading);
    const info = document.createElement('p');
    info.textContent = `Niveau ${p.level} · ${p.xp} XP${p.level < progressionRules.thresholds.length ? ' / ' + getRequiredXpForLevel(p.level + 1) : ' · niveau maximum'}${p.specialization ? ' · ' + specializations.find(s => s.id === p.specialization)!.name : ''}`;
    section.append(info);
    for (const a of abilityCatalog.filter(a => a.archetype === student.archetypeId)) {
      const row = document.createElement('p');
      row.textContent = `${p.unlockedAbilities.includes(a.id) ? '✓' : '🔒'} ${a.name} · niveau ${a.requiredLevel} · ${a.perRound}/round, ${a.perLesson}/leçon`;
      section.append(row);
    }
    const trends = specializationTrends(student);
    const trend = document.createElement('p'); trend.textContent = 'Tendance : ' + trends.map(t => `${t.name} ${t.percent} %`).join(' · '); section.append(trend);
    if (p.level >= progressionRules.specializationLevel && !p.specialization && simulation.state === 'LESSON_FINISHED') {
      for (const branch of trends) {
        const definition = specializations.find(s => s.id === branch.id)!;
        const description = document.createElement('p');
        description.textContent = `${branch.name} : ${definition.usage.map(k => rewardLabels[k]).join(', ')} · puissance ×${definition.power}${definition.duration ? ', durée +' + definition.duration + ' round' : ''}. Les conditions de maîtrise et de relation restent applicables.`;
        section.append(description);
        const button = document.createElement('button'); button.type = 'button'; button.textContent = `Choisir ${branch.name}`;
        button.disabled = busy;
        button.addEventListener('click', () => {
          simulation.chooseSpecialization(student.id, branch.id);
          scenario.students = simulation.getResult().nextLessonStudents;
          preparation.save();
          note(`${student.name} choisit ${branch.name}.`); renderStudents();
        }); section.append(button);
      }
    }
    el('student-detail').append(section);
  }
  const detail = el('student-detail');
  const extended = document.createElement('details'); extended.className = 'extended-student'; extended.open = extendedOpen;
  const summary = document.createElement('summary'); summary.textContent = 'Acquis, compétences et détails du combat'; extended.append(summary);
  const stats = detail.querySelector('dl')!;
  while (stats.nextSibling) extended.append(stats.nextSibling);
  const compact = document.createElement('p');
  compact.textContent = 'Personnalité : ' + personalityTraits.filter(key => (student.personality?.[key] ?? 0) >= 0.5).map(key => personalityLabels[key]).join(' · ');
  const links = document.createElement('p');
  links.textContent = 'Relations principales : ' + scenario.students.filter(other => other.id !== selected)
    .map(other => ({name: other.name, score: getRelation(shownRelations, selected, other.id)}))
    .filter(other => other.score !== 0).sort((a,b) => Math.abs(b.score) - Math.abs(a.score)).slice(0,3)
    .map(other => `${other.name} ${other.score > 0 ? '+' : ''}${other.score}`).join(' · ');
  const effects = document.createElement('p');
  effects.textContent = state.effects.length ? state.effects.map(effect => `${statNames[effect.stat]} +${effect.value} (${effect.remainingRounds} r.)`).join(' · ') : 'Aucun bonus ou malus temporaire actif.';
  detail.append(compact, links, effects, extended);
  const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Fermer la fiche';
  close.onclick = () => { detailOpen = false; renderStudents(); }; detail.prepend(close);
}
function buildLessonSeats() {
  renderer?.destroy();
  renderer = new ClassroomRenderer(el('seats'), scenario.students, simulation.layoutSnapshot, id => {
    detailOpen = selected !== id || !detailOpen; selected = id; renderStudents(); renderTeacher();
  });
  renderer.setQuality(el<HTMLSelectElement>('graphics-quality').value as GraphicsQuality);
  renderer.setZoom(Number(el<HTMLSelectElement>('scene-zoom').value));
}
el<HTMLSelectElement>('scene-zoom').addEventListener('change', event => {
  renderer?.setZoom(Number((event.target as HTMLSelectElement).value));
});
el<HTMLSelectElement>('graphics-quality').addEventListener('change', event => {
  renderer?.setQuality((event.target as HTMLSelectElement).value as GraphicsQuality);
});
document.addEventListener('click', event => {
  if (!renderer || (event.target as HTMLElement).closest('.student-desk, #student-detail, #teacher-controls, .summary-student')) return;
  detailOpen = false; renderStudents();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && renderer) { detailOpen = false; renderStudents(); }
});

function note(text: string) {
  const item = document.createElement('li'); item.textContent = text; log.prepend(item);
  while (log.children.length > 12) log.lastElementChild!.remove();
}
const actionSelect = el<HTMLSelectElement>('teacher-action');
const targetSelect = el<HTMLSelectElement>('teacher-target');
for (const student of scenario.students) {
  const option = document.createElement('option'); option.value = student.id;
  option.textContent = student.name + (student.disruptionChance ? ' · peut perturber' : '');
  targetSelect.append(option);
}
function renderTeacher() {
  if (gameState === GAME_STATE.CLASS_PREPARATION) { el('teacher-controls').hidden = true; return; }
  el('teacher-stats').textContent = `Pédagogie ${shownTeacher.pedagogy} · Autorité ${shownTeacher.authority}`;
  el('teacher-patience-label').textContent = `Patience ${shownTeacher.patience} / ${shownTeacher.maxPatience}`;
  el<HTMLProgressElement>('teacher-patience').max = shownTeacher.maxPatience || 1;
  el<HTMLProgressElement>('teacher-patience').value = shownTeacher.patience;
  el('teacher-controls').hidden = simulation.state !== 'TEACHER_INTERVENTION';
  if (!simulation.hasNextRound) actionSelect.value = 'PASS';
  targetSelect.value = selected;
  const previews = simulation.teacherActions(selected);
  for (const option of actionSelect.options) {
    const preview = previews.find(p => p.kind === option.value)!;
    option.textContent = `${preview.label} · ${preview.cost} patience`;
  }
  const preview = previews.find(p => p.kind === actionSelect.value)!;
  actionSelect.disabled = busy || !simulation.hasNextRound;
  targetSelect.disabled = busy || preview.target !== 'ONE_STUDENT';
  el<HTMLButtonElement>('teacher-confirm').disabled = busy || !preview.available;
  el('teacher-confirm').textContent = simulation.hasNextRound ? 'Confirmer l’intervention' : 'Terminer la leçon';
  el('intervention-title').textContent = simulation.hasNextRound ? 'À vous d’intervenir' : 'Clôturer la leçon';
  el('teacher-description').textContent = `${preview.description} Puissance : ${preview.power}${preview.kind === 'REFRAME' ? ' %' : ''}.${preview.duration ? ` Durée : ${preview.duration} prochains rounds.` : ''}`;
  el('teacher-feedback').textContent = preview.reason;
}
actionSelect.addEventListener('change', renderTeacher);
targetSelect.addEventListener('change', () => { selected = targetSelect.value; renderStudents(); renderTeacher(); });
function syncControls() {
  renderMetrics(); speed.disabled=busy;
  if (gameState === GAME_STATE.CLASS_PREPARATION) {
    advance.disabled = preparation.system.validateLayout(scenario.students).length > 0;
    advance.textContent = 'Lancer la séance planifiée';
    seed.disabled = false; restart.querySelector('button')!.disabled = false;
    restart.querySelector('button')!.textContent = 'Préparation de classe';
    el('phase').textContent = 'Préparation de classe';
    el('status').textContent = 'Organisez les places, puis lancez la leçon avec cette disposition.';
    el('teacher-sheet').hidden = true; el('teacher-controls').hidden = true;
    return;
  }
  el('teacher-sheet').hidden = false;
  advance.disabled = busy || simulation.state !== 'ROUND_READY';
  seed.disabled = busy;
  restart.querySelector('button')!.disabled = busy;
  renderTeacher();
  if (busy) { advance.textContent = 'Résolution en cours…'; return; }
  if (simulation.state === 'TEACHER_INTERVENTION') {
    el('phase').textContent = 'À vous, professeur';
    el('status').textContent = 'Consultez le bilan, puis confirmez votre intervention ou passez.';
    advance.textContent = 'Choisissez une intervention';
  } else if (simulation.state === 'LESSON_FINISHED') {
    gameState = GAME_STATE.LESSON_RESULT;
    if (activeSessionId) {
      const result = simulation.getResult();
      scenario.students = result.nextLessonStudents;
      if (result.classRelations) scenario.classRelations = result.classRelations;
      scenario.teacher = result.teacher;
      preparation.save();
      agenda.consume(activeSessionId); activeSessionId = undefined; syncLearningTime(); agendaView?.render();
    }
    el('debug-stats').textContent=JSON.stringify(simulation.debugMetrics,null,2);
    restart.querySelector('button')!.textContent = 'Préparer la prochaine leçon';
    el('phase').textContent = 'Leçon terminée'; el('status').textContent = 'Chaque élève a son résultat. Sélectionnez un pupitre pour le consulter.';
    advance.textContent = 'Leçon terminée';
  } else {
    el('phase').textContent = 'La classe est prête';
    el('status').textContent = completedRounds ? 'Intervention confirmée. Vous pouvez lancer le round suivant.' : 'Les élèves sont installés.';
    advance.textContent = completedRounds ? 'Lancer le round suivant →' : 'Commencer la leçon →';
  }
}
function renderRoundResult(before: StudentLessonState[], events: GameEvent[]) {
  const delta = (value: number) => `${value > 0 ? '+' : ''}${Math.round(value * 100) / 100}`;
  const states = simulation.studentStates;
  const summary = summarizeRound(before, states, events, scenario.lesson);
  const selectStudent = (id: string) => { selected = id; detailOpen = true; renderStudents(); renderTeacher(); };
  const nameButton = (id: string) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = studentName(id);
    button.className = 'summary-student'; button.setAttribute('aria-label', `Sélectionner ${studentName(id)} pour l’intervention`);
    button.addEventListener('click', () => selectStudent(id)); return button;
  };
  el('round-attention').replaceChildren();
  const concerns = summary.filter(row => row.alerts.length);
  for (const row of concerns) {
    const item = document.createElement('p'); item.append(nameButton(row.studentId), ` : ${row.alerts.join(' · ')}.`);
    el('round-attention').append(item);
  }
  if (!concerns.length) el('round-attention').textContent = 'Aucun point d’attention selon les seuils du bilan.';
  const best = Math.max(...summary.map(row => row.progress));
  if (best > 0) {
    const item = document.createElement('p');
    item.textContent = `Plus forte progression : ${summary.filter(row => row.progress === best).map(row => studentName(row.studentId)).join(', ')}.`;
    el('round-attention').append(item);
  }
  el('round-rows').replaceChildren();
  for (const state of states) {
    const entry = summary.find(row => row.studentId === state.studentId)!;
    const previous = before.find(s => s.studentId === state.studentId)!;
    const row = document.createElement('tr');
    const nameCell = document.createElement('td'); nameCell.append(nameButton(state.studentId)); row.append(nameCell);
    const received = entry.received;
    const interactions = [received.support ? `${received.support} aide(s)` : '', received.protection ? `${received.protection} protection(s)` : '',
      received.combo ? `${received.combo} combo(s)` : '', received.disruptionDamage ? `Perturbations : −${received.disruptionDamage} concentration` : ''].filter(Boolean).join(' · ') || 'Aucune';
    for (const value of [ estimateMastery(simulation.persistentStudents.find(s => s.id === state.studentId)!, scenario.lesson.id, shownTeacher, agenda.currentDay).label, `${state.concentration} (${delta(state.concentration - previous.concentration)})`, `${state.morale} (${delta(state.morale - previous.morale)})`, entry.alerts.join(' · ') || (entry.completed ? 'Travail terminé' : 'En apprentissage'), interactions]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    el('round-rows').append(row);
  }
  el('round-highlights').textContent = `Round ${completedRounds} · ${events.filter(e => e.type === 'EFFECT_APPLIED' && e.amount > 0).length} aides · ${events.filter(e => e.type === 'REACTION_TRIGGERED' && e.effect === 'REDUCE_PRESSURE').length} protections · ${events.filter(e => e.type === 'REACTION_TRIGGERED' && e.effect !== 'REDUCE_PRESSURE').length} soutiens réactifs · ${events.filter(e => e.type === 'DISRUPTION_RESOLVED').length} perturbations · ${events.filter(e => e.type === 'COMBINED_ATTACK_RESOLVED').length} combos`;
  el('round-result').hidden = false;
}
el<HTMLFormElement>('teacher-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (gameState === GAME_STATE.CLASS_PREPARATION || busy || simulation.state !== 'TEACHER_INTERVENTION') return;
  const kind = actionSelect.value as TeacherActionKind;
  const action: TeacherAction = kind === 'PASS' || kind === 'BREAK' ? { kind } : { kind, targetId: selected };
  busy = true; syncControls();
  try { await showEvents(simulation.applyTeacherAction(action)); }
  catch (error) { note(error instanceof Error ? error.message : 'Intervention impossible.'); }
  finally { busy = false; syncControls(); renderStudents(); }
});
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
  const playback: SimulationSpeed = simulation.individual && speed.value !== 'instant' ? 'compact' : speed.value as SimulationSpeed;
  if (playback === 'instant') renderer?.reset();
  for (const event of visualEvents(events,playback)) {
    if (playback !== 'instant') renderer?.handleEvent(event);
    if (event.type === 'LESSON_RESULTS') {
      scenario.students = simulation.persistentStudents;
      el('round-result').hidden = true;
      const panel = lessonPanel; panel.replaceChildren(); panel.hidden = false;
      restart.querySelector('button')!.textContent = 'Leçon suivante';
      const title = document.createElement('h2'); title.textContent = 'Bilan de la leçon'; panel.append(title);
      for (const result of event.results) {
        const p = result.progression; if (!p) continue;
        const row = document.createElement('p');
        row.textContent = `${studentName(result.studentId)} · ${estimateMastery(simulation.persistentStudents.find(s => s.id === result.studentId)!, scenario.lesson.id, shownTeacher, agenda.currentDay).label} · +${p.xpGained} XP · niveau ${p.beforeLevel} → ${p.afterLevel} · total ${p.xp} XP`;
        const details = document.createElement('small'); details.textContent = Object.entries(p.rewards).map(([k,v]) => `${rewardLabels[k as keyof typeof rewardLabels]} +${v}`).join(' · ');
        row.append(document.createElement('br'), details);
        if (p.unlockedAbilities.length) row.append(document.createElement('br'), 'Compétences apprises : ' + p.unlockedAbilities.map(id => abilityCatalog.find(a => a.id === id)!.name).join(', '));
        const discoveries = events.filter(e => e.type === 'concept_discovered' && e.studentId === result.studentId);
        for (const discovery of discoveries) if (discovery.type === 'concept_discovered') row.append(document.createElement('br'), 'Concept découvert : ' + (scenario.concepts.find(c => c.id === discovery.conceptId)?.name ?? discovery.conceptId));
        panel.append(row);
      }
      renderStudents();
    } else if (event.type === 'LEARNING_OBSERVED') {
      note(`${studentName(event.studentId)} · ${event.label} · ${event.feedback}`);
    } else if (event.type === 'concept_reactivated') {
      note(`${studentName(event.studentId)} réactive ${scenario.concepts.find(c => c.id === event.conceptId)?.name ?? event.conceptId}.`);
    } else if (event.type === 'XP_GAINED') {
      note(`${studentName(event.studentId)} gagne ${event.amount} XP.`);
    } else if (event.type === 'STUDENT_LEVEL_UP') {
      note(`${studentName(event.studentId)} : niveau ${event.oldLevel} → ${event.newLevel}.`);
    } else if (event.type === 'ABILITY_UNLOCKED') {
      note(`${studentName(event.studentId)} apprend ${abilityCatalog.find(a => a.id === event.abilityId)?.name ?? event.abilityId}.`);
    } else if (event.type === 'SPECIALIZATION_AVAILABLE') {
      note(`${studentName(event.studentId)} peut choisir sa spécialisation dans sa fiche.`);
    } else if (event.type === 'ROUND_STARTED') {
      reactionFeedback.clear(); reactionsUsed.clear(); renderStudents();
    } else if (event.type === 'REACTION_EVALUATED' && event.reason !== 'eligible') {
      const reason = event.reason === 'mastery' ? 'acquis insuffisants pour cette réaction'
        : event.reason === 'locked' ? 'compétence verrouillée' : event.reason === 'abilityLimit' ? 'limite d’utilisation atteinte' : event.reason === 'relation' ? 'relation insuffisante' : event.reason === 'noEffect' ? 'aucun effet utile dans cette situation' : 'aucune occasion positive au tirage de moral';
      reactionFeedback.set(event.sourceId, `Dernière occasion avec ${studentName(event.targetId)} : ${reason}.`);
      renderStudents();
    } else if (event.type === 'BEHAVIOR_APPLIED') {
      note(`${studentName(event.studentId)} est distrait : efficacité réduite à ${Math.round(event.multiplier * 100)} % pour cette action.`);
    } else if (event.type === 'TEACHER_PATIENCE_CHANGED') {
      shownTeacher.patience = event.after; renderTeacher();
    } else if (event.type === 'TEACHER_ACTION_APPLIED') {
      note(`Professeur : ${createTeacherRules().actions[event.action].label}${event.action === 'PASS' ? '' : ` · ${event.targetIds.map(studentName).join(', ')} · puissance ${event.power}`}.`);
    } else if (event.type === 'RELATION_CHANGED') {
      modifyRelation(shownRelations, event.from, event.to, event.after - getRelation(shownRelations, event.from, event.to));
      note('Relation ' + studentName(event.from) + ' → ' + studentName(event.to) + ' : ' + event.before + ' → ' + event.after); renderStudents();
    } else if (event.type === 'DISRUPTION_RESOLVED') {
      note(`${studentName(event.sourceId)} perturbe ${studentName(event.targetId)} : −${event.damage} concentration après autorité.`);
    } else if (event.type === 'TEMPORARY_EFFECT_APPLIED') {
      const state = shownStates.get(event.effect.targetId)!;
      state.effects = state.effects.filter(effect => effect.id !== event.effect.id);
      state.effects.push(structuredClone(event.effect)); renderStudents();
      if (event.refreshed) note(`${studentName(event.effect.targetId)} : bonus de ${statNames[event.effect.stat].toLowerCase()} renouvelé pour ${event.effect.remainingRounds} rounds, round actuel inclus.`);
    } else if (event.type === 'TEMPORARY_EFFECT_DECREMENTED') {
      const effect = shownStates.get(event.effect.targetId)!.effects.find(effect => effect.id === event.effect.id);
      if (effect) effect.remainingRounds = event.effect.remainingRounds;
      renderStudents();
    } else if (event.type === 'TEMPORARY_EFFECT_EXPIRED') {
      const state = shownStates.get(event.effect.targetId)!;
      state.effects = state.effects.filter(effect => effect.id !== event.effect.id);
      note(`${studentName(event.effect.targetId)} : bonus de ${statNames[event.effect.stat].toLowerCase()} expiré.`);
      renderStudents();
    } else if (event.type === 'REACTION_TRIGGERED') {
      reactionFeedback.set(event.sourceId, `Dernière réaction : aide apportée à ${studentName(event.targetId)}.`);
      reactionsUsed.set(event.sourceId, (reactionsUsed.get(event.sourceId) ?? 0) + 1);
      el(event.sourceId).classList.add('receiving');
      const ability = scenario.reactionAbilities?.find(ability => ability.id === event.abilityId);
      const label = ability?.effect === 'APPLY_TEMPORARY_EFFECT' ? statNames[ability.stat] : event.effect === 'REDUCE_COMPLEXITY' ? 'Complexité' : 'Pression';
      const verb = event.effect === 'REDUCE_PRESSURE' ? 'protège' : 'soutient';
      feedback(event.sourceId, `${verb} ${studentName(event.targetId)}`);
      feedback(event.targetId, `${label} ${event.before} → ${event.after}`);
      el('status').textContent = `${studentName(event.sourceId)} ${verb} ${studentName(event.targetId)} : ${label.toLowerCase()} ${event.before} → ${event.after}.`;
      if (event.effect === 'REDUCE_COMPLEXITY') el('status').textContent = `${studentName(event.sourceId)} affaiblit la leçon pour ${studentName(event.targetId)} : complexité ${event.before} → ${event.after}, pour cette attaque.`;
      note(el('status').textContent!);
      renderStudents();
    } else if (event.type === 'COMBINED_ATTACK_STARTED') {
      reactionFeedback.set(event.sourceId, `Dernière réaction : combo avec ${studentName(event.targetId)}.`);
      reactionsUsed.set(event.sourceId, (reactionsUsed.get(event.sourceId) ?? 0) + 1);
      el(event.sourceId).classList.add('receiving');
      feedback(event.sourceId, `Combo avec ${studentName(event.targetId)}`);
      feedback(event.targetId, 'Attaque combinée');
      el('status').textContent = `${studentName(event.targetId)} et ${studentName(event.sourceId)} attaquent ensemble !`;
      note(el('status').textContent!); renderStudents();
    } else if (event.type === 'COMBINED_ATTACK_RESOLVED') {
      feedback(event.targetId, 'Combo : avancée observée');
      note(`${studentName(event.targetId)} avance grâce au travail combiné avec ${studentName(event.sourceId)}.`);
    } else if (event.type === 'STUDENT_ACTION') {
      clearActionFeedback();
      el(event.actorId).classList.add('active');
      if (event.actionId === 'DISRUPT') {
        feedback(event.actorId, 'Perturbe un voisin');
        el('status').textContent = `${studentName(event.actorId)} perturbe la classe.`;
      } else if (event.actionId === 'SUPPORT') {
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
      note(event.actionId === 'DISRUPT' ? `${studentName(event.actorId)} perturbe un voisin.` : event.actionId === 'RECOVER' ? `${studentName(event.actorId)} se repose.` : event.actionId === 'WORK' ? `${studentName(event.actorId)} travaille${event.extra ? ' à nouveau' : ''}.` : `${studentName(event.actorId)} soutient ${studentName(event.targetId)}.`);
    } else if (event.type === 'LESSON_PROGRESS_CHANGED') {
      const state = shownStates.get(event.studentId)!;
      state.progress = event.progress; state.missedRounds = event.missedRounds;
      renderStudents();
    } else if (event.type === 'CONCENTRATION_CHANGED') {
      shownStates.get(event.studentId)!.concentration = event.after; renderStudents();
      if (event.reason === 'effort') note(`${studentName(event.studentId)} : effort de travail, −${Math.round((event.before - event.after) * 100) / 100} concentration.`);
      if (event.reason !== 'support') feedback(event.studentId, event.after < event.before ? `−${Math.round((event.before - event.after)*100)/100} HP` : `+${Math.round((event.after-event.before)*100)/100} HP · reprise au prochain tour`);
    } else if (event.type === 'MORALE_CHANGED') {
      shownStates.get(event.studentId)!.morale = event.after; renderStudents();
      note(`${studentName(event.studentId)} : moral ${event.before} → ${event.after}${event.reason ? ` · ${{ success: 'réussite', retaliation: 'riposte', dropout: 'décrochage' }[event.reason]}` : ''}.`);
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
      feedback(event.studentId, event.amount > 0 ? 'Avancée observée' : 'Hésitation');
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
    if (playback === 'compact' && !['ROUND_ENDED','LEARNING_OBSERVED','concept_reactivated'].includes(event.type)) await new Promise(resolve => setTimeout(resolve, 700));
    if (playback === 'detailed' && (event.type === 'COMBINED_ATTACK_STARTED' || event.type === 'COMBINED_ATTACK_RESOLVED' || event.type === 'REACTION_TRIGGERED' || event.type === 'UNDERSTANDING_CHANGED' || event.type === 'EFFECT_APPLIED' || event.type === 'EXTRA_ACTION_CREATED' || event.type === 'CONCENTRATION_CHANGED' && event.reason !== 'support' || event.type === 'STUDENT_DROPPED_OUT')) {
      // Conserver le temps de lecture même lorsque les mouvements sont désactivés.
      await new Promise(resolve => setTimeout(resolve, event.type === 'COMBINED_ATTACK_STARTED' || event.type === 'REACTION_TRIGGERED' || event.type === 'EFFECT_APPLIED' ? 1100 : 650));
    }
  }
  shownStates=new Map(simulation.studentStates.map(s=>[s.studentId,s]));
  shown=new Map([...shownStates.values()].map(s=>[s.studentId,s.lessonUnderstanding]));
  shownRelations=simulation.classRelations!; shownTeacher=simulation.teacherState;
  renderStudents();
  if(playback==='instant') console.info('Simulation instantanée',simulation.debugMetrics);
  clearActionFeedback();
}
async function advanceLesson() {
  if (gameState === GAME_STATE.CLASS_PREPARATION || busy || simulation.state !== 'ROUND_READY') return;
  busy = true; syncControls();
  try {
    if (simulation.state === 'ROUND_READY') {
      const before = simulation.studentStates;
      const events = simulation.resolveRound();
      el('lesson-name').textContent = scenario.lesson.name;
      el('lesson-round').textContent = `ROUND ${completedRounds + 1} / ${totalRounds}`;
      el('phase').textContent = 'Les élèves travaillent';
      el('status').textContent = 'Observez leurs progrès et leurs interactions.';
      await showEvents(events);
      completedRounds++; renderRoundResult(before, events);
      simulation.acknowledgeRoundResult();
    }
  } catch (error) { note(error instanceof Error ? error.message : 'La leçon a rencontré une erreur.'); }
  finally { clearActionFeedback(); busy = false; syncControls(); }
}
advance.addEventListener('click', () => { if (gameState === GAME_STATE.CLASS_PREPARATION) startLesson(); else void advanceLesson(); });
function startLesson() {
  if (!restart.reportValidity()) return;
  try {
    const session = agenda.nextSession();
    const selectedScenario = selectLessonActivity(scenario, curriculum, { lessonId: session.lessonId, teachingMode: session.type, sessionType: session.type as SessionType, ...(session.difficulty === undefined ? {} : { difficulty: session.difficulty }), day: agenda.currentDay });
    const nextSimulation = new Simulation({ ...preparation.prepareLesson(), program: selectedScenario.program!, subject: selectedScenario.subject, topic: selectedScenario.topic, lesson: selectedScenario.lesson, activity: selectedScenario.activity! }, Number(seed.value), createClassroomActionRules(scenario.students.filter(s=>s.present!==false).length));
    Object.assign(scenario, { program: selectedScenario.program, subject: selectedScenario.subject, topic: selectedScenario.topic, lesson: selectedScenario.lesson, activity: selectedScenario.activity });
    simulation = nextSimulation; activeSessionId = session.id;
    totalRounds = simulation.roundCount;
    el<HTMLProgressElement>('lesson-progress').max = totalRounds;
    curriculumPath.textContent = `${scenario.program?.name ?? ''} / ${scenario.subject.name} / ${scenario.topic.name} / ${scenario.lesson.name}`;
    lessonStats.textContent = `Complexité ${scenario.lesson.complexity} · Pression ${scenario.lesson.pressure} · Objectif individuel ${scenario.lesson.requiredProgress}`;
    modeSelect.replaceChildren();
    const option = document.createElement('option'); option.value = session.type; option.textContent = getTeachingMode(session.type).name; modeSelect.append(option);
  }
  catch (error) { el('status').textContent = (error as Error).message; return; }
  preparationView?.destroy(); preparationView = undefined;
  gameState = GAME_STATE.LESSON; agendaView?.render();
  modeSelect.disabled = true;
  lessonPanel.hidden = true; el('round-result').hidden = true;
  shownRelations = simulation.classRelations!;
  reactionsUsed.clear(); reactionFeedback.clear();
  completedRounds = 0; shownTeacher = simulation.teacherState; actionSelect.value = 'ENCOURAGE';
  shownStates = new Map(simulation.studentStates.map(s => [s.studentId,s]));
  shown = new Map(simulation.studentStates.map(s => [s.studentId,0]));
  selected = simulation.studentStates[0]?.studentId ?? '';
  log.replaceChildren(); note('La leçon commence avec le placement choisi.');
  el('lesson-name').textContent = scenario.lesson.name;
  el('lesson-round').textContent = `ROUND 1 / ${totalRounds}`;
  el<HTMLProgressElement>('lesson-progress').value = 0;
  detailOpen = true; buildLessonSeats();
  targetSelect.replaceChildren();
  for (const student of scenario.students.filter(s => shownStates.has(s.id))) {
    const option = document.createElement('option'); option.value = student.id; option.textContent = student.name; targetSelect.append(option);
  }
  if (selected) renderStudents(); syncControls();
  if (simulation.individual) void runIndividualSession();
}
async function runIndividualSession() {
  busy = true; syncControls();
  try {
    while (simulation.state !== 'LESSON_FINISHED') {
      const before = simulation.studentStates;
      await showEvents(simulation.resolveRound()); completedRounds++;
      renderRoundResult(before, simulation.events);
      simulation.acknowledgeRoundResult();
      await showEvents(simulation.applyTeacherAction({ kind: 'PASS' }));
    }
  } finally { busy = false; syncControls(); renderStudents(); }
}
function enterPreparation() {
  modeSelect.disabled = true;
  renderer?.destroy(); renderer = undefined; detailOpen = true; el('student-detail').hidden = false;
  gameState = GAME_STATE.CLASS_PREPARATION; activeSessionId = undefined; agendaView?.render();
  preparationView?.destroy();
  lessonPanel.hidden = true; el('round-result').hidden = true;
  preparationView = new ClassroomPreparationView(preparation, el('seats'), el('student-detail'));
  el('lesson-round').textContent = 'AVANT LA LEÇON';
  el<HTMLProgressElement>('lesson-progress').value = 0;
  syncControls();
}
restart.addEventListener('submit', event => {
  event.preventDefault(); if (busy || !restart.reportValidity()) return;
  enterPreparation();
});
const modeSelect = document.createElement('select');
modeSelect.setAttribute('aria-label', 'Mode pédagogique');
for (const id of scenario.lesson.availableTeachingModes ?? ['lecture']) {
  const mode = getTeachingMode(id), option = document.createElement('option');
  option.value = id; option.disabled = false;
  option.textContent = mode.name + (option.disabled ? ' (différé, à venir)' : ''); modeSelect.append(option);
}
const curriculumPath = document.createElement('p'); curriculumPath.className = 'lesson-stats';
curriculumPath.textContent = `${scenario.program?.name ?? ''} / ${scenario.subject.name} / ${scenario.topic.name} / ${scenario.lesson.name}`;
document.querySelector('.board')!.prepend(curriculumPath, modeSelect);
enterPreparation();
const lessonStats = document.createElement('p');
lessonStats.className = 'lesson-stats';
lessonStats.textContent = `Complexité ${scenario.lesson.complexity} · Pression ${scenario.lesson.pressure} · Objectif individuel ${scenario.lesson.requiredProgress}`;
document.querySelector('.board')!.append(lessonStats);
const agendaRoot = document.createElement('section'); agendaRoot.id = 'agenda';
document.querySelector('main')!.prepend(agendaRoot);
agendaView = new AgendaView(agendaRoot, agenda, () => scenario.students, () => gameState === GAME_STATE.LESSON, () => scenario.teacher.pedagogy, () => { syncLearningTime(); enterPreparation(); });

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
        description: readOnly ? 'Lire la phase et la compréhension affichée des élèves.' : 'Lancer un round lorsque la classe est prête, et attendre son affichage. Les interventions se choisissent dans le formulaire.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: readOnly },
        async execute(input: unknown) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Objet vide attendu.');
          if (!readOnly) {
            if (gameState === GAME_STATE.CLASS_PREPARATION || busy || simulation.state !== 'ROUND_READY') throw new Error('La leçon ne peut pas avancer maintenant.');
            await advanceLesson();
          }
          return { phase: gameState === GAME_STATE.CLASS_PREPARATION ? gameState : simulation.state, busy, students: Object.fromEntries(scenario.students.map(s => [s.id, estimateMastery(s, scenario.lesson.id, shownTeacher, agenda.currentDay)])) };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Le jeu reste utilisable si le registre facultatif est indisponible. */ }
  }
}
