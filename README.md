# TravelGrin

Este repositorio ahora está separado en dos carpetas reales para que puedas desplegar cada parte en un lugar/cuenta distinta de Vercel sin mezclar responsabilidades:

- `frontend/`: sitio público, panel admin y UI de Next.js.
- `backend/`: endpoints `/api/*`, Prisma, migraciones y lógica de servidor.

La idea es que el frontend siga funcionando como antes para el usuario: las pantallas siguen llamando a `/api/*`. La diferencia es que, cuando configurás `NEXT_API_PROXY_TARGET`, Next reescribe esas llamadas hacia el backend separado.

## Estructura

```txt
frontend/
  app/              # páginas, layouts, estilos y componentes de página
  components/       # componentes visuales reutilizables
  next.config.ts    # proxy /api/* hacia el backend separado
  package.json      # scripts propios del frontend
  vercel.json       # config para proyecto Vercel frontend

backend/
  app/api/          # todas las rutas API
  app/lib/          # utilidades de servidor usadas por la API
  prisma/           # schema, migraciones y seed
  next.config.ts    # build Next.js para route handlers
  package.json      # scripts propios del backend
  vercel.json       # config para proyecto Vercel backend
```

En la raíz quedan scripts orquestadores para comodidad, pero cada carpeta se puede abrir/subir por separado.


## Config listo para Vercel: qué subir y qué variables pegar

### Si usás este mismo repo como monorepo

Esta es la forma recomendada: conectás el mismo repositorio a dos proyectos de Vercel.

**Proyecto frontend (cuenta Vercel frontend):**

- Root Directory: `frontend`
- Build Command: `npm run build`
- Install Command: `npm install`
- Variables: copiá `frontend/.env.example` y pegá los valores reales en Vercel.

**Proyecto backend (cuenta Vercel backend):**

- Root Directory: `backend`
- Build Command: `npm run build`
- Install Command: `npm install`
- Variables: copiá `backend/.env.example` y pegá los valores reales en Vercel.

En este modo no tenés que mover archivos: Vercel entra a cada carpeta por el Root Directory.

### Si vas a subir frontend y backend como repos separados

Si decidís crear dos repositorios separados en vez de usar el monorepo:

**Repo del frontend:**

Subí como raíz del repo el contenido completo de `frontend/`:

```txt
app/
components/
lib/
public/           # si existe en tu copia local
.env.example
eslint.config.mjs
middleware.ts
next-env.d.ts
next.config.ts
package.json
postcss.config.mjs
tailwind.config.js
tsconfig.json
vercel.json
```

No necesita archivos del `backend/`. Tampoco necesita el `package.json` de la raíz si `frontend/` pasa a ser la raíz de ese repo.

**Repo del backend:**

Subí como raíz del repo el contenido completo de `backend/`:

```txt
app/
components/       # solo contiene helpers mínimos que usa la API
lib/
prisma/
.env.example
eslint.config.mjs
middleware.ts
next-env.d.ts
next.config.ts
package.json
postcss.config.mjs
tailwind.config.js
tsconfig.json
vercel.json
```

No necesita archivos del `frontend/`. Tampoco necesita el `package.json` de la raíz si `backend/` pasa a ser la raíz de ese repo.

> Nota: `.env.example` se sube porque no tiene secretos reales. Los archivos `.env`, `.env.local` o passwords reales no se suben.

### Variables mínimas para pegar y listo

**Frontend:**

```bash
NEXT_PUBLIC_APP_URL=https://tu-frontend.vercel.app
NEXT_API_PROXY_TARGET=https://tu-backend.vercel.app
BACKEND_API_URL=https://tu-backend.vercel.app
ADMIN_JWT_SECRET=el-mismo-secret-del-backend
```

**Backend:**

```bash
DEPLOY_TARGET=backend
FRONTEND_URL=https://tu-frontend.vercel.app
NEXT_PUBLIC_APP_URL=https://tu-frontend.vercel.app
API_CORS_ORIGINS=https://tu-frontend.vercel.app
DATABASE_URL=tu-url-de-base-final
ADMIN_JWT_SECRET=el-mismo-secret-del-frontend
ADMIN_BOOTSTRAP_EMAIL=travelgrin@travelgrin.com
ADMIN_BOOTSTRAP_PASSWORD=tu-password-segura
CLOUDINARY_CLOUD_NAME=tu-cloud-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
CLOUDINARY_UPLOAD_FOLDER=travelgrin
```

## Variables de entorno

### Backend en Vercel

Configurá estas variables en el proyecto/cuenta donde va el backend:

```bash
DEPLOY_TARGET=backend
DATABASE_URL=...
ADMIN_JWT_SECRET=...
API_CORS_ORIGINS=https://tu-frontend.vercel.app
FRONTEND_URL=https://tu-frontend.vercel.app
NEXT_PUBLIC_APP_URL=https://tu-frontend.vercel.app
```

Sumá también las variables de servicios que ya usa la API cuando correspondan:

```bash
OPENAI_API_KEY=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
ADMIN_BOOTSTRAP_EMAIL=...
ADMIN_BOOTSTRAP_PASSWORD=...
RESEND_API_KEY=...
```

> Importante: `ADMIN_JWT_SECRET` tiene que ser el mismo en frontend y backend para que el panel admin valide la sesión igual que antes.

