import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { showAlert } from "../../components/app-alert";
import {
  ACTIVE_STATUSES,
  formatPrice,
  groupOrdersByDay,
  Order,
  ORDER_COLUMNS,
  OrderStatus,
  paymentLabel,
  STATUS_CONFIG,
} from "../../constants/orders";
import { ThemeColors } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useOrdersRealtime } from "../../hooks/use-orders-realtime";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { supabase } from "../../services/supabase";
import { announce } from "../../utils/announce";

// Primero lo que hay que preparar, después lo que espera ser retirado
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

export default function AdminPedidosScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const router = useSafeRouter();

  const { role } = useAuth();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Solo los pedidos en curso; entregados y cancelados van al historial
  // Pedidos ya vistos, para avisar por voz cuando entra uno nuevo
  const knownIds = useRef<Set<string> | null>(null);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(ORDER_COLUMNS)
        .in("estado", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      const list = (data ?? []) as Order[];
      if (knownIds.current) {
        const nuevos = list.filter((o) => !knownIds.current!.has(o.id)).length;
        if (nuevos === 1) announce("Entró un pedido nuevo");
        else if (nuevos > 1) announce(`Entraron ${nuevos} pedidos nuevos`);
      }
      knownIds.current = new Set(list.map((o) => o.id));
      setOrders(list);
    } catch (err: any) {
      // warn en vez de error: no dispara la pantalla roja en dev
      console.warn(
        "Error fetching orders:",
        err?.code,
        err?.message,
        err?.details,
      );

      if (err?.code === "57014" || err?.message?.includes("timeout")) {
        showAlert(
          "Tardó demasiado",
          "No pudimos cargar los pedidos. ¿Querés intentar de nuevo?",
          [
            { text: "Cancelar", style: "cancel" },
            { text: "Reintentar", onPress: fetchOrders },
          ],
        );
      } else {
        showAlert("Error", "No se pudieron cargar los pedidos");
      }
    } finally {
      setLoading(false);
    }
  };

  // Se recarga cada vez que se entra a la pantalla. fetchOrders queda fuera
  // de las dependencias a propósito: se recrea en cada render y recargaría
  // en bucle.
  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Pedidos nuevos o cambios (desde otro celular o el asistente) al instante
  useOrdersRealtime(fetchOrders);

  // Deslizar hacia abajo para recargar
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (updatingId) return;

    setUpdatingId(orderId);
    const previous = orders;

    // Entregados y cancelados salen de la lista
    setOrders((prev) =>
      ACTIVE_STATUSES.includes(newStatus)
        ? prev.map((o) => (o.id === orderId ? { ...o, estado: newStatus } : o))
        : prev.filter((o) => o.id !== orderId),
    );

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ estado: newStatus })
        .eq("id", orderId);

      if (error) throw error;
    } catch (err) {
      console.error(err);
      setOrders(previous);
      showAlert("Error", "No se pudo actualizar el pedido");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmCancel = (order: Order) => {
    showAlert(
      "Cancelar pedido",
      `¿Seguro que querés cancelar ${order.id_pedido}? El alumno lo va a ver como cancelado.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Cancelar pedido",
          style: "destructive",
          onPress: () => updateStatus(order.id, "cancelled"),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={c.success} />
      </View>
    );
  }

  // Vienen ordenados por fecha: se agrupa por día y se ordena dentro de cada día
  const sections = groupOrdersByDay(orders).map((s) => ({
    ...s,
    data: sortOrders(s.data),
  }));

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={26} color={c.text} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/(admin)/historial")}
            style={({ pressed }) => [
              styles.historyBtn,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={18}
              color={c.accentStrong}
            />
            <Text style={styles.historyText}>Historial y ventas</Text>
          </Pressable>
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Gestión de Pedidos
        </Text>
        <Text style={styles.subtitle}>
          Se actualiza solo cuando entra un pedido
        </Text>
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
          refreshing={refreshing}
          onRefresh={onRefresh}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {section.title}
              </Text>
              {section.data.map((order) => {
                const config =
                  STATUS_CONFIG[order.estado] ?? STATUS_CONFIG.pending;
                const isUpdating = updatingId === order.id;

                return (
                  <View key={order.id} style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.orderId}>{order.id_pedido}</Text>
                      <Text style={styles.paymentMethod}>
                        {paymentLabel(order.metodo_pago)}
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
                      {order.items.map((item, i) => (
                        <Text key={i} style={styles.itemText}>
                          • {item.nombre}
                          {item.cantidad > 1 && ` x${item.cantidad}`}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.total}>
                        {formatPrice(order.total)}
                      </Text>

                      <View style={styles.actions}>
                        {isUpdating ? (
                          <ActivityIndicator size="small" color={c.accent} />
                        ) : (
                          <>
                            {order.estado === "pending" && (
                              <Pressable
                                style={[styles.actionBtn, styles.btnPreparing]}
                                onPress={() =>
                                  updateStatus(order.id, "preparing")
                                }
                                accessibilityRole="button"
                                accessibilityLabel="Empezar a preparar pedido"
                              >
                                <Ionicons
                                  name="restaurant-outline"
                                  size={18}
                                  color={c.info}
                                />
                                <Text style={styles.preparingText}>Preparar</Text>
                              </Pressable>
                            )}

                            {order.estado === "preparing" && (
                              <Pressable
                                style={[styles.actionBtn, styles.btnReady]}
                                onPress={() => updateStatus(order.id, "ready")}
                                accessibilityLabel="Marcar como listo"
                              >
                                <Ionicons
                                  name="checkmark-circle-outline"
                                  size={18}
                                  color={c.success}
                                />
                              </Pressable>
                            )}

                            {order.estado === "ready" && (
                              <Pressable
                                style={[styles.actionBtn, styles.btnDelivered]}
                                onPress={() =>
                                  updateStatus(order.id, "delivered")
                                }
                                accessibilityLabel="Marcar como entregado"
                              >
                                <Ionicons
                                  name="bag-check-outline"
                                  size={18}
                                  color={c.text}
                                />
                                <Text style={styles.deliveredText}>
                                  Entregado
                                </Text>
                              </Pressable>
                            )}

                            <Pressable
                              style={[styles.actionBtn, styles.btnCancel]}
                              onPress={() => confirmCancel(order)}
                              accessibilityLabel="Cancelar pedido"
                            >
                              <Ionicons
                                name="close"
                                size={18}
                                color={c.danger}
                              />
                            </Pressable>
                          </>
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
          {role === "superadmin" ? (
            <Pressable
              style={styles.navItemActive}
              onPress={() => router.replace("/(admin)/usuarios")}
            >
              <Ionicons name="people" size={24} color={c.accent} />
              <Text style={styles.navTextActive}>Usuarios</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={styles.navItemInactive}
                onPress={() => router.dismissTo("/(admin)/menu")}
              >
                <Ionicons
                  name="restaurant-outline"
                  size={24}
                  color={c.textMuted}
                />
                <Text style={styles.navTextInactive}>Menú</Text>
              </Pressable>
              <Pressable
                style={styles.navItemInactive}
                onPress={() => router.replace("/agregar")}
              >
                <Ionicons
                  name="add-circle-outline"
                  size={24}
                  color={c.textMuted}
                />
                <Text style={styles.navTextInactive}>Agregar</Text>
              </Pressable>
              <Pressable style={styles.navItemActive}>
                <Ionicons name="list" size={24} color={c.accent} />
                <Text style={styles.navTextActive}>Pedidos</Text>
              </Pressable>
            </>
          )}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.replace("/(admin)/perfil")}
          >
            <Ionicons
              name="person-circle-outline"
              size={24}
              color={c.textMuted}
            />
            <Text style={styles.navTextInactive}>Perfil</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (c: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1 },
    pressed: { opacity: 0.7 },

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
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    backBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.border,
    },
    historyBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      height: 44,
      borderRadius: 12,
      backgroundColor: c.accentSoft,
    },
    historyText: { fontSize: 14, fontWeight: "700", color: c.accentStrong },
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
      textTransform: "capitalize",
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

    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: c.borderSoft,
      paddingTop: 12,
    },
    total: { fontSize: 18, fontWeight: "800", color: c.success },

    actions: { flexDirection: "row", alignItems: "center", gap: 8 },
    actionBtn: {
      minWidth: 40,
      height: 40,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
    },
    btnPreparing: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 10,
      borderColor: c.infoBorder,
    },
    preparingText: { fontSize: 13, fontWeight: "700", color: c.info },
    btnReady: { borderColor: c.successBorder },
    btnCancel: { borderColor: c.dangerBorder },
    btnDelivered: {
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 12,
      borderColor: c.border,
    },
    deliveredText: { fontSize: 13, fontWeight: "700", color: c.text },

    empty: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 2,
    },
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
      textAlign: "center",
      paddingHorizontal: 24,
    },
    emptyText: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: "center",
      paddingHorizontal: 24,
    },

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
