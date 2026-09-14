import { benchmarkClassroom } from '../engine/classroomBenchmark.js';
const args=process.argv.slice(2);
const options:Record<string,number>={};
for(let i=0;i<args.length;i+=2) {const key=args[i]!.replace(/^--/,'');if(!['rows','columns','ticks','lessons','seed'].includes(key) || args[i+1]===undefined) throw new Error('Options : --rows --columns --ticks --lessons --seed');options[key]=Number(args[i+1]);}
console.log(JSON.stringify(benchmarkClassroom(options),null,2));
