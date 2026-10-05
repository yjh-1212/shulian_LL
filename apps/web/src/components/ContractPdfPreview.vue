<script setup lang="ts">
import {ref,watch,onBeforeUnmount,nextTick} from 'vue';
import {getDocument,GlobalWorkerOptions} from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc=workerUrl;
const props=defineProps<{blob:Blob}>(),canvas=ref<HTMLCanvasElement>(),page=ref(1),pages=ref(0),zoom=ref(1),busy=ref(false),error=ref(''),text=ref('');
let document:any,task:any,renderTask:any,generation=0,renderGeneration=0;
async function render(){const run=++renderGeneration,doc=document;if(!doc||!canvas.value)return;busy.value=true;error.value='';try{
 if(renderTask){renderTask.cancel();await renderTask.promise.catch(()=>{});}const pdfPage=await doc.getPage(page.value);if(run!==renderGeneration)return;
 const viewport=pdfPage.getViewport({scale:zoom.value}),ratio=Math.min(window.devicePixelRatio||1,2),target=canvas.value;
 target.width=Math.floor(viewport.width*ratio);target.height=Math.floor(viewport.height*ratio);target.style.width=Math.floor(viewport.width)+'px';target.style.height=Math.floor(viewport.height)+'px';
 renderTask=pdfPage.render({canvas:target,canvasContext:target.getContext('2d')!,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0]});await renderTask.promise;
 const content=await pdfPage.getTextContent();if(run===renderGeneration)text.value=content.items.map((i:any)=>i.str+(i.hasEOL?'\n':' ')).join('');
 }catch(e:any){if(run===renderGeneration&&e.name!=='RenderingCancelledException')error.value='PDF 页面加载失败，请下载原文件查看';}finally{if(run===renderGeneration)busy.value=false;}}
watch(()=>props.blob,async blob=>{const run=++generation;renderGeneration++;renderTask?.cancel();task?.destroy();document=undefined;pages.value=0;error.value='';text.value='';busy.value=true;try{
 const bytes=new Uint8Array(await blob.arrayBuffer());if(run!==generation)return;task=getDocument({data:bytes,useSystemFonts:true,cMapUrl:'/pdfjs-assets/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdfjs-assets/standard_fonts/',wasmUrl:'/pdfjs-assets/wasm/'});const loaded=await task.promise;if(run!==generation){loaded.destroy();return;}document=loaded;pages.value=loaded.numPages;page.value=1;await nextTick();await render();
 }catch(e:any){if(run===generation){error.value=e.name==='PasswordException'?'该 PDF 已加密，请使用未加密的合同模板':'无法预览此 PDF，请确认文件完整后重新上传';busy.value=false;} }},{immediate:true});
watch([page,zoom],render);onBeforeUnmount(()=>{generation++;renderGeneration++;renderTask?.cancel();task?.destroy();});
</script>
<template><div class="pdf-viewer"><div class="pdf-toolbar"><el-button :disabled="page<=1||busy" @click="page--">上一页</el-button><span>第 {{page}} / {{pages||'—'}} 页</span><el-button :disabled="page>=pages||busy" @click="page++">下一页</el-button><el-select v-model="zoom" aria-label="PDF 缩放" style="width:105px"><el-option v-for="n in [.75,1,1.25,1.5]" :key="n" :value="n" :label="Math.round(n*100)+'%'"/></el-select></div><el-alert v-if="error" :title="error" type="error" :closable="false"/><div v-loading="busy" class="pdf-canvas"><canvas ref="canvas" aria-label="合同模板 PDF 页面" role="img"/></div><details v-if="text" class="pdf-text"><summary>查看本页文本</summary><pre>{{text}}</pre></details></div></template>
<style scoped>.pdf-toolbar{display:flex;align-items:center;justify-content:center;gap:16px;padding:12px;background:#fff;border-bottom:1px solid #e3e7ed;position:sticky;top:0;z-index:1;font-size:12px;color:#788392}.pdf-canvas{padding:20px;min-height:250px;overflow:auto;text-align:center}.pdf-canvas canvas{background:white;box-shadow:0 2px 10px #19232b15}.pdf-text{margin:0 20px 20px;font-size:12px;color:#667180;background:#fff;padding:12px}.pdf-text summary{cursor:pointer}.pdf-text pre{white-space:pre-wrap;font:12px/1.8 var(--el-font-family);padding-top:12px}</style>
