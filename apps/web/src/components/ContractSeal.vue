<script setup lang="ts">
defineProps<{name:string;imageUrl?:string}>();
</script>
<template><img v-if="imageUrl" class="contract-seal" :src="imageUrl" :alt="name+'企业签章'"/><div v-else class="seal-placeholder" role="img" :aria-label="name+'签章位置预览'"><strong>签章位置</strong><span>{{name}}</span><small>待配置企业签章</small></div></template>
<style scoped>.contract-seal{width:100%;height:100%;object-fit:contain;user-select:none;pointer-events:none}.seal-placeholder{display:flex;flex-direction:column;justify-content:center;align-items:center;width:100%;height:100%;gap:10px;border:1px dashed #b8c3cf;box-sizing:border-box;color:#7a8797;pointer-events:none;text-align:center;padding:12px;font-size:11px}.seal-placeholder strong{font-size:14px;font-weight:500}.seal-placeholder small{font-size:10px}</style>
