import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router"; // ✅ Agregamos useNavigation
import { useEffect, useLayoutEffect, useState } from "react"; // ✅ Agregamos useLayoutEffect
import { supabase } from "../../services/supabase";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

export default function AdminEditarScreen() {
  const { id } = useLocalSearchParams();
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("Comida");
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [showOptions, setShowOptions] = useState(false);

  const router = useRouter();
  const navigation = useNavigation(); // ✅ Obtenemos la navegación

  // ✅ ESTO OCULTA LA BARRA BLANCA NATIVA DE EXPO ROUTER
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data, error } = await supabase
          .from("menus")
          .select("*")
          .eq("id", Number(id))
          .single();

        if (error) throw error;

        setNombre(data.nombre);
        setDescripcion(data.descripcion || "");
        setPrecio(String(data.precio));
        setCategoria(data.categoria || "Comida");
        setBase64Image(data.imagen_url);
        setDisponible(data.disponible);
      } catch (err) {
        Alert.alert("Error", "No se pudo cargar el producto");
        router.back();
      } finally {
        setFetching(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setBase64Image(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
    setShowOptions(false);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setBase64Image(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
    setShowOptions(false);
  };

  const handleGuardar = async () => {
    if (!nombre.trim() || !precio.trim()) {
      Alert.alert(
        "Campos requeridos",
        "Por favor completá el nombre y el precio.",
      );
      return;
    }

    const precioNum = parseFloat(precio.replace(/\./g, "").replace(",", "."));
    if (isNaN(precioNum) || precioNum <= 0) {
      Alert.alert("Precio inválido", "Ingresá un precio mayor a 0.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("menus")
        .update({
          nombre: nombre.trim(),
          descripcion: descripcion.trim() || null,
          precio: precioNum,
          categoria: categoria,
          disponible: disponible,
          imagen_url: base64Image || null,
        })
        .eq("id", Number(id));

      if (error) throw error;

      Alert.alert(
        "✅ Producto Actualizado",
        `"${nombre}" fue modificado correctamente.`,
      );
      router.back();
    } catch (err: any) {
      console.error("Error al actualizar:", err);
      Alert.alert("Error", err.message || "No se pudo actualizar el producto");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#638ec1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ✅ FONDO DIFUMINADO IDÉNTICO A AGREGAR */}
      <View style={styles.bgTop} />
      <View style={styles.bgBottom} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#0F172A" />
        </Pressable>

        <Text style={styles.title}>Editar Producto</Text>
        <Text style={styles.subtitle}>Modificá los datos del menú.</Text>

        {/* Selector de Imagen Premium */}
        <Pressable
          style={styles.imagePicker}
          onPress={() => setShowOptions(true)}
        >
          {base64Image ? (
            <>
              <RNImage
                source={{ uri: base64Image }}
                style={styles.previewImage}
              />
              <View style={styles.changeBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
                <Text style={styles.changeText}>Cambiar foto</Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderBox}>
              <View style={styles.placeholderIconCircle}>
                <Ionicons name="camera-outline" size={32} color="#94A3B8" />
              </View>
              <Text style={styles.placeholderText}>
                Tocar para cambiar foto
              </Text>
              <Text style={styles.placeholderSubtext}>Cámara o Galería</Text>
            </View>
          )}
        </Pressable>

        {/* Modal Cámara/Galería Estilizado */}
        <Modal visible={showOptions} transparent animationType="slide">
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowOptions(false)}
          >
            <Pressable
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <Text style={styles.modalTitle}>
                ¿De dónde querés sacar la foto?
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.modalOption,
                  pressed && styles.modalOptionPressed,
                ]}
                onPress={takePhoto}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#ECFDF5" }]}
                >
                  <Ionicons name="camera" size={24} color="#10B981" />
                </View>
                <Text style={styles.optionText}>Usar Cámara</Text>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalOption,
                  pressed && styles.modalOptionPressed,
                ]}
                onPress={pickFromGallery}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: "#EFF6FF" }]}
                >
                  <Ionicons name="images" size={24} color="#3B82F6" />
                </View>
                <Text style={styles.optionText}>Elegir de Galería</Text>
                <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                onPress={() => setShowOptions(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Campos del Formulario con Iconos */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>
            Nombre del producto <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="pricetag-outline"
              size={20}
              color="#94A3B8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej: Sándwich de jamón y queso"
              placeholderTextColor="#CBD5E1"
              value={nombre}
              onChangeText={setNombre}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Descripción</Text>
          <View style={[styles.inputWrapper, styles.textAreaWrapper]}>
            <Ionicons
              name="document-text-outline"
              size={20}
              color="#94A3B8"
              style={styles.inputIconTop}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Pan artesanal, jamón cocido, queso tybo..."
              placeholderTextColor="#CBD5E1"
              value={descripcion}
              onChangeText={setDescripcion}
              multiline
              numberOfLines={3}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>
            Precio ($) <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="cash-outline"
              size={20}
              color="#94A3B8"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej: 2150"
              placeholderTextColor="#CBD5E1"
              value={precio}
              onChangeText={setPrecio}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Selector de Categoría tipo Chips */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Categoría</Text>
          <View style={styles.catContainer}>
            {["Comida", "Gaseosas", "Bebidas"].map((cat) => (
              <Pressable
                key={cat}
                style={[
                  styles.catBtn,
                  categoria === cat && styles.catBtnActive,
                ]}
                onPress={() => setCategoria(cat)}
              >
                <Text
                  style={[
                    styles.catText,
                    categoria === cat && styles.catTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Switch de Stock Estilizado */}
        <View style={styles.switchCard}>
          <View style={styles.switchInfo}>
            <Ionicons name="cube-outline" size={20} color="#64748B" />
            <Text style={styles.switchLabel}>¿Hay stock disponible?</Text>
          </View>
          <Switch
            value={disponible}
            onValueChange={setDisponible}
            trackColor={{ false: "#CBD5E1", true: "#10B981" }}
            thumbColor={disponible ? "#FFF" : "#F1F5F9"}
            ios_backgroundColor="#CBD5E1"
          />
        </View>

        {/* Botón Guardar Premium */}
        <Pressable
          style={({ pressed }) => [
            styles.btn,
            pressed && !loading && styles.btnPressed,
          ]}
          onPress={handleGuardar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.btnText}>Guardar Cambios</Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO A AGREGAR
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: "#f0e7e2",
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },

  scrollView: { flex: 1, zIndex: 1 },
  // ✅ Padding inferior reducido ya que NO hay barra flotante
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "#64748B",
    marginBottom: 28,
    lineHeight: 22,
  },

  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 28,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  previewImage: { width: "100%", height: "100%" },
  changeBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0F172A",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: { color: "#FFF", fontSize: 12, fontWeight: "600", marginLeft: 6 },
  placeholderBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: { color: "#0F172A", fontSize: 15, fontWeight: "600" },
  placeholderSubtext: { marginTop: 4, color: "#94A3B8", fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
  },
  modalOptionPressed: { backgroundColor: "#F1F5F9" },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionText: { flex: 1, fontSize: 16, fontWeight: "600", color: "#0F172A" },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },

  formGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    marginLeft: 4,
  },
  required: { color: "#EF4444" },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    height: 56,
  },
  textAreaWrapper: { height: 100, alignItems: "flex-start", paddingTop: 16 },
  inputIcon: { marginRight: 12 },
  inputIconTop: { marginRight: 12, marginTop: 2 },
  input: { flex: 1, fontSize: 16, color: "#0F172A", height: "100%" },
  textArea: { textAlignVertical: "top", paddingTop: 0 },

  catContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catBtnActive: { backgroundColor: "#638ec1", borderColor: "#638ec1" },
  catText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  catTextActive: { color: "#FFF" },

  switchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  switchInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchLabel: { fontSize: 16, fontWeight: "600", color: "#0F172A" },

  btn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#638ec1",
    padding: 18,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: "#638ec1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnText: { color: "#FFF", fontSize: 17, fontWeight: "700" },
});
