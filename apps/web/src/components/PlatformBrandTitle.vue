<script setup lang="ts">
import {platformBrand} from '../branding';
</script>

<template>
 <span class="platform-brand-title"><strong class="platform-brand-main">{{platformBrand.name}}</strong><small class="platform-brand-service">{{platformBrand.service}}</small></span>
</template>

<style scoped>
.platform-brand-title{display:block;min-width:0;text-align:left;color:inherit}
.platform-brand-title>.platform-brand-main{display:block;margin:0;font-size:var(--brand-name-size,16px);line-height:1.4;font-weight:650;letter-spacing:var(--brand-name-spacing,.2px);white-space:nowrap;color:inherit}
.platform-brand-title>.platform-brand-service{display:block;margin:3px 0 0;font-size:var(--brand-service-size,12px);line-height:1.4;font-weight:450;letter-spacing:1.5px;opacity:.78;color:inherit;white-space:nowrap}
</style>
