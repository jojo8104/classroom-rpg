import { describe,it,expect,vi } from 'vitest';
import { CLASSROOM_CONFIG } from '../src/data/classroomConfig.js';
import { createFullClassPrototype } from '../src/data/fullClassPrototype.js';
import { createPreparationPrototype } from '../src/data/preparationPrototype.js';
import { createLayout,generateSeats,renderPosition } from '../src/models/ClassroomLayout.js';
import { ClassroomLayoutSystem } from '../src/systems/ClassroomLayoutSystem.js';
import { TargetingSystem } from '../src/systems/TargetingSystem.js';
import { PlacementEvaluationSystem } from '../src/systems/PlacementEvaluationSystem.js';
import { RelationIndex } from '../src/systems/RelationIndex.js';
import { getRelation,modifyRelation } from '../src/engine/social.js';
import { ClassPreparation,type PlanStorage } from '../src/systems/ClassPreparation.js';
import { getClassMetrics } from '../src/systems/ClassMetrics.js';
import { createLessonStates } from '../src/engine/combat.js';
import { createClassroomActionRules } from '../src/data/rules.js';
import { Simulation } from '../src/engine/simulation.js';
import { ActionQueue } from '../src/engine/actions.js';
import { benchmarkClassroom } from '../src/engine/classroomBenchmark.js';
import { visualEvents } from '../src/ui/eventPlayback.js';

