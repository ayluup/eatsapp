import { Redirect } from 'expo-router';

export default function AdminIndex() {
  // Redirige inmediatamente a la primera pantalla real del admin
  return <Redirect href="/menu" />;
}