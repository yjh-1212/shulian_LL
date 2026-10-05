import 'dotenv/config';
import {writeFile} from 'node:fs/promises';
const queries=process.argv.includes('--puhe')?[['蒲河物流基地','沈阳'],['蒲河火车站','沈阳']]:[['蒲河站','沈阳'],['广州国际港','广州'],['锦州港','锦州']];
const results=[];
for(const [keywords,city] of queries){
 const url=new URL('https://restapi.amap.com/v3/place/text');url.search=new URLSearchParams({key:process.env.AMAP_WEB_SERVICE_KEY,keywords,city,citylimit:'true',offset:'10',extensions:'base'});
 const data=await (await fetch(url,{signal:AbortSignal.timeout(20000)})).json();
 if(data.status!=='1')throw Error('POI lookup failed: '+data.infocode);
 results.push({keywords,pois:data.pois.map(p=>({id:p.id,name:p.name,type:p.typecode,location:p.location,province:p.pname,city:p.cityname,district:p.adname,address:p.address}))});
 await new Promise(r=>setTimeout(r,700));
}
await writeFile('prisma/data/'+(process.argv.includes('--puhe')?'puhe-node-lookup.json':'public-node-lookup.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
