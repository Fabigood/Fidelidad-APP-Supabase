# Sistema de Fidelización - CRUD con Autenticación y Supabase


## Evidencia del taller formativo: Core MVC, SOLID y patrones de diseño

Este proyecto fue refactorizado para evidenciar la aplicación de buenas prácticas en el Core MVC del backend. La mejora principal fue separar responsabilidades que antes estaban concentradas en los archivos de rutas. Ahora el backend mantiene una estructura más profesional: las rutas solo definen endpoints, los controladores atienden la petición HTTP, los servicios contienen reglas de negocio y los repositorios aíslan el acceso a Supabase.

### Links para entregar

- **Link del código en Git:** https://github.com/Fabigood/Fidelidad-APP-Supabase
- **Link del video explicativo:** https://youtu.be/vCUOdhLW-SY
- **Link del proyecto deployado:** https://patronesde-diseno.vercel.app/admin/dashboard

### Principios SOLID aplicados

1. **SRP - Single Responsibility Principle / Responsabilidad Única**
   - Antes, `backend/routes/fidelidad.js` hacía validaciones, cálculos de puntos, consultas a Supabase y respuestas HTTP en el mismo archivo.
   - Ahora cada clase tiene una responsabilidad concreta:
     - `routes/`: define rutas.
     - `controllers/`: recibe la petición y devuelve respuesta.
     - `services/`: contiene reglas de negocio.
     - `repositories/`: consulta Supabase.
     - `validators/`: valida datos como correo electrónico.

2. **DIP - Dependency Inversion Principle / Inversión de Dependencias**
   - Los servicios ya no crean directamente el cliente de Supabase.
   - Las dependencias se inyectan desde `backend/core/container.js`.
   - Ejemplo: `FidelidadService` recibe `clienteRepository`, `compraRepository`, `recompensaRepository`, `reclamoRepository`, `pointsStrategy` y `levelStrategy`. Esto permite cambiar la fuente de datos o la regla de negocio sin reescribir el servicio.

3. **OCP - Open/Closed Principle / Abierto-Cerrado**
   - Las reglas de cálculo de puntos y niveles se encapsularon como estrategias.
   - Si cambia la política de fidelización, se agrega una nueva estrategia sin modificar controladores ni rutas.

### Patrones de diseño aplicados

1. **Repository Pattern**
   - Implementado en:
     - `backend/repositories/UserRepository.js`
     - `backend/repositories/ClienteRepository.js`
     - `backend/repositories/CompraRepository.js`
     - `backend/repositories/RecompensaRepository.js`
     - `backend/repositories/ReclamoRepository.js`
     - `backend/repositories/TarjetaRepository.js`
   - Beneficio: el acceso a Supabase queda aislado. El resto del sistema no depende de consultas directas a la base de datos. La paginación de `fetchAll.js` se aplica en un solo sitio y todos los repositorios la heredan.

2. **Strategy Pattern**
   - Implementado en:
     - `backend/services/strategies/pointsStrategy.js`
     - `backend/services/strategies/levelStrategy.js`
   - Beneficio: permite cambiar la forma de calcular puntos o niveles de fidelización sin alterar las rutas ni los controladores.

3. **Dependency Injection / Contenedor de dependencias**
   - Implementado en `backend/core/container.js`.
   - Beneficio: centraliza la creación de repositorios, servicios, estrategias y controladores. Esto mejora el mantenimiento y reduce el acoplamiento.

### Estructura refactorizada del Core backend

```txt
backend/
├── controllers/          Reciben la petición HTTP y devuelven la respuesta
│   ├── AuthController.js
│   ├── ClienteController.js
│   └── FidelidadController.js
├── core/
│   ├── AppError.js       Error de dominio con código HTTP
│   ├── config.js         Configuración validada de una sola vez
│   └── container.js      Inyección de dependencias
├── middleware/
│   ├── auth.js           Verificación de JWT (HS256 + expiración)
│   ├── errorHandler.js   Manejo central de errores
│   ├── notFound.js       404 en formato JSON
│   └── rateLimiter.js    Límites por IP (login, API, correo, público)
├── repositories/         Único punto de acceso a Supabase
│   ├── ClienteRepository.js
│   ├── CompraRepository.js
│   ├── ReclamoRepository.js
│   ├── RecompensaRepository.js
│   ├── TarjetaRepository.js
│   ├── UserRepository.js
│   └── fetchAll.js       Paginación (evita el corte silencioso en 1000 filas)
├── routes/               Solo definen endpoints
│   ├── auth.js
│   ├── clientes.js
│   └── fidelidad.js
├── scripts/
│   ├── crearAdmin.js     Alta del administrador con hash bcrypt
│   └── verificarEntorno.js  Comprobación previa al despliegue
├── services/             Reglas de negocio
│   ├── AuthService.js
│   ├── ClienteService.js
│   ├── FidelidadService.js
│   ├── TarjetaFidelidadService.js
│   ├── email/
│   │   └── BrevoEmailProvider.js
│   └── strategies/
│       ├── levelStrategy.js
│       └── pointsStrategy.js
├── tests/
│   └── seguridad.test.js Pruebas de regresión
├── utils/
│   ├── asyncHandler.js
│   ├── dateFormatter.js
│   └── tarjetaTemplate.js
├── validators/
│   ├── dateValidator.js
│   ├── emailValidator.js
│   └── index.js
├── .env.example
├── index.js
├── supabase.js
└── supabase.sql          Esquema + Row Level Security
```

