import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: env.VITE_FRONTEND_HOST || '0.0.0.0',
      port: parseInt(env.VITE_FRONTEND_PORT || '3001', 10),
      proxy: {
        '/api': {
          target: `${env.VITE_BACKEND_PROTOCOL || 'http'}://${env.VITE_BACKEND_HOST || 'localhost'}:${env.VITE_BACKEND_PORT || '3000'}`,
          changeOrigin: true,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              const clientIp = req.socket.remoteAddress || req.connection.remoteAddress;
              if (clientIp) {
                proxyReq.setHeader('X-Forwarded-For', clientIp);
                proxyReq.setHeader('X-Real-IP', clientIp);
              }
            });
          }
        }
      }
    }
  };
});
