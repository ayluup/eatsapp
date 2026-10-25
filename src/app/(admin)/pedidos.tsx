import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../services/supabase";

type OrderStatus = "pending" | "preparing" | "ready";

type Order = {
  id: string;
  id_pedido: string;
  session_id: string;
  items: any[];
  total: number;
  metodo_pago: "mp" | "efectivo";
  estado: OrderStatus;
  created_at: string;
};

const STATUS_CONFIG = {
  pending: {
    label: "Pendiente",
    color: "#F59E0B",
    bg: "#FEF3C7",
    icon: "time-outline" as const,
  },
  preparing: {
    label: "En preparación",
    color: "#3B82F6",
    bg: "#EFF6FF",
    icon: "flame-outline" as const,
  },
  ready: {
    label: "¡Listo!",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: "checkmark-circle-outline" as const,
  },
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");

// ✅ NUEVA LÓGICA DE ORDENAMIENTO
const sortOrders = (orders: Order[]) => {
  return [...orders].sort((a, b) => {
    // 1. Prioridad: Pendiente/Preparando (Arriba) vs Listo (Abajo)
    // Damos prioridad 1 a los activos y 2 a los listos
    const getPriority = (status: OrderStatus) => (status === "ready" ? 2 : 1);

    const priorityA = getPriority(a.estado);
    const priorityB = getPriority(b.estado);

    if (priorityA !== priorityB) {
      return priorityA - priorityB; // Los activos (1) van antes que los listos (2)
    }

    // 2. Si tienen la misma prioridad, ordenar por fecha (más reciente primero)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
};

// Agrupar pedidos por día relativo
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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, []),
  );

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Limpieza automática de pedidos viejos (más de 1 día)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const validOrders = (data || []).filter((o: Order) => {
        const d = new Date(o.created_at);
        return d >= yesterday;
      });

      const oldIds = (data || [])
        .filter((o: Order) => !validOrders.includes(o))
        .map((o: Order) => o.id);

      if (oldIds.length > 0) {
        await supabase.from("pedidos").delete().in("id", oldIds);
      }

      setOrders(validOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (updatingId) return;

    setUpdatingId(orderId);

    // Actualizar visualmente al instante
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
      alert("Error al guardar: ");
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  // ✅ Aplicar el nuevo ordenamiento
  const sortedOrders = sortOrders(orders);
  const grouped = groupOrdersByDay(sortedOrders);
  const sections = Object.entries(grouped).map(([day, dayOrders]) => ({
    title: day,
    data: dayOrders,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Pedidos</Text>
        <Text style={styles.subtitle}>{orders.length} pedido(s) activo(s)</Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyText}>No hay pedidos pendientes</Text>
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
                        { backgroundColor: config.bg },
                      ]}
                    >
                      <Ionicons
                        name={config.icon}
                        size={14}
                        color={config.color}
                      />
                      <Text
                        style={[styles.statusText, { color: config.color }]}
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
                              <ActivityIndicator size="small" color="#3B82F6" />
                            ) : (
                              <Ionicons
                                name="flame-outline"
                                size={18}
                                color="#3B82F6"
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
                              <ActivityIndicator size="small" color="#10B981" />
                            ) : (
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={18}
                                color="#10B981"
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  backBtn: { marginBottom: 12 },
  title: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    marginLeft: 4,
  },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  orderId: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  paymentMethod: { fontSize: 13, color: "#64748B", fontWeight: "600" },

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
  itemText: { fontSize: 14, color: "#334155", marginBottom: 3 },
  moreItems: { fontSize: 13, color: "#94A3B8", fontStyle: "italic" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  total: { fontSize: 18, fontWeight: "800", color: "#10B981" },

  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
  },
  disabledBtn: { opacity: 0.5, backgroundColor: "#F1F5F9" },
  btnPreparing: { borderColor: "#BFDBFE" },
  btnReady: { borderColor: "#A7F3D0" },

  empty: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { fontSize: 16, color: "#64748B", marginTop: 12 },
});
