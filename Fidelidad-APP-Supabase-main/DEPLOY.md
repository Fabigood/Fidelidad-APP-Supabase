# Despliegue en un VPS

Guía completa para poner Fidelidad APP en producción sobre Ubuntu/Debian con
nginx, PM2 y Supabase.

---

## 0. Requisitos

- VPS con Ubuntu 22.04+ o Debian 12+
- Un dominio apuntando al VPS (registro `A`)
- Un proyecto de Supabase
- Node.js 18 o superior

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

---

## 1. Base de datos

En el **SQL Editor** de Supabase, ejecutá el contenido completo de
`backend/supabase.sql`.

> **Si venís de una instalación anterior** con contraseñas en texto plano,
> ejecutá primero `DELETE FROM usuarios;` — esas credenciales están comprometidas
> y hay que descartarlas.

El script activa Row Level Security en todas las tablas y revoca los permisos de
los roles `anon` y `authenticated`. Comprobalo:

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```

Todas las filas deben mostrar `rowsecurity = true`.

---

## 2. Claves de Supabase

En **Project Settings → API** copiá:

| Clave | Dónde va | Notas |
|---|---|---|
| Project URL | `SUPABASE_URL` | pública |
| `service_role` | `SUPABASE_SERVICE_ROLE_KEY` | **secreta**, solo backend |
| `anon` | `SUPABASE_ANON_KEY` | opcional, solo para la comprobación de RLS |

La `service_role` omite RLS: es la que necesita el backend. **Nunca** debe
aparecer en el frontend ni en el repositorio.

---

## 3. Backend

```bash
sudo mkdir -p /var/www/fidelidad-backend /var/log/fidelidad
sudo chown -R $USER:$USER /var/www/fidelidad-backend /var/log/fidelidad

# Copiá el contenido de backend/ a /var/www/fidelidad-backend
cd /var/www/fidelidad-backend
npm ci --omit=dev
```

Creá el `.env`:

```bash
cp .env.example .env
nano .env
```

Generá el secreto JWT — la aplicación **se niega a arrancar** en producción si
detecta el valor de ejemplo:

```bash
openssl rand -base64 48
```

Valores mínimos:

```ini
NODE_ENV=production
PORT=3000
TRUST_PROXY=1
CORS_ORIGINS=https://tudominio.com
JWT_SECRET=<el que acabás de generar>
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role>
BREVO_API_KEY=<tu clave>
BREVO_SENDER_EMAIL=<remitente verificado en Brevo>
```

Protegé el archivo:

```bash
chmod 600 .env
```

Creá el administrador (la contraseña se guarda hasheada con bcrypt):

```bash
npm run crear-admin
```

Anotá la contraseña generada: no se vuelve a mostrar.

Verificá la configuración antes de arrancar:

```bash
npm run verificar
```

Comprueba entorno, longitud del secreto, uso de la service role key, CORS,
conexión con Supabase, que ninguna contraseña esté sin hashear y que RLS bloquee
a la anon key. Sale con error si algo bloquea el despliegue.

Arrancá con PM2:

```bash
pm2 start /var/www/fidelidad-backend/../deploy/ecosystem.config.cjs
pm2 save
pm2 startup    # ejecutá el comando que imprime
```

---

## 4. Frontend

En tu máquina (o en el VPS):

```bash
cd frontend
npm ci
npm run build
```

No hace falta definir `VITE_API_URL` si el frontend y la API comparten dominio:
por defecto usa la ruta relativa `/api` y nginx hace de proxy. Solo definila si
el backend vive en otro dominio.

Publicá el resultado:

```bash
sudo mkdir -p /var/www/fidelidad
sudo cp -r dist/* /var/www/fidelidad/
sudo chown -R www-data:www-data /var/www/fidelidad
```

---

## 5. nginx y TLS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/fidelidad
sudo nano /etc/nginx/sites-available/fidelidad     # reemplazá tudominio.com
sudo ln -s /etc/nginx/sites-available/fidelidad /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

`TRUST_PROXY=1` asume **exactamente un** proxy delante. La configuración de nginx
incluida usa `$proxy_add_x_forwarded_for`, que añade la IP real al final de la
cabecera, de modo que el cliente no puede falsificarla. Si algún día ponés
Cloudflare u otro proxy delante, subí `TRUST_PROXY` a 2.

---

## 6. Cortafuegos

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

El puerto 3000 **no** debe estar abierto al exterior: nginx accede por
`127.0.0.1`.

---

## 7. Comprobación final

```bash
curl -s https://tudominio.com/api/health

# Cabeceras de seguridad (deben aparecer HSTS, CSP, nosniff, y NO X-Powered-By)
curl -sI https://tudominio.com/api/health

# Sin token debe devolver 401
curl -s -o /dev/null -w "%{http_code}\n" https://tudominio.com/api/clientes

# RLS: debe devolver un error de permisos, no datos
curl -s "https://TU_PROYECTO.supabase.co/rest/v1/usuarios?select=*" \
     -H "apikey: TU_ANON_KEY"
```

Entrá a `https://tudominio.com`, iniciá sesión y recargá la página en
`/admin/clientes` para confirmar que el enrutado de la SPA funciona.

---

## Operación

```bash
pm2 status
pm2 logs fidelidad-api
pm2 restart fidelidad-api
```

**Rotación de logs** (evita llenar el disco):

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
```

**Actualizar la aplicación:**

```bash
cd /var/www/fidelidad-backend && npm ci --omit=dev && pm2 restart fidelidad-api
cd frontend && npm ci && npm run build && sudo cp -r dist/* /var/www/fidelidad/
```

**Cambiar la contraseña del administrador:**

```bash
cd /var/www/fidelidad-backend
npm run crear-admin -- --usuario admin --password "NuevaClaveFuerte"
```

---

## Límites conocidos

- **Estado en memoria.** Los limitadores y la caché del resumen público viven en
  el proceso. Por eso PM2 corre **una sola instancia** y el límite duro está en
  nginx. Para escalar horizontalmente hay que mover los contadores a Redis.
- **Sin revocación de tokens.** Un JWT filtrado sirve hasta que expira
  (`JWT_EXPIRES_IN`, 8 h por defecto). Bajá el valor si necesitás menos ventana.
- **Un solo rol.** Cualquier usuario autenticado puede hacer todo. Si vas a dar
  acceso a más personas, hace falta añadir roles.
- **Volumen de datos.** `fetchAll` pagina hasta 500.000 filas por tabla. Por
  encima de eso hay que pasar a agregaciones en la base en lugar de calcular en
  Node.
