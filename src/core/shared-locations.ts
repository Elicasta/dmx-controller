import type { StageSettings } from '../types/show';

export interface SharedLocationPreset {
  id:string; name:string; version:number; estimated:boolean;
  dimensions:{roomWidth:number;roomDepth:number;ceilingHeight:number;stageWidth:number;stageDepth:number;stageHeight:number;screenWidth:number;screenHeight:number;screenBottom:number;drapeWidth:number;drapeHeight:number};
  objects:Array<{id:string;name:string;kind:string;position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number};size:{x:number;y:number;z:number}}>;
  cameras:Array<{id:string;name:string;position:{x:number;y:number;z:number};target:{x:number;y:number;z:number}}>;
}
export const CORNERSTONE_LOCATION_ID='cornerstone-main-sanctuary';
export function locationStagePatch(location:SharedLocationPreset):Partial<StageSettings>{
  return { dimensions: { width:location.dimensions.roomWidth, depth:location.dimensions.roomDepth, height:location.dimensions.ceilingHeight } } as Partial<StageSettings>;
}
