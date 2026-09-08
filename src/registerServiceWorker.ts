export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[PWA] Service Worker registrado com escopo:", registration.scope);

        // Verificar por atualizações
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("[PWA] Nova versão disponível. O app será atualizado no próximo carregamento.");
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
  });
}