const memory=():PlanStorage=>{const values=new Map<string,string>();return {getItem:key=>values.get(key) ?? null,setItem:(key,value)=>{values.set(key,value);}};};
describe('Roadmap 7 : classe complète',()=>{
  it('génère des identifiants stables et des zones proportionnelles configurables',()=>{
    const seats=generateSeats(CLASSROOM_CONFIG.rows,CLASSROOM_CONFIG.columns);
    expect(seats).toHaveLength(CLASSROOM_CONFIG.maxStudents);
    expect(seats.filter(s=>s.frontRow)).toHaveLength(10);
    expect(seats.filter(s=>s.backRow)).toHaveLength(10);
    expect(seats.filter(s=>s.tags.includes('center'))).toHaveLength(5);
    expect(seats.filter(s=>s.nearDoor)).toHaveLength(5);
    expect(generateSeats(5,5)).toEqual(seats);
    expect(generateSeats(5,5,{windowEdge:'back',doorEdge:'none'}).filter(s=>s.nearWindow)).toHaveLength(5);
    expect(generateSeats(5,5,{windowEdge:'back',doorEdge:'none'}).some(s=>s.nearDoor)).toBe(false);
    expect(renderPosition(seats[12]!)).toEqual({row:2,column:2,depth:2});
  });
  it('propose des profils variés et des relations sparse positives et négatives',()=>{
    const s=createFullClassPrototype();
    expect(s.students).toHaveLength(25);
    expect(new Set(s.students.map(s=>s.intelligence)).size).toBeGreaterThan(12);
    expect(new Set(s.students.map(s=>s.archetypeId)).size).toBe(s.archetypes.length);
    expect(new Set(s.students.map(s=>s.knowledge!.fraction)).size).toBeGreaterThan(12);
    expect(s.students.every(s=>!s.seatId)).toBe(true);
    expect(s.classRelations!.links.length).toBeLessThan(s.students.length*(s.students.length-1)/2);
    expect(s.classRelations!.links.some(l=>l.score<0)).toBe(true);
    expect(s.classRelations!.links.some(l=>l.score>60)).toBe(true);
    expect(createFullClassPrototype()).toEqual(s);
  });
  it.each([[3,3],[4,4],[5,5],[5,6]])('cible et simule une grille %i×%i complète', (rows,columns)=>{
    const s=createFullClassPrototype({rows,columns,maxStudents:rows*columns});
    const system=new ClassroomLayoutSystem(s.classroom.currentLayout!);
    expect(system.getNeighbors('student-1').direct).toEqual(['student-2',`student-${columns+1}`]);
    expect(system.getStudentsInRow(rows-1)).toHaveLength(columns);
    expect(system.getStudentsInColumn(columns-1)).toHaveLength(rows);
    const result=new Simulation(s,702,createClassroomActionRules(s.students.length)).runToCompletion();
    expect(result.results).toHaveLength(rows*columns);
    for(const event of result.events) if(event.type==='REACTION_TRIGGERED' || event.type==='EFFECT_APPLIED' || event.type==='DISRUPTION_RESOLVED') expect(system.getNeighbors(event.sourceId).direct).toContain(event.targetId);
  });
  it('retrouve les voisins sans parcourir les sièges et conserve la topologie après échange',()=>{
    const system=new ClassroomLayoutSystem(createLayout(5,5,Array.from({length:25},(_,i)=>String(i))));
    const spy=vi.spyOn(Array.prototype,'find');
    for(let i=0;i<100;i++) expect(system.getNeighbors('12').direct).toEqual(['7','11','13','17']);
    expect(spy).not.toHaveBeenCalled();spy.mockRestore();
    system.swapStudents('0','12');
    expect(system.getNeighbors('0').direct).toEqual(['7','11','13','17']);
    expect(system.topologyBuilds).toBe(1);
  });
  it('formalise les portées, filtres et rayons de Manhattan',()=>{
    const system=new ClassroomLayoutSystem(createLayout(5,5,Array.from({length:25},(_,i)=>String(i))));
    const targeting=new TargetingSystem(system);
    const get=(rangeType:Parameters<TargetingSystem['getTargets']>[0]['rangeType'])=>targeting.getTargets({sourceStudentId:'12',rangeType});
    expect(get('SELF')).toEqual(['12']);expect(get('ADJACENT')).toEqual(['7','11','13','17']);
    expect(get('DIAGONAL')).toEqual(['6','8','16','18']);expect(get('ROW')).toEqual(['10','11','13','14']);expect(get('COLUMN')).toEqual(['2','7','17','22']);
    expect(get('RADIUS')).toEqual(get('ADJACENT'));expect(get('GLOBAL')).toHaveLength(24);
    expect(targeting.getTargets({sourceStudentId:'12',rangeType:'RADIUS',rangeValue:0,includeSource:true})).toEqual(['12']);
    expect(targeting.getTargets({sourceStudentId:'12',rangeType:'GLOBAL',filters:[id=>Number(id)%2===0]})).toHaveLength(12);
    expect(()=>targeting.getTargets({sourceStudentId:'12',rangeType:'RADIUS',rangeValue:-1})).toThrow();
    expect(targeting.getTargets({sourceStudentId:'absent',rangeType:'GLOBAL'})).toEqual([]);
  });
  it('ignore les sièges vides et les absents dans toutes les portées actives',()=>{
    const s=createFullClassPrototype();s.students[0]!.present=false;s.students[1]!.present=false;
    const simulation=new Simulation(s,702,createClassroomActionRules(s.students.length));
    const system=new ClassroomLayoutSystem(simulation.layoutSnapshot),targeting=new TargetingSystem(system);
    expect(system.getStudentsInRow(0)).toHaveLength(3);
    expect(system.getNeighbors('student-3').direct).not.toContain('student-2');
    expect(targeting.getTargets({sourceStudentId:'student-3',rangeType:'GLOBAL',includeSource:true})).toHaveLength(23);
    expect(simulation.runToCompletion().results).toHaveLength(23);
  });
  it('retourne une relation neutre absente et indexe les liens créés ensuite',()=>{
    const relations={links:[{from:'A',to:'B',score:10}]};const index=new RelationIndex(relations);
    expect(index.getRelation('B','A')).toBe(0);expect(getRelation(relations,'B','A')).toBe(0);
    modifyRelation(relations,'A','B',12);expect(index.getRelation('A','B')).toBe(22);
    modifyRelation(relations,'B','A',-17);expect(index.getRelation('B','A')).toBe(-17);
  });
  it('recalcule uniquement les occupants déplacés et leurs voisins',()=>{
    const s=createFullClassPrototype(),system=new ClassroomLayoutSystem(s.classroom.currentLayout!),evaluation=new PlacementEvaluationSystem(s,system);
    const spy=vi.spyOn(evaluation,'previewPlacement');
    const source=system.getStudentSeat('student-1')!,target=system.getStudentSeat('student-13')!;
    system.swapStudents('student-1','student-13');
    const affected=evaluation.recalculateAffectedPlacements([source.id,target.id]);
    const expected=new Set(['student-1','student-13',...system.getNeighbors('student-1').direct,...system.getNeighbors('student-13').direct]);
    expect(new Set(affected.keys())).toEqual(expected);expect(spy).toHaveBeenCalledTimes(expected.size);expect(affected.size).toBeLessThan(s.students.length);
    const before=system.currentLayout;evaluation.previewPlacement('student-1','seat_0_4');expect(system.currentLayout).toEqual(before);
  });
  it('migre un plan 3×3 vers 5×5 sans perdre profils, verrous, relations ni positions',()=>{
    const store=memory(),old=createPreparationPrototype(),prep=new ClassPreparation(old,store);
    prep.moveStudent('student-1','seat-5');prep.setLocked('seat-5',true);old.students[0]!.knowledge!.fraction=97;prep.save();
    const grown=new ClassPreparation(createFullClassPrototype(),store);
    expect(grown.scenario.students).toHaveLength(25);expect(grown.system.dimensions).toEqual({rows:5,columns:5});
    expect(grown.system.getStudentSeat('student-1')).toMatchObject({row:1,column:1,locked:true});
    expect(grown.scenario.students.find(s=>s.id==='student-1')!.knowledge!.fraction).toBe(97);
    expect(grown.system.validateLayout(grown.scenario.students)).toEqual([]);
    grown.save();expect(new ClassPreparation(createFullClassPrototype(),store).system.currentLayout).toEqual(grown.system.currentLayout);
    grown.reset();expect(grown.system.getStudentSeat('student-1')).toMatchObject({row:0,column:0,locked:false});
  });
  it('calcule les indicateurs à partir des états individuels et gère une classe vide',()=>{
    const s=createFullClassPrototype({rows:1,columns:4,maxStudents:4}),states=createLessonStates(s.students,s.lesson);
    [0,30,60,90].forEach((value,i)=>{states[i]!.lessonUnderstanding=value;});
    expect(getClassMetrics(s.students,states)).toMatchObject({averageProgress:45,distribution:{struggling:1,partial:1,acquired:1,mastered:1}});
    expect(getClassMetrics([],[])).toMatchObject({count:0,averageProgress:0,averageMorale:0,averageConcentration:0,averageDiscipline:0});
  });
  it('borne la file et la profondeur, même avec un cycle d’actions supplémentaires',()=>{
    const rules=createClassroomActionRules(3),queue=new ActionQueue(rules);
    expect(queue.dequeue()).toBeUndefined();
    ['A','B','C'].forEach(actorId=>queue.enqueue({actorId,kind:'WORK',depth:0}));
    let count=0,action;
    while((action=queue.dequeue())) {count++;queue.enqueue({actorId:['B','C','A'][count%3]!,kind:'WORK',depth:action.depth+1});}
    expect(count).toBeLessThanOrEqual(rules.maxActionsPerRound);expect(queue.metrics.maximumDepth).toBeLessThanOrEqual(rules.maxChainDepth);
    expect(queue.metrics.maximumSize).toBe(3);
  });
  it('permet un ordre mélangé reproductible sans supprimer les premières actions',()=>{
    const s=createFullClassPrototype(),rules=createClassroomActionRules(s.students.length);rules.actionOrder='SHUFFLED';
    const first=new Simulation(s,17,rules).resolveTick(),second=new Simulation(s,17,rules).resolveTick();
    expect(first).toEqual(second);
    const ids=first.flatMap(e=>e.type==='STUDENT_ACTION' && !e.extra ? [e.actorId] : []);
    expect(new Set(ids).size).toBe(s.students.length);
    expect(ids).not.toEqual(s.students.map(s=>s.id));
    expect(first.every(e=>e.priority)).toBe(true);
  });
  it('agrège la présentation sans modifier les événements ni les résultats',()=>{
    const s=createFullClassPrototype(),sim=new Simulation(s,17,createClassroomActionRules(s.students.length)),events=sim.resolveTick(),copy=structuredClone(events);
    expect(visualEvents(events,'compact').length).toBeLessThanOrEqual(5);
    expect(visualEvents(events,'instant').map(e=>e.type)).toEqual(['ROUND_ENDED']);
    expect(visualEvents(events,'detailed')).toEqual(events);expect(events).toEqual(copy);
  });
  it('mesure 25 élèves sur 100 ticks avec des dynamiques différentes et une file bornée',()=>{
    const report=benchmarkClassroom({ticks:100});
    expect(report.ticks).toBe(100);expect(report.students).toBe(25);expect(report.mainActions).toBe(2500);
    expect(report.interactions).toBeGreaterThan(0);expect(report.positiveEffects).toBeGreaterThan(0);expect(report.negativeEffects).toBeGreaterThan(0);
    expect(report.maximumQueue).toBeLessThanOrEqual(report.queueBudget);expect(report.maximumChain).toBeLessThanOrEqual(report.chainBudget);
    expect(report.events).toBeLessThan(report.ticks*report.queueBudget*100);
    expect(report.averageTickMs).toBeLessThan(150);
    expect(new Set(Object.values(report.behavior).map(b=>JSON.stringify(b))).size).toBeGreaterThan(5);
    expect(Object.values(report.behavior).some(b=>b.support>0)).toBe(true);expect(Object.values(report.behavior).some(b=>b.disrupt>0)).toBe(true);
  },30000);
});
