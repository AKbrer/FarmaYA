# Colecciones de cuentas por rol

La aplicación ya no utiliza la colección histórica `users`. El repositorio de cuentas enruta cada lectura y escritura a su colección correspondiente:

- `CLIENTE` → `clientes`
- `FARMACIA` → `farmacias`
- `REPARTIDOR` → `domiciliarios`
- `ADMIN` → `administradores`

El registro, inicio de sesión, edición de perfil, cambio de contraseña, estado de disponibilidad, autenticación de sesiones y administración consultan las colecciones por rol. Los pedidos y las sesiones conservan los mismos identificadores de cuenta.

## Antes de eliminar `users` en MongoDB Atlas

1. Haz una copia de seguridad de la base de datos `FarmaYA`.
2. Comprueba en Atlas que las cuentas existentes estén presentes en `clientes`, `farmacias`, `domiciliarios` y `administradores`.
3. Prueba el inicio de sesión con una cuenta existente de cada rol.
4. Registra una cuenta de prueba y verifica que aparezca solo en la colección de su rol.
5. Solo después de comprobar lo anterior, elimina la colección `users` en Atlas.

La aplicación no crea ni escribe en `users`. Si la colección ya se eliminó, el flujo de registro y autenticación seguirá usando las colecciones por rol.
