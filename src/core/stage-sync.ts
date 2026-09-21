import type { StageEntityId,StagePermission,StageSource,StageSyncMode } from "./stage-model";
export type StageChangeStatus="pending"|"applied"|"approved"|"rejected"|"reverted";
export type StageChange={id:string;entityId:StageEntityId;entityKind:"fixture"|"object"|"stage";category:StagePermission;source:StageSource;baseRevision:number;createdAt:string;summary:string;before:unknown;after:unknown;status:StageChangeStatus};
export type StageSyncPolicy={mode:StageSyncMode;livePermissions:Record<StagePermission,boolean>};
export const DEFAULT_STAGE_SYNC_POLICY:StageSyncPolicy={mode:"review",livePermissions:{fixturePosition:false,scenery:false,patch:false,fixtureProfile:false,calibration:false}};
export type IncomingDecision="queue"|"apply";
export function decideIncomingChange(policy:StageSyncPolicy,change:StageChange):IncomingDecision{if(policy.mode==="locked"||policy.mode==="review")return"queue";return policy.livePermissions[change.category]?"apply":"queue";}
export function canAutoApplyDangerousChange(policy:StageSyncPolicy,category:StagePermission):boolean{if(category==="patch"||category==="fixtureProfile"||category==="calibration")return false;return policy.mode==="live"&&policy.livePermissions[category];}
export function hasRevisionConflict(currentRevision:number,change:StageChange):boolean{return change.baseRevision!==currentRevision;}
