import { onMounted, onBeforeUnmount, ref, type Ref } from 'vue';
import { loadMapApi, loadMapPlugins, invalidateMapConfig, mapError } from './amap';

interface MapHooks {
  created: (map: any, api: any) => void;
  disposed?: () => void;
  ready?: () => void;
}

export function useMap(container: Ref<HTMLElement | undefined>, options: Record<string, any>, hooks: MapHooks, controlPosition = 'RB') {
  const loading = ref(true), ready = ref(false), error = ref(''), tilesLoading = ref(false), slowTiles = ref(false);
  const interactiveMs = ref(0), tilesMs = ref(0);
  let instance: any, generation = 0, disposed = false, tileTimer: ReturnType<typeof setTimeout> | undefined;
  let frame = 0, resizeFrame = 0, resize: ResizeObserver | undefined;

  function cleanup() {
    clearTimeout(tileTimer); cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame);
    resize?.disconnect(); resize = undefined;
    ready.value = false;
    hooks.disposed?.();
    instance?.destroy(); instance = undefined;
  }

  async function init() {
    const current = ++generation, started = performance.now();
    cleanup(); loading.value = true; error.value = ''; tilesLoading.value = false; slowTiles.value = false;
    interactiveMs.value = 0; tilesMs.value = 0;
    const active = () => !disposed && current === generation;
    try {
      const api = await loadMapApi();
      if (!active() || !container.value) return;
      const map = instance = new api.Map(container.value, { viewMode: '2D', showIndoorMap: false, ...options });
      tilesLoading.value = true;
      map.on('complete', () => {
        if (!active()) return;
        if (!tilesMs.value) tilesMs.value = Math.round(performance.now() - started);
        tilesLoading.value = false; slowTiles.value = false; clearTimeout(tileTimer);
      });
      // Routes and models can render while online tiles are still downloading.
      ready.value = true;
      hooks.created(map, api);
      frame = requestAnimationFrame(() => {
        if (!active()) return;
        loading.value = false;
        interactiveMs.value = Math.round(performance.now() - started);
        hooks.ready?.();
      });
      tileTimer = setTimeout(() => { if (active() && tilesLoading.value) slowTiles.value = true; }, 12_000);
      // Controls are optional; they must not delay the first map frame.
      void loadMapPlugins(api, ['AMap.Scale', 'AMap.ToolBar']).then(() => {
        if (!active()) return;
        map.addControl(new api.Scale());
        map.addControl(new api.ToolBar({ position: controlPosition }));
      }).catch(() => undefined);
      resize = new ResizeObserver(() => {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => { if (active() && typeof map.resize === 'function') map.resize(); });
      });
      resize.observe(container.value);
    } catch (cause) {
      if (!active()) return;
      cleanup(); loading.value = false; tilesLoading.value = false; error.value = mapError(cause);
    }
  }

  onMounted(init);
  onBeforeUnmount(() => { disposed = true; generation++; cleanup(); });
  const retry = () => { invalidateMapConfig(); return init(); };
  return { loading, ready, error, tilesLoading, slowTiles, interactiveMs, tilesMs, init: retry };
}
