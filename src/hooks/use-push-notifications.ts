import * as Notifications from "expo-notifications";
import { Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { registerForPushNotifications } from "../services/notifications";

// Registra el celular cuando hay usuario logueado y, al tocar una
// notificación, abre la pantalla que trae en data.url.
// ready = la sesión y el rol ya cargaron (si no, la pantalla todavía no existe)
export function usePushNotifications(userId: string | undefined, ready: boolean) {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (!userId) return;
    registerForPushNotifications().catch((err) =>
      // warn: sin push la app sigue funcionando (ej. Expo Go en Android)
      console.warn("No se pudieron activar las notificaciones:", err?.message ?? err),
    );
  }, [userId]);

  useEffect(() => {
    if (!ready || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const url = response.notification.request.content.data?.url;
    if (typeof url === "string") router.push(url as Href);
    Notifications.clearLastNotificationResponseAsync();
  }, [ready, response, router]);
}
