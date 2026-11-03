# EatsApp 🍔

App para pedir comida en el kiosco de la escuela sin hacer fila. Los alumnos ven el menú, arman su pedido y siguen su estado en tiempo real. El kiosco recibe los pedidos al instante, los prepara y avisa cuando están listos.

> Proyecto final de **Construcción de Software — 6.º año**.

---

## El problema

En los recreos se forma fila en el kiosco y muchos alumnos no llegan a comprar. El kiosco tampoco sabe con anticipación qué va a vender. EatsApp permite pedir desde el celular y retirar cuando el pedido está listo, y le da al kiosco el control de su menú, su stock y sus ventas.

**Para quién es:** alumnos, docentes y personal de la escuela que compran en el kiosco, y los encargados del kiosco que lo administran.

---

## Instalación y acceso

### Opción 1: APK (Android)

1. Descargá el APK desde la página del proyecto: **[link a la web]**.
2. Abrí el archivo. Si Android lo pide, permití **"Instalar apps de orígenes desconocidos"** para el navegador o el gestor de archivos.
3. Abrí **EatsApp**.

**Requisitos:** Android 7 o superior y conexión a internet. No hace falta instalar nada más: el backend está en la nube.

### Opción 2: correr el proyecto (desarrolladores)

```bash
git clone https://github.com/ayluup/eatsapp.git
cd eatsapp
npm install
```

Crear un archivo `.env` en la raíz con las claves **públicas** de Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=https://<proyecto>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

```bash
npx expo start
```

La app usa módulos nativos (notificaciones, cámara), así que hace falta un **development build** y no Expo Go:

```bash
npx eas-cli@latest build -p android --profile development
```

Para generar el APK de distribución:

```bash
npx eas-cli@latest build -p android --profile preview
```

> Las variables `EXPO_PUBLIC_*` tienen que estar cargadas también en el entorno `preview` de EAS (expo.dev → proyecto → Environment variables). Si faltan, el APK no se conecta.

---

## Cómo usarla

### Crear una cuenta e iniciar sesión
1. En la pantalla de inicio tocá **"Registrate"**, ingresá tu email y una contraseña de al menos 6 caracteres, y confirmá el email que te llega.
2. También podés entrar con **"Continuar con Google"**.
3. Si olvidaste la contraseña, tocá **"¿Olvidaste tu contraseña?"**. Te llega un email con un link que abre la app para elegir una nueva.

La sesión queda iniciada entre usos hasta que toques **Salir**.

### Como alumno
- **Menú:** buscá productos o filtrá por categoría. Tocá **+** para agregar al carrito.
- **Carrito:** ajustá las cantidades, elegí el método de pago (MercadoPago o efectivo) y confirmá.
- **Mis pedidos:** seguí el estado (*Pendiente → En preparación → ¡Listo! → Entregado*). Te llega una notificación cuando cambia. Podés cancelar un pedido mientras está pendiente.
- **Asistente ✨:** pedile cosas en lenguaje natural, por ejemplo *"¿qué bebidas hay?"* o *"¿cómo va mi pedido?"*.
- **Perfil:** cambiá tu nombre, tu foto, tu contraseña, el tema y la accesibilidad.

### Como administrador del kiosco
- **Menú:** agregá, editá o eliminá productos con foto, precio, categoría y stock, y marcalos como disponibles o agotados.
- **Pedidos:** los pedidos nuevos aparecen solos y te llega una notificación. Cambiá su estado con un toque.
- **Historial y ventas:** ventas de hoy y de los últimos 7, 30 o 90 días, productos más vendidos y ticket promedio.
- **Usuarios** (solo superadmin): asigná o quitá el rol de admin y eliminá cuentas de alumnos.

### Accesibilidad ♿
El botón ♿ (arriba, en el menú) abre el panel de accesibilidad. Desde ahí se pueden activar:
- alto contraste
- tamaño de texto (normal, grande o muy grande)
- texto en negrita
- colores para daltonismo
- botones más grandes
- reducir animaciones
- botones con nombre
- avisos más largos

También tiene perfiles rápidos (baja visión, daltonismo, motricidad, sensibilidad al movimiento, lectura y comprensión). La app es compatible con **TalkBack** y **VoiceOver**: todos los botones tienen etiqueta y los cambios de estado de los pedidos se anuncian por voz.

---

## Roles

| Rol | Cómo se obtiene | Qué puede hacer |
|---|---|---|
| **student** | Todos al registrarse | Ver el menú, hacer y cancelar sus pedidos, usar el asistente y editar su perfil |
| **admin** | Lo asigna el superadmin desde la app | Todo lo del kiosco: menú, stock, pedidos e historial de ventas |
| **superadmin** | Solo desde el SQL Editor de Supabase | Todo lo del admin, más la gestión de usuarios y roles |

Los permisos **no dependen de la app**: los controla la base de datos con **Row Level Security**. Un alumno no puede modificar el menú ni ver pedidos ajenos, aunque intente hacerlo llamando directamente a la API.

### Usuarios de prueba
Las credenciales de prueba (un admin y un alumno) **se entregan en privado al docente** y no se publican en este repositorio. Para probar como alumno también podés crear una cuenta nueva.

---

## Tecnologías

