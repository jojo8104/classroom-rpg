import type { Curriculum } from '../domain.js';

export const curriculum: Curriculum = {
  programs: [ { id: 'general-primary', name: 'École des royaumes - enseignement primaire' }],
  subjects: [ { programId: 'general-primary', id: 'mathematics', name: 'Mathématiques' }],
  chapters: [ { id: 'fractions', subjectId: 'mathematics', name: 'Fractions' }],
  lessons: [ {
      complexity: 50, pressure: 70, requiredProgress: 100,
      id: 'introduction-to-fractions', topicId: 'fractions',
      name: 'Introduction aux fractions - provisions de voyage',
      tags: ['mathematics', 'sharing'],
      conceptPool: [{ conceptId: 'fraction', baseRate: 0.04 }, { conceptId: 'numerator', baseRate: 0.03 }, { conceptId: 'denominator', baseRate: 0.03 }],
      availableTeachingModes: ['lecture', 'exercise', 'homework', 'revision', 'assessment'],
      roundCount: 6,
      conceptIds: ['fraction', 'numerator', 'denominator'],
    }],
};
