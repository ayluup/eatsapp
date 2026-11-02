import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// Las notificaciones push solo existen en el celular (no en web ni emulador)
export const pushSupported = Platform.OS !== "web";

// Con la app abierta también se muestran
if (pushSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Token de este celular, para borrarlo al cerrar sesión
let currentToken: string | null = null;

// Pide permiso, obtiene el token de Expo y lo guarda para el usuario logueado.
// Devuelve null si no se puede (web, emulador o permiso denegado).
export async function registerForPushNotifications() {
  if (!pushSupported || !Device.isDevice) return null;

  // En Android 13+ el permiso no se pide hasta que exista un canal
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("pedidos", {
      name: "Pedidos",
      importance: AndroidImportance.HIGH,
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  const { error } = await supabase.rpc("registrar_push_token", {
    p_token: token,
    p_platform: Platform.OS,
  });
  if (error) throw error;

  currentToken = token;
  return token;
}

// Antes de cerrar sesión: este celular deja de recibir avisos de la cuenta
export async function unregisterPushNotifications() {
  if (!currentToken) return;
  const token = currentToken;
  currentToken = null;
  await supabase.rpc("eliminar_push_token", { p_token: token });
}
