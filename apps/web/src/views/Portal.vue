<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref} from 'vue';
import {useRouter} from 'vue-router';
import {Menu,Pause,X} from 'lucide-vue-next';
import {useAuth} from '../stores/auth';
import {message} from '../api';
import Icon from '../components/Icon.vue';

const auth=useAuth(),router=useRouter();
const entering=ref(false),entryError=ref(''),entryTarget=ref('/workbench');
const pageEl=ref<HTMLElement>(),heroEl=ref<HTMLElement>(),videoEl=ref<HTMLVideoElement>(),menuButton=ref<HTMLButtonElement>();
const scrolled=ref(false),menuOpen=ref(false),videoReady=ref(false),videoFailed=ref(false);
const motionPreference=window.matchMedia('(prefers-reduced-motion: reduce)');
const userPaused=ref(motionPreference.matches),videoEnabled=ref(!motionPreference.matches);
const heroVisible=ref(true),pageVisible=ref(!document.hidden);
const videoPlaying=computed(()=>videoEnabled.value&&!userPaused.value&&heroVisible.value&&pageVisible.value&&!videoFailed.value);
const serviceIndex=ref(0),stepIndex=ref(0),questionIndex=ref(0),dataIndex=ref(0);
const navigation=[{id:'services',label:'联运服务'},{id:'ai-service',label:'智能服务'},{id:'data-service',label:'数据服务'},{id:'logistics-map',label:'物流一张图'}];
const services=[
 {name:'公铁联运',icon:'train',title:'公路接驳，铁路干线。',description:'适合产地集货与长距离干线运输，衔接粮食集散地、铁路货运站与目的地配送。',image:'/assets/portal/grain-logistics-poster.webp',alt:'粮食集散场站、粮仓与铁路运输网络',stages:['产地集货','公路接驳','铁路运输','到站配送']},
 {name:'公水联运',icon:'ship',title:'从产地到港口，通江达海。',description:'以公路连接粮食产地与港口，通过水运干线衔接南方市场，协调集港、装船与交付。',image:'/assets/portal/intermodal-port.webp',alt:'粮食港口的粮仓、货船与公路运输',stages:['产地集货','公路集港','港口装船','水运到达']},
 {name:'铁水联运',icon:'anchor',title:'铁路连港，水运接力。',description:'组合铁路集运与水运干线，统筹铁路站场、港口换装与船舶运输之间的业务衔接。',image:'/assets/data-service/vessel-photo-v3.webp',alt:'水运货船与港口航道',stages:['铁路集运','到港换装','水运干线','目的港交付']},
 {name:'公铁水联运',icon:'network',title:'多程协同，一路相连。',description:'结合货源位置、运输条件与时效要求，组织公路、铁路和水运，协同推进多程运输。',image:'/assets/data-service/port-photo-v3.webp',alt:'连接公路、铁路与水运的港口作业场景',stages:['公路接驳','铁路干线','港口换装','水运交付']}
];
const steps=[
 {name:'提出需求',icon:'package',title:'把运输要求，一次说清。',description:'填写货物、数量、装卸地点与时间要求，集中管理每一份运输需求。',points:['货物与装载条件','起运、到达与时间要求','需求发布与状态管理'],image:'demand',alt:'系统运输需求列表，展示货物、运输线路、时间与匹配状态',target:'/supply-demand/demands',action:'管理运输需求'},
 {name:'规划方案',icon:'route',title:'比较路线，选择合适方案。',description:'结合运输条件，比较不同联运方案的路线、测算费用与预计时效。',points:['公路、铁路与水运组合','路线与运输条件设置','费用和时效综合比较'],image:'planning',alt:'系统方案规划界面，包含路线、货物、时间与预算条件',target:'/plans/solve',action:'开始方案规划'},
 {name:'匹配运力',icon:'handshake',title:'让运输需求，找到承运资源。',description:'查看需求与运力的匹配情况，协同处理承运报价与确认。',points:['需求与运输供给衔接','承运条件与报价查看','匹配进度集中管理'],image:'matching',alt:'系统供需匹配界面，展示运输需求与承运匹配情况',target:'/matches',action:'查看供需匹配'},
 {name:'组织运输',icon:'truck',title:'合同与运单，衔接每一程。',description:'围绕联运运单组织业务，查看承运主体、运输阶段和履约进展。',points:['合同与联运运单关联','多程运输阶段协作','业务执行与履约进度'],image:'execution',alt:'系统联运服务界面，展示运单、合同、承运企业和运输进度',target:'/services',action:'查看联运服务'},
 {name:'全程跟踪',icon:'map',title:'节点与进度，沿途掌握。',description:'关联运输运单，查看各程运输状态、业务节点和需要关注的异常。',points:['运输阶段与节点记录','车辆、铁路和船舶信息','进度查看与异常关注'],image:'tracking',alt:'系统运输过程界面，展示联运阶段与运输节点',target:'/tracking/journeys',action:'打开全程跟踪'}
];
const questions=[
 {stage:'运输前',icon:'route',title:'怎么运更合适？',question:'盘锦到广州的玉米，可以怎么安排联运？',intro:'可以先比较公水、铁水与公铁水等联运方式，再结合实际装卸位置、数量和时间要求选择方案。',items:[{title:'比较运输方式',text:'结合集港、干线运输与末端配送，梳理可选链路。'},{title:'核对费用与时效',text:'综合运输、换装等费用与预计运输时间。'},{title:'补充运输条件',text:'明确装载形式、计划发运时间和要求到达时间。'}],tags:['联运方案求解'],code:'PLAN',action:'试试方案规划'},
 {stage:'运输中',icon:'map',title:'现在运到哪里了？',question:'这票运输当前进展如何，有哪些需要关注的异常？',intro:'关联运单后，智能助手可以汇总当前可见的运输阶段、节点记录和业务异常，帮助你快速了解进度。',items:[{title:'看当前进度',text:'整理已完成、执行中和待执行的运输阶段。'},{title:'看节点与来源',text:'保留记录时间与来源，区分位置和业务节点。'},{title:'看异常与影响',text:'结合到达时间、港口作业及环境信息辅助研判。'}],tags:['智能问踪','ETA 延误预测','港口拥堵分析','环境异常分析'],code:'TRACK',action:'试试智能问踪'},
 {stage:'交付时',icon:'scan',title:'单据有哪些要核对？',question:'帮我检查这份运输单据，哪些字段需要复核？',intro:'提交单据后，智能助手可以提取关键字段，辅助核对货物、数量、业务编号与签收信息。',items:[{title:'提取关键信息',text:'整理单据中的业务字段，减少重复查找。'},{title:'关注缺失与差异',text:'提示需要进一步检查的字段与内容。'},{title:'由业务人员确认',text:'结合原始单据与业务记录完成最终复核。'}],tags:['单据识别与复核'],code:'DOCUMENT',action:'试试单据复核'}
];
const agents=[{code:'PLAN',icon:'route',name:'联运方案求解'},{code:'TRACK',icon:'map',name:'智能问踪'},{code:'ETA',icon:'clock',name:'ETA 延误预测'},{code:'PORT',icon:'anchor',name:'港口拥堵分析'},{code:'ENVIRONMENT',icon:'shield',name:'环境异常分析'},{code:'DOCUMENT',icon:'scan',name:'单据识别与复核'}];
const dataUses=[
 {name:'找资源',icon:'network',theme:'运力资源',title:'了解可用资源，衔接运输需求。',description:'查看运力资源与承运条件，为运输组织和业务协作提供参考。',image:'/assets/data-service/capacity-v2.webp',alt:'粮食港口的公路、铁路和水运资源',fields:['起运与目的地区','运输方式与承运条件','运力资源与服务范围']},
 {name:'看态势',icon:'chart',theme:'通道态势',title:'关注通道运行，辅助运输判断。',description:'结合通道汇总与运输风险信息，了解业务分布和需要关注的运行变化。',image:'/assets/data-service/corridor-v2.webp',alt:'粮食运输通道与物流网络场景',fields:['运输通道与业务分布','运输结构与规模汇总','时效与运输风险信息']},
 {name:'查链路',icon:'map',theme:'链路追溯',title:'串联运输节点，查看业务来路。',description:'在授权范围内查询运单和节点信息，将分散记录连接为可追溯的运输链路。',image:'/assets/data-service/trace-v2.webp',alt:'粮食运输的仓储、单据与链路追溯场景',fields:['关联运单与运输环节','节点记录与更新时间','记录来源与业务关联']}
];
const partners=[{name:'粮食贸易企业',icon:'grain'},{name:'物流运营企业',icon:'network'},{name:'公路承运商',icon:'truck'},{name:'铁路运营单位',icon:'train'},{name:'港口企业',icon:'anchor'},{name:'船公司',icon:'ship'}];
const activeService=computed(()=>services[serviceIndex.value]!);
const activeStep=computed(()=>steps[stepIndex.value]!);
const activeQuestion=computed(()=>questions[questionIndex.value]!);
const activeData=computed(()=>dataUses[dataIndex.value]!);

