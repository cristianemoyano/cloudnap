# CloudNap ☁️😴

**CloudNap** es una aplicación Python 3.13 con Flask que permite gestionar clusters de Huawei Cloud de manera automatizada para ahorrar costos. La aplicación puede encender y apagar clusters según horarios programados o manualmente a través de una interfaz web.

## 🚀 Características

- **Gestión de Clusters**: Controla múltiples clusters de Huawei Cloud desde una interfaz centralizada
- **Programación Automática**: Ejecuta tareas de encendido/apagado según horarios configurados (cron)
- **API REST**: Endpoints para integración con otros sistemas
- **Interfaz Web**: Dashboard moderno con Bootstrap para gestión visual
- **Filtrado Inteligente**: Búsqueda por nombre y filtrado por tags para manejar listas largas
- **Scroll Optimizado**: Contenedor con scroll inteligente y indicadores visuales
- **Carga Asíncrona**: UI rápida con carga de estados en segundo plano
- **Logging Completo**: Registro detallado de todas las operaciones
- **Dockerizado**: Fácil despliegue con Docker y Docker Swarm
- **Configuración Flexible**: Configuración mediante archivos YAML

## 📋 Requisitos

- Python 3.13+
- Docker y Docker Compose (para despliegue)
- Credenciales de Huawei Cloud (Access Key, Secret Key, Project ID)
- Instancias ECS de Huawei Cloud para gestionar

## 🛠️ Instalación

### Desarrollo Local

1. **Clonar el repositorio**:
   ```bash
   git clone <repository-url>
   cd cloudnap
   ```

2. **Crear entorno virtual**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # En Windows: venv\Scripts\activate
   ```

3. **Instalar dependencias**:
   ```bash
   pip install -r requirements.txt
   # O usando UV (más rápido):
   pip install uv
   uv pip install -r requirements.txt
   ```

4. **Configurar variables de entorno**:
   ```bash
   cp env.example .env
   # Editar .env con tus credenciales de Huawei Cloud
   ```

5. **Configurar clusters**:
   ```bash
   # Editar config.yaml con tus clusters y horarios
   nano config.yaml
   ```

6. **Ejecutar la aplicación**:
   ```bash
   python -m app
   ```

### Docker (Desarrollo)

1. **Configurar variables de entorno**:
   ```bash
   cp env.example .env
   # Editar .env con tus credenciales
   ```

2. **Ejecutar con Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **Acceder a la aplicación**:
   - Web Interface: http://localhost:5000
   - API: http://localhost:5000/api

### Docker Swarm (Producción)

1. **Configurar variables de entorno**:
   ```bash
   export HUAWEI_ACCESS_KEY="your_access_key"
   export HUAWEI_SECRET_KEY="your_secret_key"
   export HUAWEI_PROJECT_ID="your_project_id"
   ```

2. **Ejecutar script de despliegue**:
   ```bash
   ./deploy.sh
   ```

3. **Acceder a la aplicación**:
   - Web Interface: http://localhost
   - API: http://localhost/api

## ⚙️ Configuración

### Archivo config.yaml

El archivo `config.yaml` contiene toda la configuración de la aplicación:

```yaml
# Configuración de Huawei Cloud
huawei_cloud:
  region: "ap-southeast-1"
  access_key: "${HUAWEI_ACCESS_KEY}"
  secret_key: "${HUAWEI_SECRET_KEY}"
  project_id: "${HUAWEI_PROJECT_ID}"

# Clusters a gestionar
clusters:
  - name: "production-cluster"
    instance_ids:
      - "i-1234567890abcdef0"
      - "i-1234567890abcdef1"
    region: "ap-southeast-1"
    description: "Cluster de producción"
    tags: ["production", "web"]
    schedule:
      wake_up: "0 1 * * 1-5"    # Lunes a Viernes a las 1:00 AM UTC
      shutdown: "0 10 * * 1-5"  # Lunes a Viernes a las 10:00 AM UTC
    enabled: true
