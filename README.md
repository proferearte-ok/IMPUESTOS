# Dashboard de Impuestos - Google Apps Script

App web personal para gestión de impuestos, sueldos y notas.
Stack: Google Sheets (DB) + Google Apps Script (Backend) + HTML/JS (Frontend en Index.html).

## Estructura

```
├── Code.gs          # Backend: RPC handlers para Impuestos, Sueldos, Notas
├── Index.html       # Frontend: Dashboard completo con Chart.js
└── README.md        # Este archivo
```

## Funcionalidades

### Impuestos
- Lista ordenada por vencimiento
- Filtros: Todos / Pendientes / Vencidos / Pagados
- Agregar nuevo impuesto (con autocomplete de nombres existentes)
- Marcar como pagado
- Alertas automáticas: vencidos y por vencer (3 días)
- Gráfico de evolución temporal (Chart.js)
- Resumen MA (impuestos que empiezan con "MA")

### Sueldos
- Tabla mensual con detalle expandible
- Gráfico evolución salarial 2017-2026
- Estadísticas: promedio, total anual, mejor sueldo, antigüedad
- Formulario completo con fórmulas automáticas
- Modal de detalle por registro
- Migración histórica 2017-2026 integrada

### Notas
- CRUD completo (crear, listar, eliminar)
- Búsqueda por texto
- Ordenadas por fecha descendente

## Despliegue en Apps Script

1. Abrir [script.google.com](https://script.google.com)
2. **Nuevo proyecto**
3. Borrar `Code.gs` y pegar contenido de `Code.gs`
4. Archivo `+` > **HTML** > nombre `Index`
5. Pegar contenido de `Index.html`
6. **Desplegar** > **Nueva implementación**
   - Tipo: **Aplicación web**
   - Ejecutar como: **Yo**
   - ¿Quién tiene acceso?: **Cualquier persona**
7. **Desplegar** > Autorizar permisos
8. Copiar URL de la implementación

## Hoja de Cálculo (Base de Datos)

La app usa 4 pestañas en Google Sheets (se crean automáticamente):

| Pestaña | Columnas | Descripción |
|---------|----------|-------------|
| `Hoja 2` | Nombre, Vencimiento, Monto, Medio, Estado, Obs | Impuestos principales |
| `Sueldos` | 20 cols (Período, Básico, Neto, Aguinaldo, HE, etc.) | Sueldos mensuales con fórmulas |
| `Notas` | Fecha, Nota, Etiquetas, ID | Notas y recordatorios |

## Migración Histórica (Sueldos)

Ejecutar una vez en Apps Script:
```javascript
migrarTodosLosSueldos()
```
Inserta ~100 registros 2017-2026 con datos reales.

## Variables de Entorno

En `Code.gs` línea 4:
```javascript
const SPREADSHEET_ID = ''; // Vacío = hoja activa donde está el script
```

## Seguridad

- Sin autenticación (URL privada)
- Solo tú y quien compartas la URL acceden
- Apps Script ejecuta como **tú** (tu cuenta Google)
- CORS habilitado para `Cualquier persona`

## Desarrollo Local

El frontend es un solo `Index.html` con:
- Chart.js (CDN)
- Font Awesome (CDN)
- CSS custom properties (dark theme)
- JS vanilla ES6+

## Comandos Útiles (Apps Script Console)

```javascript
// Verificar migración
verificarMigracion()

// Re-migrar sueldos (borra y reinserta)
migrarTodosLosSueldos()

// Ver logs
Logger.log("mensaje")
```

## Licencia

Uso personal. Código abierto para referencia.