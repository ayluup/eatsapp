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
import { ThemeColors } from "../../constants/theme";
import { useThemedStyles } from "../../hooks/use-themed-styles";

export default function AdminEditarScreen() {
  const { colors: c, styles } = useThemedStyles(createStyles);
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
        <ActivityIndicator size="large" color={c.accent} />
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
          <Ionicons name="arrow-back" size={26} color={c.text} />
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
                <Ionicons name="camera" size={14} color={c.onAccent} />
                <Text style={styles.changeText}>Cambiar foto</Text>
              </View>
            </>
          ) : (
            <View style={styles.placeholderBox}>
              <View style={styles.placeholderIconCircle}>
                <Ionicons name="camera-outline" size={32} color={c.textMuted} />
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
                  style={[styles.optionIcon, { backgroundColor: c.successSoft }]}
                >
                  <Ionicons name="camera" size={24} color={c.success} />
                </View>
                <Text style={styles.optionText}>Usar Cámara</Text>
                <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
              </Pressable>

              <Pressable
                style={({ pressed }) => [
                  styles.modalOption,
                  pressed && styles.modalOptionPressed,
                ]}
                onPress={pickFromGallery}
              >
                <View
                  style={[styles.optionIcon, { backgroundColor: c.infoSoft }]}
                >
                  <Ionicons name="images" size={24} color={c.info} />
                </View>
                <Text style={styles.optionText}>Elegir de Galería</Text>
                <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
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
              color={c.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej: Sándwich de jamón y queso"
              placeholderTextColor={c.textFaint}
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
              color={c.textMuted}
              style={styles.inputIconTop}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ej: Pan artesanal, jamón cocido, queso tybo..."
              placeholderTextColor={c.textFaint}
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
              color={c.textMuted}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Ej: 2150"
              placeholderTextColor={c.textFaint}
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
            <Ionicons name="cube-outline" size={20} color={c.textSecondary} />
            <Text style={styles.switchLabel}>¿Hay stock disponible?</Text>
          </View>
          <Switch
            value={disponible}
            onValueChange={setDisponible}
            trackColor={{ false: c.textFaint, true: c.success }}
            thumbColor={disponible ? c.onAccent : c.surfaceMuted}
            ios_backgroundColor={c.textFaint}
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
            <ActivityIndicator color={c.onAccent} size="small" />
          ) : (
            <>
              <Text style={styles.btnText}>Guardar Cambios</Text>
              <Ionicons name="checkmark-circle" size={20} color={c.onAccent} />
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: { flex: 1 },

  // ✅ FONDO DIFUMINADO IDÉNTICO A AGREGAR
  bgTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: "30%",
    backgroundColor: c.decorAdmin,
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

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
  },

  scrollView: { flex: 1, zIndex: 1 },
  // ✅ Padding inferior reducido ya que NO hay barra flotante
  content: { padding: 24, paddingTop: 60, paddingBottom: 40 },

  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: c.text,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: c.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },

  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 24,
    overflow: "hidden",
    marginBottom: 28,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: c.shadow,
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
    backgroundColor: c.overlay,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeText: { color: c.onAccent, fontSize: 12, fontWeight: "600", marginLeft: 6 },
  placeholderBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
  },
  placeholderIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.surfaceMuted,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  placeholderText: { color: c.text, fontSize: 15, fontWeight: "600" },
  placeholderSubtext: { marginTop: 4, color: c.textMuted, fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: c.text,
    marginBottom: 20,
    textAlign: "center",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: c.surfaceAlt,
  },
  modalOptionPressed: { backgroundColor: c.surfaceMuted },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionText: { flex: 1, fontSize: 16, fontWeight: "600", color: c.text },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelText: { fontSize: 16, fontWeight: "600", color: c.danger },

  formGroup: { marginBottom: 20 },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: c.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  required: { color: c.danger },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: 16,
    height: 56,
  },
  textAreaWrapper: { height: 100, alignItems: "flex-start", paddingTop: 16 },
  inputIcon: { marginRight: 12 },
  inputIconTop: { marginRight: 12, marginTop: 2 },
  input: { flex: 1, fontSize: 16, color: c.text, height: "100%" },
  textArea: { textAlignVertical: "top", paddingTop: 0 },

  catContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  catBtnActive: { backgroundColor: c.accent, borderColor: c.accent },
  catText: { fontSize: 14, fontWeight: "600", color: c.textSecondary },
  catTextActive: { color: c.onAccent },

  switchCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: c.border,
  },
  switchInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  switchLabel: { fontSize: 16, fontWeight: "600", color: c.text },

  btn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.accent,
    padding: 18,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: c.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  btnText: { color: c.onAccent, fontSize: 17, fontWeight: "700" },
});
