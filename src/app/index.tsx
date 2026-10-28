import { Redirect } from "expo-router";
import { isAdminRole, useAuth } from "../context/AuthContext";

export default function Index() {
  const { session, role, recovering } = useAuth();

  if (recovering) return <Redirect href="/restablecer" />;
  if (!session) return <Redirect href="/(auth)/login" />;
  return (
    <Redirect href={isAdminRole(role) ? "/(admin)/menu" : "/(student)/menu"} />
  );
}