```

### Variables de Entorno

Crea un archivo `.env` basado en `env.example`:

```bash
HUAWEI_ACCESS_KEY=your_access_key_here
HUAWEI_SECRET_KEY=your_secret_key_here
HUAWEI_PROJECT_ID=your_project_id_here
FLASK_ENV=development
FLASK_DEBUG=true
```

## 🔌 API Endpoints

### Clusters

- `GET /api/clusters` - Listar todos los clusters
- `GET /api/clusters/{name}` - Obtener estado de un cluster específico
- `POST /api/clusters/{name}/start` - Iniciar un cluster
- `POST /api/clusters/{name}/stop` - Detener un cluster

### Scheduler

- `GET /api/scheduler/jobs` - Listar trabajos programados
- `POST /api/scheduler/jobs/{job_id}/trigger` - Ejecutar trabajo inmediatamente

### Logs y Monitoreo

- `GET /api/logs` - Obtener logs recientes
- `GET /api/health` - Health check
- `GET /api/config` - Obtener configuración (sin datos sensibles)
- `POST /api/config/reload` - Recargar configuración desde archivo

### Ejemplos de Uso

```bash
# Listar clusters
curl http://localhost:5000/api/clusters

# Iniciar un cluster
curl -X POST http://localhost:5000/api/clusters/production-cluster/start

# Obtener logs
curl http://localhost:5000/api/logs?lines=50

# Health check
curl http://localhost:5000/api/health

# Recargar configuración (útil después de modificar config.yaml)
curl -X POST http://localhost:5000/api/config/reload
```

## 🔍 Filtrado y Búsqueda de Clusters

CloudNap incluye un sistema avanzado de filtrado para manejar listas largas de clusters:

### Funcionalidades de Filtrado

#### 🔎 **Búsqueda por Nombre**
- Busca clusters por nombre en tiempo real
- Búsqueda case-insensitive
- Coincidencias parciales

#### 🏷️ **Filtrado por Tags**
- Dropdown con todos los tags únicos
- Filtrado instantáneo al seleccionar
- Múltiples tags por cluster

#### 📊 **Indicadores Visuales**
- Badges que muestran filtros activos
- Contador de resultados
- Mensaje cuando no hay coincidencias

#### 🎯 **Controles de Filtrado**
- Botón para limpiar filtros individuales
- Botón para limpiar todos los filtros
- Filtros combinables (búsqueda + tags)

### Ejemplo de Uso

```yaml
# Clusters con diferentes tags
clusters:
  - name: "production-web-cluster"
    tags: ["production", "web"]
  - name: "staging-api-cluster"  
    tags: ["staging", "api", "backend"]
  - name: "monitoring-cluster"
    tags: ["monitoring", "infrastructure", "24x7"]
