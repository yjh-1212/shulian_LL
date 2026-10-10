<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,onUpdated,ref,useId} from 'vue';
import type {Breakdown,Series,Statistics,ChartSelection} from '../types';
import type {CockpitStyle} from '../theme';
const props=withDefaults(defineProps<{
 kind:'donut'|'combo'|'treemap'|'bubbles'|'heatmap'|'sankey'|'scatter'|'gauge'|'bars';
 title:string;config:CockpitStyle;items?:Breakdown[];series?:Series[];cells?:Statistics['heatmap'];links?:Statistics['links'];points?:Statistics['scatter'];
 unit?:'tons'|'money'|'count';percent?:number|null;legend?:string[];donutLayout?:'inline'|'expanded'|'wide';interaction?:ChartSelection['dimension'];
}>(),{items:()=>[],series:()=>[],cells:()=>[],links:()=>[],points:()=>[],unit:'count',legend:()=>[],donutLayout:'inline'});
const palette=computed(()=>props.config.chartPalette==='grain'?['#edba67','#56c8b9','#689ee5','#b19bdd',props.config.primary]:props.config.chartPalette==='mono'?[props.config.primary,props.config.primary,props.config.primary,props.config.primary]:[props.config.primary,props.config.roadColor,props.config.accent,props.config.railColor]);
const emit=defineEmits<{select:[selection:ChartSelection]}>();
const interactive=(name:string)=>props.interaction?{role:'button',tabindex:0,'aria-label':`${props.interaction==='grain'?'筛选':'高亮'} ${name}`} : {};
function select(value:string,dimension=props.interaction,grain?:string){if(dimension)emit('select',{dimension,value,...(grain?{grain}:{})});}
const color=(i:number)=>palette.value[i%palette.value.length];
const grainColor=(name:string,fallback=0)=>{const i=['玉米','大豆','小麦','稻谷'].indexOf(name);return color(i<0?fallback:i);};
const chartHost=ref<HTMLElement>(),chartHeight=ref(190);let observer:ResizeObserver|undefined;
const chartId=`chart-${useId().replace(/[^a-z0-9_-]/gi,'')}`;
function measureChart(){const host=chartHost.value;if(!host)return;const svg=host.querySelector(':scope>svg'),rect=(svg||host).getBoundingClientRect();const height=Math.max(68,rect.height*360/Math.max(1,rect.width));if(Math.abs(height-chartHeight.value)>.25)chartHeight.value=height;}
onMounted(()=>{observer=new ResizeObserver(measureChart);if(chartHost.value)observer.observe(chartHost.value);measureChart();});
onUpdated(measureChart);
onBeforeUnmount(()=>observer?.disconnect());
const comboBottom=computed(()=>Math.max(45,chartHeight.value-28));
const comboTop=12;
const ticks=computed(()=>chartHeight.value<115?[0,1,2]:[0,1,2,3]);
const total=computed(()=>props.items.reduce((sum,row)=>sum+row.value,0));
const fmt=(n:number)=>props.unit==='tons'?(n/1000).toLocaleString('zh-CN',{maximumFractionDigits:1}):props.unit==='money'?(n/1000000).toLocaleString('zh-CN',{maximumFractionDigits:1}):n.toLocaleString('zh-CN',{maximumFractionDigits:1});
const short=(n:number)=>{const v=props.unit==='tons'?n/1000:props.unit==='money'?n/1000000:n;return v>=10000?`${(v/10000).toFixed(1)}万`:v>=1000?`${(v/1000).toFixed(1)}k`:v.toLocaleString('zh-CN',{maximumFractionDigits:1});};
const segments=computed(()=>{let offset=0;return props.items.map((row,i)=>{const length=row.value/Math.max(1,total.value)*301.6;const part={...row,color:grainColor(row.name,i),offset,length};offset+=length;return part;});});
const max=computed(()=>Math.max(1,...props.items.map(row=>row.value)));
const comboMax=computed(()=>Math.max(1,...props.series.flatMap(row=>[row.first,row.second,row.line||0]))*1.12);
const plotY=(v:number)=>comboBottom.value-v/comboMax.value*(comboBottom.value-comboTop);
const plotX=(i:number)=>40+(i+.5)*304/Math.max(1,props.series.length);
const line=computed(()=>props.series.map((row,i)=>`${plotX(i)},${plotY(row.line??row.first)}`).join(' '));
const comboWidth=computed(()=>Math.min(18,95/Math.max(1,props.series.length)));
const boxes=computed(()=>{
 const result:{name:string;value:number;x:number;y:number;width:number;height:number;color:string}[]=[];
 const split=(rows:Breakdown[],x:number,y:number,width:number,height:number,columns=true)=>{
  if(!rows.length)return;if(rows.length===1){result.push({...rows[0],x,y,width,height,color:color(props.items.findIndex(row=>row.name===rows[0].name))});return;}
  const sum=rows.reduce((s,r)=>s+r.value,0);let part=rows[0].value,index=1;
  while(index<rows.length-1&&Math.abs(part+rows[index].value-sum/2)<Math.abs(part-sum/2)){part+=rows[index++].value;}
  const ratio=part/sum;
  if(columns){split(rows.slice(0,index),x,y,width*ratio,height,false);split(rows.slice(index),x+width*ratio,y,width*(1-ratio),height,false);}
  else{split(rows.slice(0,index),x,y,width,height*ratio,true);split(rows.slice(index),x,y+height*ratio,width,height*(1-ratio),true);}
 };
 split(props.items.filter(row=>row.value>0).slice().sort((a,b)=>b.value-a.value),2,4,356,chartHeight.value-8);return result;
});
const bubbles=computed(()=>{
 const rows=props.items.filter(row=>row.value>0).slice(0,6),maximum=Math.max(1,...rows.map(row=>row.value));
 const columns=rows.length<=1?1:rows.length<=4?2:3,rowCount=Math.ceil(rows.length/columns),cellWidth=360/columns,cellHeight=chartHeight.value/Math.max(1,rowCount);
 const radius=Math.min(cellWidth*.43,cellHeight*.41);
 return rows.map((row,i)=>{const column=i%columns,line=Math.floor(i/columns),lastRowCount=rows.length-line*columns;const offset=line===rowCount-1&&lastRowCount<columns?(columns-lastRowCount)*cellWidth/2:0;return {...row,x:(column+.5)*cellWidth+offset,y:(line+.45)*cellHeight,r:Math.sqrt(row.value/maximum)*radius,color:color(i)};});
});
const heatRows=computed(()=>[...new Set(props.cells.map(row=>row.grain))]);
const heatCols=computed(()=>[...new Set(props.cells.map(row=>row.mode))]);
const heatMax=computed(()=>Math.max(1,...props.cells.map(row=>row.value)));
const heatHeight=computed(()=>Math.max(30,chartHeight.value-34));
const sankey=computed(()=>{
 const columns=[new Map<string,number>(),new Map<string,number>(),new Map<string,number>()];
 for(const link of props.links){columns[link.column].set(link.source,(columns[link.column].get(link.source)||0)+link.value);if(link.column===1)columns[2].set(link.target,(columns[2].get(link.target)||0)+link.value);}
 const weight=[...columns[0].values()].reduce((a,b)=>a+b,0),count=Math.max(...columns.map(c=>c.size),1),scale=Math.max(1,chartHeight.value-42-(count-1)*10)/Math.max(1,weight);
 const nodes:{name:string;column:number;x:number;y:number;height:number;color:string}[]=[];
 columns.forEach((column,j)=>{let y=28;for(const [name,value] of column){nodes.push({name,column:j,x:[6,176,346][j],y,height:value*scale,color:grainColor(name,[...column.keys()].indexOf(name))});y+=value*scale+10;}});
 const offsets=new Map<string,number>();
 const links=props.links.map(link=>{const a=nodes.find(n=>n.column===link.column&&n.name===link.source)!,b=nodes.find(n=>n.column===link.column+1&&n.name===link.target)!;const thickness=link.value*scale;
  const ak=`out:${a.column}:${a.name}`,bk=`in:${b.column}:${b.name}`,ay=a.y+(offsets.get(ak)||0)+thickness/2,by=b.y+(offsets.get(bk)||0)+thickness/2;offsets.set(ak,(offsets.get(ak)||0)+thickness);offsets.set(bk,(offsets.get(bk)||0)+thickness);
  return {...link,thickness,color:a.color,targetColor:b.color,d:`M${a.x+6},${ay} C${a.x+92},${ay} ${b.x-80},${by} ${b.x},${by}`};});
 return {nodes,links};
});
const scatterMax=computed(()=>({x:Math.max(1,...props.points.map(row=>row.x))*1.14,y:Math.max(1,...props.points.map(row=>row.y))*1.2}));
const scatterBottom=computed(()=>chartHeight.value-28);
const scatterY=(value:number)=>scatterBottom.value-value/scatterMax.value.y*(scatterBottom.value-28);
const grains=computed(()=>[...new Set(props.points.map(row=>row.grain))]);
const empty=computed(()=>props.kind==='gauge'?props.percent==null:props.kind==='combo'?!props.series.some(row=>row.first||row.second||row.line):props.kind==='heatmap'?!props.cells.some(row=>row.value):props.kind==='sankey'?!props.links.length:props.kind==='scatter'?!props.points.length:!total.value);
</script>

