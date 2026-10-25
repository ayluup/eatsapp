import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useEffect, useLayoutEffect, useState } from "react";

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
import { supabase } from "../../services/supabase";

export type Menu = {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio: number;
  disponible: boolean;
  imagen_url: string | null;
  categoria: string;
  created_at: string;
};

const formatPrice = (price: number) => "$" + price.toLocaleString("es-AR");
const CATEGORIES = ["Todos", "Comida", "Gaseosas", "Bebidas"];

export default function AdminMenuScreen() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

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
    } catch (err: any) {
      console.error("Error cargando menú:", err.message);
      Alert.alert("Error", "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert("Eliminar Producto", "¿Estás segura?", [
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
          } catch (err) {
            Alert.alert("Error", "No se pudo eliminar");
          }
        },
      },
    ]);
  };

  // Filtramos los items visibles para calcular si está vacío según la categoría
  const visibleItems =
    selectedCategory === "Todos"
      ? menus
      : menus.filter((item) => item.categoria === selectedCategory);

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerSubtitle}>Panel de Administración</Text>
        <Text style={styles.title}>Gestión de Menú</Text>
      </View>

      {/* ✅ CATEGORÍAS FIJAS CON ESPACIO CONSTANTE DEBAJO */}
      <View style={styles.categoriesRow}>
        {CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[
              styles.categoryBtn,
              selectedCategory === cat && styles.categoryBtnActive,
            ]}
            onPress={() => setSelectedCategory(cat)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === cat && styles.categoryTextActive,
              ]}
            >
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ✅ LISTA CON ListEmptyComponent DINÁMICO */}
      <FlatList
        data={visibleItems} // Usamos la data ya filtrada
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const hasImage = !!item.imagen_url;
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                { opacity: pressed ? 0.95 : 1 },
              ]}
              onPress={() => router.push(`/editar?id=${item.id}`)}
            >
              {hasImage && (
                <View style={styles.imageContainer}>
                  <Image
                    source={{ uri: item.imagen_url! }}
                    style={styles.productImage}
                  />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name}>{item.nombre}</Text>
                <Text style={styles.desc} numberOfLines={2}>
                  {item.descripcion || "Sin descripción"}
                </Text>
                <Text style={styles.price}>{formatPrice(item.precio)}</Text>
                <Text style={styles.catBadge}>{item.categoria}</Text>
                <View
                  style={[
                    styles.stockBadgeBottom,
                    item.disponible ? styles.inStock : styles.outOfStock,
                  ]}
                >
                  <Text style={styles.stockTextBottom}>
                    {item.disponible ? "En Stock" : "Agotado"}
                  </Text>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteBtn,
                  { opacity: pressed ? 0.4 : 0.7 },
                ]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDelete(item.id);
                }}
              >
                <Ionicons name="trash-outline" size={24} color="#334155" />
              </Pressable>
            </Pressable>
          );
        }}
        // ✅ MENSAJE DINÁMICO SEGÚN LA CATEGORÍA SELECCIONADA
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="fast-food-outline" size={40} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>
              {selectedCategory === "Todos"
                ? "Tu menú está vacío"
                : `No hay productos en ${selectedCategory}`}
            </Text>
            <Text style={styles.emptyText}>
              {selectedCategory === "Todos"
                ? 'Tocá "Agregar" en la barra inferior para crear tu primer producto'
                : "Probá cambiando de categoría o agregando nuevos productos"}
            </Text>
          </View>
        }
        refreshing={loading}
        onRefresh={fetchMenus}
      />

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItemActive}>
          <Ionicons name="restaurant-outline" size={24} color="#10B981" />
          <Text style={styles.navTextActive}>Menú</Text>
        </Pressable>

        <Pressable
          style={styles.navItemInactive}
          onPress={() => router.push("/agregar")}
        >
          <Ionicons name="add-circle-outline" size={24} color="#94A3B8" />
          <Text style={styles.navTextInactive}>Agregar</Text>
        </Pressable>

        <Pressable
          style={styles.navItemInactive}
          onPress={() => router.push("/(admin)/pedidos")}
        >
          <Ionicons name="list-outline" size={24} color="#94A3B8" />
          <Text style={styles.navTextInactive}>Pedidos</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },

  header: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 10 },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },

  // ✅ CATEGORÍAS FIJAS SIN SCROLL
  categoriesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12, // Espacio vertical fijo
    gap: 8,
  },
  categoryBtn: {
    flex: 1,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  categoryBtnActive: {
    backgroundColor: "#456b7b",
    borderColor: "#456b7b",
  },
  categoryText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  categoryTextActive: { color: "#FFF", fontWeight: "700" },

  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
    alignItems: "center",
  },
  card: {
    width: "100%",
    maxWidth: 320,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },

  imageContainer: { marginRight: 16 },
  productImage: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },

  info: { flex: 1, paddingRight: 6 },
  name: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 3 },
  desc: { fontSize: 12, color: "#64748B", lineHeight: 16, marginBottom: 6 },
  price: { fontSize: 17, fontWeight: "800", color: "#10B981", marginBottom: 4 },

  catBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },

  stockBadgeBottom: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inStock: { backgroundColor: "#10B981" },
  outOfStock: { backgroundColor: "#EF4444" },
  stockTextBottom: { color: "#fff", fontSize: 10, fontWeight: "700" },
  deleteBtn: { padding: 8 },

  emptyContainer: { alignItems: "center", marginTop: 60, padding: 20 },
  emptyIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#ECFDF5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    maxWidth: 240,
    lineHeight: 20,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingBottom: 25,
    paddingTop: 12,
    paddingHorizontal: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  },
  navItemActive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navItemInactive: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navTextActive: { fontSize: 12, fontWeight: "700", color: "#10B981" },
  navTextInactive: { fontSize: 12, fontWeight: "600", color: "#94A3B8" },
});
