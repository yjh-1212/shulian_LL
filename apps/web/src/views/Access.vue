<script setup lang="ts">import {useRoute} from 'vue-router';const route=useRoute();</script>
<template><el-result :title="route.path==='/forbidden'?'无权访问此页面':'该功能尚未开放'" :sub-title="route.path==='/forbidden'?'请联系平台管理员确认角色和数据授权。':'请通过已开放的导航入口继续操作。'" icon="info"><template #extra><router-link to="/workbench"><el-button type="primary">返回工作台</el-button></router-link></template></el-result></template>
