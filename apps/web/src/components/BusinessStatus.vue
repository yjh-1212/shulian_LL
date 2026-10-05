<script setup lang="ts">
import {computed} from 'vue';
import Icon from './Icon.vue';
import {businessTone,type BusinessTone} from '../business-status';
const props=defineProps<{status?:string;label:string;tone?:BusinessTone;compact?:boolean}>();
const tone=computed(()=>props.tone||businessTone(props.status));
const icons:Record<BusinessTone,string>={neutral:'file',pending:'clock',active:'route',success:'check',attention:'warning',invited:'mail'};
</script>
<template><span class="business-status" :class="['business-status--'+tone,{'is-compact':compact}]"><Icon :name="icons[tone]" :size="compact?12:14"/><span>{{label}}</span></span></template>
<style scoped>
.business-status{display:inline-flex;align-items:center;gap:5px;max-width:100%;vertical-align:middle;padding:5px 8px;border:1px solid var(--status-border);border-radius:5px;background:var(--status-bg);color:var(--status-fg);font-size:12px;line-height:16px;font-weight:600;white-space:nowrap}
.business-status svg{flex-shrink:0}.business-status.is-compact{font-size:11px;line-height:14px;padding:3px 6px}
.business-status--neutral{--status-fg:#667384;--status-bg:#f3f5f7;--status-border:#e1e5eb}
.business-status--pending{--status-fg:#98600b;--status-bg:#fff8e9;--status-border:#f0dfb4}
.business-status--active{--status-fg:#2160a6;--status-bg:#eef5ff;--status-border:#d3e3f7}
.business-status--success{--status-fg:#167553;--status-bg:#edf8f2;--status-border:#cce8db}
.business-status--attention{--status-fg:#bc3841;--status-bg:#fff1f2;--status-border:#f3d0d3}
.business-status--invited{--status-fg:#7350a0;--status-bg:#f5f0fc;--status-border:#e4d7f2}
</style>
