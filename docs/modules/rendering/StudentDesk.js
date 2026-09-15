export const progressTier = (value) => Math.min(4, Math.floor(Math.max(0, value) / 25));
const tiers = ['Perdu', 'Premiers acquis', 'Compréhension partielle', 'Presque acquis', 'Maîtrisé'];
export class StudentDesk {
    student;
    position;
    element = document.createElement('button');
    orientation = 'back';
    animation = 'idle';
    constructor(student, position) {
        this.student = student;
        this.position = position;
        const e = this.element;
        e.type = 'button';
        e.id = student.id;
        e.className = `student-desk seat ${student.archetypeId}`;
        e.innerHTML = '<span class="desk-shadow"></span><span class="student-sprite" aria-hidden="true"></span><span class="desk-chair"></span><span class="desk-surface"></span><span class="desk-info"><strong></strong><b></b><progress max="100" value="0"></progress><span class="learning-state"></span><span class="effect-count"></span></span><span class="seat-feedback" aria-hidden="true"></span>';
        e.querySelector('strong').textContent = student.name;
        e.querySelector('progress').setAttribute('aria-label', `Compréhension de ${student.name}`);
        this.setOrientation('back');
        this.playAnimation('idle');
    }
    setOrientation(direction) { this.orientation = direction; this.element.dataset.direction = direction; }
    playAnimation(animation) { this.animation = animation; this.element.dataset.animation = animation; }
    renderSprite(state, manifest) {
        this.setOrientation(state.direction);
        this.playAnimation(state.animation);
        this.element.style.setProperty('--sprite-frame', String(state.frame));
        if (manifest) {
            const sprite = this.element.querySelector('.student-sprite');
            const frames = manifest.animations[state.animation] ?? 1;
            const direction = Math.max(0, manifest.directions.indexOf(state.direction));
            sprite.style.backgroundImage = `url('./assets/students/${manifest.id}/${manifest.files?.[state.animation] ?? manifest.file ?? 'idle_atlas.png'}')`;
            sprite.style.backgroundSize = `${manifest.directions.length * 100}% ${frames * 100}%`;
            sprite.style.backgroundPosition = `${direction * 100 / Math.max(1, manifest.directions.length - 1)}% ${state.frame * 100 / Math.max(1, frames - 1)}%`;
        }
    }
    render(state, progress, selected) {
        const e = this.element;
        e.setAttribute('aria-pressed', String(selected));
        e.setAttribute('aria-label', `${this.student.name}, compréhension ${progress} %, ${state.concentration === 0 ? 'décroché' : tiers[progressTier(progress)]}`);
        e.querySelector('b').textContent = `${Math.round(progress)} %`;
        e.querySelector('progress').value = progress;
        e.querySelector('.learning-state').textContent = state.concentration === 0 ? 'Repos' : tiers[progressTier(progress)];
        e.querySelector('.effect-count').textContent = state.effects.length ? `✦ ${state.effects.length}` : '';
        e.dataset.tier = String(progressTier(progress));
        e.classList.toggle('disengaged', state.concentration === 0);
    }
}
