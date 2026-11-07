import { defineConfig, devices } from '@playwright/test';

/**
 * Belastingstest (npm run test:belasting): een volle klas speelt Codekraker. Zonder Supabase
 * draait alles in één browser (enkel om het script te testen); met SUPABASE_URL,
 * SUPABASE_ANON_KEY en GAST_WACHTWOORD speelt de leerkracht als Gast tegen de echte database.
 * De site draait als testversie (VITE_VOORSTEL): er gaat niets naar de cloud van het gastaccount.
 */
export default defineConfig({
  testDir: 'tests/belasting',
  timeout: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4175/',
    trace: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } } }],
  webServer: {
    command: 'npx vite build --outDir dist-belasting --emptyOutDir && npx vite preview --outDir dist-belasting --port 4175 --strictPort',
    url: 'http://localhost:4175/',
    reuseExistingServer: false,
    timeout: 120_000,
    env: { VITE_SUPABASE_URL: process.env.SUPABASE_URL ?? '', VITE_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ?? '', VITE_VOORSTEL: '1' },
  },
});
