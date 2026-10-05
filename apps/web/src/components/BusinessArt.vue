<script setup lang="ts">
defineProps<{kind:'demand'|'plan'|'matching'|'tracking';size?:number}>();
</script>
<template><img class="business-art" :src="'/assets/portal/'+kind+'-icon.webp'" :style="{width:(size||66)+'px',height:(size||66)+'px'}" alt="" aria-hidden="true" width="86" height="86"/></template>
<style scoped>
.business-art{display:inline-block;flex-shrink:0;object-fit:contain}
</style>
