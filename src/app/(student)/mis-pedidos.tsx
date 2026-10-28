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
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

type OrderStatus = "pending" | "preparing" | "ready";

type OrderItem = {
  id: number;
  nombre: string;
  cantidad: number;
};

type Order = {
  id: string;
  id_pedido: string;
  user_id: string;
  items: OrderItem[];
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
  const { colors: c, styles } = useThemedStyles(createStyles);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { user } = useAuth();

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
        .eq("user_id", user?.id)
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
        <ActivityIndicator size="large" color={c.accent} />
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
          <Ionicons name="receipt-outline" size={48} color={c.textFaint} />
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
            <Ionicons name="restaurant-outline" size={24} color={c.textMuted} />
            <Text style={styles.navTextInactive}>Menú</Text>
          </Pressable>

          {/* Carrito: Inactivo (Gris Outline) */}
          <Pressable
            style={styles.navItemInactive}
            onPress={() => router.push("/(student)/carrito")}
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
            onPress={() => router.push("/(student)/perfil")}
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
  moreItems: { fontSize: 13, color: c.textMuted, fontStyle: "italic" },

  cardFooter: { borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: 12 },
  total: { fontSize: 18, fontWeight: "800", color: c.accent }, // Color azul corporativo

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
