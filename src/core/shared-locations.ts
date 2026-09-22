export interface SharedLocationPreset {
  id:string; name:string; version:number; estimated:boolean;
  dimensions:{roomWidth:number;roomDepth:number;ceilingHeight:number;stageWidth:number;stageDepth:number;stageHeight:number;screenWidth:number;screenHeight:number;screenBottom:number;drapeWidth:number;drapeHeight:number};
  objects:Array<{id:string;name:string;kind:string;position:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number};size:{x:number;y:number;z:number}}>;
  cameras:Array<{id:string;name:string;position:{x:number;y:number;z:number};target:{x:number;y:number;z:number}}>;
}
export const CORNERSTONE_LOCATION_ID='cornerstone-main-sanctuary';
export const ROSEN_SIGNATURE_2_AD26_LOCATION_ID='rosen-signature-2-ad26';
export function locationStageDimensions(location:SharedLocationPreset){
  return { width:location.dimensions.roomWidth, depth:location.dimensions.roomDepth, height:location.dimensions.ceilingHeight };
}
