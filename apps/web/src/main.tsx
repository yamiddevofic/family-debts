import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './estilos.css';

/**
 * DT-08 — TanStack Query da caché y revalidación sin escribirlas a mano.
 *
 * `staleTime` alto y reintentos generosos en lectura sostienen RNF-05: con la red caída se
 * sigue viendo lo último que se cargó. La **escritura** no se reintenta ni se encola: si
 * falla, se dice (RG-05).
 */
const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 24 * 60 * 60 * 1_000,
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
});

const raiz = document.getElementById('raiz');
if (!raiz) throw new Error('Falta el elemento raíz en index.html');

createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
