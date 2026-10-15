// Geographic references only: does not create operational data or track observations.
const fs=require('node:fs');
const path=require('node:path');
const {simplify,seaPath,seaGraph}=require('./build-network.cjs');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const existing=read(path.join(root,'map_data/transport-network.json'));
const segments=existing.segments.filter(s=>s.mode==='RAIL'&&['674a185a43e54c66','35826394a44abaf8'].includes(s.id)).map(s=>({...s,regionIds:['heilongjiang','jilin','liaoning','central','south']}));
for(const [file,id,label,regionIds] of [
 ['mengdong-shenyang','road-mengdong','蒙东—沈阳集运通道',['mengdong','liaoning']],
 ['north-south-road','road-trunk','东北—华中—华南公路通道',['heilongjiang','jilin','liaoning','central','south']],
 ['wuhan-southwest-road','road-southwest','武汉—重庆—贵阳公路通道',['central','southwest']]
]){
 const data=read(path.resolve(root,'../.local/comprehensive-reference',file+'.json'));
 if(data.code!=='Ok'||!data.routes[0]?.geometry?.coordinates?.length)throw Error('道路参考缺失：'+file);
 segments.push({id,mode:'ROAD',label,origin:label.split('—')[0],destination:label.split('—').at(-1),coordinates:simplify(data.routes[0].geometry.coordinates,50),sourceLabel:'OpenStreetMap / OSRM 道路参考',sourceUrl:'https://project-osrm.org/',regionIds,distanceMeters:Math.round(data.routes[0].distance)});
}
const network=seaGraph();
for(const [id,label,point,regionIds] of [
 ['sea-east','营口—宁波舟山沿海通道',[121.85,29.92],['heilongjiang','jilin','liaoning','east']],
 ['sea-fuzhou','营口—福州沿海通道',[119.56,25.97],['heilongjiang','liaoning','east','south']],
 ['sea-south','营口—广州沿海通道',[113.668807,22.650614],['heilongjiang','jilin','liaoning','south']]
]){
 const route=seaPath(network,[122.09603,40.289446],point);
 segments.push({id,mode:'WATER',label,origin:'营口港',destination:label.split('—')[1],...route,sourceLabel:'Marnet 公开海运网络',sourceUrl:'https://github.com/genthalili/searoute-py',regionIds});
}
const output={coordinateSystem:'WGS84',builtAt:new Date().toISOString(),basis:'公开道路、铁路和海运参考网络；不代表实际车辆轨迹；港区接驳缺口不绘制',segments};
fs.writeFileSync(path.join(root,'map_data/comprehensive-network.json'),JSON.stringify(output));
console.log(JSON.stringify({segments:segments.map(s=>({id:s.id,mode:s.mode,points:s.coordinates.length})),bytes:JSON.stringify(output).length}));
