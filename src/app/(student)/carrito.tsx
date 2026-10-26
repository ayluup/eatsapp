import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useCart } from "../../hooks/useCart";
import { supabase } from "../../services/supabase";

import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");

export default function StudentCartScreen() {
  const { items, loading, updateQuantity, removeItem, total, clearCart } =
    useCart();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [sendingOrder, setSendingOrder] = useState(false);
  const router = useRouter();

  const handleConfirmOrder = async (method: "mp" | "efectivo") => {
    setSendingOrder(true);
    try {
      let sessionId = await AsyncStorage.getItem("@kiosco_session_id");
      if (!sessionId) {
        sessionId = `STU-${Date.now().toString(36).toUpperCase()}`;
        await AsyncStorage.setItem("@kiosco_session_id", sessionId);
      }

      const orderId = `PED-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase.from("pedidos").insert({
        id_pedido: orderId,
        session_id: sessionId,
        items: items,
        total: total,
        metodo_pago: method,
        estado: "pending",
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      clearCart();
      setShowPaymentModal(false);
      router.replace("/(student)/mis-pedidos");
    } catch (err) {
      console.error("Error al confirmar pedido:", err);
      alert("Hubo un error al enviar tu pedido. Intentá nuevamente.");
    } finally {
      setSendingOrder(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#638ec1" />
      </View>
    );
  }

  // ✅ ESTADO VACÍO SIN BARRA DE NAVEGACIÓN
  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.bgTop} />
        <View style={styles.bgBottom} />

        <Pressable onPress={() => router.back()} style={styles.emptyBackBtn}>
          <Ionicons name="arrow-back" size={26} color="#0F172A" />
        </Pressable>

        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrapper}>
            <Ionicons name="cart-outline" size={48} color="#638ec1" />
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
            onPress={() => router.push("/(student)/menu")}
          >
            <Ionicons
              name="restaurant-outline"
              size={20}
              color="#fff"
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
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#0F172A" />
        </Pressable>
        <Text style={styles.title}>Mi Pedido</Text>
        <Text style={styles.subtitle}>
          {items.length} producto(s) seleccionado(s)
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id.toString()}
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
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={item.cantidad <= 1 ? "#CBD5E1" : "#0F172A"}
                  />
                </Pressable>

                <Text style={styles.qtyText}>{item.cantidad}</Text>

                <Pressable
                  style={styles.qtyBtn}
                  onPress={() => updateQuantity(item.id, 1)}
                >
                  <Ionicons name="add" size={18} color="#0F172A" />
                </Pressable>
              </View>

              <Pressable
                style={styles.deleteBtn}
                onPress={() => removeItem(item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
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
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.confirmBtnText}>Confirmar Pedido</Text>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
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
              style={styles.paymentOption}
              onPress={() => handleConfirmOrder("mp")}
            >
              <View style={[styles.payIcon, { backgroundColor: "#E0F2FE" }]}>
                <Ionicons name="card-outline" size={28} color="#0284C7" />
              </View>
              <View style={styles.payInfo}>
                <Text style={styles.payTitle}>MercadoPago</Text>
                <Text style={styles.payDesc}>QR o transferencia inmediata</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>

            <Pressable
              style={styles.paymentOption}
              onPress={() => handleConfirmOrder("efectivo")}
            >
              <View style={[styles.payIcon, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="cash-outline" size={28} color="#D97706" />
              </View>
              <View style={styles.payInfo}>
                <Text style={styles.payTitle}>Efectivo</Text>
                <Text style={styles.payDesc}>
                  Pagás al retirar en el kiosco
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </Pressable>

            <Pressable
              style={styles.cancelModalBtn}
              onPress={() => setShowPaymentModal(false)}
            >
              <Text style={styles.cancelModalText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO A MENÚ/ADMIN
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
  backBtn: { marginBottom: 12 },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: 15, color: "#64748B", marginTop: 4 },

  list: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 140, zIndex: 1 },

  // TARJETAS ELEVADAS ESTILO MENÚ
  card: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  cardNoImage: { paddingRight: 16 },
  image: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    marginRight: 14,
  },
  info: { flex: 1 },
  infoFullWidth: { flex: 1, marginRight: 0 },
  name: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 4 },
  price: { fontSize: 17, fontWeight: "800", color: "#638ec1" },

  qtyControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    overflow: "hidden",
    marginLeft: 8,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
  },
  qtyBtnDisabled: { backgroundColor: "#F1F5F9" },
  qtyText: {
    width: 36,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 16,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    width: "100%",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 15, fontWeight: "600", color: "#64748B" },
  totalValue: { fontSize: 22, fontWeight: "800", color: "#0F172A" },
  confirmBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#638ec1",
    paddingVertical: 16,
    borderRadius: 16,
  },
  confirmBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  modalSubtitle: { fontSize: 16, color: "#64748B", marginBottom: 24 },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  payTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  payDesc: { fontSize: 13, color: "#64748B", marginTop: 2 },
  cancelModalBtn: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelModalText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },

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
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
    maxWidth: 280,
  },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#638ec1",
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: "#638ec1",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  exploreBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
