export const config = {
  demoOnly: import.meta.env.VITE_DEMO_ONLY === 'true',
  apiBase: import.meta.env.VITE_API_BASE || '',
}

