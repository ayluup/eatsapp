import { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { supabase } from "../services/supabase";
import { getAuthErrorMessage } from "../utils/auth-errors";

export type UserRole = "student" | "admin" | "superadmin";

// admin y superadmin usan el panel de administración
export const isAdminRole = (role: UserRole | null) =>
  role === "admin" || role === "superadmin";

// Las funciones devuelven un mensaje listo para mostrar (o null si salió bien)
type AuthResult = { error: string | null };

type AuthContextType = {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
  // true mientras el usuario entró desde el link de "recuperar contraseña"
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<AuthResult & { needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<AuthResult>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  // false si la cuenta se creó con Google y nunca tuvo contraseña
  hasPassword: boolean;
  changePassword: (
    currentPassword: string | null,
    newPassword: string,
  ) => Promise<AuthResult>;
  finishRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Supabase devuelve los tokens en el query (?code=) o en el fragment (#access_token=)
function getUrlParams(url: string) {
  const params: Record<string, string> = {};
  const [beforeHash, hash = ""] = url.split("#");
  const query = beforeHash.split("?")[1] ?? "";

  for (const part of [query, hash]) {
    for (const pair of part.split("&")) {
      if (!pair) continue;
      const [key, value = ""] = pair.split("=");
      params[decodeURIComponent(key)] = decodeURIComponent(
        value.replace(/\+/g, " "),
      );
    }
  }
  return params;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [recovering, setRecovering] = useState(false);
  // El rol se guarda junto al id del usuario al que pertenece, así nunca
  // se usa el rol de una sesión anterior mientras se busca el nuevo.
  const [fetchedRole, setFetchedRole] = useState<{
    userId: string;
    role: UserRole;
  } | null>(null);
  const handledUrls = useRef(new Set<string>());

  const user = session?.user ?? null;
  const userId = user?.id;
  const role = userId && fetchedRole?.userId === userId ? fetchedRole.role : null;

  const fetchRole = async (userId: string): Promise<UserRole> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      return (data?.role as UserRole) || "student";
    } catch {
      return "student";
    }
  };

  // Crea la sesión a partir de un link de Supabase (Google, confirmación de
  // email o recuperación de contraseña). Devuelve false si el link no es de auth.
  const handleAuthUrl = async (url: string): Promise<boolean> => {
    const params = getUrlParams(url);
    const isAuthUrl =
      params.code || params.access_token || params.error_description;
    if (!isAuthUrl || handledUrls.current.has(url)) return false;
    handledUrls.current.add(url);

    if (params.error_description) {
      Alert.alert(
        "Link inválido",
        params.error_code === "otp_expired"
          ? "El link venció o ya fue usado. Pedí uno nuevo."
          : params.error_description,
      );
      return true;
    }

    if (params.type === "recovery") setRecovering(true);

    const { error } = params.code
      ? await supabase.auth.exchangeCodeForSession(params.code)
      : await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

    if (error) {
      setRecovering(false);
      Alert.alert("Error", getAuthErrorMessage(error));
    }
    return true;
  };

  // Sesión: se restaura desde el almacenamiento y se escuchan los cambios.
  // No se hacen otras llamadas a Supabase dentro de onAuthStateChange
  // porque pueden bloquear el cliente.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Links que abren la app (email de recuperación / confirmación)
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  // Rol: se busca cada vez que cambia el usuario logueado
  useEffect(() => {
    if (!userId) return;

    let active = true;
    fetchRole(userId).then((r) => {
      if (active) setFetchedRole({ userId, role: r });
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const loading = !initialized || (!!userId && role === null);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? getAuthErrorMessage(error) : null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: Linking.createURL("/") },
    });
    return {
      error: error ? getAuthErrorMessage(error) : null,
      // Si Supabase pide confirmar el email, no devuelve sesión todavía
      needsConfirmation: !error && !data.session,
    };
  };

  const signInWithGoogle = async () => {
    const redirectTo = Linking.createURL("/");
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        // En web Supabase redirige la página entera; en nativo abrimos
        // nosotros el navegador para poder volver a la app.
        skipBrowserRedirect: Platform.OS !== "web",
      },
    });
    if (error) return { error: getAuthErrorMessage(error) };
    if (Platform.OS === "web") return { error: null };

    try {
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === "success") await handleAuthUrl(result.url);
      return { error: null };
    } catch (err) {
      return { error: getAuthErrorMessage(err) };
    }
  };

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: Linking.createURL("/restablecer"),
    });
    return { error: error ? getAuthErrorMessage(error) : null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? getAuthErrorMessage(error) : null };
  };

  const providers = (user?.app_metadata?.providers as string[] | undefined) ?? [];
  const hasPassword = providers.length === 0 || providers.includes("email");

  // Desde el perfil se pide la contraseña actual antes de cambiarla, para que
  // nadie con el celular desbloqueado pueda cambiarla.
  const changePassword = async (
    currentPassword: string | null,
    newPassword: string,
  ) => {
    if (currentPassword !== null && user?.email) {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (error) {
        return {
          error:
            error.code === "invalid_credentials"
              ? "La contraseña actual es incorrecta."
              : getAuthErrorMessage(error),
        };
      }
    }
    return updatePassword(newPassword);
  };

  const finishRecovery = () => setRecovering(false);

  const signOut = async () => {
    setRecovering(false);
    const { error } = await supabase.auth.signOut();
    // Si falla el servidor (ej. sin conexión) Supabase no borra la sesión
    // guardada: la borramos igual en el dispositivo.
    if (error) await supabase.auth.signOut({ scope: "local" });
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        recovering,
        signIn,
        signUp,
        signInWithGoogle,
        sendPasswordReset,
        updatePassword,
        hasPassword,
        changePassword,
        finishRecovery,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
