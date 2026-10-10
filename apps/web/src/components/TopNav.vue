<script setup lang="ts">
import { ref,computed,onMounted,onBeforeUnmount,nextTick,watch } from 'vue';
import { useRoute,useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import Icon from './Icon.vue';
import type { Menu } from '../types';
import { ElMessage } from 'element-plus';
import { message } from '../api';
const auth=useAuth(),route=useRoute(),router=useRouter();
const header=ref<HTMLElement>(),nav=ref<HTMLElement>(),measure=ref<HTMLElement>();
const hiddenIds=ref<string[]>([]);
const menus=computed<Menu[]>(()=>{
  const items=auth.menus.filter(m=>m.path!=='/cockpit');
  items.splice(items.findIndex(m=>m.path==='/workbench')+1,0,{id:'cockpit',label:'驾驶舱',path:'/cockpit',icon:'chart',permissionCode:'',displayOrder:2,overflowPriority:0,phase:1,available:true,children:[]});
  return items;
});
const visible=computed(()=>menus.value.filter(m=>!hiddenIds.value.includes(m.id)));
const overflow=computed(()=>menus.value.filter(m=>hiddenIds.value.includes(m.id)));
const active=(m:Menu)=>m.path==='/'?route.path==='/':route.path.startsWith(m.path);
const moreActive=computed(()=>overflow.value.some(active));
let observer:ResizeObserver|undefined;
async function fit(){
  await nextTick();if(!nav.value||!measure.value)return;
  const widths=new Map(Array.from(measure.value.children).map(el=>[(el as HTMLElement).dataset.id!,el.getBoundingClientRect().width]));
  const available=nav.value.getBoundingClientRect().width;
  let total=menus.value.reduce((sum,m)=>sum+(widths.get(m.id)||100),0);
  const hidden:string[]=[];
  if(total>available){total+=86;for(const m of [...menus.value].filter(m=>!['home','workbench','cockpit'].includes(m.id)&&m.path!=='/data').sort((a,b)=>b.overflowPriority-a.overflowPriority||b.displayOrder-a.displayOrder)){if(total<=available)break;hidden.push(m.id);total-=widths.get(m.id)||100;}}
  hiddenIds.value=hidden;
}
onMounted(()=>{observer=new ResizeObserver(()=>void fit());if(header.value)observer.observe(header.value);if(nav.value)observer.observe(nav.value);void fit();document.fonts.ready.then(fit);});
watch(menus,fit,{deep:true});
onBeforeUnmount(()=>observer?.disconnect());
async function logout(){try{await auth.logout();await router.push('/login');}catch(e){ElMessage.error(message(e));}}
function go(path:string){router.push(path);}
</script>
<template>
  <header ref="header" class="topbar">
    <router-link to="/" class="brand" aria-label="辽粮 首页"><img class="brand-logo" src="/assets/liaoliang-logo.png" alt="辽粮" width="48" height="48"/><span class="brand-name">智能多式联运<span class="brand-sub">物流数据系统</span></span></router-link>
    <nav ref="nav" class="main-nav" aria-label="主导航">
      <template v-for="m in visible" :key="m.id">
        <el-dropdown v-if="m.children.length" trigger="click" @command="go" popper-class="nav-dropdown">
          <button class="nav-button" :class="{active:active(m)}" :aria-label="m.label"><span>{{m.label}}</span><Icon name="down" :size="13"/></button>
          <template #dropdown><el-dropdown-menu><el-dropdown-item v-for="child in m.children" :key="child.id" :command="child.path" :disabled="!child.available" :class="{'child-active':active(child)}"><Icon :name="child.icon" :size="16"/><span>{{child.label}}</span><small v-if="!child.available">待开放</small></el-dropdown-item></el-dropdown-menu></template>
        </el-dropdown>
        <button v-else class="nav-button" :class="{active:active(m)}" :disabled="!m.available" :title="!m.available?'当前功能未启用':m.label" @click="go(m.path)">{{m.label}}</button>
      </template>
      <el-dropdown v-if="overflow.length" trigger="click" @command="go" popper-class="nav-dropdown more-dropdown">
        <button class="nav-button" :class="{active:moreActive}" aria-label="更多导航">更多<Icon name="down" :size="13"/></button>
        <template #dropdown><el-dropdown-menu>
          <template v-for="m in overflow" :key="m.id"><div v-if="m.children.length" class="menu-group-label">{{m.label}}</div><el-dropdown-item v-for="child in m.children.length?m.children:[m]" :key="child.id" :command="child.path" :disabled="!child.available" :class="{'child-active':active(child)}"><Icon :name="child.icon" :size="16"/>{{child.label}}<small v-if="!child.available">待开放</small></el-dropdown-item></template>
        </el-dropdown-menu></template>
      </el-dropdown>
    </nav>
    <div class="user-zone"><el-dropdown trigger="click" @command="(cmd:string)=>cmd==='logout'?logout():go('/account')"><button class="user-button" aria-label="用户菜单"><span class="avatar">{{auth.user?.displayName.slice(0,1)}}</span><span class="user-name">{{auth.user?.displayName}}</span><Icon name="down" :size="14"/></button><template #dropdown><el-dropdown-menu><el-dropdown-item disabled>{{auth.user?.businessEntity.name}}</el-dropdown-item><el-dropdown-item command="account">账号设置</el-dropdown-item><el-dropdown-item command="logout" divided>退出登录</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div>
    <div ref="measure" class="nav-measure" aria-hidden="true"><span v-for="m in menus" :key="m.id" :data-id="m.id" class="nav-button"><span>{{m.label}}</span><Icon v-if="m.children.length" name="down" :size="13"/></span></div>
  </header>
</template>
<style scoped>
.brand-logo{display:block;width:48px;height:48px;object-fit:contain;flex-shrink:0}
@media(max-width:600px){.brand-logo{width:42px;height:42px}}
</style>
