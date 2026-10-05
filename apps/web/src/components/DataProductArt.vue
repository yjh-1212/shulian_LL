<script setup lang="ts">
import {computed,ref,watch} from 'vue';
import Icon from './Icon.vue';
const props=defineProps<{kind?:string;compact?:boolean}>();
const unavailable=ref(false);
const pictures:Record<string,{file:string;position:string}>={
 CAPACITY:{file:'warehouse',position:'50% 55%'},
 CORRIDOR:{file:'vessel',position:'50% 55%'},
 TRACE:{file:'port',position:'50% 60%'},
 CREDIT:{file:'silos',position:'50% 50%'},
 RISK:{file:'rail',position:'50% 60%'}
};
const picture=computed(()=>pictures[props.kind||'']||pictures.CAPACITY);
watch(()=>props.kind,()=>unavailable.value=false);
</script>
<template>
 <div class="product-art" :class="[kind?.toLowerCase(),{compact}]" aria-hidden="true">
  <img v-if="!unavailable" :src="`/assets/data-service/${picture.file}-photo-v3.webp`" alt="" width="960" height="640" loading="lazy" decoding="async" :style="{objectPosition:picture.position}" @error="unavailable=true"/>
  <div v-else class="art-fallback"><Icon name="route" :size="36"/></div>
 </div>
</template>
<style scoped>
.product-art{position:relative;background:#e7eff1;height:170px;overflow:hidden;border-radius:10px}
.product-art img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .45s ease}
.art-fallback{height:100%;display:grid;place-items:center;color:#648b91;background:#eaf0f1}
.compact{height:170px}
@media(prefers-reduced-motion:reduce){.product-art img{transition:none}}
</style>