### Frontend en Vercel

Configurá estas variables en el proyecto actual del frontend:

```bash
NEXT_API_PROXY_TARGET=https://tu-backend.vercel.app
BACKEND_API_URL=https://tu-backend.vercel.app
NEXT_PUBLIC_APP_URL=https://tu-frontend.vercel.app
ADMIN_JWT_SECRET=...
```

Recomendación: dejá las llamadas del navegador como `/api/*` usando el proxy. Así evitás problemas de CORS/cookies porque el browser le pega al dominio del frontend y Vercel/Next lo envía al backend.

El login admin usa rutas puente en el frontend (`/api/admin/auth/*`) para guardar la cookie en el dominio del frontend y evitar que, después de ingresar usuario y contraseña correctos, vuelva a pedir login. Esas rutas validan contra el backend usando `BACKEND_API_URL` o `NEXT_API_PROXY_TARGET`.


## Imágenes y Cloudinary

- Las imágenes subidas desde el formulario de oferente destacado y desde el admin se validan con máximo **10 MB** de tamaño original.
- Antes de guardarlas, el frontend intenta convertirlas a **WebP** y reducirlas a un peso aproximado de 0.65 MB con un máximo de 1600 px por lado.
- Si Cloudinary está configurado en el backend, las imágenes comprimidas se suben a Cloudinary y se guardan como URL optimizada `f_webp,q_auto`.
- Además de mantener la lista histórica `images` como URLs/string para compatibilidad, la DB guarda metadata en `fields.imageAssets` / `imageAssets` con `public_id`, `publicId`, `secure_url`, `secureUrl` y la URL optimizada.
- Si Cloudinary no está configurado, la app no se rompe: guarda un data URL WebP comprimido como fallback y deja `public_id` vacío.
- En el admin, las URLs remotas de imágenes de publicaciones también se intentan importar a Cloudinary para servirlas comprimidas; si no se puede, se mantiene la URL original.

Variables requeridas en el backend para Cloudinary:

```bash
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_UPLOAD_FOLDER=travelgrin
```

## Deploy en Vercel

### Backend, en la otra cuenta/proyecto

1. Creá un proyecto nuevo en Vercel apuntando al mismo repo.
2. En **Root Directory**, elegí `backend`.
3. Usá el build command de esa carpeta:

```bash
npm run build
```

4. Cargá las variables del backend.
5. Deployá. La URL resultante va en `NEXT_API_PROXY_TARGET` y `BACKEND_API_URL` del frontend.

Si deployás por CLI desde la raíz del repo:

```bash
vercel --prod --local-config backend/vercel.json
```

### Frontend, en el Vercel actual

1. En el proyecto actual de Vercel, configurá **Root Directory** como `frontend`.
2. Usá el build command de esa carpeta:

```bash
npm run build
```

3. Cargá `NEXT_API_PROXY_TARGET` y `BACKEND_API_URL` apuntando al backend.
4. Deployá normalmente.

Si deployás por CLI desde la raíz del repo:

```bash
vercel --prod --local-config frontend/vercel.json
```

## Correr desde VS Code para probar

Abrí dos terminales en VS Code.

### Terminal 1: backend local

Desde la raíz del repo:

```bash
export DEPLOY_TARGET=backend
export DATABASE_URL="postgresql://..."
npm run dev:backend
```

También podés entrar directo a la carpeta:

```bash
cd backend
export DEPLOY_TARGET=backend
export DATABASE_URL="postgresql://..."
npm run dev
```

El backend queda en [http://localhost:3001](http://localhost:3001). Podés probarlo con:

```bash
curl http://localhost:3001/api/categories
```

### Terminal 2: frontend local

Desde la raíz del repo:

```bash
export NEXT_API_PROXY_TARGET=http://localhost:3001
export BACKEND_API_URL=http://localhost:3001
export NEXT_PUBLIC_APP_URL=http://localhost:3000
export ADMIN_JWT_SECRET="el-mismo-secret-del-backend"
npm run dev:frontend
```

O entrando a la carpeta:

```bash
cd frontend
export NEXT_API_PROXY_TARGET=http://localhost:3001
export BACKEND_API_URL=http://localhost:3001
export NEXT_PUBLIC_APP_URL=http://localhost:3000
export ADMIN_JWT_SECRET="el-mismo-secret-del-backend"
npm run dev
```

El frontend queda en [http://localhost:3000](http://localhost:3000). Navegá y probá todo normalmente; las llamadas a `/api/*` salen del frontend y llegan al backend local por el rewrite.

### PowerShell en Windows

Backend:

```powershell
$env:DEPLOY_TARGET="backend"
$env:DATABASE_URL="postgresql://..."
npm run dev:backend
```

Frontend:

```powershell
$env:NEXT_API_PROXY_TARGET="http://localhost:3001"
$env:BACKEND_API_URL="http://localhost:3001"
$env:NEXT_PUBLIC_APP_URL="http://localhost:3000"
$env:ADMIN_JWT_SECRET="el-mismo-secret-del-backend"
npm run dev:frontend
```

## Comandos útiles desde la raíz

```bash
npm run dev:backend      # levanta backend en :3001
npm run dev:frontend     # levanta frontend en :3000
npm run build:backend    # build solo backend
npm run build:frontend   # build solo frontend
npm run build            # build de frontend + backend
```
