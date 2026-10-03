import type { Waveform } from './media-waveform';

export type TempoAnalysis = {
  version: 1;
  bpm: number;
  confidence: number;
  halfBpm: number | null;
  doubleBpm: number | null;
  downbeatMs: number;
  downbeatConfidence: number;
  analyzedAt: string;
  manualDownbeat?: boolean;
};

type Candidate = { bpm: number; lag: number; score: number };

const clamp = (value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const roundTempo = (value:number)=>Math.round(value*10)/10;

function onsetEnvelope(wave: Waveform) {
  const sampleMs = wave.durationMs / Math.max(1, wave.peaks.length);
  const maxSamples = Math.min(wave.peaks.length, Math.max(1, Math.floor(240_000 / sampleMs)));
  const source = wave.peaks.slice(0,maxSamples);
  const envelope = new Float64Array(source.length);
  let maximum = 0;
  for(let i=0;i<source.length;i++){
    let baseline=0,count=0;
    for(let back=1;back<=6;back++){
      if(i-back<0)break;
      baseline+=source[i-back];count++;
    }
    baseline=count?baseline/count:0;
    const rise=Math.max(0,source[i]-baseline*.82);
    const transient=Math.max(0,source[i]-(source[i-1]??0));
    const value=rise*.7+transient*.3;
    envelope[i]=value;
    maximum=Math.max(maximum,value);
  }
  if(maximum>0)for(let i=0;i<envelope.length;i++)envelope[i]/=maximum;
  return { envelope, sampleMs };
}

function correlation(envelope: Float64Array, lag:number) {
  const rounded=Math.max(1,Math.round(lag));
  if(rounded>=envelope.length-4)return 0;
  let dot=0,left=0,right=0;
  for(let i=rounded;i<envelope.length;i++){
    const a=envelope[i],b=envelope[i-rounded];
    dot+=a*b;left+=a*a;right+=b*b;
  }
  return left>0&&right>0?dot/Math.sqrt(left*right):0;
}

function candidateForLag(envelope:Float64Array,sampleMs:number,lag:number):Candidate{
  return {bpm:60000/(lag*sampleMs),lag,score:correlation(envelope,lag)};
}

function chooseCanonical(candidates:Candidate[]){
  const sorted=[...candidates].sort((a,b)=>b.score-a.score);
  let best=sorted[0];
  if(!best)return null;
  const near=(target:number)=>candidates.reduce<Candidate|null>((found,item)=>
    Math.abs(item.bpm-target)<Math.abs((found?.bpm??Infinity)-target)?item:found,null);
  if(best.bpm<72){
    const doubled=near(best.bpm*2);
    if(doubled&&doubled.bpm<=180&&doubled.score>=best.score*.88)best=doubled;
  }else if(best.bpm>180){
    const halved=near(best.bpm/2);
    if(halved&&halved.bpm>=55&&halved.score>=best.score*.88)best=halved;
  }
  const musical=sorted.find(item=>item.bpm>=72&&item.bpm<=175&&item.score>=best.score*.94);
  return musical??best;
}

function phaseAnalysis(envelope:Float64Array,lag:number,sampleMs:number){
  const beat=Math.max(2,Math.round(lag));
  const phaseScores=new Float64Array(beat);
  for(let i=0;i<envelope.length;i++)phaseScores[i%beat]+=envelope[i];
  let phase=0,phaseMax=-1,total=0;
  for(let i=0;i<phaseScores.length;i++){
    const smooth=phaseScores[i]+phaseScores[(i+beat-1)%beat]*.5+phaseScores[(i+1)%beat]*.5;
    total+=phaseScores[i];
    if(smooth>phaseMax){phaseMax=smooth;phase=i;}
  }

  const barScores=[0,0,0,0];
  let beatCount=0;
  for(let sample=phase;sample<envelope.length;sample+=beat){
    let local=0;
    for(let d=-2;d<=2;d++)if(sample+d>=0&&sample+d<envelope.length)local=Math.max(local,envelope[sample+d]);
    barScores[beatCount%4]+=local;
    beatCount++;
  }
  let barIndex=0;
  for(let i=1;i<4;i++)if(barScores[i]>barScores[barIndex])barIndex=i;
  const barTotal=barScores.reduce((sum,value)=>sum+value,0);
  const sortedBars=[...barScores].sort((a,b)=>b-a);
  const downbeatConfidence=barTotal>0?clamp((sortedBars[0]-sortedBars[1])/(sortedBars[0]+1e-9),0,1):0;
  return {
    downbeatMs:(phase+barIndex*beat)*sampleMs,
    phaseConfidence:total>0?clamp(phaseMax/(total*1.6),0,1):0,
    downbeatConfidence
  };
}

export function analyzeTempo(wave:Waveform):TempoAnalysis {
  if(!wave.peaks.length||!Number.isFinite(wave.durationMs)||wave.durationMs<=0)throw Error('Waveform is empty.');
  const {envelope,sampleMs}=onsetEnvelope(wave);
  const candidates:Candidate[]=[];
  const minLag=Math.max(2,Math.floor(60000/220/sampleMs));
  const maxLag=Math.min(envelope.length-5,Math.ceil(60000/50/sampleMs));
  for(let lag=minLag;lag<=maxLag;lag++)candidates.push(candidateForLag(envelope,sampleMs,lag));
  const best=chooseCanonical(candidates);
  if(!best)throw Error('Tempo could not be analyzed.');
  const sorted=[...candidates].sort((a,b)=>b.score-a.score);
  const second=sorted.find(item=>Math.abs(item.bpm-best.bpm)>3&&Math.abs(item.bpm-best.bpm*2)>4&&Math.abs(item.bpm-best.bpm/2)>2)??sorted[1]??best;
  const separation=best.score>0?clamp((best.score-second.score)/best.score,0,1):0;
  const phase=phaseAnalysis(envelope,best.lag,sampleMs);
  const confidence=clamp(best.score*.62+separation*.23+phase.phaseConfidence*.15,0,1);
  const bpm=roundTempo(best.bpm);
  return {
    version:1,
    bpm,
    confidence,
    halfBpm:bpm/2>=20?roundTempo(bpm/2):null,
    doubleBpm:bpm*2<=300?roundTempo(bpm*2):null,
    downbeatMs:Math.max(0,Math.round(phase.downbeatMs)),
    downbeatConfidence:phase.downbeatConfidence,
    analyzedAt:new Date().toISOString()
  };
}

export function correctedDownbeat(analysis:TempoAnalysis,downbeatMs:number):TempoAnalysis{
  return {...analysis,downbeatMs:Math.max(0,Math.round(downbeatMs)),manualDownbeat:true};
}
