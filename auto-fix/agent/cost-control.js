'use strict';
const fs=require('fs'),path=require('path');
const PRICES={'gpt-4o-mini':{input:0.00015,output:0.0006},'gpt-4o':{input:0.005,output:0.015}};
const SIMPLE='simple',COMPLEX='complex';
const SIMPLE_PATTERNS=['classification','log normalization','duplicate detection','small test generation','fingerprint','deduplication','test generation'];
function classifyTask(t,c){const s=(t+' '+c).toLowerCase();for(const p of SIMPLE_PATTERNS)if(s.includes(p))return SIMPLE;if(/(root[- ]cause|debug|architecture|concurrency|difficult)/i.test(s))return COMPLEX;if(/simple|test/i.test(s))return SIMPLE;return COMPLEX}
function getModel(complexity,cfg){return complexity===SIMPLE?(cfg.simpleModel||'gpt-4o-mini'):(cfg.complexModel||'gpt-4o')}
function getPricing(model,p){return p[model]||PRICES[model]||(()=>{throw new Error('No pricing for '+model)})()}
function calcCost(model,inTok,outTok,p){const pr=getPricing(model,p);return(inTok/1000)*pr.input+(outTok/1000)*pr.output}
const calculateCost=calcCost;
const COMPLEXITY_SIMPLE=SIMPLE;
const COMPLEXITY_COMPLEX=COMPLEX;

function publicJobUsage(job){return{...job,inputTokens:job.input,outputTokens:job.output}}

function publicDailyUsage(usage){return{...usage,jobs:usage.jobs.map((job)=>({...job}))}}

function dailyUsageFile(b){return path.join(b,'agent','cost-daily.json')}
function loadDaily(b){const f=dailyUsageFile(b);try{const d=JSON.parse(fs.readFileSync(f,'utf8'));const t=new Date().toISOString().slice(0,10);if(d.date!==t)return{date:t,totalCost:0,jobs:[]};return d}catch(_){return{date:new Date().toISOString().slice(0,10),totalCost:0,jobs:[]}}}
function saveDaily(b,u){const f=dailyUsageFile(b);const d=path.dirname(f);if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});fs.writeFileSync(f,JSON.stringify(u,null,2),'utf8')}
class CostController{constructor({baseDir,policy={}}){this.baseDir=baseDir||process.cwd();this.policy=policy;this.cfg=policy.cost||{};this.daily=loadDaily(this.baseDir);this.jobs={}}
classifyTask(t,c){return classifyTask(t,c)}
getModel(complexity){return getModel(complexity,this.cfg)}
getTokenLimit(complexity){const key=complexity===SIMPLE?'simpleTokenLimitPerJob':'complexTokenLimitPerJob';return this.cfg[key]||(complexity===SIMPLE?10000:50000)}
canStartJob(id,t,c=''){const complexity=this.classifyTask(t,c);const model=this.getModel(complexity);const limit=this.getTokenLimit(complexity);const maxJob=this.cfg.maxJobCost||1.0;const maxDaily=this.cfg.maxDailyCost||10.0;if(this.jobs[id])return this.canContinueJob(id);if(this.daily.totalCost>=maxDaily)return{allowed:false,reason:'daily-budget-exceeded',dailyTotal:this.daily.totalCost,maxDaily};return{allowed:true,complexity,model,tokenLimit:limit,maxJobCost:maxJob,reason:'ok'}}
canContinueJob(id){const job=this.jobs[id];if(!job)return{allowed:false,reason:'job-not-found'};const limit=this.getTokenLimit(job.complexity);const maxJob=this.cfg.maxJobCost||1.0;if(job.input+job.output>=limit)return{allowed:false,reason:'job-token-limit-exceeded',used:job.input+job.output,limit};if(job.cost>=maxJob)return{allowed:false,reason:'job-cost-limit-exceeded',cost:job.cost,limit:maxJob};const maxDaily=this.cfg.maxDailyCost||10.0;if(this.daily.totalCost>=maxDaily)return{allowed:false,reason:'daily-budget-exceeded',dailyTotal:this.daily.totalCost,maxDaily};return{allowed:true,reason:'ok'}}
recordUsage(id,inTok,outTok,extra=0){let job=this.jobs[id];if(!job){job={model:this.getModel(COMPLEX),complexity:COMPLEX,taskType:'unknown',startedAt:new Date().toISOString(),input:0,output:0,cost:0};this.jobs[id]=job}const model=job.model;const cost=calcCost(model,inTok,outTok,this.cfg.pricing||{})+extra;job.input+=inTok;job.output+=outTok;job.cost+=cost;this.daily.totalCost+=cost;let entry=this.daily.jobs.find(j=>j.jobId===id);if(entry){entry.inputTokens=job.input;entry.outputTokens=job.output;entry.cost=job.cost;entry.updatedAt=new Date().toISOString()}else{this.daily.jobs.push({jobId:id,taskType:job.taskType,complexity:job.complexity,model:job.model,inputTokens:job.input,outputTokens:job.output,cost:job.cost,startedAt:job.startedAt,updatedAt:new Date().toISOString()})}saveDaily(this.baseDir,this.daily);return{job,dailyTotal:this.daily.totalCost}}
startJob(id,t,c=''){const ch=this.canStartJob(id,t,c);if(!ch.allowed)return ch;const complexity=ch.complexity;const model=this.getModel(complexity);this.jobs[id]={jobId:id,taskType:t,complexity,model,startedAt:new Date().toISOString(),input:0,output:0,cost:0};return{allowed:true,complexity,model,tokenLimit:this.getTokenLimit(complexity),maxJobCost:this.cfg.maxJobCost||1.0}}
resetDaily(){const today=new Date().toISOString().slice(0,10);this.daily={date:today,totalCost:0,jobs:[]};saveDaily(this.baseDir,this.daily)}
getDailyUsage(){return publicDailyUsage(this.daily)}
getJobUsage(id){return this.jobs[id]?publicJobUsage(this.jobs[id]):null}
stats(){return{dailyTotalCost:this.daily.totalCost,activeJobs:Object.keys(this.jobs).length,dailyJobs:this.daily.jobs.length}}}
module.exports={CostController,classifyTask,getModel,calcCost,calculateCost,SIMPLE,COMPLEX,COMPLEXITY_SIMPLE,COMPLEXITY_COMPLEX};