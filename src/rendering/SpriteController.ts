import type { LogicalPosition } from './ClassroomProjection.js';
export const SPRITE_DIRECTIONS = { FRONT: 'front', BACK: 'back', LEFT: 'left', RIGHT: 'right', FRONT_LEFT: 'front-left', FRONT_RIGHT: 'front-right' } as const;
export type Direction = typeof SPRITE_DIRECTIONS[keyof typeof SPRITE_DIRECTIONS];
export const ANIMATIONS = ['idle','listen','work','attackLesson','help','encourage','distract','receiveBonus','receiveMalus','understand','fail'] as const;
export type SpriteAnimation = typeof ANIMATIONS[number];
export function getStudentOrientation(position: LogicalPosition, action: SpriteAnimation, target?: LogicalPosition): Direction {
  if (action === 'encourage') return 'front';
  if (action === 'understand') return position.column < 2 ? 'front-right' : position.column > 2 ? 'front-left' : 'front';
  if (target && ['help','distract','receiveBonus','receiveMalus'].includes(action)) {
    if (target.column !== position.column) return target.column < position.column ? 'left' : 'right';
    if (target.row !== position.row) return target.row < position.row ? 'back' : 'front';
  }
  // Every resting student faces the board; profiles are reserved for actual interactions.
  return 'back';
}
export interface SpriteState { animation: SpriteAnimation; direction: Direction; frame: number }
export interface SpriteManifest {
  id: string; frameWidth: number; frameHeight: number; directions: Direction[];
  animations: Partial<Record<SpriteAnimation, number>>;
  file?: string;
  files?: Partial<Record<SpriteAnimation, string>>;
}
interface Playback { state: SpriteState; remaining: number; duration: number; frames: number; returnTo: SpriteAnimation }
/** No permanent RAF: one timer only while actions with remaining frames exist. */
export class SpriteController {
  private active = new Map<string, Playback>();
  private rests = new Map<string, Direction>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private last = 0;
  private paused = false;
  constructor(private update: (id: string, state: SpriteState) => void, public manifest?: SpriteManifest) {}
  setRest(id: string, direction: Direction) { this.stop(id); this.rests.set(id, direction); this.idle(id); }
  private idle(id: string, animation: SpriteAnimation = 'idle') { this.update(id, { animation, direction: this.rests.get(id) ?? 'back', frame: 0 }); }
  play(id: string, options: { animation: SpriteAnimation; direction: Direction; duration: number; returnTo?: SpriteAnimation }) {
    if (options.duration <= 0) { this.stop(id); return; }
    const state = { animation: options.animation, direction: options.direction, frame: 0 };
    this.active.set(id, { state, remaining: options.duration, duration: options.duration, frames: this.manifest?.animations[options.animation] ?? 1, returnTo: options.returnTo ?? 'idle' });
    this.update(id, state); this.schedule();
  }
  private schedule() {
    if (this.timer !== undefined || this.paused || !this.active.size) return;
    this.last = Date.now();
    this.timer = setTimeout(() => {
      this.timer = undefined; this.advance(Date.now() - this.last); this.schedule();
    }, 80);
  }
  advance(milliseconds: number) {
    if (this.paused) return;
    for (const [id, p] of this.active) {
      p.remaining -= milliseconds;
      if (p.remaining <= 0) { this.active.delete(id); this.idle(id, p.returnTo); }
      else {
        const frame = Math.min(p.frames - 1, Math.floor((1 - p.remaining / p.duration) * p.frames));
        if (frame !== p.state.frame) { p.state.frame = frame; this.update(id, p.state); }
      }
    }
    if (!this.active.size) this.cancelTimer();
  }
  private cancelTimer() { if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; }
  pause() { this.paused = true; this.cancelTimer(); }
  resume() { this.paused = false; this.schedule(); }
  stop(id: string) { this.active.delete(id); this.idle(id); if (!this.active.size) this.cancelTimer(); }
  reset() { for (const id of this.active.keys()) this.idle(id); this.active.clear(); this.cancelTimer(); }
  get activeCount() { return this.active.size; }
  destroy() { this.reset(); this.rests.clear(); }
}
