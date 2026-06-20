# SocioCheck AI - Clasificador de Documentos de Asamblea

SocioCheck AI es una aplicación web interactiva, moderna y premium diseñada para automatizar la clasificación de documentos presentados en asambleas de socios (Poderes de Representación y Cartas de Agenda) y evitar registros duplicados utilizando Inteligencia Artificial.

---

## 🚀 Características Clave

* **Clasificación Automática por IA**:
  - **Poderes de Representación**: Identifica y extrae firmas y datos de representación para la asamblea.
  - **Cartas de Inclusión en Agenda**: Identifica cartas de solicitud de inclusión de temas (como anular el límite de 1 invitado en fin de semana).
* **Extracción Inteligente de Datos**:
  - Extrae de forma precisa el **Nombre Completo** del socio titular (primera línea de texto rellenable, p. ej. *"Quien suscribe..."*).
  - Extrae y valida el **Socio No.** del titular (que debe ser obligatoriamente de **exactamente 4 dígitos**).
  - Ignora los datos del apoderado impresos más abajo en el documento para evitar falsas coincidencias.
* **Control de Duplicados Riguroso**:
  - Verifica si el número de socio ya cuenta con un documento aprobado en la base de datos local.
  - En caso de duplicidad, bloquea la inserción del registro, emite un aviso visual flotante (Toast de error) y reproduce una **alerta acústica dual sintetizada** en tiempo real.
* **Dashboard y Métricas en Tiempo Real**:
  - Estadísticas dinámicas de total de documentos, aprobados, rechazados y distribución porcentual mediante un **gráfico circular de dona SVG animado**.
  - Historial detallado de todas las transacciones de la sesión.
* **Panel de Administración Protegido**:
  - Acceso mediante contraseña segura (**`country2026`**).
  - Buscador en tiempo real de socios registrados.
  - Herramientas de depuración: eliminación de registros individuales y vaciado de base de datos.
  - **Exportador a CSV**: Permite descargar la base de datos completa de socios en un formato compatible con Excel.
* **Integración Opcional con Gemini AI**:
  - Cuenta con un extractor heurístico local para contingencia.
  - Permite configurar directamente la **API Key de Gemini** en la interfaz para realizar análisis y OCR reales de archivos (PDF e imágenes) en tiempo real usando modelos multimodales como `gemini-2.5-flash`.

---

## 🛠️ Tecnologías Utilizadas

* **Estructura**: HTML5 Semántico
* **Diseño y Estilo**: CSS3 con Variables de Diseño (Custom Properties), efectos de *glassmorphism* y animaciones de entrada. Soporta temas Claro/Oscuro.
* **Interactividad y Lógica**: JavaScript Vanilla (ES6+) con Web Audio API para alertas de sonido sintetizadas y manipulación dinámica de gráficos SVG.
* **Base de Datos**: `LocalStorage` (Persistencia del navegador del cliente).
* **IA Multimodal**: API oficial de Google Gemini (opcional).

---

## 💻 Instalación y Uso Local

La aplicación es completamente autocontenida y no requiere de un servidor backend complejo para las pruebas generales.

1. Descarga o clona este repositorio:
   ```bash
   git clone <URL_DE_TU_REPOSITORIO>
   ```
2. Entra a la carpeta del proyecto y abre el archivo `index.html` en cualquier navegador moderno:
   - En Windows, simplemente haz doble clic sobre el archivo `index.html`.
3. Para acceder al panel de administración:
   - Haz clic en el enlace **Administrador** en la esquina inferior izquierda.
   - Introduce la clave: `country2026`.

---

## 📁 Estructura del Proyecto

```
Clasificacion-carta-poder/
│
├── index.html     # Estructura principal y maquetación de modales
├── style.css      # Sistema de diseño, temas claro/oscuro y animaciones
└── app.js         # Base de datos local, reglas de negocio y conexión a Gemini
```

---

## 🔒 Privacidad y Seguridad

* La API Key de Gemini y los registros de los socios se almacenan de manera local y encriptada en la sesión/almacenamiento de tu navegador (`LocalStorage`).
* Ningún dato sensible es transmitido a servidores de terceros, a excepción del procesamiento de documentos enviado directamente a la API oficial de Google Gemini (si decides activarlo en la pestaña de configuración).
