<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { EChartsType } from 'echarts/core';
import { createGrainChartOption, grainRowDescription, type GrainChartConfig, type GrainChartKind, type GrainChartRow } from '../grain-source-charts';

const props = withDefaults(defineProps<{
  kind: GrainChartKind;
  rows: GrainChartRow[];
  config: GrainChartConfig;
  selected?: string;
  label?: string;
}>(), { selected: '', label: '粮源统计图表' });
const emit = defineEmits<{ select: [id: string] }>();
const element = ref<HTMLDivElement>();
const error = ref('');
const ready = ref(false);
const reducedMotion = ref(false);
const accessibleRows = computed(() => props.rows.map(row => ({ id: row.id, description: grainRowDescription(row) })));
let chart: EChartsType | undefined;
let observer: ResizeObserver | undefined;
let motion: MediaQueryList | undefined;
let disposed = false;
let resizeFrame = 0;
let generation = 0;
let lastDataSignature = '';

function render() {
  if (!chart || disposed) return;
  const dataSignature = JSON.stringify([props.kind, props.rows]);
  const dataChanged = dataSignature !== lastDataSignature;
  const replacingScope = lastDataSignature !== '' && dataChanged;
  // A different statistical scope is a replacement, so departing treemap tiles must not linger.
  if (dataChanged) {
    chart.clear();
    lastDataSignature = dataSignature;
  }
  chart.setOption(createGrainChartOption(props.kind, props.rows, props.config, props.selected, reducedMotion.value || replacingScope), { notMerge: dataChanged, lazyUpdate: false });
}

function resize() {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => { if (!disposed) chart?.resize(); });
}

async function initialise() {
  if (!element.value || chart || disposed) return;
  const sequence = ++generation;
  error.value = '';
  try {
    // A lazy component owns this import boundary; only used chart families are registered.
    const [echarts, chartModules, componentModules, rendererModules, featureModules] = await Promise.all([
      import('echarts/core'),
      import('echarts/charts').then(({ TreemapChart, HeatmapChart, ScatterChart, CustomChart }) => [TreemapChart, HeatmapChart, ScatterChart, CustomChart]),
      import('echarts/components').then(({ GridComponent, TooltipComponent, LegendComponent, VisualMapContinuousComponent, GraphicComponent, AriaComponent }) => [GridComponent, TooltipComponent, LegendComponent, VisualMapContinuousComponent, GraphicComponent, AriaComponent]),
      import('echarts/renderers').then(({ CanvasRenderer }) => [CanvasRenderer]),
      import('echarts/features').then(({ LabelLayout }) => [LabelLayout]),
    ]);
    if (disposed || sequence !== generation || !element.value) return;
    echarts.use([...chartModules, ...componentModules, ...rendererModules, ...featureModules]);
    chart = echarts.init(element.value, undefined, { renderer: 'canvas', devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) });
    chart.on('click', (params: any) => {
      const id = params.data?.id;
      if (typeof id === 'string') emit('select', id);
    });
    render();
    ready.value = true;
    observer = new ResizeObserver(resize);
    observer.observe(element.value);
  } catch {
    chart?.dispose();
    chart = undefined;
    if (!disposed) { ready.value = false; error.value = '图表加载失败'; }
  }
}

function motionChanged(event: MediaQueryListEvent) { reducedMotion.value = event.matches; render(); }
watch(() => [props.kind, props.rows, props.config, props.selected], render, { deep: true });
onMounted(() => {
  motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  reducedMotion.value = motion.matches;
  motion.addEventListener('change', motionChanged);
  void initialise();
});
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  cancelAnimationFrame(resizeFrame);
  observer?.disconnect();
  motion?.removeEventListener('change', motionChanged);
  chart?.dispose();
  chart = undefined;
});
defineExpose({ resize, getOption: () => chart?.getOption() });
</script>

<template>
  <div class="gs-chart" :data-kind="kind" :data-ready="ready" :aria-label="label">
    <div ref="element" class="gs-chart-canvas" aria-hidden="true" />
    <div v-if="error" class="gs-chart-state" role="status">
      <span>{{ error }}</span><button type="button" @click="initialise">重新加载</button>
    </div>
    <div v-else-if="!ready" class="gs-chart-state" role="status">正在加载图表…</div>
    <details class="gs-chart-accessible">
      <summary>{{ label }}：查看数据及选择地区</summary>
      <div class="gs-chart-data-list">
        <button v-for="row in accessibleRows" :key="row.id" type="button" :aria-pressed="selected === row.id" @click="emit('select', row.id)">{{ row.description }}</button>
        <span v-if="!accessibleRows.length">暂无已公布数据</span>
      </div>
    </details>
  </div>
</template>

<style scoped>
.gs-chart{position:relative;min-width:0;min-height:0;width:100%;height:100%;isolation:isolate}
.gs-chart-canvas{width:100%;height:100%;min-height:0}
.gs-chart-state{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;gap:12px;color:var(--cc-muted);font-size:12px;background:transparent}
.gs-chart-state button{border:1px solid var(--cc-border);border-radius:4px;padding:5px 9px;color:var(--cc-primary);background:var(--cc-panel-solid);cursor:pointer}
.gs-chart-accessible{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);top:0;left:0;z-index:4}
.gs-chart-accessible:focus-within,.gs-chart-accessible[open]{width:100%;height:auto;max-height:100%;overflow:auto;clip-path:none;background:var(--cc-panel-solid);border:1px solid var(--cc-primary);border-radius:5px;color:var(--cc-text);box-shadow:0 6px 20px #0002}
.gs-chart-accessible summary{padding:7px 9px;cursor:pointer;font-size:12px}
.gs-chart-data-list{display:grid;gap:2px;padding:2px 7px 7px}
.gs-chart-data-list button{border:0;border-left:2px solid transparent;text-align:left;color:var(--cc-text);background:transparent;padding:6px;font:inherit;font-size:11px;line-height:1.6;cursor:pointer}
.gs-chart-data-list button[aria-pressed=true]{border-left-color:var(--cc-primary);background:color-mix(in srgb,var(--cc-primary) 10%,transparent)}
.gs-chart-accessible summary:focus-visible,.gs-chart-data-list button:focus-visible,.gs-chart-state button:focus-visible{outline:2px solid var(--cc-primary);outline-offset:-2px}
</style>
