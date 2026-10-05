export const driverUrl=import.meta.env.VITE_DRIVER_URL||(import.meta.env.DEV?`${location.protocol}//${location.hostname}:5174/`:new URL('/driver',location.origin).href);
