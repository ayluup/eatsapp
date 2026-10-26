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

type OrderItem = {
  id: number;
  nombre: string;
  cantidad: number;
};

type Order = {
  id: string;
  id_pedido: string;
  session_id: string;
  items: OrderItem[];
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

const groupOrdersByDay = (orders: Order[]) => {
  const groups: Record<string, Order[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  orders.forEach((order) => {
    const orderDate = new Date(order.created_at);
    orderDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    let key = "";
    if (diffDays === 0) key = "Hoy";
    else if (diffDays === 1) key = "Ayer";
    else key = `Hace ${diffDays} días`;

    if (!groups[key]) groups[key] = [];
    groups[key].push(order);
  });
  return groups;
};

export default function StudentMisPedidosScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const validOrders = (data || []).filter(
        (o: Order) => new Date(o.created_at) >= yesterday,
      );

      setOrders(validOrders);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#638ec1" />
      </View>
    );

  const grouped = groupOrdersByDay(orders);
  const sections = Object.entries(grouped).map(([day, dayOrders]) => ({
    title: day,
    data: dayOrders,
  }));

  return (
    <View style={styles.container}>
      {/* ✅ FONDO DIFUMINADO IDÉNTICO A STUDENT MENU */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      {/* ✅ HEADER LIMPIO SIN BOTÓN VOLVER */}
      <View style={styles.header}>
        <Text style={styles.title}>Mis Pedidos</Text>
        <Text style={styles.subtitle}>
          Seguimiento de tus compras recientes
        </Text>
      </View>

      {sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
          <Text style={styles.emptyTitle}>No tenés pedidos recientes</Text>
          <Text style={styles.emptyText}>
            Cuando hagas un pedido aparecerá aquí automáticamente
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
                return (
                  <View key={order.id} style={styles.card}>
                    <View style={styles.info}>
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
                        {order.items.slice(0, 3).map((item, i) => (
                          <Text key={i} style={styles.itemText}>
                            • {item.nombre} x{item.cantidad}
                          </Text>
                        ))}
                        {order.items.length > 3 && (
                          <Text style={styles.moreItems}>
                            +{order.items.length - 3} más
                          </Text>
                        )}
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.total}>
                          {formatPrice(order.total)}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        />
      )}

      {/* ✅ BARRA FLOTANTE ESTILO CÁPSULA INVERTIDA (IGUAL QUE STUDENT MENU) */}
      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNav}>
          {/* Menú: Inactivo (Gris Outline) */}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/menu")}
          >
            <Ionicons name="restaurant-outline" size={24} color="#94A3B8" />
            <Text style={styles.navTextInactive}>Menú</Text>
          </Pressable>

          {/* Carrito: Inactivo (Gris Outline) */}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/carrito")}
          >
            <Ionicons name="cart-outline" size={24} color="#94A3B8" />
            <Text style={styles.navTextInactive}>Carrito</Text>
          </Pressable>

          {/* Pedidos: ACTIVO (Blanco con texto Azul) */}
          <Pressable style={styles.navItemActive}>
            <Ionicons name="list" size={24} color="#638ec1" />
            <Text style={styles.navTextActive}>Pedidos</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO A STUDENT MENU
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: "#e2ecf0",
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
    backgroundColor: "#F8FAFC",
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
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },

  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140, zIndex: 1 },
  section: { width: "100%", marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    marginLeft: 4,
  },

  // TARJETAS ELEVADAS ESTILO STUDENT MENU
  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  info: { flex: 1 },

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

  cardFooter: { borderTopWidth: 1, borderTopColor: "#F1F5F9", paddingTop: 12 },
  total: { fontSize: 18, fontWeight: "800", color: "#638ec1" }, // Color azul corporativo

  emptyContainer: {
    alignItems: "center",
    marginTop: 80,
    padding: 24,
    zIndex: 1,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#64748B",
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
    backgroundColor: "#ffffff",
    borderRadius: 32,
    padding: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  navItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#ffffff",
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderRadius: 24,
  },

  navTextActive: { color: "#638ec1", fontSize: 12, fontWeight: "800" },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
});
