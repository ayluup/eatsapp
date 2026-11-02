import { AccessibilityInfo } from "react-native";

// Lee un mensaje con TalkBack / VoiceOver. Para cosas que pasan sin que la
// persona toque nada (un pedido que cambia de estado, un aviso que aparece)
// y que si no, quien no ve la pantalla no se entera.
export function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}
