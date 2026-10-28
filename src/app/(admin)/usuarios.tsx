import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth, UserRole } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

const ROLE_LABELS: Record<UserRole, string> = {
  student: "Estudiante",
  admin: "Administrador",
  superadmin: "Super admin",
};

type Profile = {
  id: string;
  email: string | null;
  role: UserRole;
};

export default function UsuariosScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    setLoadError(null);
    // RLS: solo un admin recibe todos los perfiles
    const { data, error } = await supabase
      .from("profiles")
      .select("id, email, role")
      .order("email");

    if (error) {
      console.warn("Error cargando usuarios:", error.message);
      setLoadError("No se pudieron cargar los usuarios. Revisá tu conexión.");
    } else {
      setUsers((data ?? []) as Profile[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUsers();
    }, [fetchUsers]),
  );

  const changeRole = async (target: Profile, newRole: UserRole) => {
    setUpdatingId(target.id);
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", target.id);
    setUpdatingId(null);

    if (error) {
      // El mensaje viene del trigger proteger_rol en la base
      Alert.alert("No se pudo cambiar el rol", error.message);
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, role: newRole } : u)),
    );
  };

  const confirmChangeRole = (target: Profile) => {
    const newRole: UserRole = target.role === "admin" ? "student" : "admin";
    Alert.alert(
      newRole === "admin" ? "Hacer administrador" : "Quitar administrador",
      newRole === "admin"
        ? `${target.email} va a poder gestionar el menú y los pedidos.`
        : `${target.email} va a pasar a ser estudiante.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Confirmar", onPress: () => changeRole(target, newRole) },
      ],
    );
  };

  const filtered = users.filter((u) =>
    (u.email ?? "").toLowerCase().includes(search.trim().toLowerCase()),
  );

  const renderItem = ({ item }: { item: Profile }) => {
    const isMe = item.id === user?.id;
    const isSuper = item.role === "superadmin";
    const isAdmin = item.role === "admin" || isSuper;

    return (
      <View style={styles.card}>
        <View style={[styles.avatar, isAdmin && styles.avatarAdmin]}>
          <Ionicons
            name={isSuper ? "star" : isAdmin ? "shield-checkmark" : "person"}
            size={20}
            color={isAdmin ? c.accent : c.textSecondary}
          />
        </View>
        <View style={styles.info}>
          <Text style={styles.email} numberOfLines={1}>
            {item.email || "(sin email)"}
            {isMe && <Text style={styles.me}> · vos</Text>}
          </Text>
          <Text style={[styles.role, isAdmin && styles.roleAdmin]}>
            {ROLE_LABELS[item.role]}
          </Text>
        </View>
        {/* El superadmin no se puede cambiar desde la app */}
        {!isSuper &&
          (updatingId === item.id ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.roleBtn,
                pressed && styles.roleBtnPressed,
              ]}
              onPress={() => confirmChangeRole(item)}
            >
              <Text style={styles.roleBtnText}>
                {isAdmin ? "Quitar admin" : "Hacer admin"}
              </Text>
            </Pressable>
          ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />

      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>PANEL DE ADMINISTRACIÓN</Text>
        <Text style={styles.title}>Usuarios y roles</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={20} color={c.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por email"
          placeholderTextColor={c.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={c.accent}
          style={styles.loading}
        />
      ) : loadError ? (
        <View style={styles.empty}>
          <Ionicons name="cloud-offline-outline" size={48} color={c.textMuted} />
          <Text style={styles.emptyText}>{loadError}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchUsers}>
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshing={false}
          onRefresh={fetchUsers}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay usuarios con ese email</Text>
          }
        />
      )}

      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/menu")}
          >
            <Ionicons name="restaurant-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Menú</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/agregar")}
          >
            <Ionicons name="add-circle-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Agregar</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/pedidos")}
          >
            <Ionicons name="list-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Pedidos</Text>
          </Pressable>
          <Pressable style={styles.navItemActive}>
            <Ionicons name="people" size={24} color={c.accent} />
            <Text style={styles.navTextActive}>Usuarios</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(admin)/perfil")}
          >
            <Ionicons name="person-circle-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Perfil</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface },
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    backgroundColor: c.decorAdmin,
    borderBottomRightRadius: 80,
    borderBottomLeftRadius: 80,
  },
  header: { paddingTop: 64, paddingHorizontal: 24, paddingBottom: 16 },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    color: c.textSecondary,
    letterSpacing: 1,
  },
  title: { fontSize: 28, fontWeight: "800", color: c.text, marginTop: 4 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: c.border,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: c.text },
  loading: { marginTop: 48 },
  list: { paddingHorizontal: 24, paddingBottom: 140, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarAdmin: { backgroundColor: c.accentSoft },
  info: { flex: 1 },
  email: { fontSize: 15, fontWeight: "600", color: c.text },
  me: { color: c.textMuted, fontWeight: "500" },
  role: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  roleAdmin: { color: c.accent, fontWeight: "700" },
  roleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
  },
  roleBtnPressed: { opacity: 0.7 },
  roleBtnText: { fontSize: 13, fontWeight: "700", color: c.textBody },
  empty: { alignItems: "center", marginTop: 48, gap: 12, padding: 24 },
  emptyText: { color: c.textSecondary, fontSize: 15, textAlign: "center" },
  retryBtn: {
    backgroundColor: c.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: { color: c.onAccent, fontWeight: "700" },

  floatingNavWrapper: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    zIndex: 10,
    alignItems: "center",
  },
  floatingNav: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 32,
    padding: 8,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  navItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
  },
  navTextActive: { fontSize: 12, fontWeight: "700", color: c.accent },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: c.textMuted },
});
