import { Ionicons } from "@expo/vector-icons";
import { File as DeviceFile } from "expo-file-system";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, UserRole } from "../context/AuthContext";
import { ThemePreference, useAppTheme } from "../context/ThemeContext";
import { supabase } from "../services/supabase";
import { MIN_PASSWORD_LENGTH } from "../utils/auth-errors";
import { ThemeColors } from "../constants/theme";
import { useThemedStyles } from "../hooks/use-themed-styles";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // igual que el límite del bucket

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Estudiante",
  admin: "Administrador",
  superadmin: "Super admin",
};

type Stat = { icon: keyof typeof Ionicons.glyphMap; label: string; value: string };
const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "system", label: "Sistema", icon: "phone-portrait-outline" },
  { value: "light", label: "Claro", icon: "sunny-outline" },
  { value: "dark", label: "Oscuro", icon: "moon-outline" },
];

type Notice = { type: "success" | "error"; text: string };

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");

async function fetchProfileData(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("nombre, avatar_url")
    .eq("id", userId)
    .single();
  return {
    nombre: (data?.nombre as string | null) ?? null,
    avatarUrl: (data?.avatar_url as string | null) ?? null,
    error: error?.message ?? null,
  };
}

// Resumen distinto según el rol. Si falla, el perfil se muestra igual.
async function fetchStats(userId: string, role: UserRole): Promise<Stat[] | null> {
  if (role === "student") {
    const { data, error } = await supabase
      .from("pedidos")
      .select("total")
      .eq("user_id", userId);
    if (error) return null;
    const gastado = (data ?? []).reduce((sum, p) => sum + Number(p.total), 0);
    return [
      { icon: "receipt-outline", label: "Pedidos hechos", value: String(data?.length ?? 0) },
      { icon: "wallet-outline", label: "Total gastado", value: formatPrice(gastado) },
    ];
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [menus, pedidosHoy] = await Promise.all([
    supabase.from("menus").select("id", { count: "exact", head: true }),
    supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .gte("created_at", hoy.toISOString()),
  ]);
  if (menus.error || pedidosHoy.error) return null;
  return [
    { icon: "restaurant-outline", label: "Productos", value: String(menus.count ?? 0) },
    { icon: "today-outline", label: "Pedidos hoy", value: String(pedidosHoy.count ?? 0) },
  ];
}

// Pantalla de perfil compartida por estudiantes y administradores
export function ProfileScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { user, role, hasPassword, changePassword, signOut } = useAuth();
  const { preference, setPreference } = useAppTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = user?.id;

  // Datos personales
  const [nombre, setNombre] = useState("");
  const [savedNombre, setSavedNombre] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingNombre, setSavingNombre] = useState(false);
  const [nombreError, setNombreError] = useState<string | null>(null);

  // Foto
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Cambio de contraseña
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  // Aviso temporal arriba de la pantalla (funciona también en web)
  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (type: Notice["type"], text: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, text });
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  };
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const applyProfile = useCallback(
    (
      profile: Awaited<ReturnType<typeof fetchProfileData>>,
      newStats: Stat[] | null,
    ) => {
      if (profile.error) {
        console.warn("Error cargando perfil:", profile.error);
        setLoadError("No se pudo cargar tu perfil. Revisá tu conexión.");
      } else {
        setLoadError(null);
        setNombre(profile.nombre ?? "");
        setSavedNombre(profile.nombre ?? "");
        setAvatarUrl(profile.avatarUrl);
      }
      setStats(newStats);
      setLoadingProfile(false);
      setRefreshing(false);
    },
    [],
  );

  const loadAll = useCallback(
    (id: string, r: UserRole) =>
      Promise.all([fetchProfileData(id), fetchStats(id, r)]),
    [],
  );

  useEffect(() => {
    if (!userId || !role) return;
    let active = true;
    loadAll(userId, role).then(([profile, newStats]) => {
      if (active) applyProfile(profile, newStats);
    });
    return () => {
      active = false;
    };
  }, [userId, role, loadAll, applyProfile]);

  const reload = async (mode: "refresh" | "retry") => {
    if (!userId || !role) return;
    if (mode === "refresh") setRefreshing(true);
    else {
      setLoadError(null);
      setLoadingProfile(true);
    }
    const [profile, newStats] = await loadAll(userId, role);
    applyProfile(profile, newStats);
  };

  // ---------------- Nombre ----------------
  const handleSaveNombre = async () => {
    const clean = nombre.trim();
    if (clean.length < 2) return setNombreError("Ingresá al menos 2 letras");
    if (clean.length > 60) return setNombreError("Máximo 60 caracteres");
    if (!userId) return;

    setNombreError(null);
    setSavingNombre(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nombre: clean })
      .eq("id", userId);
    setSavingNombre(false);

    if (error) {
      setNombreError("No se pudo guardar. Revisá tu conexión y probá de nuevo.");
      return;
    }
    setNombre(clean);
    setSavedNombre(clean);
    showNotice("success", "Tus datos se guardaron");
  };

  // ---------------- Foto ----------------
  // Borra las fotos anteriores del usuario, dejando solo `keepPath`
  const removeOldPhotos = async (keepPath: string | null) => {
    if (!userId) return;
    const { data: files } = await supabase.storage
      .from(AVATAR_BUCKET)
      .list(userId);
    const old = (files ?? [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath);
    if (old.length) await supabase.storage.from(AVATAR_BUCKET).remove(old);
  };

  const uploadPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!userId) return;
    if (asset.fileSize && asset.fileSize > MAX_AVATAR_BYTES) {
      showNotice("error", "La foto pesa más de 2 MB. Elegí otra.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const contentType =
        asset.mimeType === "image/png" || asset.mimeType === "image/webp"
          ? asset.mimeType
          : "image/jpeg";
      const ext = contentType.split("/")[1].replace("jpeg", "jpg");
      const body =
        Platform.OS === "web" && asset.file
          ? await asset.file.arrayBuffer()
          : await new DeviceFile(asset.uri).arrayBuffer();

      // Nombre nuevo en cada subida para que no se muestre la foto vieja en caché
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, body, { contentType });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      await removeOldPhotos(path);
      showNotice("success", "Foto actualizada");
    } catch (err) {
      console.warn("Error subiendo foto:", err);
      showNotice("error", "No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const pickPhoto = async (source: "camera" | "gallery") => {
    setShowPhotoOptions(false);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    };

    if (source === "camera") {
      const { granted } = await ImagePicker.requestCameraPermissionsAsync();
      if (!granted) {
        showNotice("error", "Necesitamos permiso para usar la cámara.");
        return;
      }
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled && result.assets[0]) await uploadPhoto(result.assets[0]);
  };

  const removePhoto = async () => {
    setShowPhotoOptions(false);
    if (!userId) return;
    setUploadingPhoto(true);
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);
    if (error) {
      showNotice("error", "No se pudo quitar la foto.");
    } else {
      setAvatarUrl(null);
      await removeOldPhotos(null);
      showNotice("success", "Foto eliminada");
    }
    setUploadingPhoto(false);
  };

  // ---------------- Contraseña ----------------
  const resetPasswordForm = () => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  };

  const handleChangePassword = async () => {
    if (hasPassword && !currentPassword)
      return setPasswordError("Ingresá tu contraseña actual");
    if (newPassword.length < MIN_PASSWORD_LENGTH)
      return setPasswordError(
        `La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`,
      );
    if (newPassword !== confirmPassword)
      return setPasswordError("Las contraseñas no coinciden");

    setPasswordError(null);
    setSavingPassword(true);
    const { error } = await changePassword(
      hasPassword ? currentPassword : null,
      newPassword,
    );
    setSavingPassword(false);

    if (error) return setPasswordError(error);
    resetPasswordForm();
    showNotice("success", "Tu contraseña se cambió");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const displayName = savedNombre || user?.email?.split("@")[0] || "Usuario";
  const initial = displayName.charAt(0).toUpperCase();
  const nombreChanged = nombre.trim() !== savedNombre;
  const loginWithGoogle = (
    (user?.app_metadata?.providers as string[] | undefined) ?? []
  ).includes("google");
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.bgTop} />

      {notice && (
        <View
          style={[
            styles.notice,
            { top: insets.top + 8 },
            notice.type === "error" && styles.noticeError,
          ]}
        >
          <Ionicons
            name={notice.type === "error" ? "alert-circle" : "checkmark-circle"}
            size={20}
            color={notice.type === "error" ? c.danger : c.success}
          />
          <Text style={styles.noticeText}>{notice.text}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => reload("refresh")}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
      >
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={22} color={c.text} />
          </Pressable>
          <Text style={styles.topTitle}>Mi perfil</Text>
          <View style={styles.backBtnPlaceholder} />
        </View>

        {/* Encabezado */}
        <View style={styles.hero}>
          <Pressable
            onPress={() => setShowPhotoOptions(true)}
            disabled={uploadingPhoto || loadingProfile}
            accessibilityLabel="Cambiar foto de perfil"
          >
            <View style={styles.avatar}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={200}
                />
              ) : (
                <Text style={styles.avatarText}>{initial}</Text>
              )}
              {uploadingPhoto && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color={c.onAccent} />
                </View>
              )}
            </View>
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={16} color={c.onAccent} />
            </View>
          </Pressable>

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroEmail}>{user?.email}</Text>
          <View style={styles.heroBadges}>
            {role && (
              <View style={styles.roleBadge}>
                <Ionicons
                  name={role === "student" ? "school" : "shield-checkmark"}
                  size={14}
                  color={c.accent}
                />
                <Text style={styles.roleText}>{ROLE_LABELS[role]}</Text>
              </View>
            )}
            {memberSince && (
              <View style={styles.roleBadge}>
                <Ionicons name="calendar-outline" size={14} color={c.textSecondary} />
                <Text style={styles.memberText}>Desde {memberSince}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Resumen */}
        {stats && (
          <View style={styles.statsRow}>
            {stats.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <Ionicons name={s.icon} size={20} color={c.accent} />
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Datos personales */}
        <Text style={styles.sectionTitle}>DATOS PERSONALES</Text>
        <View style={styles.card}>
          {loadingProfile ? (
            <ActivityIndicator color={c.accent} style={styles.cardLoading} />
          ) : loadError ? (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline-outline" size={32} color={c.textMuted} />
              <Text style={styles.errorText}>{loadError}</Text>
              <Pressable onPress={() => reload("retry")}>
                <Text style={styles.linkText}>Reintentar</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.label}>Nombre</Text>
              <View style={[styles.inputBox, nombreError && styles.inputError]}>
                <Ionicons name="person-outline" size={20} color={c.textSecondary} />
                <TextInput
                  style={styles.input}
                  value={nombre}
                  onChangeText={(t) => {
                    setNombre(t);
                    setNombreError(null);
                  }}
                  placeholder="¿Cómo te llamás?"
                  placeholderTextColor={c.textMuted}
                  maxLength={60}
                  autoComplete="name"
                  returnKeyType="done"
                  onSubmitEditing={nombreChanged ? handleSaveNombre : undefined}
                />
              </View>
              {nombreError && <Text style={styles.errorText}>{nombreError}</Text>}

              <Text style={[styles.label, styles.labelSpaced]}>Email</Text>
              <View style={[styles.inputBox, styles.inputDisabled]}>
                <Ionicons name="mail-outline" size={20} color={c.textMuted} />
                <Text style={styles.readonlyText} numberOfLines={1}>
                  {user?.email}
                </Text>
                <Ionicons name="lock-closed" size={16} color={c.textFaint} />
              </View>
              <Text style={styles.hint}>El email no se puede modificar.</Text>

              {nombreChanged && (
                <View style={styles.formActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.secondaryBtn,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => {
                      setNombre(savedNombre);
                      setNombreError(null);
                    }}
                    disabled={savingNombre}
                  >
                    <Text style={styles.secondaryBtnText}>Descartar</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      styles.flex1,
                      pressed && styles.pressed,
                      savingNombre && styles.disabled,
                    ]}
                    onPress={handleSaveNombre}
                    disabled={savingNombre}
                  >
                    {savingNombre ? (
                      <ActivityIndicator color={c.onAccent} />
                    ) : (
                      <Text style={styles.primaryBtnText}>Guardar cambios</Text>
                    )}
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {/* Apariencia */}
        <Text style={styles.sectionTitle}>APARIENCIA</Text>
        <View style={styles.card}>
          <View style={styles.segmented}>
            {THEME_OPTIONS.map((opt) => {
              const selected = preference === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.segment, selected && styles.segmentSelected]}
                  onPress={() => setPreference(opt.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={selected ? c.onAccent : c.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      selected && styles.segmentTextSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.hint}>
            {preference === "system"
              ? "Usa el mismo tema que tu celular."
              : "El tema se guarda en este dispositivo."}
          </Text>
        </View>

        {/* Seguridad */}
        <Text style={styles.sectionTitle}>SEGURIDAD</Text>
        <View style={styles.card}>
          {loginWithGoogle && (
            <View style={styles.infoRow}>
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={styles.infoText}>Tu cuenta está vinculada a Google</Text>
            </View>
          )}

          {!showPasswordForm ? (
            <Pressable
              style={({ pressed }) => [styles.rowBtn, pressed && styles.pressed]}
              onPress={() => setShowPasswordForm(true)}
            >
              <Ionicons name="key-outline" size={20} color={c.accent} />
              <Text style={styles.rowBtnText}>
                {hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
              </Text>
              <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
            </Pressable>
          ) : (
            <View style={styles.passwordForm}>
              {!hasPassword && (
                <Text style={styles.hint}>
                  Creá una contraseña para poder entrar también con tu email.
                </Text>
              )}
              {hasPassword && (
                <PasswordInput
                  placeholder="Contraseña actual"
                  value={currentPassword}
                  onChangeText={(t) => {
                    setCurrentPassword(t);
                    setPasswordError(null);
                  }}
                  autoComplete="current-password"
                />
              )}
              <PasswordInput
                placeholder="Contraseña nueva"
                value={newPassword}
                onChangeText={(t) => {
                  setNewPassword(t);
                  setPasswordError(null);
                }}
              />
              <PasswordInput
                placeholder="Repetir contraseña nueva"
                value={confirmPassword}
                onChangeText={(t) => {
                  setConfirmPassword(t);
                  setPasswordError(null);
                }}
                onSubmitEditing={handleChangePassword}
              />
              <Text style={styles.hint}>
                Mínimo {MIN_PASSWORD_LENGTH} caracteres.
              </Text>

              {passwordError && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}

              <View style={styles.formActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.secondaryBtn,
                    pressed && styles.pressed,
                  ]}
                  onPress={resetPasswordForm}
                  disabled={savingPassword}
                >
                  <Text style={styles.secondaryBtnText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    styles.flex1,
                    pressed && styles.pressed,
                    savingPassword && styles.disabled,
                  ]}
                  onPress={handleChangePassword}
                  disabled={savingPassword}
                >
                  {savingPassword ? (
                    <ActivityIndicator color={c.onAccent} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Cerrar sesión */}
        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            pressed && styles.pressed,
            signingOut && styles.disabled,
          ]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <ActivityIndicator color={c.danger} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color={c.danger} />
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </>
          )}
        </Pressable>
      </ScrollView>

      {/* Opciones de foto */}
      <Modal
        visible={showPhotoOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowPhotoOptions(false)}
        >
          <Pressable
            style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Foto de perfil</Text>
            {Platform.OS !== "web" && (
              <SheetOption
                icon="camera-outline"
                label="Sacar foto"
                onPress={() => pickPhoto("camera")}
              />
            )}
            <SheetOption
              icon="images-outline"
              label="Elegir de la galería"
              onPress={() => pickPhoto("gallery")}
            />
            {avatarUrl && (
              <SheetOption
                icon="trash-outline"
                label="Quitar foto"
                danger
                onPress={removePhoto}
              />
            )}
            <Pressable
              style={({ pressed }) => [styles.sheetCancel, pressed && styles.pressed]}
              onPress={() => setShowPhotoOptions(false)}
            >
              <Text style={styles.secondaryBtnText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function SheetOption(props: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const color = props.danger ? c.danger : c.text;
  return (
    <Pressable
      style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}
      onPress={props.onPress}
    >
      <Ionicons name={props.icon} size={22} color={props.danger ? color : c.accent} />
      <Text style={[styles.sheetOptionText, { color }]}>{props.label}</Text>
    </Pressable>
  );
}

// Campo de contraseña con el ojito para mostrar/ocultar lo escrito
function PasswordInput(props: {
  placeholder: string;
  value: string;
  onChangeText: (t: string) => void;
  onSubmitEditing?: () => void;
  autoComplete?: "current-password" | "new-password";
}) {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.inputBox}>
      <Ionicons name="lock-closed-outline" size={20} color={c.textSecondary} />
      <TextInput
        style={styles.input}
        placeholder={props.placeholder}
        placeholderTextColor={c.textMuted}
        value={props.value}
        onChangeText={props.onChangeText}
        onSubmitEditing={props.onSubmitEditing}
        secureTextEntry={!visible}
        autoComplete={props.autoComplete ?? "new-password"}
        autoCapitalize="none"
      />
      <Pressable
        onPress={() => setVisible(!visible)}
        hitSlop={10}
        accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={22}
          color={c.textSecondary}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surfaceAlt },
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: c.decorStudent,
    borderBottomLeftRadius: 80,
    borderBottomRightRadius: 80,
  },
  scroll: { paddingHorizontal: 24 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  backBtnPlaceholder: { width: 42 },
  topTitle: { fontSize: 17, fontWeight: "700", color: c.text },

  notice: {
    position: "absolute",
    left: 24,
    right: 24,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.successBorder,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  noticeError: { borderColor: c.dangerBorder },
  noticeText: { flex: 1, fontSize: 14, fontWeight: "600", color: c.text },

  hero: { alignItems: "center", marginVertical: 16 },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: c.surface,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: { fontSize: 40, fontWeight: "800", color: c.onAccent },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.overlay,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: c.surface,
  },
  heroName: { fontSize: 22, fontWeight: "800", color: c.text, marginTop: 12 },
  heroEmail: { fontSize: 14, color: c.textSecondary, marginTop: 2 },
  heroBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  roleText: { fontSize: 13, fontWeight: "700", color: c.accent },
  memberText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },

  statsRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  statCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: c.text, marginTop: 4 },
  statLabel: { fontSize: 12, fontWeight: "600", color: c.textSecondary },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
    letterSpacing: 1,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: c.borderSoft,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardLoading: { paddingVertical: 24 },

  label: { fontSize: 13, fontWeight: "600", color: c.textBody, marginBottom: 6 },
  labelSpaced: { marginTop: 14 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.surfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    borderWidth: 1,
    borderColor: c.border,
  },
  inputError: { borderColor: c.danger },
  inputDisabled: { backgroundColor: c.surfaceMuted },
  input: { flex: 1, fontSize: 15, color: c.text },
  readonlyText: { flex: 1, fontSize: 15, color: c.textSecondary },
  hint: { fontSize: 12, color: c.textMuted, marginTop: 6 },
  errorText: { fontSize: 13, color: c.danger, marginTop: 6, textAlign: "left" },
  errorBox: { alignItems: "center", gap: 8, paddingVertical: 12 },
  linkText: { color: c.accent, fontWeight: "700" },

  primaryBtn: {
    backgroundColor: c.accent,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: c.onAccent, fontSize: 15, fontWeight: "700" },
  secondaryBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    backgroundColor: c.surfaceMuted,
  },
  secondaryBtnText: { color: c.textBody, fontSize: 15, fontWeight: "700" },
  formActions: { flexDirection: "row", gap: 10 },
  flex1: { flex: 1 },

  segmented: {
    flexDirection: "row",
    backgroundColor: c.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentSelected: { backgroundColor: c.accent },
  segmentText: { fontSize: 13, fontWeight: "600", color: c.textSecondary },
  segmentTextSelected: { color: c.onAccent },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 12,
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  infoText: { fontSize: 14, color: c.textBody },
  rowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rowBtnText: { flex: 1, fontSize: 15, fontWeight: "600", color: c.text },
  passwordForm: { gap: 10 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.dangerSoft,
    borderWidth: 1,
    borderColor: c.dangerBorder,
    marginTop: 28,
  },
  logoutText: { color: c.danger, fontSize: 16, fontWeight: "700" },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  sheetOptionText: { fontSize: 16, fontWeight: "600" },
  sheetCancel: {
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: c.surfaceMuted,
  },

  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
});
