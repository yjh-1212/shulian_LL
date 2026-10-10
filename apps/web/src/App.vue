<script setup lang="ts">
import { onMounted,onBeforeUnmount,watch } from 'vue';
import { scheduleMapPreload,invalidateMapConfig } from './amap';
import { useRoute,useRouter } from 'vue-router';
import { useAuth } from './stores/auth';
import TopNav from './components/TopNav.vue';
import Agent from './components/AgentEntry.vue';
const route=useRoute(),router=useRouter(),auth=useAuth();
let cancelMapPreload:(()=>void)|undefined,mapPreloadGeneration=0;
watch(()=>[auth.user?.id,auth.user?.mustChangePassword,auth.can('plan:read')||auth.can('tracking:read'),route.meta.cockpit],()=>{
  const generation=++mapPreloadGeneration;
  cancelMapPreload?.();invalidateMapConfig();
  // Authentication can finish before the initial lazy route resolves.
  void router.isReady().then(()=>{if(generation===mapPreloadGeneration&&auth.user&&!auth.user.mustChangePassword&&!route.meta.cockpit&&(auth.can('plan:read')||auth.can('tracking:read')))cancelMapPreload=scheduleMapPreload();});
},{immediate:true});
onBeforeUnmount(()=>{mapPreloadGeneration++;cancelMapPreload?.();});
const expired=()=>{auth.clear();router.push('/login');};
onMounted(()=>window.addEventListener('session-expired',expired));onBeforeUnmount(()=>window.removeEventListener('session-expired',expired));
</script>
<template>
  <router-view v-if="route.meta.public||route.path==='/login'||route.meta.driver"/>
  <router-view v-else-if="route.meta.agentCenter&&auth.user"/>
  <template v-else-if="auth.user"><a class="skip-link" href="#main">跳到主要内容</a><TopNav/><div class="breadcrumb-bar"><el-breadcrumb separator="/"><el-breadcrumb-item :to="{path:'/'}">首页</el-breadcrumb-item><el-breadcrumb-item v-if="route.path.startsWith('/system')">系统管理</el-breadcrumb-item><el-breadcrumb-item v-if="route.path.startsWith('/supply-demand')&&auth.user.businessEntity.type==='PLATFORM'">供需管理</el-breadcrumb-item><el-breadcrumb-item v-if="route.path.startsWith('/plans')">联运方案</el-breadcrumb-item><el-breadcrumb-item>{{route.meta.title}}</el-breadcrumb-item></el-breadcrumb><span class="workspace-identity">{{auth.user.businessEntity.name}}</span></div><main id="main" class="main-content" :class="{'map-workspace-main':route.meta.mapWorkspace}"><router-view/></main><footer v-if="!route.meta.mapWorkspace" class="app-footer"><span>北粮南运 · 智能多式联运物流数据系统</span><span>辽粮 · 联运业务协同平台</span></footer><Agent/></template>
</template>