```

### Interfaz de Usuario

1. **Campo de búsqueda**: Escribe el nombre del cluster
2. **Selector de tags**: Elige un tag para filtrar
3. **Filtros activos**: Ve qué filtros están aplicados
4. **Scroll optimizado**: Navega por listas largas fácilmente

## 📜 Scroll Inteligente

CloudNap incluye un sistema de scroll optimizado para manejar listas largas de clusters:

### 🎯 **Características del Scroll**

#### **Contenedor con Altura Fija**
- ✅ **Altura máxima**: 600px (500px en móviles)
- ✅ **Scroll vertical**: Automático cuando el contenido excede la altura
- ✅ **Sin scroll horizontal**: Previene desbordamiento lateral

#### **Scrollbar Personalizada**
- ✅ **Diseño moderno**: Scrollbar estilizada con colores Bootstrap
- ✅ **Compatibilidad**: Funciona en Chrome, Firefox, Safari
- ✅ **Interactiva**: Hover y estados activos

#### **Indicadores Visuales**
- ✅ **Gradientes**: Indicadores sutiles en la parte superior/inferior
- ✅ **Dinámicos**: Aparecen solo cuando hay más contenido
- ✅ **Responsivos**: Se actualizan al filtrar o redimensionar

### 🎨 **Estilos de Scroll**

```css
.clusters-container {
    max-height: 600px;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: thin;
    scrollbar-color: #dee2e6 #f8f9fa;
}
```

### 📱 **Responsive Design**

| Dispositivo | Altura Máxima | Comportamiento |
|-------------|---------------|----------------|
| **Desktop** | 600px | Scroll completo |
| **Tablet** | 600px | Scroll completo |
| **Mobile** | 500px | Scroll optimizado |

### 🔧 **Funcionalidades JavaScript**

- ✅ **Detección automática** de contenido desbordado
- ✅ **Indicadores dinámicos** que aparecen/desaparecen
- ✅ **Actualización en tiempo real** al filtrar
- ✅ **Compatibilidad** con filtros y búsqueda

## ⚡ Rendimiento y Carga Asíncrona

CloudNap está optimizado para cargar rápidamente incluso con muchos clusters:

### 🚀 **Carga Rápida de UI**
- **Carga inicial**: La interfaz se carga inmediatamente con información básica
- **Estados de loading**: Indicadores visuales mientras se cargan los datos
- **Carga asíncrona**: Los estados de clusters se cargan en segundo plano

### 🛡️ **Manejo de Errores**
- **Timeouts cortos**: 5 segundos para fallos rápidos en desarrollo
- **Errores resilientes**: Un cluster con error no afecta a los demás
- **Feedback visual**: Indicadores claros de errores de API

### 📊 **Estados de Carga**

| Estado | Descripción | Color |
|--------|-------------|-------|
| `LOADING` | Cargando información | Gris |
| `RUNNING` | Cluster activo | Verde |
| `STOPPED` | Cluster detenido | Rojo |
| `ERROR` | Error de API | Amarillo |

### 🔧 **Configuración de Timeouts**

```python
# En huawei_cloud_service.py
timeout=5  # 5 segundos para desarrollo rápido
```

### 💡 **Beneficios**
- ✅ **UI instantánea**: La página se carga en <1 segundo
- ✅ **Experiencia fluida**: No hay bloqueos por errores de API
- ✅ **Feedback claro**: Usuario sabe qué está pasando
- ✅ **Escalable**: Funciona con 100+ clusters

## 🕒 Programación de Tareas

CloudNap utiliza expresiones cron para programar tareas **en UTC**:

```yaml
schedule:
  wake_up: "0 1 * * 1-5"    # Lunes a Viernes a las 1:00 AM UTC
  shutdown: "0 10 * * 1-5"  # Lunes a Viernes a las 10:00 AM UTC
```

> **⚠️ IMPORTANTE**: Todos los horarios están en UTC. Para convertir a tu zona horaria local, 
> resta/agrega las horas correspondientes. Ejemplo: UTC+8 (Singapur) = UTC + 8 horas.

### Formato Cron

```
* * * * *
│ │ │ │ │
│ │ │ │ └─── Día de la semana (0-7, 0 y 7 = Domingo)
│ │ │ └───── Mes (1-12)
│ │ └─────── Día del mes (1-31)
│ └───────── Hora (0-23)
└─────────── Minuto (0-59)
```

### Ejemplos Comunes

- `0 9 * * 1-5` - Lunes a Viernes a las 9:00 AM
- `0 17 * * 1-5` - Lunes a Viernes a las 5:00 PM
- `0 2 * * 1` - Todos los Lunes a las 2:00 AM
- `0 0 1 * *` - Primer día de cada mes a medianoche

## 🔄 Recarga de Configuración

CloudNap permite recargar la configuración sin reiniciar la aplicación:

### Desde la Interfaz Web
1. Haz clic en el botón **"Refresh"** en el dashboard
2. La aplicación recargará automáticamente el `config.yaml`
3. Los nuevos clusters y horarios se aplicarán inmediatamente

### Desde la API
```bash
# Recargar configuración
curl -X POST http://localhost:5000/api/config/reload
```

### ¿Cuándo usar la recarga?
- ✅ **Agregar nuevos clusters** al `config.yaml`
- ✅ **Modificar horarios** de clusters existentes
- ✅ **Habilitar/deshabilitar** clusters
- ✅ **Cambiar configuración** del scheduler
- ❌ **NO usar** para cambios en credenciales (requiere reinicio)

## 🐳 Docker

### Dockerfile

El Dockerfile utiliza un enfoque multi-stage para optimizar el tamaño de la imagen:

1. **Stage Builder**: Instala dependencias y herramientas de compilación
2. **Stage Runtime**: Imagen final optimizada con solo dependencias de runtime

### Docker Compose

Para desarrollo:
```bash
docker-compose up -d
```

Para producción con Nginx:
```bash
docker-compose --profile production up -d
```

### Docker Swarm

Para despliegue en producción con alta disponibilidad:

```bash
# Inicializar swarm (si no está inicializado)
docker swarm init

