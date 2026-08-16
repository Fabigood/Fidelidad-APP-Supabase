# Frontend — Fidelización

Panel administrativo en Vue 3 + Vite. Consume la API REST de `../backend`.

## Puesta en marcha

```bash
npm install
npm run dev
```

Arranca en `http://localhost:5173`. Las peticiones a `/api` se redirigen al
backend en `http://localhost:3000` mediante el proxy configurado en
`vite.config.js`, así que **no hace falta definir ninguna URL**.

## Variables de entorno

Solo se necesita `VITE_API_URL` si el backend vive en otro dominio. Sin ella, la
aplicación usa la ruta relativa `/api` y nginx hace de proxy en producción.

```bash
cp .env.example .env
```

## Compilar para producción

```bash
npm run build     # genera dist/
npm run preview   # sirve dist/ localmente para comprobarlo
```

Las instrucciones de despliegue están en [../DEPLOY.md](../DEPLOY.md).

## Estructura

```txt
src/
├── components/     Componentes reutilizables
├── data/           Estado compartido y llamadas a la API (fidelidadStore.js)
├── router/         Rutas y protección de acceso
├── services/       Cliente HTTP (axios) e interceptores
├── utils/          Utilidades de sesión y token
└── views/          Una vista por pantalla
```

## Accesibilidad

- Todos los campos tienen `label` asociado por `for`/`id`.
- Las tablas usan `scope` en las cabeceras y `caption` para lectores de pantalla.
- Los mensajes de error se anuncian con `role="alert"`; los de éxito con `role="status"`.
- El modal de vista previa es un diálogo real: se cierra con Escape, atrapa el
  tabulador y devuelve el foco al botón que lo abrió.
- Hay enlace "Saltar al contenido principal" y foco visible con `:focus-visible`.
- Se respeta `prefers-reduced-motion`.

## Paginación

Las tablas de clientes, tarjetas, catálogo y estadísticas se paginan en cliente
con `components/PaginacionTabla.vue` y el mixin `utils/paginacion.js`
(25 por página por defecto, configurable en la propia tabla). Al cambiar un
filtro la paginación vuelve a la primera página.

## Notas

- El token se guarda en `sessionStorage`: se borra al cerrar la pestaña.
- Un 401 en cualquier respuesta limpia la sesión y redirige a `/login`.
- `AdminLayout` avisa cinco minutos antes de que expire la sesión.
- Los puntos y niveles llegan calculados del backend; el frontend no duplica
  esas reglas de negocio.
