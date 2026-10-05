import AMapLoader from '@amap/amap-jsapi-loader';
import { get, message } from './api';
import { createMapRuntime, type MapConfig } from './map-runtime';

const runtime = createMapRuntime({
  fetchConfig: () => get<MapConfig>('/map/config'),
  async loadSdk(config) {
    (window as any)._AMapSecurityConfig = { serviceHost: location.origin + config.serviceHost };
    try {
      const api = await AMapLoader.load({ key: config.key, version: '2.0', plugins: [] });
      api.getConfig().appname = 'amap-jsapi-skill';
      return api;
    } catch {
      // Reset only after an actual SDK failure, before any map instance exists.
      (AMapLoader as typeof AMapLoader & { reset: () => void }).reset();
      document.querySelectorAll<HTMLScriptElement>('script[src^="https://webapi.amap.com/maps?"]').forEach(script => script.remove());
      throw new Error('地图未能加载，请检查网络或地图授权后重试');
    }
  },
  loadPlugins: (api, names) => new Promise(resolve => api.plugin(names, resolve)),
});

export const loadMapApi = runtime.load;
export const loadMapPlugins = runtime.plugins;
export const invalidateMapConfig = runtime.invalidate;
export const mapError = (error: any) => error instanceof Error && !('response' in error) ? error.message : message(error);

export function preloadMap() { return loadMapApi().catch(() => undefined); }

// Warm the SDK after the business page has rendered. Do not load it on login.
export function scheduleMapPreload() {
  let cancelled = false;
  const run = () => { if (!cancelled) void preloadMap(); };
  const idle = 'requestIdleCallback' in window ? window.requestIdleCallback(run, { timeout: 2500 }) : undefined;
  const fallback = idle == null ? window.setTimeout(run, 800) : undefined;
  const renew = window.setInterval(() => {
    if (document.visibilityState === 'visible') void runtime.configure().catch(() => undefined);
  }, 20 * 60_000);
  const visible = () => {
    if (document.visibilityState === 'visible' && !cancelled) void runtime.configure().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', visible);
  return () => {
    cancelled = true;
    if (idle != null) window.cancelIdleCallback(idle);
    if (fallback != null) window.clearTimeout(fallback);
    window.clearInterval(renew);
    document.removeEventListener('visibilitychange', visible);
  };
}