<template>
 <div ref="chartHost" class="cc-stat-chart" :data-chart="kind">
  <p v-if="empty" class="cc-empty">当前筛选范围暂无统计数据</p>
  <template v-else-if="kind==='donut'">
   <div class="cc-donut-layout" :class="{'cc-donut-expanded':donutLayout==='expanded'}" :style="{'--cc-legend-columns':Math.max(1,items.length)}"><svg :viewBox="donutLayout==='inline'?'0 0 150 150':'12 12 126 126'" role="img" :aria-label="title"><title>{{title}}</title><circle cx="75" cy="75" r="48" fill="none" stroke="var(--cc-border)" stroke-width="13"/><circle v-for="part in segments" :key="part.name" v-bind="interactive(part.name)" @click="select(part.name)" @keydown.enter="select(part.name)" @keydown.space.prevent="select(part.name)" cx="75" cy="75" r="48" fill="none" :stroke="part.color" stroke-width="13" :stroke-dasharray="`${Math.max(0,part.length-2)} ${301.6-Math.max(0,part.length-2)}`" :stroke-dashoffset="-part.offset" transform="rotate(-90 75 75)"><title>{{part.name}}：{{fmt(part.value)}}</title></circle><text x="75" y="73" class="cc-svg-number" text-anchor="middle">{{short(total)}}</text><text x="75" y="94" text-anchor="middle">{{unit==='tons'?'计划运输量 · 吨':'运输需求 · 单'}}</text></svg><ul class="cc-stat-legend"><li v-for="(row,i) in items" :key="row.name" v-bind="interactive(row.name)" @click="select(row.name)" @keydown.enter="select(row.name)" @keydown.space.prevent="select(row.name)"><i :style="{background:grainColor(row.name,i)}"/><span>{{row.name}}</span><strong>{{fmt(row.value)}}</strong><small>{{(row.value/total*100).toFixed(1)}}%</small></li></ul></div>
  </template>
  <template v-else-if="kind==='gauge'">
   <svg viewBox="60 25 240 150" role="img" :aria-label="title"><title>{{title}}</title><path d="M80 137 A100 100 0 0 1 280 137" fill="none" stroke="var(--cc-border)" stroke-width="13" pathLength="100"/><path d="M80 137 A100 100 0 0 1 280 137" fill="none" :stroke="color(0)" stroke-width="13" pathLength="100" :stroke-dasharray="`${Math.max(0,Math.min(100,percent||0))} 100`"/><text x="180" y="118" text-anchor="middle" class="cc-svg-gauge">{{(percent||0).toFixed(1)}}<tspan class="cc-svg-unit">%</tspan></text><text x="180" y="142" text-anchor="middle">业务完成率</text><text x="74" y="161">0%</text><text x="270" y="161">100%</text></svg>
  </template>
  <template v-else-if="kind==='combo'">
   <svg :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title><g v-for="tick in ticks" :key="tick"><path v-if="config.chartGrid" :d="`M40 ${comboBottom-tick*(comboBottom-comboTop)/(ticks.length-1)} H350`" class="cc-chart-grid"/><text x="33" :y="comboBottom+3-tick*(comboBottom-comboTop)/(ticks.length-1)" text-anchor="end">{{short(comboMax*tick/(ticks.length-1))}}</text></g><g v-for="(row,i) in series" :key="row.name"><rect :x="plotX(i)-comboWidth-(legend.length>1?2:0)" :y="plotY(row.first)" :width="comboWidth" :height="Math.max(0,comboBottom-plotY(row.first))" rx="2" :fill="color(0)" opacity="0.8"><title>{{row.name}} {{legend[0]||'运输量'}}：{{fmt(row.first)}}</title></rect><rect v-if="legend.length>1" :x="plotX(i)+2" :y="plotY(row.second)" :width="comboWidth" :height="Math.max(0,comboBottom-plotY(row.second))" rx="2" :fill="color(1)" opacity="0.7"><title>{{row.name}} {{legend[1]}}：{{fmt(row.second)}}</title></rect><text :x="plotX(i)" :y="comboBottom+20" text-anchor="middle">{{row.name.slice(5)}}月</text></g><polyline v-if="legend.length!==2" :points="line" fill="none" :stroke="color(2)" :stroke-width="config.chartWidth" stroke-linejoin="round"/><g v-if="legend.length!==2"><circle v-for="(row,i) in series" :key="row.name" :cx="plotX(i)" :cy="plotY(row.line??row.first)" r="3" :fill="color(2)"><title>{{row.name}}：{{fmt(row.line??row.first)}}</title></circle></g></svg>
   <div class="cc-series-legend"><span v-for="(name,i) in legend" :key="name"><i :style="{background:color(i)}"/>{{name}}</span></div>
  </template>
  <svg v-else-if="kind==='treemap'" :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title><g v-for="box in boxes" :key="box.name" v-bind="interactive(box.name)" @click="select(box.name)" @keydown.enter="select(box.name)" @keydown.space.prevent="select(box.name)"><rect :x="box.x+1" :y="box.y+1" :width="Math.max(0,box.width-3)" :height="Math.max(0,box.height-3)" :fill="box.color" fill-opacity=".33" :stroke="box.color" stroke-opacity=".65"/><title>{{box.name}}：{{fmt(box.value)}} 吨</title><text v-if="box.width>54&&box.height>25" :x="box.x+box.width/2" :y="box.y+box.height/2-2" text-anchor="middle" class="cc-svg-label">{{box.name}}</text><text v-if="box.width>65&&box.height>50" :x="box.x+box.width/2" :y="box.y+box.height/2+20" text-anchor="middle">{{fmt(box.value)}} 吨</text></g></svg>
  <svg v-else-if="kind==='bubbles'" class="cc-sphere-chart" :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title>
   <defs><radialGradient :id="`${chartId}-shadow`"><stop offset="0" stop-color="#000" stop-opacity=".38"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><radialGradient v-for="(bubble,i) in bubbles" :key="bubble.name" :id="`${chartId}-sphere-${i}`" cx="30%" cy="23%" r="80%"><stop offset="0" stop-color="#f2ffff" stop-opacity=".95"/><stop offset=".18" :stop-color="bubble.color"/><stop offset=".56" :stop-color="bubble.color" stop-opacity=".75"/><stop offset="1" stop-color="#071a29"/></radialGradient></defs>
   <ellipse v-for="bubble in bubbles" :key="`shadow-${bubble.name}`" :cx="bubble.x+bubble.r*.12" :cy="bubble.y+bubble.r*1.1" :rx="bubble.r*.9" :ry="bubble.r*.16" :fill="`url(#${chartId}-shadow)`"/>
   <g v-for="(bubble,i) in bubbles" :key="bubble.name" class="cc-sphere" :data-value="bubble.value" v-bind="interactive(bubble.name)" @click="select(bubble.name)" @keydown.enter="select(bubble.name)" @keydown.space.prevent="select(bubble.name)"><title>{{bubble.name}}：{{fmt(bubble.value)}} 吨</title><circle :cx="bubble.x" :cy="bubble.y" :r="bubble.r+2" fill="none" :stroke="bubble.color" stroke-opacity=".16"/><circle class="cc-sphere-surface" :cx="bubble.x" :cy="bubble.y" :r="bubble.r" :fill="`url(#${chartId}-sphere-${i})`" :stroke="bubble.color" stroke-opacity=".65" stroke-width=".7"/><ellipse :cx="bubble.x" :cy="bubble.y" :rx="bubble.r*.91" :ry="bubble.r*.3" fill="none" stroke="#e0fcff" stroke-opacity=".14" :transform="`rotate(-18 ${bubble.x} ${bubble.y})`"/><ellipse :cx="bubble.x" :cy="bubble.y" :rx="bubble.r*.32" :ry="bubble.r*.91" fill="none" stroke="#e0fcff" stroke-opacity=".13" :transform="`rotate(-18 ${bubble.x} ${bubble.y})`"/><ellipse :cx="bubble.x-bubble.r*.3" :cy="bubble.y-bubble.r*.49" :rx="bubble.r*.19" :ry="bubble.r*.07" fill="#fff" fill-opacity=".4"/><text :x="bubble.x" :y="bubble.y-3" text-anchor="middle" class="cc-sphere-label" :style="{fontSize:`${12}px`}">{{bubble.name}}</text><text :x="bubble.x" :y="bubble.y+15" text-anchor="middle" class="cc-sphere-value" :style="{fontSize:`${14}px`}">{{short(bubble.value)}}<tspan style="font-size:9px"> 吨</tspan></text></g>
  </svg>
  <svg v-else-if="kind==='heatmap'" :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title><text v-for="(grain,i) in heatRows" :key="grain" x="44" :y="28+(i+.5)*heatHeight/heatRows.length+3" text-anchor="end" class="cc-svg-label">{{grain}}</text><text v-for="(mode,i) in heatCols" :key="mode" :x="56+(i+.5)*298/heatCols.length" y="16" text-anchor="middle" class="cc-svg-label">{{mode}}</text><g v-for="cell in cells" :key="cell.grain+cell.mode" v-bind="interactive(cell.grain+' · '+cell.mode)" @click="select(cell.mode,'mode',cell.grain)" @keydown.enter="select(cell.mode,'mode',cell.grain)" @keydown.space.prevent="select(cell.mode,'mode',cell.grain)"><rect class="cc-heat-cell" :x="56+heatCols.indexOf(cell.mode)*298/heatCols.length" :y="28+heatRows.indexOf(cell.grain)*heatHeight/heatRows.length" :width="298/heatCols.length-4" :height="heatHeight/heatRows.length-4" rx="3" :fill="color(0)" :fill-opacity="cell.value?0.15+cell.value/heatMax*.68:.04" :stroke="color(0)" stroke-opacity=".2"/><title>{{cell.grain}} · {{cell.mode}}：{{fmt(cell.value)}} 吨</title><text :x="56+(heatCols.indexOf(cell.mode)+.5)*298/heatCols.length-2" :y="31+(heatRows.indexOf(cell.grain)+.5)*heatHeight/heatRows.length" text-anchor="middle">{{cell.value?short(cell.value):'—'}}</text></g></svg>
  <svg v-else-if="kind==='sankey'" :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title><defs><linearGradient v-for="(link,i) in sankey.links" :key="i" :id="`${chartId}-flow-${i}`"><stop offset="0" :stop-color="link.color"/><stop offset="1" :stop-color="link.targetColor"/></linearGradient></defs><text x="6" y="13">粮食品种</text><text x="179" y="13" text-anchor="middle">联运方式</text><text x="352" y="13" text-anchor="end">业务状态</text><path v-for="(link,i) in sankey.links" :key="link.column+link.source+link.target" :d="link.d" fill="none" :stroke="`url(#${chartId}-flow-${i})`" :stroke-width="link.thickness" stroke-opacity=".43"><title>{{link.source}} → {{link.target}}：{{fmt(link.value)}} 吨</title></path><g v-for="node in sankey.nodes" :key="node.column+node.name" v-bind="interactive(node.name)" @click="select(node.name,node.column===0?'grain':node.column===1?'mode':'status')" @keydown.enter="select(node.name,node.column===0?'grain':node.column===1?'mode':'status')" @keydown.space.prevent="select(node.name,node.column===0?'grain':node.column===1?'mode':'status')"><rect class="cc-sankey-node" :x="node.x" :y="node.y" width="6" :height="node.height" :fill="node.color"/><text :x="node.column===2?node.x-7:node.x+12" :y="node.y+node.height/2+4" :text-anchor="node.column===2?'end':'start'" class="cc-svg-label">{{node.name}}</text></g></svg>
  <template v-else-if="kind==='scatter'">
   <svg :viewBox="`0 0 360 ${chartHeight}`" role="img" :aria-label="title"><title>{{title}}</title><g v-for="tick in [0,1,2,3]" :key="tick"><path v-if="config.chartGrid" :d="`M46 ${scatterY(scatterMax.y*tick/3)} H350`" class="cc-chart-grid"/><text x="38" :y="scatterY(scatterMax.y*tick/3)+3" text-anchor="end">{{Math.round(scatterMax.y*tick/3)}}</text><text :x="46+tick*99" :y="chartHeight-10" text-anchor="middle">{{Math.round(scatterMax.x*tick/3)}}</text></g><text x="46" y="13">单价（元/吨）</text><text x="351" :y="chartHeight-1" text-anchor="end">计划量（吨）</text><circle v-for="(point,i) in points" :key="i" :cx="46+point.x/scatterMax.x*298" :cy="scatterY(point.y)" r="6" :fill="grainColor(point.grain)" fill-opacity=".72" :stroke="grainColor(point.grain)"><title>{{point.grain}} · {{point.x.toFixed(1)}} 吨 · {{point.y.toFixed(1)}} 元/吨 · {{point.status}}</title></circle></svg><div class="cc-series-legend"><span v-for="(name,i) in grains" :key="name"><i :style="{background:grainColor(name,i)}"/>{{name}}</span></div>
  </template>
  <div v-else class="cc-stat-bars" :style="{'--cc-bar-rows':items.length}"><div v-for="(row,i) in items" :key="row.name" v-bind="interactive(row.name)" @click="select(row.name)" @keydown.enter="select(row.name)" @keydown.space.prevent="select(row.name)"><div><span>{{row.name}}</span><strong>{{fmt(row.value)}}<small>{{unit==='tons'?' 吨':' 项'}}</small></strong></div><div class="cc-stat-track"><i :style="{width:`${row.value/max*100}%`,background:grainColor(row.name,i)}"/></div></div></div>
 </div>
</template>
