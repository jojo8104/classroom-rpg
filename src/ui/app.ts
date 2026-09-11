import { chapterMastery, masteryRequirement, moraleChances } from '../engine/interactions.js';
import { moraleMultiplier } from '../engine/combat.js';
import { createPrototype } from '../data/prototype.js';
import { Simulation } from '../engine/simulation.js';
import type { TeacherAction, TeacherActionKind, StudentLessonState } from '../domain.js';
import type { GameEvent } from '../events.js';
import { areAdjacent, relationBetween } from '../engine/reactions.js';
import { createTeacherRules } from '../data/teacherRules.js';
import { createActionRules } from '../data/rules.js';
import { effectiveStats } from '../engine/effects.js';

const scenario = createPrototype();
let simulation = new Simulation(scenario, 12345);
let selected = scenario.students[0]!.id;
let shown = new Map(scenario.students.map(s => [s.id, 0]));
let shownStates = new Map(simulation.studentStates.map(s => [s.studentId, s]));
let busy = false;
let completedRounds = 0;
let shownTeacher = simulation.teacherState;
const reactionsUsed = new Map<string, number>();
let activeChapterId = scenario.lesson.chapters[0]!.id;
const reactionFeedback = new Map<string, string>();
const statNames = { intelligence: 'Intelligence', discipline: 'Discipline', morale: 'Moral', complexityReduction: 'Réduction de complexité', disruptionReduction: 'Réduction des perturbations' };
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const advance = el<HTMLButtonElement>('advance');
const seed = el<HTMLInputElement>('seed');
const restart = el<HTMLFormElement>('restart');
const log = el<HTMLOListElement>('log');
const studentName = (id: string) => scenario.students.find(s => s.id === id)?.name ?? 'Professeur';

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
  const mastery = chapterMastery(state, scenario.lesson, activeChapterId);
  const morale = moraleMultiplier(effectiveStats(student, state).morale);
  const chances = moraleChances(morale, scenario.interactionRules!);
  const behaviorInfo = document.createElement('p');
  behaviorInfo.textContent = `Maîtrise du chapitre : ${mastery} %. Moral effectif : ×${morale.toFixed(2)}. Occasion positive : ${Math.round(chances.positive * 10000) / 100} % · risque négatif : ${Math.round(chances.negative * 10000) / 100} %. Deux tirages indépendants.`;
  el('student-detail').append(behaviorInfo);
  if (reactionFeedback.has(selected)) {
    const last = document.createElement('p'); last.textContent = reactionFeedback.get(selected)!;
    el('student-detail').append(last);
  }
  const reactionIds = student.reactionIds ?? scenario.archetypes.find(archetype => archetype.id === student.archetypeId)?.reactionIds ?? [];
  const abilities = scenario.reactionAbilities?.filter(ability => reactionIds.includes(ability.id)) ?? [];
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
        ? ` Maîtrise requise : ${requirement.minimum} %${ability.effect === 'COMBINED_ATTACK' ? ' chez les deux élèves' : ''}${mastery < requirement.minimum ? ' · pas encore acquise' : ''}.`
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
  const relations = document.createElement('p');
  relations.textContent = 'Relations avec les voisins : ' + scenario.students
    .filter(other => areAdjacent(student, other, scenario.classroom))
    .map(other => `${other.name} ${relationBetween(student.id, other.id, scenario.relations ?? [])}/100`).join(' · ');
  el('student-detail').append(relations);
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
  button.addEventListener('click', () => { selected = student.id; renderStudents(); renderTeacher(); });
  el('seats').append(button);
}
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
  el('round-rows').replaceChildren();
  for (const state of simulation.studentStates) {
    const previous = before.find(s => s.studentId === state.studentId)!;
    const row = document.createElement('tr');
    for (const value of [studentName(state.studentId), `${state.lessonUnderstanding} % (${delta(state.lessonUnderstanding - previous.lessonUnderstanding)})`, `${state.concentration} (${delta(state.concentration - previous.concentration)})`, `${state.morale} (${delta(state.morale - previous.morale)})`, state.concentration ? 'En apprentissage' : 'Décroché']) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    el('round-rows').append(row);
  }
  el('round-highlights').textContent = `Round ${completedRounds} · ${events.filter(e => e.type === 'EFFECT_APPLIED').length} aides · ${events.filter(e => e.type === 'REACTION_TRIGGERED' && e.effect === 'REDUCE_PRESSURE').length} protections · ${events.filter(e => e.type === 'REACTION_TRIGGERED' && e.effect !== 'REDUCE_PRESSURE').length} soutiens réactifs · ${events.filter(e => e.type === 'DISRUPTION_RESOLVED').length} perturbations · ${events.filter(e => e.type === 'COMBINED_ATTACK_RESOLVED').length} combos`;
  el('round-result').hidden = false;
}
el<HTMLFormElement>('teacher-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (busy || simulation.state !== 'TEACHER_INTERVENTION') return;
  const kind = actionSelect.value as TeacherActionKind;
  const action: TeacherAction = kind === 'PASS' || kind === 'BREAK' ? { kind } : { kind, targetId: selected };
  busy = true; syncControls();
  try { await showEvents(simulation.applyTeacherAction(action)); }
  catch (error) { note(error instanceof Error ? error.message : 'Intervention impossible.'); }
  finally { busy = false; syncControls(); }
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
  for (const event of events) {
    if (event.type === 'ROUND_STARTED') {
      activeChapterId = event.chapterId; reactionFeedback.clear(); reactionsUsed.clear(); renderStudents();
    } else if (event.type === 'REACTION_EVALUATED' && event.reason !== 'eligible') {
      const reason = event.reason === 'mastery' ? `maîtrise insuffisante (${event.mastery} %, cible ${event.targetMastery} %, minimum ${event.minimum} %)`
        : event.reason === 'relation' ? 'relation insuffisante' : event.reason === 'noEffect' ? 'aucun effet utile dans cette situation' : 'aucune occasion positive au tirage de moral';
      reactionFeedback.set(event.sourceId, `Dernière occasion avec ${studentName(event.targetId)} : ${reason}.`);
      renderStudents();
    } else if (event.type === 'BEHAVIOR_APPLIED') {
      note(`${studentName(event.studentId)} est distrait : efficacité réduite à ${Math.round(event.multiplier * 100)} % pour cette action.`);
    } else if (event.type === 'TEACHER_PATIENCE_CHANGED') {
      shownTeacher.patience = event.after; renderTeacher();
    } else if (event.type === 'TEACHER_ACTION_APPLIED') {
      note(`Professeur : ${createTeacherRules().actions[event.action].label}${event.action === 'PASS' ? '' : ` · ${event.targetIds.map(studentName).join(', ')} · puissance ${event.power}`}.`);
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
      feedback(event.targetId, `Combo : +${event.appliedProgress} points`);
      note(`Combo : ${event.activeGain} + ${event.partnerGain} + ${event.synergyGain} de synergie. ${studentName(event.targetId)} gagne ${event.appliedProgress} points de chapitre (potentiel ${event.potentialGain}).`);
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
    } else if (event.type === 'CHAPTER_PROGRESS_CHANGED') {
      const chapter = shownStates.get(event.studentId)!.chapters.find(c => c.chapterId === event.chapterId)!;
      chapter.progress = event.progress; chapter.missedRounds = event.missedRounds;
      renderStudents();
    } else if (event.type === 'CONCENTRATION_CHANGED') {
      shownStates.get(event.studentId)!.concentration = event.after; renderStudents();
      if (event.reason !== 'support') feedback(event.studentId, event.after < event.before ? `−${Math.round((event.before - event.after)*100)/100} HP` : `+${Math.round((event.after-event.before)*100)/100} HP · reprise au prochain tour`);
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
    if (event.type === 'COMBINED_ATTACK_STARTED' || event.type === 'COMBINED_ATTACK_RESOLVED' || event.type === 'REACTION_TRIGGERED' || event.type === 'UNDERSTANDING_CHANGED' || event.type === 'EFFECT_APPLIED' || event.type === 'EXTRA_ACTION_CREATED' || event.type === 'CONCENTRATION_CHANGED' && event.reason !== 'support' || event.type === 'STUDENT_DROPPED_OUT') {
      // Conserver le temps de lecture même lorsque les mouvements sont désactivés.
      await new Promise(resolve => setTimeout(resolve, event.type === 'COMBINED_ATTACK_STARTED' || event.type === 'REACTION_TRIGGERED' || event.type === 'EFFECT_APPLIED' ? 1100 : 650));
    }
  }
  clearActionFeedback();
}
async function advanceLesson() {
  if (busy || simulation.state !== 'ROUND_READY') return;
  busy = true; syncControls();
  try {
    if (simulation.state === 'ROUND_READY') {
      const before = simulation.studentStates;
      const events = simulation.resolveRound();
      const chapterId = events[0]!.chapterId;
      const index = scenario.lesson.chapters.findIndex(c => c.id === chapterId);
      el('chapter').textContent = scenario.lesson.chapters[index]!.name;
      el('chapter-count').textContent = `CHAPITRE ${index + 1} / 2`;
      el('phase').textContent = 'Les élèves travaillent';
      el('status').textContent = 'Observez leurs progrès et leurs interactions.';
      await showEvents(events);
      completedRounds++; renderRoundResult(before, events);
      simulation.acknowledgeRoundResult();
    }
  } catch (error) { note(error instanceof Error ? error.message : 'La leçon a rencontré une erreur.'); }
  finally { clearActionFeedback(); busy = false; syncControls(); }
}
advance.addEventListener('click', () => { void advanceLesson(); });
restart.addEventListener('submit', event => {
  event.preventDefault(); if (busy || !restart.reportValidity()) return;
  simulation = new Simulation(scenario, Number(seed.value));
  reactionsUsed.clear();
  activeChapterId = scenario.lesson.chapters[0]!.id; reactionFeedback.clear();
  completedRounds = 0; shownTeacher = simulation.teacherState; actionSelect.value = 'ENCOURAGE';
  el('round-result').hidden = true;
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
        description: readOnly ? 'Lire la phase et la compréhension affichée des neuf élèves.' : 'Lancer un round lorsque la classe est prête, et attendre son affichage. Les interventions se choisissent dans le formulaire.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: readOnly },
        async execute(input: unknown) {
          if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Objet vide attendu.');
          if (!readOnly) {
            if (busy || simulation.state !== 'ROUND_READY') throw new Error('La leçon ne peut pas avancer maintenant.');
            await advanceLesson();
          }
          return { phase: simulation.state, busy, students: Object.fromEntries(shown) };
        },
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch { /* Le jeu reste utilisable si le registre facultatif est indisponible. */ }
  }
}
