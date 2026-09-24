/**
 * Utilitários de navegação SPA para o Tribbu'sChat
 */

export function getNormalizedPath(path?: string): string {
  if (!path && typeof window !== 'undefined') {
    path = window.location.pathname;
  }
  if (!path) return '/';
  const clean = path.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  return clean;
}

/**
 * Função utilitária de navegação SPA para troca dinâmica de rotas
 * sem recarregar a página, sincronizando o histórico e disparando eventos
 * popstate e app-route-change. Retorna uma Promise para suporte a await.
 */
export async function navigate(toPath: string): Promise<void> {
  if (typeof window !== 'undefined') {
    const normalized = getNormalizedPath(toPath);
    if (window.location.pathname !== normalized) {
      window.history.pushState(null, '', normalized);
    }
    window.dispatchEvent(new Event('popstate'));
    window.dispatchEvent(new CustomEvent('app-route-change', { detail: normalized }));
  }
  return Promise.resolve();
}
