export const SPRITE_DIRECTIONS = { FRONT: 'front', BACK: 'back', LEFT: 'left', RIGHT: 'right', FRONT_LEFT: 'front-left', FRONT_RIGHT: 'front-right' };
export const ANIMATIONS = ['idle', 'listen', 'work', 'attackLesson', 'help', 'encourage', 'distract', 'receiveBonus', 'receiveMalus', 'understand', 'fail'];
export function getStudentOrientation(position, action, target) {
    if (action === 'encourage')
        return 'front';
    if (action === 'understand')
        return position.column < 2 ? 'front-right' : position.column > 2 ? 'front-left' : 'front';
    if (target && ['help', 'distract', 'receiveBonus', 'receiveMalus'].includes(action)) {
        if (target.column !== position.column)
            return target.column < position.column ? 'left' : 'right';
        if (target.row !== position.row)
            return target.row < position.row ? 'back' : 'front';
    }
    // Every resting student faces the board; profiles are reserved for actual interactions.
    return 'back';
}
/** No permanent RAF: one timer only while actions with remaining frames exist. */
export class SpriteController {
    update;
    manifest;
    active = new Map();
    rests = new Map();
    timer;
    last = 0;
    paused = false;
    constructor(update, manifest) {
        this.update = update;
        this.manifest = manifest;
    }
    setRest(id, direction) { this.stop(id); this.rests.set(id, direction); this.idle(id); }
    idle(id, animation = 'idle') { this.update(id, { animation, direction: this.rests.get(id) ?? 'back', frame: 0 }); }
    play(id, options) {
        if (options.duration <= 0) {
            this.stop(id);
            return;
        }
        const state = { animation: options.animation, direction: options.direction, frame: 0 };
        this.active.set(id, { state, remaining: options.duration, duration: options.duration, frames: this.manifest?.animations[options.animation] ?? 1, returnTo: options.returnTo ?? 'idle' });
        this.update(id, state);
        this.schedule();
    }
    schedule() {
        if (this.timer !== undefined || this.paused || !this.active.size)
            return;
        this.last = Date.now();
        this.timer = setTimeout(() => {
            this.timer = undefined;
            this.advance(Date.now() - this.last);
            this.schedule();
        }, 80);
    }
    advance(milliseconds) {
        if (this.paused)
            return;
        for (const [id, p] of this.active) {
            p.remaining -= milliseconds;
            if (p.remaining <= 0) {
                this.active.delete(id);
                this.idle(id, p.returnTo);
            }
            else {
                const frame = Math.min(p.frames - 1, Math.floor((1 - p.remaining / p.duration) * p.frames));
                if (frame !== p.state.frame) {
                    p.state.frame = frame;
                    this.update(id, p.state);
                }
            }
        }
        if (!this.active.size)
            this.cancelTimer();
    }
    cancelTimer() { if (this.timer !== undefined)
        clearTimeout(this.timer); this.timer = undefined; }
    pause() { this.paused = true; this.cancelTimer(); }
    resume() { this.paused = false; this.schedule(); }
    stop(id) { this.active.delete(id); this.idle(id); if (!this.active.size)
        this.cancelTimer(); }
    reset() { for (const id of this.active.keys())
        this.idle(id); this.active.clear(); this.cancelTimer(); }
    get activeCount() { return this.active.size; }
    destroy() { this.reset(); this.rests.clear(); }
}
