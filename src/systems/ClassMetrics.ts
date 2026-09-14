import type { Student, StudentLessonState } from '../domain.js';
export function getClassMetrics(students: readonly Student[],states: readonly StudentLessonState[]) {
  const present=new Map(students.filter(s=>s.present!==false).map(s=>[s.id,s]));
  const active=states.filter(s=>present.has(s.studentId));
  const average=(values:number[])=>values.length ? Math.round(values.reduce((a,b)=>a+b,0)/values.length*100)/100 : 0;
  const distribution={struggling:0,partial:0,acquired:0,mastered:0};
  for(const state of active) distribution[state.lessonUnderstanding<25 ? 'struggling' : state.lessonUnderstanding<50 ? 'partial' : state.lessonUnderstanding<80 ? 'acquired' : 'mastered']++;
  return {count:active.length,averageProgress:average(active.map(s=>s.lessonUnderstanding)),averageMorale:average(active.map(s=>s.morale)),
    averageConcentration:average(active.map(s=>s.concentration)),averageDiscipline:average(active.map(s=>present.get(s.studentId)!.discipline)),distribution};
}
