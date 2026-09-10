import type { PrototypeScenario } from '../domain.js';

// Une nouvelle instance à chaque appel évite de partager un état mutable entre tests.
export function createPrototype(): PrototypeScenario {
  const names = ['Alice', 'Paul', 'Léa', 'Hugo', 'Emma', 'Louis', 'Inès', 'Adam', 'Chloé'];
  const archetypeIds = ['offensive', 'defensive', 'support'];
  return {
    teacher: { id: 'teacher', pedagogy: 60, authority: 60, patience: 70 },
    classroom: {
      id: 'classroom', rows: 3, columns: 3,
      seats: Array.from({ length: 9 }, (_, index) => ({
        id: `seat-${index + 1}`, row: Math.floor(index / 3), column: index % 3,
      })),
    },
    students: names.map((name, index) => ({
      id: `student-${index + 1}`, name,
      intelligence: 45 + index * 4, discipline: 50 + index * 3,
      concentration: 55 + index * 2, morale: 65,
      archetypeId: archetypeIds[index % 3]!, seatId: `seat-${index + 1}`,
    })),
    archetypes: [
      { id: 'offensive', name: 'Offensif' },
      { id: 'defensive', name: 'Défensif' },
      { id: 'support', name: 'Support' },
    ],
    subject: { id: 'mathematics', name: 'Mathématiques' },
    topic: { id: 'fractions', subjectId: 'mathematics', name: 'Fractions' },
    lesson: {
      id: 'introduction-to-fractions', topicId: 'fractions',
      name: 'Introduction aux fractions',
      chapters: [
        { id: 'discover', name: 'Découvrir', roundCount: 3 },
        { id: 'understand', name: 'Comprendre', roundCount: 3 },
      ],
      conceptIds: ['fraction', 'numerator', 'denominator'],
    },
    concepts: [
      { id: 'fraction', name: 'Fraction' },
      { id: 'numerator', name: 'Numérateur' },
      { id: 'denominator', name: 'Dénominateur' },
    ],
  };
}
