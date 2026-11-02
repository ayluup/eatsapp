import { Ionicons } from "@expo/vector-icons";
import { useSafeRouter } from "../../hooks/use-safe-router";
import { useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { canAddMore, useCart, writeCart } from "../../hooks/useCart";
import { createOrder } from "../../services/orders";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";
import { showAlert } from "../../components/app-alert";
import { announce } from "../../utils/announce";

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");

export default function StudentCartScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
  const { items, loading, updateQuantity, removeItem, total, reload } = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  const router = useSafeRouter();
  const { user } = useAuth();

  // El state tarda un render en actualizarse: con dos toques rápidos los dos
  // veían sendingOrder = false y se creaban pedidos repetidos. El ref no.
  const sendingRef = useRef(false);

  // Antes se vaciaba el carrito con el modal abierto: la pantalla pasaba al
  // estado "vacío", el Modal se desmontaba visible en medio del cambio de
  // pantalla y en Android la app se cerraba. Ahora primero se cierra el
  // modal, después se cambia de pantalla y recién ahí se vacía el carrito.
  const goToOrders = () => {
    announce("Pedido enviado. Podés seguir su estado en Mis pedidos.");
    setShowPaymentModal(false);
    setTimeout(() => {
      router.replace("/(student)/mis-pedidos");
      writeCart([]).catch(console.warn);
    }, 350);
  };

  // Deslizar hacia abajo para recargar
  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const handleConfirmOrder = async (method: "mp" | "efectivo") => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSendingOrder(true);
    try {
      await createOrder(items, method, user?.id);
      goToOrders();
    } catch (err: any) {
      console.warn("Error al confirmar pedido:", err);
      // El servidor ya tiene este pedido (doble toque o reintento)
      if (err?.message?.includes("Ya recibimos este pedido")) {
        goToOrders();
        return;
      }
      // Solo si falló se habilita de nuevo: si salió bien la pantalla se va
      // y no tiene que poder mandarse otra vez mientras tanto.
      sendingRef.current = false;
      setSendingOrder(false);
      showAlert("No se pudo enviar", "Hubo un error al enviar tu pedido. Intentá nuevamente.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // ✅ ESTADO VACÍO SIN BARRA DE NAVEGACIÓN
  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.bgTop} />
        <View style={styles.bgBottom} />

        <Pressable
          onPress={() => router.back()}
          style={styles.emptyBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={26} color={c.text} />
        </Pressable>

        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="cart-outline" size={48} color={c.accent} />
          </View>

          <Text style={styles.emptyTitle}>Tu carrito está vacío</Text>
          <Text style={styles.emptyDescription}>
            Agregá tus productos favoritos desde el menú y volvé acá para
            finalizar tu pedido.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.exploreBtn,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => router.dismissTo("/(student)/menu")}
          >
            <Ionicons
              name="restaurant-outline"
              size={20}
              color={c.onAccent}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.exploreBtnText}>Explorar Menú</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ✅ DISEÑO SOLO CON RESUMEN FLOTANTE (SIN NAV)
  return (
    <View style={styles.container}>
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={26} color={c.text} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">Mi Pedido</Text>
        <Text style={styles.subtitle}>
          {items.length} producto(s) seleccionado(s)
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[c.accent]}
            tintColor={c.accent}
          />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const hasImage =
            typeof item.imagen_url === "string" && item.imagen_url.length > 0;

          return (
            <View style={[styles.card, !hasImage && styles.cardNoImage]}>
              {hasImage && (
                <Image
                  source={{ uri: item.imagen_url! }}
                  style={styles.image}
                  accessible
                  accessibilityLabel={`Foto de ${item.nombre}`}
                />
              )}

              <View style={[styles.info, !hasImage && styles.infoFullWidth]}>
                <Text style={styles.name}>{item.nombre}</Text>
                <Text style={styles.price}>{formatPrice(item.precio)}</Text>
              </View>

              <View style={styles.qtyControls}>
                <Pressable
                  style={[
                    styles.qtyBtn,
                    item.cantidad <= 1 && styles.qtyBtnDisabled,
                  ]}
                  onPress={() => updateQuantity(item.id, -1)}
                  disabled={item.cantidad <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar uno de ${item.nombre}`}
                  accessibilityState={{ disabled: item.cantidad <= 1 }}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={item.cantidad <= 1 ? c.textFaint : c.text}
                  />
                </Pressable>

                <Text
                  style={styles.qtyText}
                  accessibilityLabel={`Cantidad: ${item.cantidad}`}
                  accessibilityLiveRegion="polite"
                >
                  {item.cantidad}
                </Text>

                <Pressable
                  style={[
                    styles.qtyBtn,
                    !canAddMore(item) && styles.qtyBtnDisabled,
                  ]}
                  onPress={() => updateQuantity(item.id, 1)}
                  disabled={!canAddMore(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`Agregar uno más de ${item.nombre}`}
                  accessibilityState={{ disabled: !canAddMore(item) }}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={canAddMore(item) ? c.text : c.textFaint}
                  />
                </Pressable>
              </View>

              <Pressable
                style={styles.deleteBtn}
                onPress={() => removeItem(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${item.nombre} del carrito`}
              >
                <Ionicons name="trash-outline" size={20} color={c.danger} />
              </Pressable>
            </View>
          );
        }}
      />

      {/* ✅ RESUMEN FLOTANTE ÚNICO EN LA PARTE INFERIOR */}
      <View style={styles.summaryFloatingWrapper}>
        <View style={styles.summaryFloating}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total a pagar</Text>
            <Text style={styles.totalValue}>{formatPrice(total)}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.confirmBtn,
              { opacity: pressed || sendingOrder ? 0.85 : 1 },
            ]}
            onPress={() => setShowPaymentModal(true)}
            disabled={sendingOrder}
          >
            {sendingOrder ? (
              <ActivityIndicator color={c.onAccent} />
            ) : (
              <>
                <Text style={styles.confirmBtnText}>Confirmar Pedido</Text>
                <Ionicons name="checkmark-circle" size={22} color={c.onAccent} />
              </>
            )}
          </Pressable>
        </View>
      </View>

      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>¿Cómo querés pagar?</Text>
            <Text style={styles.modalSubtitle}>
              Monto total: {formatPrice(total)}
            </Text>

            <Pressable
              style={[styles.paymentOption, sendingOrder && styles.paymentOptionDisabled]}
              onPress={() => handleConfirmOrder("mp")}
              disabled={sendingOrder}
            >
              <View style={[styles.payIcon, { backgroundColor: c.infoSoft }]}>
                <Ionicons name="card-outline" size={28} color={c.info} />
              </View>
              <View style={styles.payInfo}>
                <Text style={styles.payTitle}>MercadoPago</Text>
                <Text style={styles.payDesc}>QR o transferencia inmediata</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
            </Pressable>

            <Pressable
              style={[styles.paymentOption, sendingOrder && styles.paymentOptionDisabled]}
              onPress={() => handleConfirmOrder("efectivo")}
              disabled={sendingOrder}
            >
              <View style={[styles.payIcon, { backgroundColor: c.warningSoft }]}>
                <Ionicons name="cash-outline" size={28} color={c.warningStrong} />
              </View>
              <View style={styles.payInfo}>
                <Text style={styles.payTitle}>Efectivo</Text>
                <Text style={styles.payDesc}>
                  Pagás al retirar en el kiosco
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
            </Pressable>

            {sendingOrder && (
              <View style={styles.sendingRow}>
                <ActivityIndicator color={c.accent} />
                <Text style={styles.sendingText}>Enviando tu pedido...</Text>
              </View>
            )}

            <Pressable
              style={styles.cancelModalBtn}
              onPress={() => setShowPaymentModal(false)}
              disabled={sendingOrder}
            >
              <Text style={styles.cancelModalText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO A MENÚ/ADMIN
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
  backBtn: { marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: c.textSecondary, marginTop: 4 },

  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140, zIndex: 1 },

  // TARJETAS ELEVADAS ESTILO MENÚ
  card: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: c.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardNoImage: { paddingRight: 16 },
  image: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    marginRight: 14,
  },
  info: { flex: 1 },
  infoFullWidth: { flex: 1, marginRight: 0 },
  name: { fontSize: 16, fontWeight: "700", color: c.text, marginBottom: 4 },
  price: { fontSize: 17, fontWeight: "800", color: c.accent },

  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.border,
  },
  qtyBtnDisabled: { backgroundColor: c.surfaceMuted },
  qtyText: {
    width: 36,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: c.text,
  },
  deleteBtn: { padding: 8, marginLeft: 8 },

  // ✅ WRAPPER DEL RESUMEN FLOTANTE ÚNICO
  summaryFloatingWrapper: {
    position: "absolute",
    bottom: 32,
    left: 24,
    right: 24,
    zIndex: 10,
    alignItems: "center",
  },

  // TARJETA FLOTANTE DE RESUMEN
  summaryFloating: {
    backgroundColor: c.surface,
    borderRadius: 24,
    padding: 16,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: c.borderSoft,
    width: "100%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: c.textSecondary },
  totalValue: { fontSize: 22, fontWeight: "800", color: c.text },
  confirmBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: c.accent,
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmBtnText: { color: c.onAccent, fontSize: 17, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: c.text,
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 16, color: c.textSecondary, marginBottom: 24 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  payIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  payInfo: { flex: 1 },
  payTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  payDesc: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  cancelModalBtn: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelModalText: { fontSize: 16, fontWeight: "600", color: c.danger },
  paymentOptionDisabled: { opacity: 0.5 },
  sendingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  sendingText: { fontSize: 15, color: c.textSecondary },

  // ESTADO VACÍO
  emptyBackBtn: {
    position: "absolute",
    top: 60,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingBottom: 100,
    zIndex: 1,
  },
  emptyIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: c.infoSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: c.text,
    marginBottom: 12,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: c.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.accent,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: c.accent,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreBtnText: { color: c.onAccent, fontSize: 17, fontWeight: "700" },
});
