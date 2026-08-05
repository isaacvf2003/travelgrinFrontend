# Frontend de TravelGrin

Esta carpeta contiene toda la parte visual de la plataforma (lo que ven los viajeros, los formularios y el panel de administración). Está construido sobre **React** (usando el framework **Next.js**) y estilizado con **Tailwind CSS**.

El frontend no toca la base de datos directamente para mantener todo seguro y ordenado. Lo que hace es usar un "proxy" interno: cuando el navegador pide algo a `/api/*`, Next.js lo redirige de forma transparente al servidor backend.

---

## Lo que necesitás configurar (.env.local)

Antes de arrancar, create un archivo llamado `.env.local` dentro de esta carpeta (`frontend/`) y pegale esto (completando con tus datos reales):

```bash
# La URL de este frontend local
NEXT_PUBLIC_APP_URL=http://localhost:3000

# La URL de tu backend local (donde va a redirigir las consultas de API)
NEXT_API_PROXY_TARGET=http://localhost:3001
BACKEND_API_URL=http://localhost:3001

# La clave secreta de administrador (debe ser la MISMA que pongas en el backend)
ADMIN_JWT_SECRET=tu-clave-secreta-compartida-super-segura
```

---

## Cómo correrlo en VS Code

1. **Abrí una terminal** en VS Code (arriba en el menú: *Terminal -> New Terminal*).
2. **Entrá a la carpeta del frontend**:
   ```bash
   cd frontend
   ```
3. **Instalá los paquetes** (solo la primera vez o si agregás algo nuevo):
   ```bash
   npm install
   ```
4. **Levantá el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
5. ¡Listo! Abrí tu navegador y entrá a [http://localhost:3000](http://localhost:3000).

---

## Panel de Control del Administrador
* Para entrar al panel de administración, la ruta privada es `/admin` o **`/tgn-panel-control`**.
* Al ingresar con tu usuario y contraseña, el frontend guarda una cookie de sesión segura para mantenerte logueado.
