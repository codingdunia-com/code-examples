import os from 'node:os';
const jsonClone = (o) => JSON.parse(JSON.stringify(o));
const R=(n,f)=>Array.from({length:n},(_,i)=>f(i));
const recs=(n)=>R(n,i=>({id:i,name:'user-'+i,email:'u'+i+'@example.com',active:i%3===0,score:i*1.5,tags:['a','b','c']}));

const cases=[
 ['8-key config object',{id:7,name:'checkout',qty:2,price:19.99,active:true,sku:'ABC-123',tags:['sale'],meta:{source:'web'}}],
 ['array of 10,000 records',recs(10000)],
 ['array of 10,000 strings, 200 chars each',R(10000,i=>'x'.repeat(200)+i)],
 ['array of 100,000 numbers',R(100000,i=>i*0.5)],
 ['Float64Array, 100,000 items',Float64Array.from(R(100000,i=>i))],
];
function once(fn,p,ms){for(let i=0;i<50;i++)fn(p);const s=[];const dl=performance.now()+ms;
 while(performance.now()<dl&&s.length<200000){const t=performance.now();fn(p);s.push(performance.now()-t);}
 s.sort((a,b)=>a-b);return s[s.length>>1];}
function stable(fn,p){const m=R(5,()=>once(fn,p,700)).sort((a,b)=>a-b);return m[2];}

console.log('node '+process.version+' | '+os.cpus()[0].model+' | '+new Date().toISOString().slice(0,10));
console.log('| payload | JSON.parse(JSON.stringify()) | structuredClone() |');
console.log('| --- | --- | --- |');
const out=[];
for(const [l,p] of cases){
 let j; try{j=stable(jsonClone,p);}catch(e){j=null;}
 const s=stable(structuredClone,p);
 const f=(x)=>x<0.01?x.toFixed(4)+' ms':x<1?x.toFixed(3)+' ms':x.toFixed(2)+' ms';
 out.push([l,j,s]);
 console.log('| '+l+' | '+(j===null?'throws':f(j))+' | '+f(s)+' |'+(j!==null?'  // structuredClone '+(j/s).toFixed(1)+'x faster':''));
}
console.log('\nJSON fidelity (probe without BigInt / cycles / functions):');
const probe={date:new Date('2026-08-23T00:00:00Z'),map:new Map([['a',1]]),set:new Set([1,2]),undef:undefined,inf:Infinity,nan:NaN,regex:/ab+c/gi,bytes:new Uint8Array([1,2,3])};
const jf=jsonClone(probe);
console.log(JSON.stringify(jf));
console.log('undefined key present after JSON:', 'undef' in jf);

console.log('\ndeep nesting cliff:');
const deep=(d)=>{let o={leaf:1};for(let i=0;i<d;i++)o={c:o};return o;};
let lo=1000,hi=5000; // find structuredClone limit
const okS=(d)=>{try{structuredClone(deep(d));return true;}catch(e){return false;}};
const okJ=(d)=>{try{jsonClone(deep(d));return true;}catch(e){return false;}};
while(hi-lo>10){const m=(lo+hi)>>1; if(okS(m))lo=m; else hi=m;}
console.log('structuredClone RangeError at depth ~'+hi+' (ok at '+lo+')');
lo=1000;hi=20000;
while(hi-lo>50){const m=(lo+hi)>>1; if(okJ(m))lo=m; else hi=m;}
console.log('JSON RangeError at depth ~'+hi+' (ok at '+lo+')');
