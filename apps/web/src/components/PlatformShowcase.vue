<script setup lang="ts">
import Icon from './Icon.vue';
</script>
<template>
 <figure class="platform-showcase">
  <header class="showcase-top">
   <span class="showcase-brand"><img src="/assets/liaoliang-logo.png" alt="" width="26" height="28"/><strong>辽粮 · 智能多式联运</strong></span>
   <span class="showcase-page">工作台</span>
   <span class="showcase-top-note">业务协同，从这里开始</span>
   <span class="showcase-window-dots" aria-hidden="true"><i/><i/><i/></span>
  </header>
  <img class="showcase-workbench" src="/assets/portal/workbench-preview.webp" alt="辽粮智能多式联运工作台，包含运输需求、方案规划、运力匹配与运输跟踪快捷入口，以及运输概览、阶段进度、待办处理、最近运输任务和 AI 助手。" width="1218" height="1054" loading="lazy" decoding="async"/>
  <figcaption class="showcase-bottom"><span><Icon name="dashboard" :size="16"/>业务总览</span><span><Icon name="file" :size="16"/>待办协同</span><span><Icon name="truck" :size="16"/>运输进度</span><span><Icon name="bot" :size="16"/>AI 助手</span></figcaption>
 </figure>
</template>
<style scoped>
.platform-showcase{margin:0;background:#f5f6f8;border:1px solid #e2e7ee;border-radius:12px;overflow:hidden;text-align:left;color:#203142;box-shadow:0 25px 70px #051b3133}
.showcase-top{display:flex;align-items:center;gap:18px;min-height:62px;padding:15px 24px;border-bottom:1px solid #e9edf1;background:#fff}
.showcase-brand{display:flex;align-items:center;gap:9px}
.showcase-brand img{object-fit:contain}
.showcase-brand strong{font-size:14px;white-space:nowrap}
.showcase-page{font-size:12px;padding:5px 12px;border-radius:5px;background:#fff0f0;color:#d92e37;font-weight:600}
.showcase-top-note{font-size:12px;color:#8795a4;margin-left:auto}
.showcase-window-dots{display:flex;gap:7px;margin-left:10px}
.showcase-window-dots>i{width:7px;height:7px;border-radius:50%;background:#e2e6eb}
.showcase-workbench{display:block;width:100%;height:auto;padding:18px;box-sizing:border-box}
.showcase-bottom{display:flex;align-items:center;justify-content:space-around;gap:10px;padding:17px 20px;background:white;border-top:1px solid #e6ebf0;font-size:12px;color:#687f90}
.showcase-bottom>span{display:flex;align-items:center;gap:7px;white-space:nowrap}
@media(max-width:700px){.showcase-top{gap:10px;padding:13px 16px;min-height:54px}.showcase-brand strong{font-size:12px}.showcase-top-note{display:none}.showcase-window-dots{margin-left:auto}.showcase-workbench{padding:10px}.showcase-bottom{font-size:10px;gap:8px;padding:14px 10px}.showcase-bottom>span{gap:4px}.showcase-bottom svg{width:13px}}
@media(max-width:400px){.showcase-page{padding:4px 8px;font-size:10px}.showcase-brand strong{font-size:11px}.showcase-window-dots{display:none}.showcase-bottom{font-size:9px}}
</style>
