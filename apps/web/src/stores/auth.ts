import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api,get,renew,setToken } from '../api';
import type { User,Menu } from '../types';
export const useAuth=defineStore('auth',()=>{
  const user=ref<User|null>(null);const menus=ref<Menu[]>([]);let initialized=false;
  async function init(){if(initialized)return;try{const data=await renew();user.value=data.user;await loadMenus();}catch{user.value=null;}initialized=true;}
  async function loadMenus(){menus.value=user.value?.mustChangePassword?[]:await get<Menu[]>('/menus');}
  async function login(username:string,password:string){const data=(await api.post('/auth/login',{username,password})).data.data;setToken(data.accessToken);user.value=data.user;await loadMenus();initialized=true;}
  async function enterPlatform(){await init();if(!user.value){const data=(await api.post('/auth/experience')).data.data;setToken(data.accessToken);user.value=data.user;initialized=true;}await loadMenus();}
  async function logout(){await api.post('/auth/logout');clear();}
  function clear(){setToken('');user.value=null;menus.value=[];}
  const can=(p:string)=>!!user.value?.permissions.includes(p);
  return {user,menus,init,loadMenus,login,enterPlatform,logout,clear,can};
});
