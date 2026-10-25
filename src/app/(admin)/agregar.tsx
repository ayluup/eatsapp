import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useNavigation, useRouter } from "expo-router";
import { useLayoutEffect, useState } from "react";

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
import { supabase } from "../../services/supabase";

export default function AdminAgregarScreen() {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("Comida"); // ✅ Estado para categoría
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [disponible, setDisponible] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
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
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setBase64Image(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
    setShowOptions(false);
  };

  const handleGuardar = async () => {
    if (!nombre.trim() || !precio.trim()) {
      return Alert.alert(
        "Campos requeridos",
        "Por favor completá el nombre y el precio.",
      );
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("menus").insert({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: parseFloat(precio.replace(/\./g, "").replace(",", ".")),
        categoria: categoria, // ✅ Guardamos la categoría
        disponible: disponible,
        imagen_url: base64Image || null,
      });

      if (error) throw error;

      Alert.alert(
        "Producto Guardado",
        `"${nombre}" fue agregado al menú correctamente.`,
      );
      router.back();
    } catch (err: any) {
      console.error("Error al guardar:", err);
      Alert.alert("Error", err.message || "No se pudo guardar el producto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={28} color="#0F172A" />
      </Pressable>

      <Text style={styles.title}>Nuevo Producto</Text>
      <Text style={styles.subtitle}>
        Completá los datos para agregarlo al menú del kiosco.
      </Text>

      {/* Selector de Imagen */}
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
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.changeText}>Cambiar foto</Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholderBox}>
            <Ionicons name="camera-outline" size={36} color="#64748B" />
            <Text style={styles.placeholderText}>Tocar para agregar foto</Text>
            <Text style={styles.placeholderSubtext}>Cámara o Galería</Text>
          </View>
        )}
      </Pressable>

      <Modal visible={showOptions} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              ¿De dónde querés sacar la foto?
            </Text>
            <Pressable style={styles.modalOption} onPress={takePhoto}>
              <View style={[styles.optionIcon, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons name="camera" size={24} color="#10B981" />
              </View>
              <Text style={styles.optionText}>Usar Cámara</Text>
            </Pressable>
            <Pressable style={styles.modalOption} onPress={pickFromGallery}>
              <View style={[styles.optionIcon, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons name="images" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.optionText}>Elegir de Galería</Text>
            </Pressable>
            <Pressable
              style={styles.cancelBtn}
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Campos del Formulario */}
      <Text style={styles.label}>Nombre del producto *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Sandwich de jamon y queso"
        value={nombre}
        onChangeText={setNombre}
      />

      <Text style={styles.label}>Descripción</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Ej: Agua/soda + Tarta de zucchini..."
        value={descripcion}
        onChangeText={setDescripcion}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Precio ($) *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 21500"
        value={precio}
        onChangeText={setPrecio}
        keyboardType="numeric"
      />

      {/* ✅ SELECTOR DE CATEGORÍAS (SIN DULCES) */}
      <Text style={styles.label}>Categoría</Text>
      <View style={styles.catContainer}>
        {["Comida", "Gaseosas", "Bebidas"].map((cat) => (
          <Pressable
            key={cat}
            style={[styles.catBtn, categoria === cat && styles.catBtnActive]}
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

      {/* Switch de Stock */}
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>¿Hay stock disponible?</Text>
        <Switch
          value={disponible}
          onValueChange={setDisponible}
          trackColor={{ false: "#CBD5E1", true: "#10B981" }}
          thumbColor={disponible ? "#fff" : "#F1F5F9"}
        />
      </View>

      {/* Botón Guardar */}
      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { opacity: pressed && !loading ? 0.85 : 1 },
        ]}
        onPress={handleGuardar}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Guardar Producto</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  backBtn: { marginBottom: 24 },
  title: { fontSize: 28, fontWeight: "800", color: "#0F172A", marginBottom: 6 },
  subtitle: { fontSize: 15, color: "#64748B", marginBottom: 28 },

  imagePicker: {
    width: "100%",
    height: 200,
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 28,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  changeText: { color: "#fff", fontSize: 12, fontWeight: "600", marginLeft: 6 },
  placeholderBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  placeholderText: {
    marginTop: 12,
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600",
  },
  placeholderSubtext: { marginTop: 4, color: "#64748B", fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
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
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  optionText: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  cancelBtn: { padding: 16, alignItems: "center", marginTop: 8 },
  cancelText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },

  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    color: "#0F172A",
  },
  textArea: { height: 100, textAlignVertical: "top" },

  // ✅ ESTILOS PARA CATEGORÍAS
  catContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  catBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catBtnActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  catText: { fontSize: 14, fontWeight: "600", color: "#64748B" },
  catTextActive: { color: "#FFF" },

  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  switchLabel: { fontSize: 16, fontWeight: "600", color: "#0F172A" },
  btn: {
    backgroundColor: "#0F172A",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