### Mejoras implementadas en el Core

- Se separó la lógica de negocio de las rutas.
- Se centralizó el manejo de errores con `AppError` y `errorHandler`.
- Se evitó repetir `try/catch` en cada endpoint usando `asyncHandler`.
- Se mejoró el middleware de autenticación para aceptar token directo o formato `Bearer token`.
- Se mantuvieron los mismos endpoints para no romper el frontend existente.
- Se agregó endpoint de verificación: `GET /api/health`.

### Calidad y pruebas

El backend incluye una batería de pruebas de regresión sobre los fallos de
seguridad detectados en la auditoría:

```bash
cd backend
npm test          # 26 pruebas: validaciones, hashing, errores, paginación
npm run verificar # comprobación de la configuración antes de desplegar
```

La integración continua (`.github/workflows/ci.yml`) ejecuta en cada push las
pruebas, la auditoría de vulnerabilidades, la compilación del frontend y una
comprobación de que no se haya colado ninguna credencial en el repositorio.

### Guion sugerido para el video

1. Mostrar cómo estaba antes: rutas con muchas responsabilidades.
2. Explicar la nueva estructura MVC: rutas, controladores, servicios y repositorios.
3. Mostrar SRP con el ejemplo de `FidelidadController`, `FidelidadService` y `ClienteRepository`.
4. Mostrar DIP en `backend/core/container.js`, donde se inyectan dependencias.
5. Mostrar Repository Pattern en los archivos de `backend/repositories`.
6. Mostrar Strategy Pattern en `pointsStrategy.js` y `levelStrategy.js`.
7. Ejecutar el proyecto y probar login, clientes, compras y recompensas.

---


## Descripción

Este proyecto consiste en una aplicación web desarrollada para gestionar clientes dentro de un sistema de fidelización. El sistema permite administrar clientes, registrar compras, gestionar recompensas y controlar el acceso mediante autenticación basada en tokens.

La aplicación fue desarrollada utilizando Vue.js en el frontend y Node.js con Express en el backend. La persistencia de datos se realiza mediante Supabase utilizando PostgreSQL como base de datos.

El sistema se encuentra desplegado públicamente utilizando Vercel para el frontend y Render para el backend.

---

## Objetivo

El objetivo del proyecto es implementar un sistema web completo que integre:

- Un CRUD funcional conectado a base de datos
- Un sistema de autenticación con usuario y contraseña
- Protección de rutas en frontend y backend
- Validaciones de datos sensibles desde backend
- Relaciones entre tablas mediante claves foráneas
- Comunicación entre frontend y backend mediante API REST
- Integración con Supabase utilizando PostgreSQL

---

## Tecnologías utilizadas

### Frontend

- Vue.js
- Vue Router
- Axios
- Vite

### Backend

- Node.js
- Express
- JSON Web Token (JWT)
- Supabase JavaScript Client
- dotenv
- cors

### Base de datos

- Supabase
- PostgreSQL

### Despliegue

- Vercel
- Render

---

## Funcionalidades

### Gestión de clientes

- Registro de clientes
- Edición de clientes
- Eliminación de clientes
- Visualización de clientes registrados

### Sistema de fidelización

- Registro de compras
- Generación automática de puntos
- Gestión de recompensas
- Registro de reclamos de recompensas
- Clasificación de clientes por niveles

### Dashboard administrativo

- Panel principal con estadísticas
- Visualización de clientes en riesgo
- Resumen de compras recientes
- Distribución de clientes por nivel

### Seguridad y autenticación

- Contraseñas hasheadas con bcrypt (nunca en texto plano)
- Tokens JWT con algoritmo fijado (HS256) y expiración obligatoria
- Row Level Security activo en todas las tablas de Supabase
- Backend conectado con la `service_role` key; la `anon` key no accede a nada
- CORS restringido a los orígenes configurados
- Cabeceras de seguridad vía helmet (CSP, HSTS, nosniff, anti-clickjacking)
- Limitación de peticiones por IP: global, en el login y en el envío de correos
- Validación estricta de entradas con listas blancas
- Los errores internos nunca se filtran en las respuestas
- Protección de rutas privadas en frontend y backend

---

## Validaciones implementadas

El sistema implementa validaciones tanto en frontend como en backend.

