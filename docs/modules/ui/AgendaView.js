import { sessionRules } from '../data/sessionRules.js';
import { getTeachingMode } from '../data/teachingModes.js';
const node = (tag, text = '') => {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
};
export class AgendaView {
    root;
    agenda;
    students;
    locked;
    pedagogy;
    timeChanged;
    weekIndex = 0;
    editing;
    message = '';
    constructor(root, agenda, students, locked, pedagogy = () => 0, timeChanged = () => { }) {
        this.root = root;
        this.agenda = agenda;
        this.students = students;
        this.locked = locked;
        this.pedagogy = pedagogy;
        this.timeChanged = timeChanged;
        this.render();
    }
    render() {
        const a = this.agenda, weeks = a.calendar.periods.flatMap(p => p.weeks), slots = a.slots;
        this.weekIndex = Math.min(this.weekIndex, weeks.length - 1);
        const week = weeks[this.weekIndex];
        this.root.replaceChildren(node('h2', 'Agenda scolaire'));
        const notice = node('p', this.message || a.message);
        notice.setAttribute('role', 'status');
        this.root.append(notice);
        const run = (action) => { try {
            action();
            this.message = a.message;
        }
        catch (e) {
            this.message = e.message;
        } this.render(); };
        const button = (label, action, disabled = false) => {
            const b = node('button', label);
            b.type = 'button';
            b.disabled = disabled;
            b.onclick = () => run(action);
            return b;
        };
        const deadlineSlots = a.calendar.periods.find(p => p.id === week.periodId).weeks.flatMap(w => w.days.flatMap(d => d.slots));
        const info = a.indicators(this.students(), deadlineSlots.at(-1)?.id, this.pedagogy());
        this.root.append(node('p', `${info.remaining} créneaux restants · ${info.free} libres · ${info.unaddressed.length} leçons non abordées · ${info.estimates.filter(e => e.high < a.snapshot.config.masteryThreshold).length} leçons estimées en difficulté`));
        this.root.append(node('p', `${info.slotsBeforeDeadline} créneaux jusqu’à la fin de la période affichée. Marge minimale pour aborder le programme : ${info.minimumCoverageMargin} créneaux (hypothèse : une séance par leçon ; sans garantie de maîtrise).`));
        const current = a.currentSlot;
        const currentWeek = weeks.find(w => w.days.some(d => d.slots.some(s => s.id === current?.id)));
        this.root.append(node('p', current ? `Temps courant : semaine ${currentWeek.number}, ${currentWeek.days.find(d => d.slots.some(s => s.id === current.id)).name}, créneau ${current.index + 1}` : 'Année terminée : plus aucun créneau disponible.'));
        const nav = node('div');
        nav.className = 'agenda-toolbar';
        const periods = node('select');
        periods.setAttribute('aria-label', 'Période');
        for (const p of a.calendar.periods) {
            const o = node('option', p.name);
            o.value = p.id;
            o.selected = p.id === week.periodId;
            periods.append(o);
        }
        periods.onchange = () => { this.weekIndex = weeks.findIndex(w => w.periodId === periods.value); this.render(); };
        nav.append(button('Semaine précédente', () => { this.weekIndex--; }, this.weekIndex === 0), node('strong', `Semaine ${week.number}`), button('Semaine suivante', () => { this.weekIndex++; }, this.weekIndex === weeks.length - 1), periods, button('Temps courant', () => { this.weekIndex = currentWeek ? weeks.indexOf(currentWeek) : weeks.length - 1; }));
        this.root.append(nav);
        const grid = node('div');
        grid.className = 'agenda-grid';
        for (const day of week.days) {
            const cell = node('section');
            cell.className = `agenda-day ${day.status}`;
            cell.append(node('h3', day.name), node('p', `${{ school: 'Scolaire', holiday: 'Non scolaire', event: 'Événement' }[day.status]} · ${day.label}`));
            for (const slot of day.slots) {
                const session = a.sessions.find(s => s.slotId === slot.id && s.type !== 'homework'), row = node('div');
                row.className = 'agenda-slot';
                const lesson = a.curriculum.lessons.find(l => l.id === session?.lessonId);
                const chapter = a.curriculum.chapters.find(c => c.id === lesson?.topicId);
                const subject = a.curriculum.subjects.find(s => s.id === chapter?.subjectId);
                row.append(node('strong', `Créneau ${slot.index + 1}${slot.id === current?.id ? ' · Maintenant' : ''}`));
                row.append(node('p', session ? `${subject?.name} · ${lesson?.name} · ${getTeachingMode(session.type).name} · ${session.status === 'completed' ? 'Réalisée' : 'Planifiée'}` : (slots.findIndex(s => s.id === slot.id) < a.snapshot.cursor ? 'Temps écoulé' : 'Libre')));
                if (slots.findIndex(s => s.id === slot.id) >= a.snapshot.cursor) {
                    row.append(button(session ? 'Modifier / déplacer' : 'Planifier', () => { this.editing = session?.id; this.renderEditor(slot.id); }, this.locked()));
                    // Opening the editor must follow the wrapper's render.
                    row.lastChild.onclick = () => { this.editing = session?.id; this.renderEditor(slot.id); };
                    if (session)
                        row.append(button('Supprimer', () => a.remove(session.id), this.locked()));
                    const homework = a.sessions.find(s => s.slotId === slot.id && s.type === 'homework');
                    if (homework)
                        row.append(node('p', `Devoir hors classe · ${a.curriculum.lessons.find(l => l.id === homework.lessonId).name} · ${homework.status === 'completed' ? 'Réalisé' : 'Planifié'} · difficulté ${homework.difficulty ?? 50}`));
                    if (!homework || homework.status === 'planned') {
                        const edit = node('button', homework ? 'Modifier le devoir' : 'Ajouter un devoir hors classe');
                        edit.type = 'button';
                        edit.disabled = this.locked();
                        edit.onclick = () => { this.editing = homework?.id; this.renderEditor(slot.id, 'homework'); };
                        row.append(edit);
                        if (homework)
                            row.append(button('Supprimer le devoir', () => a.remove(homework.id), this.locked()));
                    }
                }
                cell.append(row);
            }
            grid.append(cell);
        }
        this.root.append(grid, button('Laisser passer le créneau courant vide', () => { a.skip(); this.timeChanged(); }, this.locked() || !current || a.sessions.some(s => s.slotId === current.id && s.status === 'planned')));
        const mastery = node('details');
        mastery.append(node('summary', 'Maîtrise par leçon'));
        for (const m of info.estimates)
            mastery.append(node('p', `${a.curriculum.lessons.find(l => l.id === m.lessonId).name} : environ ${m.low}–${m.high} %${info.unaddressed.includes(m.lessonId) ? ' · Non abordée' : ''}`));
        this.root.append(mastery);
        for (const s of a.sessions.filter(s => s.type === 'homework' && s.status === 'completed'))
            this.root.append(node('p', `Devoir réalisé · ${a.curriculum.lessons.find(l => l.id === s.lessonId).name} · ${sessionRules.homeworkMinutes} min de préparation hors classe`));
        const config = node('details');
        config.append(node('summary', 'Configuration de campagne'));
        config.append(node('p', 'Modifiable avant toute planification : semaines, périodes, jours travaillés, créneaux, vacances et jours particuliers. Les semaines des jours particuliers incluent les vacances.'));
        const field = node('textarea');
        field.value = JSON.stringify(a.snapshot.config, null, 2);
        field.rows = 12;
        field.setAttribute('aria-label', 'Configuration du calendrier JSON');
        field.disabled = this.locked() || a.sessions.length > 0 || a.snapshot.cursor > 0;
        config.append(field, button('Appliquer la configuration', () => a.configure(JSON.parse(field.value)), field.disabled));
        this.root.append(config);
    }
    renderEditor(slotId, initialType = 'lecture') {
        this.root.querySelector('form')?.remove();
        const a = this.agenda, session = a.sessions.find(s => s.id === this.editing), form = node('form');
        form.className = 'agenda-editor';
        const lesson = node('select'), type = node('select'), destination = node('select');
        lesson.setAttribute('aria-label', 'Leçon');
        type.setAttribute('aria-label', 'Type de séance');
        destination.setAttribute('aria-label', 'Créneau de destination');
        for (const l of a.curriculum.lessons) {
            const o = node('option', l.name);
            o.value = l.id;
            lesson.append(o);
        }
        if (session)
            lesson.value = session.lessonId;
        const modes = () => { type.replaceChildren(); for (const id of a.curriculum.lessons.find(l => l.id === lesson.value).availableTeachingModes ?? ['lecture']) {
            const m = getTeachingMode(id), o = node('option', m.name + (m.resolution === 'deferred' ? ' (hors classe)' : ''));
            o.value = id;
            type.append(o);
        } };
        const difficulty = node('input');
        difficulty.type = 'number';
        difficulty.min = '0';
        difficulty.max = '100';
        difficulty.value = String(session?.difficulty ?? 50);
        difficulty.setAttribute('aria-label', 'Complexité de 0 à 100');
        const help = node('p');
        const describe = () => { difficulty.hidden = !['exercise', 'homework'].includes(type.value); help.textContent = type.value === 'homework' ? `Préparation : ${sessionRules.homeworkMinutes} min hors classe, ${sessionRules.homeworkPatience} Patience. Travail autonome, très dépendant de la Discipline.` : type.value === 'assessment' ? `Deux tours individuels, ${sessionRules.assessmentAuthority} Autorité, baisse de Moral. Observer sans enseigner.` : type.value === 'revision' ? 'Récupérer les acquis oubliés, protéger et réactiver les concepts liés.' : type.value === 'exercise' ? 'Complexité 0–100 : choisissez-la selon votre estimation des acquis.' : 'Acquérir de nouvelles connaissances ; observation limitée.'; };
        type.onchange = describe;
        lesson.onchange = () => { modes(); describe(); };
        modes();
        type.value = session?.type ?? initialType;
        describe();
        const allowed = new Set(a.slots.slice(a.snapshot.cursor).map(s => s.id));
        for (const p of a.calendar.periods)
            for (const w of p.weeks)
                for (const d of w.days)
                    for (const s of d.slots) {
                        if (!allowed.has(s.id))
                            continue;
                        const o = node('option', `${p.name} · S${w.number} · ${d.name} · ${s.index + 1}`);
                        o.value = s.id;
                        destination.append(o);
                    }
        destination.value = slotId;
        const submit = node('button', 'Enregistrer la séance');
        submit.type = 'submit';
        const cancel = node('button', 'Annuler');
        cancel.type = 'button';
        cancel.onclick = () => form.remove();
        form.append(node('h3', session ? 'Modifier ou déplacer la séance' : 'Nouvelle séance'), lesson, type, difficulty, help, destination, submit, cancel);
        form.onsubmit = e => { e.preventDefault(); if (this.locked())
            return; try {
            a.place(destination.value, lesson.value, type.value, this.editing, difficulty.hidden ? undefined : Number(difficulty.value));
            this.message = a.message;
            this.render();
        }
        catch (error) {
            const message = node('p', error.message);
            message.setAttribute('role', 'alert');
            form.append(message);
        } };
        this.root.append(form);
        lesson.focus();
    }
}
