import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    Image as RNImage,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { supabase } from "../services/supabase";

export default function AdminAgregarScreen() {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [base64Image, setBase64Image] = useState<string | null>(null); // Guardamos la imagen convertida
  const [disponible, setDisponible] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Función para abrir galería/cámara y convertir a Base64
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      // Convertimos a formato Data URI válido para web/app
      setBase64Image(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleGuardar = async () => {
    if (!nombre.trim() || !precio.trim()) {
      Alert.alert(
        "Campos requeridos",
        "Por favor completá el nombre y el precio.",
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("menus").insert({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        precio: parseFloat(precio.replace(/\./g, "").replace(",", ".")),
        disponible: disponible,
        imagen_url: base64Image || null, // Guardamos el string Base64 en la BD
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
        <Ionicons name="arrow-back" size={28} color="#000" />
      </Pressable>

      <Text style={styles.title}>Nuevo Producto</Text>
      <Text style={styles.subtitle}>
        Completa los datos para agregarlo al menú.
      </Text>

      {/* Selector de Imagen */}
      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {base64Image ? (
          <RNImage source={{ uri: base64Image }} style={styles.previewImage} />
        ) : (
          <View style={styles.placeholderBox}>
            <Ionicons name="camera-outline" size={32} color="#666" />
            <Text style={styles.placeholderText}>Tocar para elegir foto</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.label}>Nombre del producto *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Menú Ejecutivo"
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

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>¿Hay stock disponible?</Text>
        <Switch
          value={disponible}
          onValueChange={setDisponible}
          trackColor={{ false: "#BDC3C7", true: "#1B5E20" }}
          thumbColor={disponible ? "#fff" : "#f4f3f4"}
        />
      </View>

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
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  content: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  backBtn: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "#000", marginBottom: 5 },
  subtitle: { fontSize: 15, color: "#666", marginBottom: 20 },

  // Estilos nuevos para el selector de imagen
  imagePicker: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  previewImage: { width: "100%", height: "100%" },
  placeholderBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
  },
  placeholderText: { marginTop: 10, color: "#666", fontSize: 14 },

  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
    marginLeft: 5,
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    color: "#000",
  },
  textArea: { height: 100, textAlignVertical: "top" },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  switchLabel: { fontSize: 16, fontWeight: "600", color: "#000" },
  btn: {
    backgroundColor: "#1B5E20",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
