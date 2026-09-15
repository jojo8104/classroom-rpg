import { ClassroomProjection } from './ClassroomProjection.js';
import { DepthManager } from './DepthManager.js';
import { StudentDesk } from './StudentDesk.js';
import { SpriteController, getStudentOrientation } from './SpriteController.js';
export const QUALITY_LIMITS = { high: 8, medium: 4, low: 1 };
const ns = 'http://www.w3.org/2000/svg';
export class ClassroomRenderer {
    root;
    desks = new Map();
    sprites = new SpriteController((id, state) => this.desks.get(id)?.renderSprite(state, this.sprites.manifest));
    projection;
    world = document.createElement('div');
    effects = document.createElementNS(ns, 'svg');
    observer;
    lifecycle = new AbortController();
    effectTimers = new Map();
    moved = [];
    motion = matchMedia('(prefers-reduced-motion: reduce)');
    quality = 'high';
    zoom = 1;
    viewportWidth = 0;
    constructor(root, students, layout, select) {
        this.root = root;
        this.projection = new ClassroomProjection(layout.rows, layout.columns);
        root.replaceChildren();
        root.classList.add('classroom-scene');
        root.parentElement.classList.add('scene-viewport');
        this.world.className = 'classroom-world';
        root.append(this.world);
        this.world.style.width = `${this.projection.config.width}px`;
        this.world.style.height = `${this.projection.config.height}px`;
        for (const selector of ['.board', '.teacher']) {
            const element = document.querySelector(selector);
            const marker = document.createComment('scene origin');
            element.before(marker);
            this.moved.push({ element, marker });
            this.world.append(element);
        }
        this.effects.classList.add('classroom-effects');
        this.effects.setAttribute('viewBox', '0 0 1600 900');
        const defs = document.createElementNS(ns, 'defs');
        const marker = document.createElementNS(ns, 'marker');
        marker.id = 'interaction-arrow';
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '5');
        marker.setAttribute('markerHeight', '5');
        marker.setAttribute('orient', 'auto');
        const arrow = document.createElementNS(ns, 'path');
        arrow.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrow.setAttribute('style', 'fill:context-stroke;stroke:none');
        marker.append(arrow);
        defs.append(marker);
        this.effects.append(defs);
        this.effects.setAttribute('aria-hidden', 'true');
        this.effects.style.zIndex = String(DepthManager.effects(layout.rows));
        this.world.append(this.effects);
        this.setLayout(students, layout, select);
        this.observer = new ResizeObserver(entries => {
            this.viewportWidth = entries[0]?.contentRect.width ?? 0;
            this.resize();
        });
        this.observer.observe(root.parentElement);
        const options = { signal: this.lifecycle.signal };
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.sprites.pause();
                this.clearEffects();
            }
            else
                this.sprites.resume();
            this.root.classList.toggle('scene-paused', document.hidden);
        }, options);
        this.motion.addEventListener('change', () => this.setQuality(this.quality), options);
        void fetch('./assets/students/base-01/manifest.json', options).then(r => r.json()).then((manifest) => {
            if (!this.lifecycle.signal.aborted)
                this.sprites.manifest = manifest;
        }).catch(() => { });
        this.setQuality('high');
    }
    setLayout(students, layout, select) {
        this.reset();
        this.desks.clear();
        this.world.querySelectorAll('.classroom-row').forEach(row => row.remove());
        this.projection = new ClassroomProjection(layout.rows, layout.columns);
        this.effects.style.zIndex = String(DepthManager.effects(layout.rows));
        for (let row = 0; row < layout.rows; row++) {
            const layer = document.createElement('div');
            layer.className = 'classroom-row';
            layer.style.zIndex = String(DepthManager.row(row));
            this.world.append(layer);
            for (const seat of layout.seats.filter(s => s.row === row)) {
                const student = students.find(s => s.id === seat.studentId && s.present !== false);
                const p = this.projection.project(seat.row, seat.column);
                const desk = student ? new StudentDesk(student, { row: seat.row, column: seat.column }) : undefined;
                const element = desk?.element ?? document.createElement('div');
                if (!desk) {
                    element.className = 'student-desk empty-desk';
                    element.innerHTML = '<span class="desk-surface"></span>';
                    element.setAttribute('aria-label', 'Place vide');
                }
                element.style.left = `${p.x}px`;
                element.style.top = `${p.y}px`;
                element.style.transform = `translate(-50%, -50%) scale(${p.scale})`;
                layer.append(element);
                if (desk && student) {
                    this.desks.set(student.id, desk);
                    this.sprites.setRest(student.id, getStudentOrientation(seat, 'idle'));
                    element.addEventListener('click', () => select(student.id), { signal: this.lifecycle.signal });
                }
            }
        }
    }
    render(states, progress, selected) {
        for (const [id, desk] of this.desks) {
            const state = states.get(id);
            if (state)
                desk.render(state, progress.get(id) ?? state.lessonUnderstanding, selected === id);
        }
    }
    setQuality(quality) {
        this.quality = quality;
        this.root.dataset.quality = quality;
        this.root.classList.toggle('reduced-motion', this.motion.matches);
        this.reset();
    }
    setZoom(zoom) { this.zoom = Math.max(1, Math.min(2.5, zoom)); this.resize(); }
    resize() {
        const { width, height } = this.projection.config;
        this.root.parentElement.style.height = `${this.viewportWidth * height / width}px`;
        this.root.parentElement.style.overflow = this.zoom > 1 ? 'auto' : 'hidden';
        this.root.style.width = `${this.viewportWidth * this.zoom}px`;
        this.root.style.height = `${this.viewportWidth * this.zoom * height / width}px`;
        this.world.style.transform = `scale(${this.viewportWidth * this.zoom / width})`;
    }
    getEffectAnchor(id) {
        const desk = this.desks.get(id);
        if (!desk)
            return undefined;
        const p = this.projection.project(desk.position.row, desk.position.column);
        return { x: p.x, y: p.y - 20 * p.scale };
    }
    play(id, animation, targetId) {
        const desk = this.desks.get(id);
        if (!desk)
            return;
        this.sprites.play(id, { animation, direction: getStudentOrientation(desk.position, animation, targetId ? this.desks.get(targetId)?.position : undefined), duration: this.motion.matches || this.quality === 'low' ? 250 : 700 });
    }
    connect(sourceId, targetId, kind) {
        const source = this.getEffectAnchor(sourceId), target = this.getEffectAnchor(targetId);
        if (!source || !target || sourceId === targetId || document.hidden)
            return;
        while (this.effectTimers.size >= QUALITY_LIMITS[this.quality])
            this.removeEffect(this.effectTimers.keys().next().value);
        const group = document.createElementNS(ns, 'g');
        group.dataset.kind = kind;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', `M ${source.x} ${source.y} Q ${(source.x + target.x) / 2} ${Math.min(source.y, target.y) - 75} ${target.x} ${target.y}`);
        path.setAttribute('marker-end', 'url(#interaction-arrow)');
        const dot = document.createElementNS(ns, 'circle');
        dot.setAttribute('cx', String(source.x));
        dot.setAttribute('cy', String(source.y));
        dot.setAttribute('r', '7');
        const label = document.createElementNS(ns, 'text');
        label.setAttribute('x', String(target.x));
        label.setAttribute('y', String(target.y - 12));
        label.textContent = kind === 'distract' ? '−' : kind === 'combo' ? '✦' : '+';
        group.append(path, dot, label);
        this.effects.append(group);
        this.effectTimers.set(group, setTimeout(() => this.removeEffect(group), this.motion.matches ? 350 : 850));
    }
    removeEffect(effect) { clearTimeout(this.effectTimers.get(effect)); this.effectTimers.delete(effect); effect.remove(); }
    clearEffects() { for (const effect of this.effectTimers.keys())
        this.removeEffect(effect); }
    handleEvent(event) {
        if (document.hidden)
            return;
        switch (event.type) {
            case 'STUDENT_ACTION':
                this.play(event.actorId, event.actionId === 'WORK' ? 'attackLesson' : event.actionId === 'SUPPORT' ? 'help' : event.actionId === 'DISRUPT' ? 'distract' : 'listen', event.targetId);
                break;
            case 'EFFECT_APPLIED':
            case 'REACTION_TRIGGERED':
            case 'DISRUPTION_RESOLVED':
            case 'COMBINED_ATTACK_STARTED': {
                const kind = event.type === 'DISRUPTION_RESOLVED' ? 'distract' : event.type === 'COMBINED_ATTACK_STARTED' ? 'combo' : 'help';
                this.play(event.sourceId, kind === 'distract' ? 'distract' : 'help', event.targetId);
                this.play(event.targetId, kind === 'distract' ? 'receiveMalus' : 'receiveBonus', event.sourceId);
                this.connect(event.sourceId, event.targetId, kind);
                break;
            }
            case 'TEMPORARY_EFFECT_APPLIED':
                this.play(event.effect.targetId, 'receiveBonus', event.effect.sourceId);
                break;
            case 'UNDERSTANDING_CHANGED':
                if (Math.floor(event.after / 25) > Math.floor(event.before / 25))
                    this.play(event.studentId, 'understand');
                break;
            case 'STUDENT_DROPPED_OUT':
                this.play(event.studentId, 'fail');
                break;
            case 'LESSON_RETALIATED':
                this.play(event.studentId, 'receiveMalus');
                break;
            case 'TEACHER_ACTION_APPLIED':
                for (const id of event.targetIds)
                    this.play(id, event.action === 'ENCOURAGE' ? 'encourage' : event.action === 'REFRAME' ? 'receiveMalus' : 'receiveBonus');
                break;
        }
    }
    reset() { this.sprites.reset(); this.clearEffects(); }
    destroy() {
        this.lifecycle.abort();
        this.observer.disconnect();
        this.sprites.destroy();
        this.clearEffects();
        for (const { element, marker } of this.moved)
            marker.replaceWith(element);
        this.root.replaceChildren();
        this.root.classList.remove('classroom-scene', 'reduced-motion', 'scene-paused');
        this.root.parentElement.classList.remove('scene-viewport');
        this.root.style.removeProperty('width');
        this.root.style.removeProperty('height');
        this.root.parentElement.style.removeProperty('height');
        this.root.parentElement.style.removeProperty('overflow');
    }
}
