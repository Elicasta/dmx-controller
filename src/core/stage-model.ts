export type StageEntityId = string;
export type StageSource = "lumarig" | "lumaviz";
export type StageSyncMode = "locked" | "review" | "live";
export type StagePermission = "fixturePosition" | "scenery" | "patch" | "fixtureProfile" | "calibration";
export type Vec3 = { x:number; y:number; z:number };
export type Rotation3 = { x:number; y:number; z:number };
export type StageRevisionMeta = { revision:number; lastEditedBy:StageSource; lastEditedAt:string };
export type FixturePatch = { universe:number; address:number; secondaryPatchPoints?:Array<{universe:number;address:number}> };
export type StageFixture = StageRevisionMeta & { uuid:StageEntityId; name:string; profileId:string; modeId:string; patch:FixturePatch; position:Vec3; rotation:Rotation3; mounting?:"floor"|"stand"|"truss"|"wall"|"ceiling"|"other"; parentId?:StageEntityId; calibration?:Record<string,number|boolean|string>; optics?:{beamAngleDeg?:number;fieldAngleDeg?:number;luminousFluxLm?:number} };
export type StageObject = StageRevisionMeta & { uuid:StageEntityId; name:string; type:"stage"|"riser"|"truss"|"scenery"|"screen"|"speaker"|"custom"; position:Vec3; rotation:Rotation3; scale:Vec3; dimensions?:Vec3; parentId?:StageEntityId; material?:string; visible:boolean };
export type StageDocument = { schema:"luma.stage"; schemaVersion:1; stageId:string; name:string; revision:number; fixtures:Record<StageEntityId,StageFixture>; objects:Record<StageEntityId,StageObject> };
export function assertValidPatch(patch:FixturePatch):void { for(const point of [patch,...(patch.secondaryPatchPoints??[])]) { if(!Number.isInteger(point.universe)||point.universe<1) throw new Error("Universe must be a positive integer"); if(!Number.isInteger(point.address)||point.address<1||point.address>512) throw new Error("DMX address must be 1...512"); } }
export function fixtureIdentity(fixture:Pick<StageFixture,"uuid">):string{return fixture.uuid;}
