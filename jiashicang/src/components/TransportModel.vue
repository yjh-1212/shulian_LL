<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watch} from 'vue';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createTransportModel,disposeTransport} from '../transport-models';
import type {Mode} from '../types';
const props=defineProps<{mode:Mode;paused:boolean;color:string}>();
const host=ref<HTMLElement>(),failed=ref(false);let renderer:THREE.WebGLRenderer|undefined,scene:THREE.Scene,model:THREE.Group,camera:THREE.PerspectiveCamera,controls:OrbitControls,observer:ResizeObserver,raf=0,last=0;
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
function replace(){if(!scene)return;if(model){scene.remove(model);disposeTransport(model);}model=createTransportModel(props.mode,props.color);scene.add(model);}
function frame(time:number){raf=requestAnimationFrame(frame);if(document.hidden||time-last<1000/24)return;last=time;controls.autoRotate=!props.paused&&!reduced.matches;controls.update();renderer?.render(scene,camera);}
onMounted(()=>{try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));host.value!.append(renderer.domElement);scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#d0edff','#293e60',3));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(2,3,2);scene.add(light);camera=new THREE.PerspectiveCamera(35,1,.1,20);camera.position.set(1.6,1.2,1.8);controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.18,0);controls.enableZoom=false;controls.enablePan=false;controls.enableDamping=true;controls.autoRotateSpeed=.8;replace();observer=new ResizeObserver(()=>{const b=host.value!.getBoundingClientRect();camera.aspect=b.width/Math.max(1,b.height);camera.updateProjectionMatrix();renderer!.setSize(b.width,Math.max(1,b.height));});observer.observe(host.value!);raf=requestAnimationFrame(frame);}catch{failed.value=true;renderer?.dispose();}});
watch(()=>[props.mode,props.color],replace);
onBeforeUnmount(()=>{cancelAnimationFrame(raf);observer?.disconnect();controls?.dispose();if(model)disposeTransport(model);renderer?.dispose();renderer?.forceContextLoss();});
</script>
<template><div ref="host" class="ch-model" :data-model="mode" role="img" :aria-label="`${mode==='RAIL'?'粮食货运列车':mode==='ROAD'?'粮食运输卡车':'散粮船'}三维模型，可拖动旋转`"><span v-if="failed">{{mode==='RAIL'?'粮食货运列车':mode==='ROAD'?'粮食运输卡车':'散粮船'}}</span></div></template>
<style scoped>.ch-model{width:100%;height:100%;min-height:96px;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 80%,#5281ff18,transparent 65%);cursor:grab}.ch-model :deep(canvas){display:block;max-width:100%}.ch-model:active{cursor:grabbing}</style>
