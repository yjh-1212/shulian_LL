<script setup lang="ts">
import {computed} from 'vue';
const props=defineProps<{text:string}>();
// Render a small Markdown subset with Vue text nodes; model content never becomes HTML.
const lines=computed(()=>String(props.text||'').split('\n').map(text=>({
 heading:/^#{1,3}\s/.test(text),bullet:/^\s*[-*]\s/.test(text),
 parts:text.replace(/^#{1,3}\s|^\s*[-*]\s/g,'').split(/(\*\*[^*]+\*\*)/g).map(value=>({bold:value.startsWith('**')&&value.endsWith('**'),text:value.startsWith('**')&&value.endsWith('**')?value.slice(2,-2):value}))
})));
</script>
<template><div class="answer-content"><p v-for="(line,i) in lines" :key="i" :class="{heading:line.heading,bullet:line.bullet,blank:line.parts.every(p=>!p.text.trim())}"><template v-for="(part,j) in line.parts" :key="j"><strong v-if="part.bold">{{part.text}}</strong><template v-else>{{part.text}}</template></template></p></div></template>
<style scoped>.answer-content{font-size:13px;line-height:1.95;color:#536b87;overflow-wrap:anywhere}.answer-content p{margin:0 0 6px;white-space:pre-wrap}.answer-content p.blank{height:9px;margin:0}.answer-content p.heading{font-weight:600;color:#345983}.answer-content p.bullet{position:relative;padding-left:15px}.answer-content p.bullet:before{content:'•';position:absolute;left:0;color:#7297c8}.answer-content strong{font-weight:600;color:#3e597b}</style>
