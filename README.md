# FarmaYa

Plataforma que conecta **clientes, farmacias y repartidores** para pedir medicamentos a domicilio.
Java 21 (LTS) · Spring Boot 3.3 · MongoDB · HTML, CSS y JavaScript sin dependencias.

## Cómo ejecutarlo

Requisitos: JDK 21, Maven 3.9+ y MongoDB.

```bash
docker compose up -d        # MongoDB en localhost:27017 (o usa tu propia instancia)
mvn spring-boot:run         # http://localhost:8080
```

La conexión está en `src/main/resources/application.yml`, sección `MONGODB_URI`: pega ahí tu URI (local o Atlas), o define la variable de entorno `MONGODB_URI`.

## Cuentas de prueba (se crean al iniciar)

| Rol | Correo | Contraseña |
|---|---|---|
| Cliente | cliente@demo.com | Demo1234! |
| Farmacia (Zona Norte) | farmacia@demo.com | Demo1234! |
| Farmacia (Zona Centro) | farmacia2@demo.com | Demo1234! |
| Repartidor | repartidor@demo.com | Demo1234! |
| Administrador | admin@farmaya.local | Admin123! |

Para probar el flujo completo, abre cuatro ventanas (una en modo incógnito) con cliente, farmacia, repartidor y administrador.
Desactiva las cuentas de prueba con `FARMAYA_SEED_DEMO=false` y cambia el administrador con `FARMAYA_ADMIN_EMAIL` / `FARMAYA_ADMIN_PASSWORD`.

## Flujo

Solicitud enviada → Buscando farmacia → Farmacia asignada → Precio por aceptar → Precio confirmado →
Pedido en preparación → Pedido listo → Buscando repartidor → Repartidor asignado → Pedido recogido → En camino → Entregado.
Estados alternativos: Rechazada, Cancelada, Vencida, Con incidencia.

- **Asignación exclusiva**: aceptar un pedido (farmacia) o una entrega (repartidor) usa `findAndModify` condicionado al estado; MongoDB lo ejecuta de forma atómica, por lo que solo uno gana.
- **Sin inventario central**: cada farmacia verifica sus existencias y confirma cantidades y precios; el cliente debe aceptar el precio final.
- **Tiempos** (`application.yml`): si nadie acepta en 120 s se amplía la zona y se reenvía (hasta 3 rondas, luego vence); si la farmacia no confirma precios en 5 min el pedido vuelve a buscarse; si el cliente no acepta el precio en 10 min vence.
- **Entrega verificada** con código de 4 dígitos que solo ve el cliente (máximo 5 intentos).
- **Privacidad**: la farmacia ve la dirección del cliente solo cuando el pedido es suyo y nunca su teléfono; el repartidor no ve qué medicamentos son.
- **Historial**: cada cambio guarda quién lo hizo y cuándo.
- Las pantallas se actualizan solas cada pocos segundos (sondeo).

## API (resumen)

| Área | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout`, `active`; `GET /api/auth/me`; `GET /api/meta` |
| Cliente | `POST /api/orders`, `GET /api/orders/mine`, `GET /api/orders/{id}`, `POST /api/orders/{id}/accept-price`, `decline-price`, `cancel`, `incident` |
| Farmacia | `GET /api/pharmacy/offers`, `GET /api/pharmacy/orders`, `POST /api/pharmacy/orders/{id}/accept`, `reject`, `release`, `confirm`, `start`, `ready` |
| Repartidor | `GET /api/courier/offers`, `GET /api/courier/orders`, `POST /api/courier/orders/{id}/accept`, `release`, `pickup`, `on-the-way`, `deliver` |
| Admin | `GET /api/admin/stats`, `users`, `orders`; `POST /api/admin/users/{id}/verified`, `enabled`; `POST /api/admin/orders/{id}/resolve`, `cancel` |

## Antes de producción

- Servir bajo HTTPS y limitar intentos de inicio de sesión.
- Validar con asesoría legal los controles para medicamentos de venta bajo fórmula (la app solo marca los productos «con fórmula médica»).
- Cambiar la moneda en `static/js/core.js` (`CONFIG`) y las zonas en `application.yml`.
- Si necesitas notificaciones instantáneas, cambia el sondeo por WebSocket/SSE.

## Mejoras de esta versión

- Interfaz renovada en tema claro, adaptable a móviles y escritorio, con navegación según el rol autenticado.
- Inicio de sesión, registro y cierre de sesión conectados a los endpoints reales de la API; las pantallas ya no simulan el acceso cambiando solamente el rol.
- Registro con campos requeridos según el tipo de cuenta: datos del local y licencia para farmacias, medio de transporte para repartidores.
- Catálogo referencial con búsqueda, categorías, cantidades y carrito. Al enviar una solicitud, se crea un pedido real en la API; el precio mostrado en el catálogo es orientativo y la farmacia debe confirmar existencias y precio final.
- Consulta de farmacias verificadas por medio de `/api/pharmacies` y seguimiento de pedidos reales.
- Formularios con validación, estados de carga, avisos de error/éxito y controles deshabilitados cuando una acción no aplica.
- Se eliminó la URI de MongoDB con credenciales incrustadas. Para Atlas, define `MONGODB_URI` y `MONGODB_DATABASE` como variables de entorno; por defecto usa MongoDB local.

## Configuración de MongoDB Atlas

No guardes credenciales de Atlas en el repositorio. Define `MONGODB_URI` en el entorno de ejecución con la cadena de conexión de tu propio clúster y `MONGODB_DATABASE` con el nombre de la base de datos. Si ya se había compartido la URI anterior, cambia esa contraseña en Atlas.


Actualización de interfaz: el logotipo PNG se encuentra en `src/main/resources/static/images/farmaya-logo.png`. El filtro de categorías consulta `GET /api/categories` y usa los códigos de la colección MongoDB `categories`; si el endpoint no responde, conserva categorías locales de respaldo.


## Nombres de colecciones en español

- Los pedidos se almacenan en la colección MongoDB `pedidos`.
- La auditoría de acciones se almacena en `movimientos`.
- La colección `sessions` se mantiene para la autenticación y expiración de sesiones; no es una pestaña del panel de administración. No debe eliminarse sin sustituir antes el mecanismo de autenticación.

### Separación de usuarios por tipo

La aplicación actual utiliza el repositorio `UserRepository` y el modelo `User` compartido por autenticación, administración y directorio de farmacias. Separar físicamente esos documentos en `clientes`, `domiciliarios` y `farmacias` requiere migrar también las consultas de inicio de sesión, autorización, administración y directorio. No se realiza una copia automática destructiva para evitar duplicar o perder cuentas.

## Modelo de Machine Learning para Predicción de Demanda Mensual

Se incluye el módulo de predicción y clasificación de demanda de medicamentos (`ml/` y servicio integrado `DemandPredictionService`):
- **Clasificación**: Clasifica la demanda mensual en tres categorías: **ALTA**, **MEDIA** y **BAJA**.
- **Entrenamiento e Inferencia**: Pipeline en Python (`ml/demand_model.py`) con `RandomForestClassifier` y scikit-learn, calculando rezagos temporales, medias móviles, tendencias y estacionalidad a partir de la colección `pedidos` de MongoDB.
- **Planificación de Existencias**: Calcula el stock de seguridad y sugerencia de compra recomendada para cada farmacia.
- **Acceso en Plataforma**: Disponible a través de la API `GET /api/demand-forecast` y en el panel web de la farmacia en la pestaña **«Predicción de Demanda (IA)»**. Consultar `ml/README.md` para detalles de ejecución.