# Desplegar stack
./deploy.sh
```

## 📊 Monitoreo y Logs

### Logs

Los logs se almacenan en:
- Archivo: `logs/cloudnap.log`
- Rotación automática: 10MB por archivo, 5 archivos de respaldo
- Nivel configurable: DEBUG, INFO, WARNING, ERROR

### Health Check

El endpoint `/api/health` proporciona información sobre el estado de la aplicación:

```json
{
  "success": true,
  "status": "healthy",
  "services": {
    "scheduler": "running",
    "huawei_cloud": "connected"
  },
  "timestamp": "2024-01-15T10:30:00"
}
```

## 🔧 Desarrollo

### Estructura del Proyecto

```
cloudnap/
├── app/
│   ├── __init__.py          # Aplicación Flask principal
│   ├── config.py            # Gestión de configuración
│   ├── routes/
│   │   ├── api.py           # Endpoints de API REST
│   │   └── main.py          # Rutas web principales
│   ├── services/
│   │   ├── huawei_cloud_service.py    # Servicio Huawei Cloud
│   │   ├── scheduler_service.py       # Servicio de programación
│   │   └── logging_service.py         # Servicio de logging
│   ├── templates/
│   │   ├── base.html        # Template base
│   │   ├── index.html       # Dashboard principal
│   │   └── logs.html        # Página de logs
│   └── static/
│       └── css/
│           └── style.css    # Estilos personalizados
├── config.yaml              # Configuración principal
├── requirements.txt         # Dependencias Python
├── pyproject.toml          # Configuración del proyecto
├── Dockerfile              # Imagen Docker
├── docker-compose.yaml     # Compose para desarrollo
├── docker-swarm.yaml       # Stack para producción
├── deploy.sh               # Script de despliegue
└── README.md               # Este archivo
```

### Agregar Nuevos Clusters

1. Editar `config.yaml`
2. Agregar nueva entrada en la sección `clusters`
3. Reiniciar la aplicación

### Personalizar la UI

Los templates están en `app/templates/` y utilizan Bootstrap 5. Puedes personalizar:
- `base.html`: Layout principal
- `index.html`: Dashboard
- `logs.html`: Página de logs
- `app/static/css/style.css`: Estilos personalizados

## 🚨 Solución de Problemas

### Problemas Comunes

1. **Error de autenticación con Huawei Cloud**:
   - Verificar que las credenciales sean correctas
   - Asegurarse de que el proyecto tenga permisos ECS

2. **Scheduler no ejecuta tareas**:
   - Verificar la zona horaria en `config.yaml`
   - Revisar logs para errores de programación

3. **Instancias no responden**:
   - Verificar que los IDs de instancia sean correctos
   - Comprobar que las instancias estén en la región correcta

### Logs de Debug

Para habilitar logs detallados:

```yaml
logging:
  level: "DEBUG"
```

### Verificar Estado

```bash
# Ver logs en tiempo real
docker-compose logs -f cloudnap

# Verificar servicios en Docker Swarm
docker service ls
docker service logs cloudnap_cloudnap
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la documentación
2. Busca en los issues existentes
3. Crea un nuevo issue con detalles del problema

## 🙏 Agradecimientos

- [Flask](https://flask.palletsprojects.com/) - Framework web
- [APScheduler](https://apscheduler.readthedocs.io/) - Programación de tareas
- [Bootstrap](https://getbootstrap.com/) - Framework CSS
- [Huawei Cloud](https://www.huaweicloud.com/) - Plataforma cloud

---

**¡Happy Cloud Napping! ☁️😴**
