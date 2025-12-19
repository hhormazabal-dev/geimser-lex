# PJUD Companion (Chrome/Edge) – MVP

Este complemento ejecuta la consulta en la **OJV/PJUD desde el navegador del abogado** (misma red/sesión), evitando bloqueos típicos a scrapers server-side.

## Instalación (modo developer)

1. Chrome/Edge → `chrome://extensions`
2. Activa **Developer mode**
3. **Load unpacked** → selecciona la carpeta `extensions/pjud-companion`

## Uso

1. Abre la plataforma y entra a `PJUD` (`/pjud`)
2. Haz clic en el ícono de la extensión → **Conectar a esta pestaña**
3. Vuelve a la plataforma: el formulario debería cargar opciones desde OJV y permitir “Buscar causas”.

## Permisos

- La extensión solo tiene permisos de host para `https://oficinajudicialvirtual.pjud.cl/*`.
- Para integrarse con la plataforma, se inyecta un content-script en **la pestaña activa** cuando presionas “Conectar”.