| Capa | Tecnología |
|---|---|
| App (Android, iOS y web) | **React Native** + **Expo SDK 58**, **Expo Router** (navegación por archivos) y **TypeScript** |
| Backend | **Supabase**: PostgreSQL, Auth, Storage, Realtime y Edge Functions |
| Autenticación | Supabase Auth (JWT) con email y contraseña, y **Google OAuth**. La sesión queda guardada en el dispositivo y el token se renueva solo |
| Base de datos | PostgreSQL con **RLS**, triggers y funciones `security definer` |
| Tiempo real | Supabase Realtime: los pedidos se actualizan sin recargar |
| Notificaciones push | `expo-notifications` + **Expo Push**, enviadas desde la base con `pg_net` |
| Segundo plano | **pg_cron**: tareas programadas dentro de la base |
| Archivos | Supabase Storage: fotos de perfil y de productos |
| Asistente de IA | Edge Function `ai-agent` + **Google Gemini** |
| Build y distribución | **EAS Build** (APK) |

---

## Arquitectura

> La explicación completa de cada funcionalidad, la base de datos y la seguridad está en **[ARQUITECTURA.md](ARQUITECTURA.md)**.

```
 ┌──────────────┐        HTTPS + JWT         ┌──────────────────────────────┐
 │  App Expo    │ ─────────────────────────▶ │ Supabase                     │
 │ (alumno /    │ ◀──── Realtime (pedidos) ─ │  ├─ Auth (email, Google)     │
 │  admin)      │                            │  ├─ PostgreSQL + RLS         │
 └──────┬───────┘                            │  │   ├─ triggers (validación,│
        │  notificaciones push               │  │   │   stock, push)        │
        │                                    │  │   └─ pg_cron (tareas)     │
 ┌──────┴───────┐      pg_net (HTTP)         │  ├─ Storage (fotos)          │
 │  Expo Push   │ ◀───────────────────────── │  └─ Edge Function ai-agent ──┼──▶ Gemini
 └──────────────┘                            └──────────────────────────────┘
```

- **La lógica importante vive en el servidor.** Al crear un pedido, un trigger recalcula el total con los precios reales del menú, descuenta stock bloqueando las filas (así dos alumnos no se llevan la última unidad) y rechaza los pedidos duplicados. El cliente no puede mandar un total manipulado.
- **Procesos en segundo plano (pg_cron):**
  - `cancelar-pedidos-vencidos`: cada 15 minutos cancela los pedidos que siguen pendientes después de 2 horas y devuelve el stock.
  - `cerrar-dia`: todas las noches (23:59, hora de Argentina) guarda el resumen de ventas del día en `ventas_diarias`.
- **Notificaciones:** cuando entra un pedido se avisa a los admins, y cuando cambia de estado se avisa al alumno. Lo dispara un trigger en la base, así que funciona aunque nadie tenga la app abierta.

### Estructura del proyecto

```
src/
  app/                 Pantallas (Expo Router)
    (auth)/            Login, registro y recuperar contraseña
    (student)/         Menú, carrito, mis pedidos, asistente y perfil
    (admin)/           Menú, agregar/editar, pedidos, historial, usuarios, asistente y perfil
    restablecer.tsx    Nueva contraseña (link del email)
  components/          Componentes compartidos (alertas, perfil, panel de accesibilidad…)
  context/             AuthContext (sesión y rol) y ThemeContext (tema y accesibilidad)
  hooks/               Realtime, notificaciones push, carrito y estilos con tema
  services/            Supabase, pedidos, imágenes y asistente
  constants/           Paleta de colores (normal, alto contraste, daltonismo) y estados
supabase/
  migrations/          Esquema, seguridad, roles, notificaciones y tareas programadas
  functions/ai-agent/  Edge Function del asistente
```

---

## Base de datos

Tablas principales (esquema `public`):

| Tabla | Contenido |
|---|---|
| `profiles` | Un perfil por usuario: rol, nombre, foto y preferencia de notificaciones |
| `menus` | Productos: nombre, descripción, precio, categoría, imagen, disponibilidad y stock |
| `pedidos` | Pedidos: código, productos (JSON), total, método de pago, estado y usuario |
| `push_tokens` | Tokens de Expo Push de cada dispositivo |
| `ventas_diarias` | Resumen de ventas por día (lo genera pg_cron) |

### Recrear la base en un proyecto nuevo de Supabase
Ejecutar los archivos de `supabase/migrations/` **en orden** desde el SQL Editor. Cada archivo se puede correr más de una vez.

Además hay que:
1. Habilitar las extensiones `pg_cron` y `pg_net` (Database → Extensions).
2. Activar el proveedor **Google** en Authentication → Providers.
3. Agregar `eatsapp12://` a las URLs de redirección (Authentication → URL Configuration).
4. Publicar la Edge Function y cargar su secreto:
   ```bash
   npx supabase functions deploy ai-agent
   npx supabase secrets set GEMINI_API_KEY=<clave>
   ```

### Acceso para la evaluación
El acceso al panel de Supabase (base de datos, usuarios y logs) se comparte **en privado con el docente**, invitándolo como miembro del proyecto.

---

## Seguridad

- Ninguna clave secreta está en el código ni en la app. La app solo tiene la *anon key* pública de Supabase, que no da acceso a nada por sí sola: todo pasa por RLS.
- La clave de Gemini está como secreto de la Edge Function, y la de Firebase (FCM) solo en EAS. Las dos están excluidas del repo en `.gitignore`.
- Las contraseñas las maneja Supabase Auth (hash bcrypt). La app nunca las guarda.
- La sesión (JWT de corta duración más refresh token) queda guardada en el almacenamiento de la app para no tener que volver a iniciar sesión, y se renueva automáticamente mientras la app está abierta.
- Validaciones en los dos lados: la app avisa de los datos vacíos o con formato incorrecto, y la base vuelve a validar todo (precios, stock, estados permitidos y permisos).

---

## Autoría

[@ayluup](https://github.com/ayluup). Construcción de Software, 6.º año, 2026.
