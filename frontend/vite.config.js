import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite is the build tool/dev server for this React app - faster and
// simpler to configure than older tools like Create React App.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Matches CLIENT_URL in the backend's .env for CORS
  },
});
