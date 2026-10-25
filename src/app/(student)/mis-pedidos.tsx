import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";

import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";

type OrderStatus = "pending" | "preparing" | "ready";

// Tipo ajustado a la estructura real de Supabase
type Order = {
  id: string;
  id_pedido: string;
  total: number;
  estado: OrderStatus;
  items: any[]; // Array JSONB de productos
  created_at: string;
  session_id: string;
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
    label: "¡Listo para retirar!",
    color: "#10B981",
    bg: "#ECFDF5",
    icon: "checkmark-circle-outline" as const,
  },
};

const formatPrice = (p: number) => "$" + p.toLocaleString("es-AR");

export default function MisPedidosScreen() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    initSessionAndFetch();
  }, []);

  const initSessionAndFetch = async () => {
    try {
      // 1. Obtener o crear ID de sesión único para este dispositivo
      let sid = await AsyncStorage.getItem("@kiosco_session_id");
      if (!sid) {
        sid = `STU-${Date.now().toString(36).toUpperCase()}`;
        await AsyncStorage.setItem("@kiosco_session_id", sid);
      }
      setSessionId(sid);

      // 2. Traer pedidos reales de Supabase filtrados por esta sesión
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("session_id", sid)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error("Error cargando pedidos:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={28} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Mis Pedidos</Text>
        <Text style={styles.subtitle}>Seguí el estado de tus compras</Text>
      </View>

      {/* Lista de Pedidos Reales */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const config = STATUS_CONFIG[item.estado];
          const itemsCount = item.items?.length || 0;

          // Formatear fecha legible
          const date = new Date(item.created_at);
          const dateStr = date.toLocaleDateString("es-AR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          });

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.orderId}>{item.id_pedido}</Text>
                <Text style={styles.orderDate}>{dateStr}</Text>
              </View>

              <View
                style={[styles.statusBadge, { backgroundColor: config.bg }]}
              >
                <Ionicons name={config.icon} size={16} color={config.color} />
                <Text style={[styles.statusText, { color: config.color }]}>
                  {config.label}
                </Text>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.itemsText}>{itemsCount} producto(s)</Text>
                <Text style={styles.totalText}>{formatPrice(item.total)}</Text>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Aún no tenés pedidos</Text>
            <Text style={styles.emptyText}>
              Hacé tu primer pedido desde el menú
            </Text>
            <Pressable
              style={styles.emptyBtn}
              onPress={() => router.push("/(student)/menu")}
            >
              <Text style={styles.emptyBtnText}>Ir al Menú</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 },
  backBtn: { marginBottom: 16 },
  title: { fontSize: 28, fontWeight: "800", color: "#0F172A" },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  orderId: { fontSize: 16, fontWeight: "800", color: "#0F172A" },
  orderDate: { fontSize: 14, color: "#64748B" },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    marginBottom: 12,
  },
  statusText: { fontSize: 13, fontWeight: "700" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 12,
  },
  itemsText: { fontSize: 14, color: "#64748B" },
  totalText: { fontSize: 16, fontWeight: "800", color: "#10B981" },

  empty: { alignItems: "center", marginTop: 80, paddingHorizontal: 20 },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyBtn: {
    backgroundColor: "#10B981",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  emptyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
