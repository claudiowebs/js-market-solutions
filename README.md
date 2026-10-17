# JS Market · Muestreo de clientes PDV

Aplicación web para registrar visitas a puntos de venta (PDV). Cada visita se guarda con una de estas tres opciones (o varias a la vez):

1. **Grabar audio** con el micrófono del celular.
2. **Subir un audio** ya grabado.
3. **Escribir una observación** en texto.

**App:** https://claudiowebs.github.io/js-market-solutions/

## Cómo se usa

### 1. Ingresar
1. Abre el enlace en **Chrome** (celular o PC).
2. Escribe el **DNI del jefe zonal** y toca **Ingresar**.
   - Solo verás los puntos de venta asignados a ese jefe zonal.
   - El celular recuerda el acceso; para cambiar de zonal toca **Salir**.

### 2. Registrar una visita
1. **Cliente:** escribe parte del DNI, el código o el nombre del punto y elige el resultado. Se muestra su ficha (dirección, ruta, módulo, distrito).
2. **Fecha de visita:** viene con la fecha de hoy; cámbiala si hace falta.
3. **Nota de voz u observación:**
   - Toca el micrófono para grabar (máx. 5 min) y vuelve a tocarlo para detener. Puedes escucharlo o descartarlo.
   - O toca **subir un audio** para elegir un archivo del celular.
   - O escribe en el cuadro **Observación en texto**.
4. Toca **Guardar visita**.

### 3. Ver registros
En la pestaña **Registros** aparecen las visitas de tu zonal:

| Estado | Significado |
|---|---|
| CON AUDIO | La visita tiene audio (y puede tener observación) |
| SOLO TEXTO | La visita tiene solo observación escrita |
| SIN DATOS | Visita guardada sin audio ni observación |

## Permiso de micrófono

La primera vez, Chrome pregunta si la página puede usar el micrófono: toca **Permitir**.

Si lo bloqueaste por error:
1. Toca el ícono a la izquierda de la dirección web.
2. **Permisos** > **Micrófono** > **Permitir**.
3. Recarga la página.

Si abriste el enlace desde WhatsApp u otra app, toca ⋮ y elige **Abrir en Chrome**.

## Instalar como app en el celular

En Chrome toca ⋮ > **Agregar a la pantalla principal**. Quedará un ícono de JS Market como si fuera una app.

## Cómo funciona

```
Celular (esta página) ──▶ Google Apps Script (API) ──▶ Google Drive (audios)
                                                    └─▶ Google Sheets (REGISTROS / CLIENTES)
```

- La base de clientes se toma de la hoja **DETALLE** del Excel de programación (columnas `CEDULA_CLIENTE`, `COD CLIENTE`, `NOMBRE_PUNTO`, `ZONAL`, `RUTA`, `MODULO`, `DISTRITO`, `DIRECCION`, `dni_zonal`, `nombre_jefe_zonal`) y se sincroniza automáticamente cada hora (o al instante ejecutando `syncClientes` en Apps Script).
- El acceso se valida en el servidor con el DNI del jefe zonal; cada zonal solo puede leer, crear y eliminar sus propios registros. Tras 20 intentos fallidos el acceso se bloquea 15 minutos.
- El código del servidor está en la carpeta `apps-script/` (copiar al proyecto de Apps Script).
