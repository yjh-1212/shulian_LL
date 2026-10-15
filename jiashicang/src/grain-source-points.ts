import payload from '../map_data/grain-source-points.json';

export interface GrainSourcePoint {
 adcode:string;name:string;province:string;prefecture:string;lng:number;lat:number;
 weight:number;level:'core'|'key'|'normal';grainTypes:string[];regionId:string;
}
const prefectures:Record<string,string>={'呼伦贝尔':'150700','兴安盟':'152200','通辽':'150500','赤峰':'150400'};
const provinces:Record<string,string>={'黑龙江':'230000','吉林':'220000','辽宁':'210000'};
export const grainSourcePoints:GrainSourcePoint[]=payload.data.map(point=>({...point,
 level:point.level as GrainSourcePoint['level'],regionId:point.province==='内蒙古'?prefectures[point.prefecture]:provinces[point.province],
}));
export const sourceLevelName={core:'核心粮源',key:'重点粮源',normal:'一般粮源'};
export const preferredSourceNames=['富锦市','海伦市','巴彦县','公主岭市','扶余市','昌图县','阿荣旗','阿鲁科尔沁旗','宝清县','德惠市','黑山县','阜新蒙古族自治县'];
