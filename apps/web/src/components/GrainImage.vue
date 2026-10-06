<script setup lang="ts">
import { ref,watch,onBeforeUnmount } from 'vue';
import { api } from '../api';
const props=defineProps<{code?:string;photo?:string}>();
const src=ref('');let objectUrl='';let generation=0;
const fallback=()=>({ '1':'corn','2':'soybean','3':'wheat','4':'rice' } as Record<string,string>)[props.code||''];
watch(()=>[props.code,props.photo],async()=>{const current=++generation;if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl='';src.value=fallback()?`/assets/grain/${fallback()}.webp`:'';if(props.photo)try{const result=await api.get(`/transport-files/${props.photo}`,{responseType:'blob'});if(current!==generation)return;objectUrl=URL.createObjectURL(result.data);src.value=objectUrl;}catch{/* Keep the supplied grain illustration when an attachment is unavailable. */}},{immediate:true});
onBeforeUnmount(()=>{generation++;if(objectUrl)URL.revokeObjectURL(objectUrl);});
</script>
<template><img v-if="src" class="grain-image" decoding="async" :src="src" :alt="photo?'货物照片':'粮食示意图'"/><span v-else class="grain-image grain-placeholder" aria-label="粮食品种未指定">粮</span></template>
<style scoped>.grain-image{width:48px;height:48px;flex:none;border-radius:8px;object-fit:cover;background:#f6f5f2;border:1px solid #ececea}.grain-placeholder{display:grid;place-items:center;color:#999;font-size:20px}</style>
