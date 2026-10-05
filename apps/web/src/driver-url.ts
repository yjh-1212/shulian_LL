export const driverUrl=import.meta.env.VITE_DRIVER_URL||(import.meta.env.DEV?`${location.protocol}//${location.hostname}:5174/`:`${location.protocol}//${location.hostname}:8081/`);
