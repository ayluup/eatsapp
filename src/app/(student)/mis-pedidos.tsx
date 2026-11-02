import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { cancelOrder, HIDEABLE_STATUSES, hideOrder } from "../../services/orders";
import { supabase } from "../../services/supabase";
import {
  formatPrice,
  groupOrdersByDay,
  Order,
  ORDER_COLUMNS,
  paymentLabel,
  STATUS_CONFIG,
} from "../../constants/orders";
import { ThemeColors } from "../../constants/theme";
import { useOrdersRealtime } from "../../hooks/use-orders-realtime";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { showAlert } from "../../components/app-alert";

// Cuántos pedidos se cargan por vez en el historial
const PAGE_SIZE = 30;

export default function StudentMisPedidosScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const router = useSafeRouter();
  const { user } = useAuth();

  const fetchOrders = async (max = limit) => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select(ORDER_COLUMNS)
        .eq("user_id", user?.id)
        .eq("oculto_alumno", false)
        .order("created_at", { ascending: false })
        .limit(max + 1);
      if (error) throw error;

      // Se pide uno de más para saber si hay más pedidos viejos
      setHasMore((data ?? []).length > max);
      setOrders(((data ?? []) as Order[]).slice(0, max));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Deslizar hacia abajo para recargar
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
  };

  const loadMore = () => {
    const next = limit + PAGE_SIZE;
    setLimit(next);
    fetchOrders(next);
  };

  // Cuando el kiosco cambia el estado de un pedido, se ve al instante
  useOrdersRealtime(fetchOrders, user?.id ? `user_id=eq.${user.id}` : undefined);

  const confirmCancel = (order: Order) => {
    showAlert(
      "Cancelar pedido",
      `¿Querés cancelar el pedido ${order.id_pedido}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            setCancellingId(order.id);
            try {
              await cancelOrder(order.id_pedido);
              setOrders((prev) =>
                prev.map((o) => (o.id === order.id ? { ...o, estado: "cancelled" } : o)),
              );
            } catch (err: any) {
              showAlert("No se pudo cancelar", err?.message ?? "Probá de nuevo");
              fetchOrders();
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  // Solo se sacan de "Mis pedidos": el kiosco los sigue viendo en su historial
  const confirmDelete = (order: Order) => {
    showAlert(
      "Eliminar pedido",
      `¿Querés eliminar el pedido ${order.id_pedido} de tu lista?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingId(order.id);
            try {
              await hideOrder(order.id);
              setOrders((prev) => prev.filter((o) => o.id !== order.id));
            } catch (err: any) {
              showAlert("No se pudo eliminar", err?.message ?? "Probá de nuevo");
              fetchOrders();
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    );
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

  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );

  const sections = groupOrdersByDay(orders);

  return (
    <View style={styles.container}>
      {/* ✅ FONDO DIFUMINADO IDÉNTICO A STUDENT MENU */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* ✅ HEADER LIMPIO SIN BOTÓN VOLVER */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Pedidos</Text>
        <Text style={styles.subtitle}>
          Seguimiento en vivo e historial de tus compras
        </Text>
      </View>

      {/* Siempre se muestra la lista (aunque esté vacía) para poder deslizar y recargar */}
      <FlatList
        data={sections}
        keyExtractor={(item) => item.title}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[c.accent]}
            tintColor={c.accent}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={48} color={c.textFaint} />
            <Text style={styles.emptyTitle}>Todavía no hiciste pedidos</Text>
            <Text style={styles.emptyText}>
              Cuando hagas un pedido aparecerá aquí automáticamente
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          hasMore ? (
            <Pressable
              style={({ pressed }) => [styles.moreBtn, pressed && styles.pressed]}
              onPress={loadMore}
            >
              <Text style={styles.moreBtnText}>Ver pedidos anteriores</Text>
            </Pressable>
          ) : undefined
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.data.map((order) => {
              const config = STATUS_CONFIG[order.estado] ?? STATUS_CONFIG.pending;
              return (
                <View key={order.id} style={styles.card}>
                  <View style={styles.info}>
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
                          • {item.nombre}{item.cantidad > 1 && ` x${item.cantidad}`}
                        </Text>
                      ))}
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.total}>
                        {formatPrice(order.total)}
                      </Text>
                      {order.estado === "pending" &&
                        (cancellingId === order.id ? (
                          <ActivityIndicator size="small" color={c.danger} />
                        ) : (
                          <Pressable
                            style={({ pressed }) => [
                              styles.cancelBtn,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => confirmCancel(order)}
                          >
                            <Ionicons name="close-circle-outline" size={16} color={c.danger} />
                            <Text style={styles.cancelText}>Cancelar</Text>
                          </Pressable>
                        ))}
                      {HIDEABLE_STATUSES.includes(order.estado) &&
                        (deletingId === order.id ? (
                          <ActivityIndicator size="small" color={c.danger} />
                        ) : (
                          <Pressable
                            style={({ pressed }) => [
                              styles.cancelBtn,
                              pressed && styles.pressed,
                            ]}
                            onPress={() => confirmDelete(order)}
                          >
                            <Ionicons name="trash-outline" size={16} color={c.danger} />
                            <Text style={styles.cancelText}>Eliminar</Text>
                          </Pressable>
                        ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      />

      {/* ✅ BARRA FLOTANTE ESTILO CÁPSULA INVERTIDA (IGUAL QUE STUDENT MENU) */}
      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          {/* Menú: Inactivo (Gris Outline) */}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.dismissTo("/(student)/menu")}
          >
            <Ionicons name="restaurant-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Menú</Text>
          </Pressable>

          {/* Carrito: Inactivo (Gris Outline) */}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.replace("/(student)/carrito")}
          >
            <Ionicons name="cart-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Carrito</Text>
          </Pressable>

          {/* Pedidos: ACTIVO (Blanco con texto Azul) */}
          <Pressable style={styles.navItemActive}>
            <Ionicons name="list" size={24} color={c.accent} />
            <Text style={styles.navTextActive}>Pedidos</Text>
          </Pressable>
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.replace("/(student)/perfil")}
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

  // ✅ FONDO DIFUMINADO IDÉNTICO A STUDENT MENU
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: c.decorStudent,
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

  header: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: c.textSecondary, marginTop: 4 },

  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140, zIndex: 1 },
  section: { width: "100%", marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: c.text,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: "capitalize",
  },

  // TARJETAS ELEVADAS ESTILO STUDENT MENU
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

  info: { flex: 1 },

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
  total: { fontSize: 18, fontWeight: "800", color: c.accent }, // Color azul corporativo
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: c.dangerSoft,
    borderWidth: 1,
    borderColor: c.dangerBorder,
  },
  cancelText: { fontSize: 13, fontWeight: "700", color: c.danger },
  pressed: { opacity: 0.7 },

  moreBtn: {
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  moreBtnText: { fontSize: 14, fontWeight: "700", color: c.accentStrong },

  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
    padding: 24,
    zIndex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: c.textSecondary,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 22,
  },

  // ✅ BARRA FLOTANTE ESTILO CÁPSULA INVERTIDA
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surface,
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },

  navTextActive: { color: c.accent, fontSize: 12, fontWeight: "800" },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: c.textMuted },
});
