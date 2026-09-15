import { estimateMastery } from '../systems/LearningMemory.js';
import { ClassPreparation } from '../systems/ClassPreparation.js';
import { PlacementEvaluationSystem, knowledgeOf } from '../systems/PlacementEvaluationSystem.js';
import { paragraph, renderStudentCard, signed, tagLabels } from './StudentCard.js';

export class ClassroomPreparationView {
  private selected: string;
  private evaluator: PlacementEvaluationSystem;
  private evaluatedSystem: ClassPreparation['system'];
  private moving = false;
  private drag: { id: string; x: number; y: number; pointerId: number; active: boolean } | undefined;
  private hover: string | undefined;
  private controller = new AbortController();
  private tools = document.createElement('div');
  private preview = document.createElement('div');
  private message = document.createElement('p');
  constructor(private preparation: ClassPreparation, private grid: HTMLElement, private detail: HTMLElement) {
    this.evaluatedSystem=preparation.system;
    this.evaluator=new PlacementEvaluationSystem(preparation.scenario,preparation.system);
    this.selected = preparation.scenario.students.find(s => s.present !== false)?.id ?? '';
    this.tools.className = 'preparation-tools';
    this.tools.innerHTML = '<p>Glissez un élève sur une place pour le déplacer ou échanger deux élèves. Au clavier, sélectionnez un élève puis « Déplacer » et choisissez une place.</p>';
    for (const [label, action] of [['Réinitialiser le placement', () => preparation.reset()], ['Sauvegarder le placement', () => preparation.save()]] as const) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
      button.onclick = () => { action(); this.render(); }; this.tools.append(button);
    }
    this.message.setAttribute('role', 'status'); this.tools.append(this.message); this.grid.before(this.tools);
    this.preview.id = 'placement-preview'; this.preview.setAttribute('aria-live', 'polite'); this.preview.setAttribute('aria-atomic','true');
    const options = { signal: this.controller.signal };
    grid.addEventListener('pointerdown', event => {
      const button = (event.target as HTMLElement).closest<HTMLElement>('[data-student]');
      if (!button || event.button !== 0) return;
      const id = button.dataset.student!;
      if (preparation.system.getStudentSeat(id)?.locked) return;
      this.drag = { id, x: event.clientX, y: event.clientY, pointerId: event.pointerId, active: false };
    }, options);
    document.addEventListener('pointermove', event => {
      const drag = this.drag; if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.active && Math.hypot(event.clientX-drag.x, event.clientY-drag.y) < 7) return;
      if (!drag.active) { drag.active = true; this.selected = drag.id; this.grid.classList.add('dragging'); this.renderDetail(); }
      event.preventDefault();
      const viewport=this.grid.parentElement!;
      if(viewport.scrollWidth>viewport.clientWidth) { const bounds=viewport.getBoundingClientRect(); if(event.clientX<bounds.left+30) viewport.scrollBy(-14,0); else if(event.clientX>bounds.right-30) viewport.scrollBy(14,0); }
      const target = document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>('[data-seat]');
      const seatId = target && this.grid.contains(target) ? target.dataset.seat : undefined;
      if (seatId !== this.hover) {
        this.hover = seatId;
        this.grid.querySelectorAll('[data-seat]').forEach(el => el.classList.toggle('drop-target', (el as HTMLElement).dataset.seat === seatId));
        if (seatId) this.showPreview(seatId);
      }
    }, { ...options, passive: false });
    document.addEventListener('pointerup', event => {
      const drag = this.drag; if (!drag || drag.pointerId !== event.pointerId) return;
      this.drag = undefined;
      if (drag.active) { if (this.hover) this.move(this.hover); else this.render(); }
      this.grid.classList.remove('dragging'); this.hover = undefined;
    }, options);
    document.addEventListener('pointercancel', () => { this.cancel(); this.render(); }, options);
    window.addEventListener('blur', () => { this.cancel(); this.render(); }, options);
    grid.addEventListener('keydown', event => { if (event.key === 'Escape') { this.cancel(); this.render(); } }, options);
    this.render();
  }
  private cancel() { this.drag = undefined; this.hover = undefined; this.moving = false; this.grid.classList.remove('dragging'); }
  destroy() { this.controller.abort(); this.cancel(); this.tools.remove(); this.grid.replaceChildren(); this.detail.replaceChildren(); }
  private evaluation() {
    if(this.evaluatedSystem!==this.preparation.system) { this.evaluatedSystem=this.preparation.system; this.evaluator=new PlacementEvaluationSystem(this.preparation.scenario,this.preparation.system); }
    return this.evaluator;
  }
  private move(seatId: string) {
    try {
      const source=this.preparation.system.getStudentSeat(this.selected)!;
      this.preparation.moveStudent(this.selected, seatId);
      this.evaluation().recalculateAffectedPlacements([source.id,seatId]);
    }
    catch (error) { this.preparation.message = (error as Error).message; }
    this.moving = false; this.render();
    this.grid.querySelector<HTMLButtonElement>(`[data-student="${this.selected}"]`)?.focus();
  }
  render() {
    const { scenario, system } = this.preparation, layout = system.currentLayout;
    this.grid.replaceChildren(); this.grid.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
    this.grid.setAttribute('aria-label', `Placement de la classe, ${layout.rows} lignes et ${layout.columns} colonnes`);
    this.message.textContent = this.preparation.message;
    for (const seat of layout.seats) {
      const cell = document.createElement('div'); cell.className = 'preparation-seat'; cell.dataset.seat = seat.id;
      cell.style.gridRow = String(seat.row+1); cell.style.gridColumn = String(seat.column+1);
      const student = scenario.students.find(s => s.id === seat.studentId && s.present !== false);
      const label = `${seat.row+1}${String.fromCharCode(65+seat.column)}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = `seat ${student?.archetypeId ?? 'empty'}`;
      paragraph(button, `Place ${label}`, 'small');
      if (student) {
        button.dataset.student = student.id;
        button.classList.add('draggable-student');
        paragraph(button, student.name, 'strong');
        const mastery = knowledgeOf(student, scenario.lesson.conceptIds[0] ?? '');
        paragraph(button, estimateMastery(student, scenario.lesson.id, scenario.teacher, scenario.activity?.day).label, 'b');
        paragraph(button, scenario.archetypes.find(a => a.id === student.archetypeId)?.name ?? '', 'span');
        button.setAttribute('aria-pressed', String(this.selected === student.id));
        button.setAttribute('aria-label', `${student.name}, place ${label}${seat.locked ? ', verrouillée' : ''}`);
      } else { paragraph(button, 'Place vide', 'strong'); button.setAttribute('aria-label', `Place vide ${label}`); }
      button.onclick = () => {
        if (this.moving) { this.move(seat.id); return; }
        if (student) { this.selected = student.id; this.render(); this.grid.querySelector<HTMLButtonElement>(`[data-student="${student.id}"]`)?.focus(); }
      };
      button.onpointerenter = () => { if (this.moving) this.showPreview(seat.id); };
      button.onfocus = () => { if (this.moving) this.showPreview(seat.id); };
      cell.append(button);
      const lock = document.createElement('button'); lock.type = 'button'; lock.className = 'seat-lock'; lock.textContent = seat.locked ? '🔒' : 'Verrouiller';
      lock.setAttribute('aria-label', `${seat.locked ? 'Déverrouiller' : 'Verrouiller'} la place ${label}`); lock.setAttribute('aria-pressed', String(seat.locked));
      lock.onclick = () => { this.preparation.setLocked(seat.id, !seat.locked); this.render(); }; cell.append(lock);
      this.grid.append(cell);
    }
    this.renderDetail();
  }
  private renderDetail() {
    const student = this.preparation.scenario.students.find(s => s.id === this.selected);
    if (!student) { this.detail.textContent = 'Aucun élève présent.'; return; }
    renderStudentCard(this.detail, student, this.preparation.scenario);
    const move = document.createElement('button'); move.type = 'button'; move.textContent = this.moving ? 'Annuler le déplacement' : 'Déplacer cet élève';
    move.disabled = this.preparation.system.getStudentSeat(student.id)?.locked ?? true;
    move.onclick = () => { this.moving = !this.moving; this.renderDetail(); if (this.moving) { this.message.textContent = 'Choisissez la place de destination. Échap pour annuler.'; this.grid.querySelector<HTMLButtonElement>('.seat')?.focus(); } };
    this.detail.append(move, this.preview);
    this.showPreview(this.preparation.system.getStudentSeat(student.id)!.id);
  }
  private showPreview(seatId: string) {
    const result = this.evaluation().previewPlacement(this.selected, seatId);
    const seat = this.preparation.system.getSeat(seatId)!;
    this.preview.replaceChildren();
    paragraph(this.preview, `Placement ${seat.row+1}${String.fromCharCode(65+seat.column)}`, 'h3');
    paragraph(this.preview,seat.tags.map(t=>tagLabels[t] ?? t).join(' · '));
    this.grid.querySelectorAll<HTMLElement>('[data-seat]').forEach(cell=>{ delete cell.dataset.compatibility; if(cell.dataset.seat===seatId) cell.dataset.compatibility=result.state; });
    if (!result.allowed) { paragraph(this.preview, 'Déplacement impossible : place verrouillée.'); return; }
    paragraph(this.preview, `${result.state === 'positive' ? 'Favorable' : result.state === 'negative' ? 'Risqué' : 'Neutre'} · score indicatif ${signed(result.score)}`);
    paragraph(this.preview, `Confort initial : ${signed(result.preference)} moral`);
    paragraph(this.preview, 'Relations avec les voisins', 'h3');
    if (!result.neighbors.length) paragraph(this.preview, 'Aucun voisin direct.');
    for (const neighbor of result.neighbors) {
      paragraph(this.preview, `${neighbor.name} : ${signed(neighbor.relation)} · envers cet élève : ${signed(neighbor.incomingRelation)}${neighbor.knowledge !== null ? ' · acquis à observer' : ''}`);
      if (neighbor.useful) paragraph(this.preview, 'Soutien pédagogique potentiel — à mettre en balance avec la relation.');
    }
    const synergies = [...new Set(result.neighbors.flatMap(n => n.synergies.map(s => s.name)))];
    if (synergies.length) paragraph(this.preview, 'Compétences de voisinage : ' + synergies.join(', '));
    paragraph(this.preview, result.advisory, 'small');
  }
}
