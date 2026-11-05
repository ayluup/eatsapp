import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { supabase } from "../../services/supabase";
import {
  formatPrice,
  groupOrdersByDay,
  Order,
  ORDER_COLUMNS,
  OrderStatus,
  paymentLabel,
  startOfDaysAgo,
  STATUS_CONFIG,
  summarizeSales,
} from "../../constants/orders";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { showAlert } from "../../components/app-alert";

const PERIODS = [
  { label: "Hoy", dias: 1 },
  { label: "7 días", dias: 7 },
  { label: "30 días", dias: 30 },
  { label: "90 días", dias: 90 },
];

const STATUS_FILTERS: { label: string; estado: OrderStatus | null }[] = [
  { label: "Todos", estado: null },
  { label: "Entregados", estado: "delivered" },
  { label: "En curso", estado: "pending" },
  { label: "Cancelados", estado: "cancelled" },
];

// Trae los pedidos del período (null si falló)
async function fetchHistory(dias: number): Promise<Order[] | null> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(ORDER_COLUMNS)
    .gte("created_at", startOfDaysAgo(dias).toISOString())
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    console.warn("Error cargando historial:", error.message);
    return null;
  }
  return (data ?? []) as Order[];
}

export default function AdminHistorialScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const router = useSafeRouter();
  const [dias, setDias] = useState(7);
  const [estado, setEstado] = useState<OrderStatus | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Se carga al entrar y cada vez que cambia el período
  useFocusEffect(
    useCallback(() => {
      fetchHistory(dias).then((data) => {
        setFailed(data === null);
        setOrders(data ?? []);
        setLoading(false);
      });
    }, [dias]),
  );

  const changePeriod = (d: number) => {
    if (d === dias) return;
    setLoading(true);
    setDias(d);
  };

  const deleteCancelledOrder = async (order: Order) => {
    if (deletingId) return;
    setDeletingId(order.id);
    const { data, error } = await supabase
      .from("pedidos")
      .delete()
      .eq("id", order.id)
      .eq("estado", "cancelled")
      .select("id")
      .maybeSingle();
    setDeletingId(null);

    if (error) {
      console.error("Error eliminando pedido cancelado:", error.message);
      showAlert("Error", "No se pudo eliminar el pedido cancelado.");
      return;
    }
    if (!data) {
      showAlert(
        "Pedido no eliminado",
        "Solo se pueden eliminar pedidos que estén cancelados.",
      );
      return;
    }
    setOrders((current) => current.filter((item) => item.id !== order.id));
  };

  const confirmDeleteCancelledOrder = (order: Order) => {
    showAlert(
      "Eliminar pedido cancelado",
      `¿Querés eliminar definitivamente el pedido ${order.id_pedido}? Esta acción no se puede deshacer.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => deleteCancelledOrder(order),
        },
      ],
    );
  };

  const summary = summarizeSales(orders);
  const filtered = orders.filter((o) =>
    estado === null
      ? true
      : estado === "pending"
        ? ["pending", "preparing", "ready"].includes(o.estado)
        : o.estado === estado,
  );
  const sections = groupOrdersByDay(filtered);
  const maxUnits = summary.ranking[0]?.unidades ?? 1;

  const header = (
    <View>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Historial y ventas</Text>
        <Text style={styles.subtitle}>Los cancelados no suman en las ventas</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {PERIODS.map((p) => (
          <Pressable
            key={p.dias}
            style={[styles.chip, dias === p.dias && styles.chipActive]}
            onPress={() => changePeriod(p.dias)}
          >
            <Text style={[styles.chipText, dias === p.dias && styles.chipTextActive]}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={styles.loading} size="large" color={c.accent} />
      ) : failed ? (
        <Text style={styles.errorText}>No se pudo cargar el historial. Revisá tu conexión.</Text>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <Stat label="Facturado" value={formatPrice(summary.facturado)} icon="cash-outline" c={c} styles={styles} />
            <Stat label="Pedidos" value={String(summary.cantidad_pedidos)} icon="receipt-outline" c={c} styles={styles} />
            <Stat label="Ticket promedio" value={formatPrice(summary.ticket_promedio)} icon="trending-up-outline" c={c} styles={styles} />
            <Stat label="Cancelados" value={String(summary.cancelados)} icon="close-circle-outline" c={c} styles={styles} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Más vendidos</Text>
            {summary.ranking.length === 0 ? (
              <Text style={styles.muted}>Todavía no hay ventas en este período</Text>
            ) : (
              summary.ranking.slice(0, 5).map((p, i) => (
                <View key={p.nombre} style={styles.rankRow}>
                  <Text style={styles.rankPos}>{i + 1}</Text>
                  <View style={styles.flex1}>
                    <View style={styles.rankHeader}>
                      <Text style={styles.rankName} numberOfLines={1}>{p.nombre}</Text>
                      <Text style={styles.rankUnits}>{p.unidades} u.</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { width: `${(p.unidades / maxUnits) * 100}%` }]} />
                    </View>
                  </View>
                </View>
              ))
            )}
            {summary.cantidad_pedidos > 0 && (
              <View style={styles.extraRow}>
                {Object.entries(summary.pedidos_por_metodo).map(([m, n]) => (
                  <Text key={m} style={styles.muted}>
                    {m}: {n}
                  </Text>
                ))}
                {summary.hora_pico && (
                  <Text style={styles.muted}>Hora pico: {summary.hora_pico}</Text>
                )}
              </View>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {STATUS_FILTERS.map((f) => (
              <Pressable
                key={f.label}
                style={[styles.chip, estado === f.estado && styles.chipActive]}
                onPress={() => setEstado(f.estado)}
              >
                <Text style={[styles.chipText, estado === f.estado && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <FlatList
        data={loading || failed ? [] : sections}
        keyExtractor={(s) => s.title}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading || failed ? undefined : (
            <Text style={[styles.muted, styles.center]}>No hay pedidos para mostrar</Text>
          )
        }
        renderItem={({ item: section }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">{section.title}</Text>
            {section.data.map((order) => {
              const config = STATUS_CONFIG[order.estado] ?? STATUS_CONFIG.pending;
              return (
                <View key={order.id} style={styles.orderRow}>
                  <View style={styles.flex1}>
                    <Text style={styles.orderId}>
                      {order.id_pedido} ·{" "}
                      {new Date(order.created_at).toLocaleTimeString("es-AR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text style={styles.orderItems} numberOfLines={1}>
                      {order.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")}
                    </Text>
                    <Text style={styles.muted}>{paymentLabel(order.metodo_pago)}</Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text
                      style={[
                        styles.orderTotal,
                        order.estado === "cancelled" && styles.strike,
                      ]}
                    >
                      {formatPrice(order.total)}
                    </Text>
                    <View style={[styles.badge, { backgroundColor: c[config.bg] }]}>
                      <Text style={[styles.badgeText, { color: c[config.color] }]}>
                        {config.label}
                      </Text>
                    </View>
                    {order.estado === "cancelled" && (
                      <Pressable
                        style={({ pressed }) => [
                          styles.deleteOrderBtn,
                          pressed && styles.deleteOrderBtnPressed,
                        ]}
                        onPress={() => confirmDeleteCancelledOrder(order)}
                        disabled={deletingId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={`Eliminar pedido cancelado ${order.id_pedido}`}
                      >
                        {deletingId === order.id ? (
                          <ActivityIndicator size="small" color={c.danger} />
                        ) : (
                          <Ionicons
                            name="trash-outline"
                            size={18}
                            color={c.danger}
                          />
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      />
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

function Stat({
  label,
  value,
  icon,
  c,
  styles,
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  c: ThemeColors;
  styles: Styles;
}) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={c.accent} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },
  flex1: { flex: 1 },
  center: { textAlign: "center", marginTop: 24 },

  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    backgroundColor: c.decorAdmin,
    borderBottomRightRadius: 80,
    borderBottomLeftRadius: 80,
  },

  list: { paddingBottom: 60 },
  loading: { marginTop: 40 },
  errorText: { color: c.danger, textAlign: "center", marginTop: 24, paddingHorizontal: 24 },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 12 },
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
  title: { fontSize: 28, fontWeight: "800", color: c.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: c.textSecondary, marginTop: 4 },

  chips: { paddingHorizontal: 24, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontSize: 14, fontWeight: "600", color: c.textSecondary },
  chipTextActive: { color: c.onAccent },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  stat: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  statValue: { fontSize: 22, fontWeight: "800", color: c.text },
  statLabel: { fontSize: 13, color: c.textSecondary },

  card: {
    marginHorizontal: 24,
    marginTop: 12,
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: c.text },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rankPos: { width: 18, fontSize: 14, fontWeight: "800", color: c.accent },
  rankHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  rankName: { flex: 1, fontSize: 14, fontWeight: "600", color: c.textBody },
  rankUnits: { fontSize: 13, fontWeight: "700", color: c.textSecondary },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, overflow: "hidden" },
  bar: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  extraRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: 10,
  },
  muted: { fontSize: 13, color: c.textSecondary },

  section: { paddingHorizontal: 24, marginTop: 16 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: c.text,
    marginBottom: 8,
    textTransform: "capitalize",
  },
  orderRow: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  orderId: { fontSize: 14, fontWeight: "800", color: c.text },
  orderItems: { fontSize: 13, color: c.textBody, marginVertical: 2 },
  orderRight: { alignItems: "flex-end", gap: 6 },
  deleteOrderBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: c.dangerSoft,
    marginTop: 2,
  },
  deleteOrderBtnPressed: { opacity: 0.7 },
  orderTotal: { fontSize: 15, fontWeight: "800", color: c.success },
  strike: { textDecorationLine: "line-through", color: c.textMuted },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "700" },
});
