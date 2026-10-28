// Traduce los errores de Supabase Auth a mensajes claros para el usuario

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed:
    "Todavía no confirmaste tu email. Revisá tu bandeja de entrada.",
  user_already_exists: "Ya existe una cuenta con ese email.",
  email_exists: "Ya existe una cuenta con ese email.",
  weak_password: "La contraseña es muy débil. Usá al menos 6 caracteres.",
  same_password: "La contraseña nueva tiene que ser distinta a la anterior.",
  email_address_invalid: "El email no es válido.",
  over_email_send_rate_limit:
    "Se enviaron demasiados emails. Esperá unos minutos y probá de nuevo.",
  over_request_rate_limit:
    "Demasiados intentos. Esperá unos minutos y probá de nuevo.",
  session_not_found: "Tu sesión expiró. Iniciá sesión de nuevo.",
  user_not_found: "No existe un usuario con esos datos.",
  provider_disabled: "Este método de inicio de sesión no está habilitado.",
};

export function getAuthErrorMessage(error: unknown): string {
  const err = error as { code?: string; name?: string; message?: string };

  if (err?.code && MESSAGES[err.code]) return MESSAGES[err.code];

  const message = err?.message ?? "";
  if (
    err?.name === "AuthRetryableFetchError" ||
    /network request failed|failed to fetch/i.test(message)
  ) {
    return "No hay conexión. Revisá tu internet y probá de nuevo.";
  }

  return message || "Ocurrió un error inesperado. Probá de nuevo.";
}

export const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const MIN_PASSWORD_LENGTH = 6;
