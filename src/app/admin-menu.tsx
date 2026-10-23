import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { supabase } from "../services/supabase";

export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
  created_at: string;
};

const formatPrice = (price: number) => {
  return "$" + price.toLocaleString("es-AR");
};

export default function AdminMenuScreen() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      const { data, error } = await supabase
        .from("menus")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMenus(data || []);
    } catch (err) {
      console.error("Error cargando menús:", err);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert("Eliminar Producto", "¿Estás segura de borrar este ítem?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const { error } = await supabase
              .from("menus")
              .delete()
              .eq("id", id);
            if (error) throw error;
            setMenus((prev) => prev.filter((m) => m.id !== id));
            Alert.alert("Éxito", "Producto eliminado correctamente");
          } catch (err) {
            Alert.alert("Error", "No se pudo eliminar el producto");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1B5E20" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Moderno */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Kiosco EatsApp</Text>
          <Text style={styles.title}>Gestión de Menú</Text>
        </View>

        {/* FAB MODERNO: Blanco, sombra suave, ícono negro */}
        <Pressable
          style={({ pressed }) => [
            styles.fab,
            {
              transform: [{ rotate: pressed ? "45deg" : "0deg" }],
              opacity: pressed ? 0.7 : 1,
            },
          ]}
          onPress={() => router.push("/admin-agregar")}
        >
          <Ionicons name="add" size={24} color="#111" />
        </Pressable>
      </View>

      <FlatList
        data={menus}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={[styles.card, !item.disponible && styles.cardDisabled]}>
            <View style={styles.imageContainer}>
              {item.imagen_url ? (
                <Image
                  source={{ uri: item.imagen_url }}
                  style={styles.productImage}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={24} color="#999" />
                </View>
              )}

              {/* Badge de Stock integrado */}
              <View
                style={[
                  styles.stockBadge,
                  item.disponible ? styles.inStock : styles.outOfStock,
                ]}
              >
                <Text style={styles.stockText}>
                  {item.disponible ? "En Stock" : "Agotado"}
                </Text>
              </View>
            </View>

            <View style={styles.info}>
              <Text style={styles.name}>{item.nombre}</Text>
              <Text style={styles.desc} numberOfLines={2}>
                {item.descripcion || "Sin descripción disponible"}
              </Text>
              <Text style={styles.price}>{formatPrice(item.precio)}</Text>
            </View>

            {/* Tacho Negro Minimalista */}
            <Pressable
              style={({ pressed }) => [
                styles.deleteBtn,
                { opacity: pressed ? 0.5 : 1 },
              ]}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={24} color="#333" />
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="fast-food-outline" size={40} color="#1B5E20" />
            </View>
            <Text style={styles.emptyTitle}>Tu menú está vacío</Text>
            <Text style={styles.emptyText}>
              Tocá el botón + para agregar tu primer producto
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchMenus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* =========================
     FONDO
  ========================= */

  container: {
    flex: 1,
    backgroundColor: "#F6F7F5",
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F6F7F5",
  },

  /* =========================
     HEADER
  ========================= */

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 24,
    paddingTop: 60,
    paddingBottom: 10,
  },

  headerSubtitle: {
    fontSize: 13,
    color: "#7A7D78",
    fontWeight: "600",
    marginBottom: 5,
    letterSpacing: 0.4,
  },

  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#20231F",
    letterSpacing: -0.7,
  },

  /* =========================
     BOTÓN +
  ========================= */

  fab: {
    width: 48,
    height: 48,
    borderRadius: 16,

    backgroundColor: "#20231F",

    justifyContent: "center",
    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },

    elevation: 5,

    borderWidth: 1,
    borderColor: "#20231F",
  },

  /* =========================
     LISTA
  ========================= */

  list: {
    padding: 16,
    paddingBottom: 120,
  },

  /* =========================
     TARJETA
  ========================= */

  card: {
    flexDirection: "row",

    backgroundColor: "#FFFFFF",

    borderRadius: 20,

    padding: 16,

    marginBottom: 16,

    alignItems: "center",

    shadowColor: "#000",
    shadowOpacity: 0.055,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,

    borderWidth: 1,
    borderColor: "#E8EAE6",
  },

  cardDisabled: {
    opacity: 0.62,
    backgroundColor: "#F1F2EF",
  },

  /* =========================
     IMAGEN
  ========================= */

  imageContainer: {
    position: "relative",
    marginRight: 16,
  },

  productImage: {
    width: 72,
    height: 72,

    borderRadius: 16,

    backgroundColor: "#ECEEEB",
  },

  imagePlaceholder: {
    width: 72,
    height: 72,

    backgroundColor: "#ECEEEB",

    borderRadius: 16,

    justifyContent: "center",
    alignItems: "center",

    borderWidth: 1,
    borderColor: "#E1E3DF",
  },

  /* =========================
     STOCK
  ========================= */

  stockBadge: {
    position: "absolute",

    bottom: -6,
    left: -6,

    paddingHorizontal: 8,
    paddingVertical: 3,

    borderRadius: 8,

    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  inStock: {
    backgroundColor: "#2E6B3A",
  },

  outOfStock: {
    backgroundColor: "#B84A4A",
  },

  stockText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },

  /* =========================
     INFORMACIÓN
  ========================= */

  info: {
    flex: 1,
  },

  name: {
    fontSize: 17,
    fontWeight: "700",
    color: "#20231F",
    marginBottom: 4,
  },

  desc: {
    fontSize: 13,
    color: "#777B76",
    lineHeight: 18,
    marginBottom: 8,
  },

  price: {
    fontSize: 18,
    fontWeight: "800",
    color: "#2E6B3A",
  },

  /* =========================
     BOTÓN ELIMINAR
  ========================= */

  deleteBtn: {
    padding: 12,
    marginLeft: 4,

    borderRadius: 12,
    backgroundColor: "#F1F2EF",
  },

  /* =========================
     MENÚ VACÍO
  ========================= */

  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    padding: 20,
  },

  emptyIconBox: {
    width: 80,
    height: 80,

    borderRadius: 24,

    backgroundColor: "#E4EAE3",

    justifyContent: "center",
    alignItems: "center",

    marginBottom: 16,

    borderWidth: 1,
    borderColor: "#D9E0D8",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#20231F",
    marginBottom: 6,
  },

  emptyText: {
    fontSize: 14,
    color: "#858984",
    textAlign: "center",
    maxWidth: 250,
  },
});
