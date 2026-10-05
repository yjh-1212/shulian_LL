export interface MapConfig { key: string; serviceHost: string }
interface MapDependencies {
  fetchConfig: () => Promise<MapConfig>;
  loadSdk: (config: MapConfig) => Promise<any>;
  loadPlugins: (api: any, names: string[]) => Promise<void>;
  now?: () => number;
  configTtlMs?: number;
  timeoutMs?: number;
}

function bounded<T>(pending: Promise<T>, ms: number, text: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(text)), ms);
    pending.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

// Cache resources, never map instances. The proxy ticket expires after 30 minutes.
export function createMapRuntime(deps: MapDependencies) {
  const now = deps.now || Date.now, ttl = deps.configTtlMs ?? 20 * 60_000, timeout = deps.timeoutMs ?? 20_000;
  let config: MapConfig | undefined, expires = 0, configFlight: Promise<MapConfig> | undefined, epoch = 0;
  let sdkFlight: Promise<any> | undefined;
  const pluginFlights = new Map<string, Promise<void>>();

  function configure(): Promise<MapConfig> {
    if (config && now() < expires) return Promise.resolve(config);
    if (configFlight) return configFlight;
    const generation = epoch;
    const pending = deps.fetchConfig().then(value => {
      if (generation === epoch) { config = value; expires = now() + ttl; }
      return value;
    }).finally(() => { if (configFlight === pending) configFlight = undefined; });
    configFlight = pending;
    return pending;
  }

  async function load(): Promise<any> {
    const generation = epoch;
    const current = await bounded(configure(), timeout, '地图配置加载超时，请重试');
    if (generation !== epoch) throw new Error('地图会话已变更，请重试');
    if (!sdkFlight) {
      const pending = deps.loadSdk(current).catch(error => {
        if (sdkFlight === pending) sdkFlight = undefined;
        throw error;
      });
      sdkFlight = pending;
    }
    // A slow request remains shared; a retry must not inject a second SDK script.
    return bounded(sdkFlight, timeout, '地图加载超时，请检查网络后重试');
  }

  async function plugins(api: any, names: string[]): Promise<void> {
    const missing = [...new Set(names)].filter(name => !api[name.split('.').at(-1)!]).sort();
    if (!missing.length) return;
    const key = missing.join(',');
    let pending = pluginFlights.get(key);
    if (!pending) {
      pending = deps.loadPlugins(api, missing).finally(() => { pluginFlights.delete(key); });
      pluginFlights.set(key, pending);
    }
    await bounded(pending, timeout, '地图控件加载超时，请重试');
  }

  function invalidate() { epoch++; config = undefined; expires = 0; configFlight = undefined; }
  return { load, plugins, configure, invalidate };
}
