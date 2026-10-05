<script setup lang="ts">
defineProps<{ loading: boolean; ready: boolean; error: string; tilesLoading: boolean; slowTiles: boolean }>();
defineEmits(['retry']);
</script>
<template>
  <div v-if="loading" class="map-load-cover" role="status"><span class="map-load-spinner"/>正在加载地图…</div>
  <div v-else-if="error" class="map-load-cover map-load-error" role="alert"><p>{{error}}</p><el-button @click="$emit('retry')">重新加载地图</el-button></div>
  <div v-else-if="ready&&tilesLoading" class="map-tile-status" role="status"><span class="map-load-spinner"/>{{slowTiles?'底图加载较慢，可继续查看路线与节点':'正在补充底图…'}}<el-button v-if="slowTiles" size="small" link @click="$emit('retry')">重试底图</el-button></div>
</template>
<style scoped>
.map-load-cover{position:absolute;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;gap:10px;background:#f0f3f7;color:#64758a;font-size:13px}.map-load-error{flex-direction:column;padding:24px;text-align:center}.map-tile-status{position:absolute;right:18px;bottom:40px;z-index:250;display:flex;align-items:center;gap:8px;padding:8px 12px;max-width:calc(100% - 36px);border:1px solid #e1e7ee;border-radius:6px;background:#fffffff2;color:#64758a;font-size:11px;box-shadow:0 2px 8px #2435480c}.map-load-spinner{flex-shrink:0;width:14px;height:14px;border:2px solid #ced9e4;border-top-color:#457b9d;border-radius:50%;animation:map-spin .8s linear infinite}@keyframes map-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.map-load-spinner{animation:none}}
</style>
