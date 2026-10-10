<script setup lang="ts">
import {computed,onMounted,onBeforeUnmount,ref} from 'vue';
import Icon from '../../../apps/web/src/components/Icon.vue';
defineProps<{title:string;icon:string;subtitle?:string}>();
const host=ref<HTMLElement>(),size=ref({width:360,height:250});
let observer:ResizeObserver|undefined;
const frame=computed(()=>{
 const {width:w,height:h}=size.value;
 return {
  outline:`M1 18 L18 1 H${w*.73} L${w*.79} 17 H${w-1} V${h-1} H${w*.83} L${w*.81} ${h-7} H${w*.19} L${w*.17} ${h-1} H1 Z`,
  corners:`M${w-18} 17 H${w-1} V32 M1 ${h-18} V${h-1} H18 M${w*.19} ${h-3} H${w*.81}`
 };
});
onMounted(()=>{
 observer=new ResizeObserver(()=>{if(host.value)size.value={width:host.value.clientWidth,height:host.value.clientHeight};});
 if(host.value)observer.observe(host.value);
});
onBeforeUnmount(()=>observer?.disconnect());
</script>
<template><section ref="host" class="cc-panel" :aria-label="title"><svg class="cc-panel-frame" :viewBox="`0 0 ${size.width} ${size.height}`" preserveAspectRatio="none" aria-hidden="true"><path class="cc-frame-outline" :d="frame.outline"/><path class="cc-frame-corners" :d="frame.corners"/><path class="cc-frame-notch" d="M1 14 V1 H14 Z"/></svg><header class="cc-panel-heading"><span><Icon :name="icon" :size="17"/><h2>{{title}}</h2></span><slot name="heading-extra"/><small v-if="subtitle">{{subtitle}}</small></header><div class="cc-panel-body"><slot/></div></section></template>
