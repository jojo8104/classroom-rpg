// Mulberry32 : état entier 32 bits, indépendant de l'horloge et de Math.random.
export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
      throw new Error('La seed doit être un entier entre 0 et 4294967295.');
    }
    this.state = seed;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  integer(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1) {
      throw new Error('La borne aléatoire doit être un entier strictement positif.');
    }
    return Math.floor(this.next() * maxExclusive);
  }
}
