import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRouter } from "expo-router";
import { useCallback, useLayoutEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

type OrderStatus = "pending" | "preparing" | "ready";

type Order = {
  id: string;
  id_pedido: string;
  user_id: string;
  items: any[];
  total: number;
  metodo_pago: "mp" | "efectivo";
  estado: OrderStatus;
  created_at: string;
};

// Colores del tema (ver constants/theme.ts)
const STATUS_CONFIG = {
  pending: {
    label: "Pendiente",
    color: "warning" as const,
    bg: "warningSoft" as const,
    icon: "time-outline" as const,
  },
  preparing: {
    label: "En preparación",
    color: "info" as const,
    bg: "infoSoft" as const,
    icon: "flame-outline" as const,
  },
  ready: {
    label: "¡Listo!",
    color: "success" as const,
    bg: "successSoft" as const,
    icon: "checkmark-circle-outline" as const,
  },
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");

const sortOrders = (orders: Order[]) => {
  return [...orders].sort((a, b) => {
    const getPriority = (status: OrderStatus) => (status === "ready" ? 2 : 1);
    const priorityA = getPriority(a.estado);
    const priorityB = getPriority(b.estado);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

const groupOrdersByDay = (orders: Order[]) => {
  const groups: Record<string, Order[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  orders.forEach((order) => {
    const orderDate = new Date(order.created_at);
    orderDate.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - orderDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    let key = "";
    if (diffDays === 0) key = "Hoy";
    else if (diffDays === 1) key = "Ayer";
    else key = `Hace ${diffDays} días`;

    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
  });

  return groups;
};

export default function AdminPedidosScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const router = useRouter();

  const { role } = useAuth();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, []),
  );

  const fetchOrders = async () => {
    try {
      const desde = new Date();
      desde.setHours(0, 0, 0, 0);
      desde.setDate(desde.getDate() - 1); // ayer 00:00

      const { data, error } = await supabase
        .from("pedidos")
        .select(
          "id, id_pedido, user_id, items, total, metodo_pago, estado, created_at",
        )
        .gte("created_at", desde.toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setOrders((data ?? []) as Order[]);
    } catch (err: any) {
      // warn en vez de error: no dispara la pantalla roja en dev
      console.warn(
        "Error fetching orders:",
        err?.code,
        err?.message,
        err?.details,
      );

      if (err?.code === "57014" || err?.message?.includes("timeout")) {
        Alert.alert(
          "Tardó demasiado",
          "No pudimos cargar los pedidos. ¿Querés intentar de nuevo?",
          [{ text: "Reintentar", onPress: fetchOrders }, { text: "Cancelar" }],
        );
      } else {
        Alert.alert("Error", "No se pudieron cargar los pedidos");
      }
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (updatingId) return;

    setUpdatingId(orderId);

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, estado: newStatus } : o)),
    );

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: newStatus })
        .eq("id", orderId);

      if (error) throw error;
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={c.success} />
      </View>
    );
  }

  const sortedOrders = sortOrders(orders);
  const grouped = groupOrdersByDay(sortedOrders);
  const sections = Object.entries(grouped).map(([day, dayOrders]) => ({
    title: day,
    data: dayOrders,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.title}>Gestión de Pedidos</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="receipt-outline" size={48} color={c.accentStrong} />
          </View>
          <Text style={styles.emptyTitle}>No hay pedidos pendientes</Text>
          <Text style={styles.emptyText}>
            Los nuevos pedidos aparecerán aquí automáticamente
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(item) => item.title}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map((order) => {
                const config = STATUS_CONFIG[order.estado];
                const isUpdating = updatingId === order.id;

                return (
                  <View key={order.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.orderId}>{order.id_pedido}</Text>
                      <Text style={styles.paymentMethod}>
                        {order.metodo_pago === "mp"
                          ? "MercadoPago"
                          : "Efectivo"}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: c[config.bg] },
                      ]}
                    >
                      <Ionicons
                        name={config.icon}
                        size={14}
                        color={c[config.color]}
                      />
                      <Text
                        style={[styles.statusText, { color: c[config.color] }]}
                      >
                        {config.label}
                      </Text>
                    </View>

                    <View style={styles.itemsPreview}>
                      {order.items.slice(0, 2).map((item, i) => (
                        <Text key={i} style={styles.itemText}>
                          • {item.nombre} x{item.cantidad}
                        </Text>
                      ))}
                      {order.items.length > 2 && (
                        <Text style={styles.moreItems}>
                          +{order.items.length - 2} más
                        </Text>
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.total}>
                        {formatPrice(order.total)}
                      </Text>

                      <View style={styles.actions}>
                        {order.estado === "pending" && (
                          <Pressable
                            style={[
                              styles.actionBtn,
                              styles.btnPreparing,
                              isUpdating && styles.disabledBtn,
                            ]}
                            onPress={() => updateStatus(order.id, "preparing")}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <ActivityIndicator size="small" color={c.info} />
                            ) : (
                              <Ionicons
                                name="flame-outline"
                                size={18}
                                color={c.info}
                              />
                            )}
                          </Pressable>
                        )}

                        {order.estado === "preparing" && (
                          <Pressable
                            style={[
                              styles.actionBtn,
                              styles.btnReady,
                              isUpdating && styles.disabledBtn,
                            ]}
                            onPress={() => updateStatus(order.id, "ready")}
                            disabled={isUpdating}
                          >
                            {isUpdating ? (
                              <ActivityIndicator size="small" color={c.success} />
                            ) : (
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color={c.success}
                              />
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        />
      )}
      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          {/* Menú: Inactivo (Gris Outline) */}
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

          <Pressable style={styles.navItemActive}>
            <Ionicons name="list" size={24} color={c.accent} />
            <Text style={styles.navTextActive}>Pedidos</Text>
          </Pressable>

          {role === "superadmin" && (
            <Pressable
              style={styles.navItemInactive}
              onPress={() => router.push("/(admin)/usuarios")}
            >
              <Ionicons name="people-outline" size={24} color={c.textMuted} />
              <Text style={styles.navTextInactive}>Usuarios</Text>
            </Pressable>
          )}
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
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO AL MENÚ
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: c.decorAdmin,
    borderBottomRightRadius: 80,
    borderBottomLeftRadius: 80,
    zIndex: 0,
  },
  bgBottom: {
    position: "absolute",
    top: "48%",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surfaceAlt,
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    zIndex: 0,
  },

  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  // ✅ HEADER PERSONALIZADO CON FLECHITA
  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    zIndex: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: c.textSecondary, marginTop: 4 },

  list: { paddingHorizontal: 24, paddingBottom: 140, zIndex: 1 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.text,
    marginBottom: 12,
    marginLeft: 4,
  },

  card: {
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: "800", color: c.text },
  paymentMethod: { fontSize: 13, color: c.textSecondary, fontWeight: "600" },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 5,
    marginBottom: 12,
  },
  statusText: { fontSize: 12, fontWeight: "700" },

  itemsPreview: { marginBottom: 14 },
  itemText: { fontSize: 14, color: c.textBody, marginBottom: 3 },
  moreItems: { fontSize: 13, color: c.textMuted, fontStyle: "italic" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: 12,
  },
  total: { fontSize: 18, fontWeight: "800", color: c.success },

  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
  },
  disabledBtn: { opacity: 0.5, backgroundColor: c.surfaceMuted },
  btnPreparing: { borderColor: c.infoBorder },
  btnReady: { borderColor: c.successBorder },

  empty: { flex: 1, justifyContent: "center", alignItems: "center", zIndex: 1 },
  emptyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: c.infoSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
  },
  emptyText: { fontSize: 15, color: c.textSecondary, textAlign: "center" },

  // ✅ BARRA FLOTANTE IDÉNTICA AL MENÚ
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
    borderRadius: 24,
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },
  navTextActive: { fontSize: 12, fontWeight: "700", color: c.accent },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: c.textMuted },
});
