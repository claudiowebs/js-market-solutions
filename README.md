# JS Market · Muestreo de clientes PDV

Aplicación web para registrar visitas a puntos de venta (PDV) con nota de voz. El audio se guarda en Google Drive, el registro en Google Sheets y luego se transcribe automáticamente.

**App:** https://claudiowebs.github.io/js-market-solutions/

## Cómo se usa

### 1. Ingresar
1. Abre el enlace de la app en **Chrome** (celular o PC).
2. Escribe el **DNI del jefe zonal** y toca **Ingresar**.
   - Solo verás los puntos de venta asignados a ese jefe zonal.
   - El celular recuerda el acceso; para cambiar de zonal toca **Salir**.

### 2. Registrar una visita
1. **Cliente:** escribe parte del DNI, el código o el nombre del punto y elige el resultado. Se muestra su ficha (dirección, ruta, módulo, distrito).
2. **Fecha de visita:** viene con la fecha de hoy; cámbiala si hace falta.
3. **Nota de voz:** toca el micrófono para grabar (máx. 5 min) y vuelve a tocarlo para detener. Puedes escucharlo, descartarlo o **subir un audio** ya grabado.
4. Toca **Guardar visita**.

### 3. Ver registros
En la pestaña **Registros** aparecen las visitas de tu zonal con su estado:

| Estado | Significado |
|---|---|
| PENDIENTE | Audio guardado, en cola para transcribir |
| EN PROCESO | Se está transcribiendo |
| TRANSCRITO | La transcripción ya está disponible |
| ERROR | No se pudo transcribir (pasa el mouse o mantén presionado para ver el motivo) |
| SIN AUDIO | Visita guardada sin nota de voz |

La lista se actualiza sola cada minuto mientras haya audios pendientes.

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
Worker Python (cada 5 min) ──▶ transcribe audios PENDIENTE ──▶ escribe TRANSCRIPCION en Sheets
```

- La base de clientes se toma de la hoja **DETALLE** del Excel de programación (columnas `CEDULA_CLIENTE`, `COD CLIENTE`, `NOMBRE_PUNTO`, `ZONAL`, `RUTA`, `MODULO`, `DISTRITO`, `DIRECCION`, `dni_zonal`, `nombre_jefe_zonal`) y se sincroniza todos los días a las 6:00 a. m.
- El acceso se valida en el servidor con el DNI del jefe zonal; cada zonal solo puede leer, crear y eliminar sus propios registros. Tras 20 intentos fallidos el acceso se bloquea 15 minutos.
- El código del servidor está en la carpeta `apps-script/` (copiar al proyecto de Apps Script).