async function enterPlatform(target='/workbench'){
 if(entering.value)return;
 entering.value=true;entryError.value='';entryTarget.value=target;menuOpen.value=false;
 try{await auth.enterPlatform();await router.push(auth.user?.mustChangePassword?'/account':target);}
 catch(error){entryError.value=message(error);}
 finally{entering.value=false;}
}
function jumpTo(id:string){menuOpen.value=false;document.getElementById(id)?.scrollIntoView({behavior:motionPreference.matches?'auto':'smooth',block:'start'});}
function closeMenu(focus=false){menuOpen.value=false;if(focus)menuButton.value?.focus();}
function updateScroll(){scrolled.value=window.scrollY>48;}
function onTabKey(event:KeyboardEvent,group:'service'|'step'|'question'|'data'){
 const groups={service:{state:serviceIndex,count:services.length},step:{state:stepIndex,count:steps.length},question:{state:questionIndex,count:questions.length},data:{state:dataIndex,count:dataUses.length}};
 const {state,count}=groups[group];let target=state.value;
 if(event.key===(group==='question'?'ArrowDown':'ArrowRight'))target=(target+1)%count;
 else if(event.key===(group==='question'?'ArrowUp':'ArrowLeft'))target=(target+count-1)%count;
 else if(event.key==='Home')target=0;
 else if(event.key==='End')target=count-1;
 else return;
 event.preventDefault();state.value=target;void nextTick(()=>document.getElementById(group+'-tab-'+target)?.focus());
}
function syncVideo(){
 const video=videoEl.value;if(!video)return;
 if(!videoPlaying.value){video.pause();return;}
 if(video.readyState<2)return;
 void video.play().catch(()=>{if(videoPlaying.value&&videoEl.value===video)userPaused.value=true;});
}
async function toggleVideo(){
 const shouldStart=videoFailed.value||!videoEnabled.value||userPaused.value;
 if(videoFailed.value){videoFailed.value=false;videoReady.value=false;}
 videoEnabled.value=true;userPaused.value=!shouldStart;await nextTick();syncVideo();
}
function onVideoError(){videoReady.value=false;videoFailed.value=true;}
function onVisibility(){pageVisible.value=!document.hidden;syncVideo();}
function onMotionChange(event:MediaQueryListEvent){if(event.matches){userPaused.value=true;syncVideo();}}
let heroObserver:IntersectionObserver|undefined,revealObserver:IntersectionObserver|undefined;
onMounted(()=>{
 updateScroll();window.addEventListener('scroll',updateScroll,{passive:true});document.addEventListener('visibilitychange',onVisibility);motionPreference.addEventListener('change',onMotionChange);
 if('IntersectionObserver' in window){
  heroObserver=new IntersectionObserver(([entry])=>{heroVisible.value=!!entry?.isIntersecting;syncVideo();},{threshold:0});if(heroEl.value)heroObserver.observe(heroEl.value);
  if(!motionPreference.matches){revealObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');revealObserver?.unobserve(entry.target);}}),{threshold:.08});pageEl.value?.querySelectorAll('.portal-reveal').forEach(el=>{el.classList.add('will-reveal');revealObserver?.observe(el);});}
 }
 syncVideo();
});
onBeforeUnmount(()=>{window.removeEventListener('scroll',updateScroll);document.removeEventListener('visibilitychange',onVisibility);motionPreference.removeEventListener('change',onMotionChange);heroObserver?.disconnect();revealObserver?.disconnect();videoEl.value?.pause();});
</script>

<template>
 <div ref="pageEl" class="portal-page" @keydown.esc="closeMenu(true)">
  <a class="skip-link" href="#portal-main">跳到主要内容</a>
  <header class="portal-header" :class="{'is-scrolled':scrolled,'is-menu-open':menuOpen}">
   <a href="#portal-main" class="portal-brand" aria-label="辽粮智运首页" @click.prevent="jumpTo('portal-main')"><img src="/assets/liaoliang-logo.png" alt="" width="43" height="47"/><span><strong>辽粮智运</strong><small>智能多式联运平台</small></span></a>
   <nav id="portal-navigation" aria-label="首页导航" :class="{'is-open':menuOpen}"><a v-for="item in navigation" :key="item.id" :href="'#'+item.id" @click.prevent="jumpTo(item.id)">{{item.label}}</a></nav>
   <button class="portal-header-action" :disabled="entering" :aria-busy="entering" @click="enterPlatform()">{{entering?'正在进入…':'进入平台'}}<Icon name="arrow" :size="17"/></button>
   <button ref="menuButton" class="portal-menu-toggle" :aria-expanded="menuOpen" aria-controls="portal-navigation" :aria-label="menuOpen?'关闭导航':'打开导航'" @click="menuOpen=!menuOpen"><X v-if="menuOpen" :size="23"/><Menu v-else :size="23"/></button>
  </header>
  <div v-if="entryError" class="portal-entry-error" role="alert"><span>{{entryError}}</span><button :disabled="entering" @click="enterPlatform(entryTarget)">重试</button><router-link to="/login">账号密码登录</router-link><button aria-label="关闭提示" @click="entryError=''">关闭</button></div>
  <main id="portal-main" tabindex="-1">
   <section ref="heroEl" class="portal-hero" aria-labelledby="portal-title">
    <img class="hero-image" src="/assets/portal/grain-logistics-clean-poster.webp" alt="粮食集散场站与铁路运输场景" fetchpriority="high" width="1920" height="1080"/>
    <video v-if="videoEnabled&&!videoFailed" ref="videoEl" class="hero-video" :class="{'is-ready':videoReady}" src="/assets/portal/grain-logistics-clean.mp4" poster="/assets/portal/grain-logistics-clean-poster.webp" :autoplay="!userPaused" muted loop playsinline preload="metadata" aria-hidden="true" tabindex="-1" disablepictureinpicture @loadeddata="videoReady=true" @canplay="syncVideo" @error="onVideoError"/>
    <div class="hero-shade"/>
    <div class="portal-shell hero-inner"><p class="hero-kicker"><span/>连接北方粮仓与南方市场</p><h1 id="portal-title">数智联运<span class="hero-dot"> · </span><br/>畅通南北</h1><p class="hero-subtitle">面向粮食贸易与物流企业<br/>连接多式运输，协同粮食全程交付。</p><div class="hero-actions"><button class="portal-btn primary" :disabled="entering" :aria-busy="entering" @click="enterPlatform()">{{entering?'正在进入…':'进入平台'}}<Icon name="arrow" :size="19"/></button><a href="#services" class="hero-text-link" @click.prevent="jumpTo('services')">了解联运服务<Icon name="down" :size="17"/></a></div></div>
    <div class="hero-controls"><button class="hero-scroll" aria-label="向下浏览联运服务" @click="jumpTo('services')"><span class="hero-scroll-line"/><span>向下探索</span><Icon name="down" :size="17"/></button><button class="hero-video-toggle" :aria-label="videoFailed?'重新加载背景视频':userPaused?'播放背景视频':'暂停背景视频'" :aria-pressed="!userPaused&&!videoFailed" @click="toggleVideo"><Icon v-if="userPaused||videoFailed" name="play" :size="16"/><Pause v-else :size="16"/></button></div>
    <aside class="hero-signature" aria-label="北粮南运，全程协同"><span>北粮南运 · 全程协同</span></aside>
   </section>

   <div class="portal-shell portal-intro portal-reveal"><p class="portal-eyebrow">辽粮智运</p><p class="portal-intro-statement">连接粮食产业与运输资源，<br class="intro-break"/>让每一程协作清晰、有序。</p><p class="portal-body-copy">从产地集货到目的地交付，<br/>把运输需求、承运资源与业务进度连接起来。</p></div>

   <section id="services" class="portal-services" aria-labelledby="services-title"><div class="portal-shell">
    <div class="portal-section-heading portal-reveal"><div><p class="portal-eyebrow">联运服务</p><h2 id="services-title">一份运输需求，贯通每一程<span class="portal-title-dot">。</span></h2></div><p class="portal-body-copy">结合货物与运输条件，<br/>组织公路、铁路和水运协同。</p></div>
    <div class="portal-service-scene portal-reveal"><img :key="activeService.image" class="service-scene-image" :src="activeService.image" :alt="activeService.alt" loading="lazy" width="1600" height="850"/><div class="service-scene-shade"/><div id="service-panel" class="service-scene-copy" role="tabpanel" :aria-labelledby="'service-tab-'+serviceIndex"><span class="service-scene-label"><Icon :name="activeService.icon" :size="19"/>{{activeService.name}}</span><h3>{{activeService.title}}</h3><p>{{activeService.description}}</p><div class="service-stage-route" aria-label="运输环节"><template v-for="(stage,index) in activeService.stages" :key="stage"><Icon v-if="index" name="arrow" :size="16"/><span>{{stage}}</span></template></div><button class="portal-inline-link light" @click="jumpTo('service-process')">了解业务流程<Icon name="down" :size="17"/></button></div><div class="service-scene-tabs" role="tablist" aria-label="联运方式" @keydown="onTabKey($event,'service')"><button v-for="(service,index) in services" :id="'service-tab-'+index" :key="service.name" role="tab" :aria-selected="serviceIndex===index" aria-controls="service-panel" :tabindex="serviceIndex===index?0:-1" :class="{active:serviceIndex===index}" @click="serviceIndex=index"><Icon :name="service.icon" :size="22"/><span>{{service.name}}</span><Icon name="arrow" :size="16"/></button></div></div>

    <div id="service-process" class="portal-process portal-reveal"><div class="process-heading"><h3>从需求到运输，一条流程协同推进。</h3><span>点击环节，了解系统如何协作</span></div><div class="process-tabs" role="tablist" aria-label="联运业务流程" @keydown="onTabKey($event,'step')"><button v-for="(step,index) in steps" :id="'step-tab-'+index" :key="step.name" role="tab" :aria-selected="stepIndex===index" aria-controls="step-panel" :tabindex="stepIndex===index?0:-1" :class="{active:stepIndex===index}" @click="stepIndex=index"><span class="process-number">{{String(index+1).padStart(2,'0')}}</span><span>{{step.name}}</span><Icon v-if="index<steps.length-1" name="arrow" :size="17"/></button></div>
     <div id="step-panel" class="process-content" role="tabpanel" :aria-labelledby="'step-tab-'+stepIndex"><div class="process-copy"><Icon :name="activeStep.icon" :size="29"/><h4>{{activeStep.title}}</h4><p>{{activeStep.description}}</p><ul><li v-for="point in activeStep.points" :key="point"><Icon name="check" :size="15"/>{{point}}</li></ul><button class="portal-inline-link" :disabled="entering" @click="enterPlatform(activeStep.target)">{{activeStep.action}}<Icon name="external" :size="18"/></button></div><figure class="process-screen"><figcaption><span><i/>辽粮智运 · {{activeStep.name}}</span><span>业务协同平台</span></figcaption><img :key="activeStep.image" :src="'/assets/portal/product-'+activeStep.image+'.jpg'" :alt="activeStep.alt" width="1400" height="740" loading="lazy" decoding="async"/></figure></div>
    </div>
   </div></section>

   <section id="ai-service" class="portal-ai" aria-labelledby="ai-title"><div class="portal-shell">
    <div class="portal-section-heading portal-reveal"><div><p class="portal-eyebrow">智能服务</p><h2 id="ai-title">让复杂运输，多一份清晰判断<span class="portal-title-dot">。</span></h2></div><p class="portal-body-copy">从一个业务问题出发，<br/>辅助规划、跟踪与复核。</p></div>
    <div class="portal-ai-layout portal-reveal"><div class="ai-questions"><div class="ai-intro"><img src="/assets/portal/liaoliang-ai.webp" alt="辽粮智能助手" loading="lazy" width="80" height="80"/><div><strong>懂粮食，也懂运输。</strong><p>把繁杂的业务信息，整理为清晰答案。</p></div></div><div class="ai-question-tabs" role="tablist" aria-label="智能服务场景" aria-orientation="vertical" @keydown="onTabKey($event,'question')"><button v-for="(question,index) in questions" :id="'question-tab-'+index" :key="question.stage" role="tab" :aria-selected="questionIndex===index" aria-controls="question-panel" :tabindex="questionIndex===index?0:-1" :class="{active:questionIndex===index}" @click="questionIndex=index"><span class="ai-stage">{{question.stage}}</span><strong>{{question.title}}</strong><Icon name="arrow" :size="19"/></button></div><button class="portal-inline-link" :disabled="entering" @click="enterPlatform('/agents')">打开智能助手<Icon name="external" :size="18"/></button></div>
     <div id="question-panel" class="ai-conversation" role="tabpanel" :aria-labelledby="'question-tab-'+questionIndex"><header><span><Icon name="bot" :size="19"/>辽粮智能助手</span><small>问答示例</small></header><div class="ai-user-question"><Icon name="user" :size="17"/><p>{{activeQuestion.question}}</p></div><div class="ai-answer"><span class="ai-answer-icon"><Icon name="bot" :size="20"/></span><div><p class="ai-answer-intro">{{activeQuestion.intro}}</p><ul><li v-for="item in activeQuestion.items" :key="item.title"><Icon name="check" :size="15"/><div><strong>{{item.title}}</strong><p>{{item.text}}</p></div></li></ul></div></div><footer><span>{{activeQuestion.tags.join(' · ')}}</span><button :disabled="entering" @click="enterPlatform('/agents?agent='+activeQuestion.code)">{{activeQuestion.action}}<Icon name="arrow" :size="16"/></button></footer></div>
    </div>
    <div class="portal-agent-links portal-reveal" aria-label="全部智能服务"><button v-for="agent in agents" :key="agent.code" :disabled="entering" @click="enterPlatform('/agents?agent='+agent.code)"><Icon :name="agent.icon" :size="20"/><span>{{agent.name}}</span><Icon name="external" :size="14"/></button></div>
   </div></section>

   <section id="data-service" class="portal-data" aria-labelledby="data-title"><div class="portal-shell">
    <div class="portal-section-heading portal-reveal"><div><p class="portal-eyebrow">数据服务</p><h2 id="data-title">让业务数据，支持每一次判断<span class="portal-title-dot">。</span></h2></div><button class="portal-inline-link" :disabled="entering" @click="enterPlatform('/data')">进入数据服务<Icon name="external" :size="19"/></button></div>
    <div class="data-showcase portal-reveal"><div class="data-use-tabs" role="tablist" aria-label="数据服务用途" @keydown="onTabKey($event,'data')"><button v-for="(use,index) in dataUses" :id="'data-tab-'+index" :key="use.name" role="tab" :aria-selected="dataIndex===index" aria-controls="data-panel" :tabindex="dataIndex===index?0:-1" :class="{active:dataIndex===index}" @click="dataIndex=index"><Icon :name="use.icon" :size="23"/><span><strong>{{use.name}}</strong><small>{{use.theme}}</small></span><Icon name="arrow" :size="18"/></button></div><div id="data-panel" class="data-use-content" role="tabpanel" :aria-labelledby="'data-tab-'+dataIndex"><div class="data-use-image"><img :key="activeData.image" :src="activeData.image" :alt="activeData.alt" loading="lazy" width="960" height="640"/></div><div class="data-use-copy"><span class="data-theme"><Icon name="database" :size="17"/>{{activeData.theme}}</span><h3>{{activeData.title}}</h3><p>{{activeData.description}}</p><ul><li v-for="field in activeData.fields" :key="field"><Icon name="check" :size="15"/>{{field}}</li></ul><div class="data-access-note"><Icon name="shield" :size="16"/><span>按业务需要申请授权，在授权范围内使用数据。</span></div><button class="portal-inline-link" :disabled="entering" @click="enterPlatform('/data')">查看数据产品<Icon name="external" :size="18"/></button></div></div></div>
   </div></section>

   <section id="logistics-map" class="portal-logistics" aria-labelledby="logistics-title"><div class="portal-shell">
    <div class="portal-section-heading portal-reveal"><div><p class="portal-eyebrow">物流一张图</p><h2 id="logistics-title">一张图，掌握粮食物流全局。</h2><p class="portal-body-copy">汇聚运输网络、业务规模、通道结构与履约情况，让整体运营清晰可见。</p></div><router-link class="portal-inline-link light" to="/cockpit?view=platform">查看物流全景<Icon name="external" :size="20"/></router-link></div>
    <router-link class="logistics-preview portal-reveal" to="/cockpit?view=platform" aria-label="查看物流全景，打开平台运营"><div class="logistics-image-window"><img src="/assets/portal/cockpit-platform.webp" alt="平台运营全景：全国运输网络、业务规模、联运结构、履约、风险与结算统计" width="1920" height="1080" loading="lazy" decoding="async"/></div><span class="logistics-preview-open"><Icon name="external" :size="20"/>查看物流全景</span></router-link>
    <div class="logistics-topics portal-reveal"><span><Icon name="network" :size="19"/>全国运输网络</span><span><Icon name="chart" :size="19"/>业务规模与趋势</span><span><Icon name="route" :size="19"/>多式联运结构</span><span><Icon name="shield" :size="19"/>履约与风险分布</span></div>
   </div></section>

   <section class="portal-audience"><div class="portal-shell portal-reveal"><p class="portal-eyebrow">连接粮食产业与多式联运上下游</p><div class="portal-partners"><span v-for="partner in partners" :key="partner.name"><Icon :name="partner.icon" :size="25"/>{{partner.name}}</span></div><div class="portal-conversion"><h2>让粮食运输的每一程，<br/>连接得更紧密。</h2><button class="portal-btn primary" :disabled="entering" :aria-busy="entering" @click="enterPlatform()">{{entering?'正在进入…':'进入平台'}}<Icon name="arrow" :size="20"/></button></div></div></section>
  </main>
  <footer class="portal-footer"><div class="portal-shell"><div class="portal-footer-main"><div><a href="#portal-main" class="portal-brand" @click.prevent="jumpTo('portal-main')"><img src="/assets/liaoliang-logo.png" alt="" width="43" height="47"/><span><strong>辽粮智运</strong><small>智能多式联运平台</small></span></a><p>连接北方粮仓与南方市场。<br/>让每一程运输，清晰、有序。</p></div><nav aria-label="平台能力"><strong>了解平台</strong><a v-for="item in navigation" :key="item.id" :href="'#'+item.id" @click.prevent="jumpTo(item.id)">{{item.label}}</a></nav><nav aria-label="平台访问入口"><strong>快捷入口</strong><button :disabled="entering" @click="enterPlatform()">业务工作台</button><router-link to="/cockpit?view=platform">物流一张图</router-link><router-link to="/login">账号登录</router-link></nav><a href="#portal-main" class="portal-back-top" @click.prevent="jumpTo('portal-main')">返回顶部<Icon name="up" :size="18"/></a></div><div class="portal-footer-bottom"><span>辽粮智运 · 智能多式联运平台</span><span>数智联运 · 畅通南北</span></div></div></footer>
 </div>
</template>
<style src="./portal.css"/>
