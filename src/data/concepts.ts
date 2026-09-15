import type { Concept } from '../domain.js';

export const conceptCatalog: Concept[] = [
  { id: 'fraction', name: 'Fraction', description: 'Partager équitablement les provisions d’une expédition.', tags: ['mathematics', 'sharing'], effects: [{ type: 'learning_boost', tags: ['mathematics'], value: 0.10 }] },
  { id: 'numerator', name: 'Numérateur', description: 'Compter les parts prélevées dans une réserve.', tags: ['mathematics', 'counting'], effects: [] },
  { id: 'denominator', name: 'Dénominateur', description: 'Reconnaître le nombre de parts égales d’un tout.', tags: ['mathematics', 'sharing'], effects: [] },
];