### Validaciones en backend

- Validación de formato de correo electrónico
- Restricción de correos duplicados
- Validación de clientes existentes antes de registrar compras
- Validación de recompensas existentes antes de registrar reclamos
- Restricción de acceso a rutas protegidas sin token válido
- Validación de campos obligatorios
- Restricción de correos temporales o desechables

Estas validaciones se realizan desde backend para evitar manipulaciones desde el cliente.

---

## Relación entre tablas

El sistema utiliza relaciones mediante claves foráneas en PostgreSQL.

### Relaciones implementadas

- Un cliente puede tener múltiples compras
- Un cliente puede reclamar múltiples recompensas
- Una recompensa puede ser reclamada por múltiples clientes

Las relaciones se gestionan mediante claves foráneas y validaciones en backend.

---

## Autenticación

El sistema utiliza autenticación basada en JSON Web Tokens (JWT).

El usuario debe iniciar sesión para acceder a las funcionalidades protegidas del sistema. Una vez autenticado, el backend genera un token que es almacenado temporalmente y enviado en cada petición protegida.

Las rutas protegidas no pueden ser accedidas sin autenticación válida.

---

## Usuario administrador

El usuario administrador **no viene precargado**: se crea al desplegar, con la
contraseña hasheada con bcrypt.

```bash
cd backend
npm run crear-admin
```

Si no se indica `--password`, el script genera una contraseña aleatoria y la
muestra una sola vez.

> Las versiones anteriores traían `admin` / `1234` en `supabase.sql` y en este
> README, y la comparación se hacía contra la contraseña en texto plano. Si
> desplegaste alguna de esas versiones, ejecutá `DELETE FROM usuarios;` antes de
> aplicar el nuevo esquema: esas credenciales están comprometidas.

---

## Arquitectura del sistema

```txt
Frontend (Vue + Vercel)
        │
        ▼
Backend API REST (Node.js + Express + Render)
        │
        ▼
Supabase PostgreSQL

fidelidad-app/
│
├── backend/
│   ├── middleware/
│   │   └── auth.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── clientes.js
│   │   └── fidelidad.js
│   │
│   ├── supabase.js
│   ├── index.js
│   ├── package.json
│   └── .env
│
├── frontend/
│   ├── public/
│   │
│   ├── src/
│   │   ├── components/
│   │   ├── router/
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── views/
│   │   ├── App.vue
│   │   └── main.js
│   │
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
└── README.md
```
## Instalación del proyecto
Clonar repositorio
git clone https://github.com/Fabigood/Fidelidad-APP-Supabase.git
Backend
cd backend
npm install
npm run dev
Frontend
cd frontend
npm install
npm run dev
Variables de entorno

Antes de ejecutar el backend localmente, copia el archivo de ejemplo:

```bash
cd backend
cp .env.example .env      # en Windows: copy .env.example .env
```

Luego edita `backend/.env` con tus credenciales reales de Supabase. El archivo
`.env` no se sube a Git por seguridad.

Comandos útiles del backend:

```bash
npm run verificar      # comprueba la configuración antes de desplegar
npm run crear-admin    # crea o actualiza el usuario administrador
npm test               # pruebas de regresión de seguridad
```

**Backend** (`backend/.env`) — la plantilla completa está en
`backend/.env.example`:

```ini
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
CORS_ORIGINS=https://tudominio.com

# Generalo con: openssl rand -base64 48
# La aplicación se niega a arrancar en producción con un valor de ejemplo.
JWT_SECRET=

SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY

BREVO_API_KEY=
BREVO_SENDER_EMAIL=
```

**Frontend** (`frontend/.env`): normalmente no hace falta. Sin `VITE_API_URL` se
usa la ruta relativa `/api` y nginx hace de proxy. Solo definila si el backend
está en otro dominio.
Base de datos

La base de datos fue implementada en Supabase utilizando PostgreSQL.

El proyecto incluye:

Tabla de usuarios
Tabla de clientes
Tabla de compras
Tabla de recompensas
Tabla de reclamos de recompensas
Protección de rutas

El sistema protege las rutas tanto en frontend como en backend.

Frontend

Las rutas privadas requieren autenticación para poder acceder al sistema.

Backend

Los endpoints protegidos requieren un token JWT válido para permitir operaciones sobre la API.

Despliegue del sistema

Para desplegar en un VPS propio (nginx + PMIA + TLS) seguí la guía completa en
[DEPLOY.md](DEPLOY.md), que incluye la configuración de nginx
(`deploy/nginx.conf`) y de PM2 (`deploy/ecosystem.config.cjs`).

Base de datos

Implementada en Supabase PostgreSQL, con Row Level Security activo.

Estado del proyecto

Proyecto funcional desarrollado con integración completa entre frontend, backend y base de datos en Supabase.

El sistema cuenta con autenticación, validaciones backend, protección de rutas y despliegue público.
