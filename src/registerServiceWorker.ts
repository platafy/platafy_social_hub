export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service Worker registrado com escopo:", registration.scope);

        // Forçar verificação de novas atualizações imediatamente
        registration.update().catch(() => {});

        // Verificar por atualizações
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("[PWA] Nova versão disponível. Aplicando imediatamente...");
                  installingWorker.postMessage({ type: "SKIP_WAITING" });
                } else {
                  console.log("[PWA] Conteúdo em cache para uso offline.");
                }
              }
            };
          }
        };
      })
      .catch((error) => {
        console.warn("[PWA] Falha ao registrar Service Worker:", error);
      });

    // Quando o novo Service Worker assumir o controle, recarregar a janela
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}
