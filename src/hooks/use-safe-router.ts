import { useRouter } from "expo-router";

// Mientras una pantalla todavía está animando, un segundo toque abría otra
// encima (o reemplazaba la que se estaba abriendo) y la pila de pantallas
// quedaba rota. Se ignora cualquier navegación dentro de este tiempo.
// Es global a propósito: el toque rápido suele caer en la pantalla nueva.
const LOCK_MS = 600;
let lockedUntil = 0;

function guard<A extends unknown[]>(navigate: (...args: A) => void) {
  return (...args: A) => {
    const now = Date.now();
    if (now < lockedUntil) return;
    lockedUntil = now + LOCK_MS;
    navigate(...args);
  };
}

// Igual que useRouter, pero sin navegaciones repetidas por toques seguidos
export function useSafeRouter() {
  const router = useRouter();
  return {
    ...router,
    push: guard(router.push),
    replace: guard(router.replace),
    navigate: guard(router.navigate),
    dismissTo: guard(router.dismissTo),
    back: guard(router.back),
  };
}
