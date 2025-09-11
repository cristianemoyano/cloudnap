# CloudNap ☁️😴

**CloudNap** es una aplicación que gestiona clusters de Huawei Cloud de manera automatizada para ahorrar costos. Puede encender y apagar clusters según horarios programados o manualmente a través de una interfaz web.

## 🚀 Características

- **Gestión de Clusters**: Controla múltiples clusters de Huawei Cloud
- **Programación Automática**: Ejecuta tareas según horarios configurados (cron)
- **API REST**: Endpoints para integración con otros sistemas
- **Interfaz Web**: Dashboard moderno para gestión visual
- **Docker Secrets**: Manejo seguro de credenciales
- **Docker Swarm**: Despliegue en producción con alta disponibilidad

## 📋 Requisitos

- Docker y Docker Swarm
- Python 3.13+ (para desarrollo local)
- Credenciales de Huawei Cloud (Access Key, Secret Key, Project ID)
- Instancias ECS de Huawei Cloud para gestionar

## 🛠️ Instalación

### 🐳 Docker Swarm (Producción)

1. **Clonar el repositorio**:
   ```bash
   git clone <repository-url>
   cd cloudnap
   ```

2. **Crear Docker secrets**:
   ```bash
   # Crear secrets en Docker Swarm
   echo "tu_access_key_aqui" | docker secret create huawei_access_key -
   echo "tu_secret_key_aqui" | docker secret create huawei_secret_key -
   echo "tu_project_id_aqui" | docker secret create huawei_project_id -
   ```

3. **Configurar clusters**:
   ```bash
   # Editar config.yaml con tus clusters y horarios
   nano config.yaml
   ```

4. **Crear red externa** (si no existe):
   ```bash
   docker network create --driver overlay --attachable cloudnap-network
   ```

5. **Desplegar la aplicación**:
   ```bash
   docker stack deploy -c docker-swarm.yaml cloudnap
   ```

6. **Acceder a la aplicación**:
   - Web Interface: http://localhost:7181
   - API: http://localhost:7181/api

### 💻 Desarrollo Local

#### Opción 1: Docker Compose (Recomendado)

1. **Clonar el repositorio**:
   ```bash
   git clone <repository-url>
   cd cloudnap
   ```

2. **Crear archivos de secrets**:
   ```bash
   mkdir -p secrets
   echo "tu_access_key_aqui" > secrets/huawei_access_key.txt
   echo "tu_secret_key_aqui" > secrets/huawei_secret_key.txt
   echo "tu_project_id_aqui" > secrets/huawei_project_id.txt
   chmod 600 secrets/*.txt
   ```

3. **Configurar clusters**:
   ```bash
   # Editar config.yaml con tus clusters y horarios
   nano config.yaml
   ```

4. **Ejecutar con Docker Compose**:
   ```bash
   docker-compose up -d
   ```

5. **Acceder a la aplicación**:
   - Web Interface: http://localhost:7181
   - API: http://localhost:7181/api

#### Opción 2: Python Virtual Environment

1. **Crear entorno virtual**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # o
   venv\Scripts\activate     # Windows
   ```

2. **Instalar dependencias**:
   ```bash
   pip install -e .
   # o para desarrollo con herramientas adicionales
   pip install -e ".[dev]"
   ```

3. **Configurar variables de entorno**:
   ```bash
   cp env.example .env
   # Editar .env con tus credenciales
   ```

4. **Ejecutar aplicación**:
   ```bash
   python -m app
   ```

## ⚙️ Configuración

### Archivo config.yaml

El archivo `config.yaml` contiene la configuración de clusters y horarios:

```yaml
# Configuración de Huawei Cloud
huawei_cloud:
  region: "la-south-2"
  access_key: "huawei_access_key"  # Docker secret name
  secret_key: "huawei_secret_key"  # Docker secret name
  project_id: "huawei_project_id"  # Docker secret name

# Clusters a gestionar
clusters:
  - name: "qa-cluster"
    instance_ids:
      - "xxxx-yyyy"
    region: "la-south-2"
    description: "Cluster de QA para aplicaciones"
    tags: ["qa"]
    schedule:
      wake_up: "0 4 * * 1-5"    # Lunes a Viernes a las 4:00 AM UTC
      shutdown: "0 10 * * 1-5"  # Lunes a Viernes a las 10:00 AM UTC
    enabled: true
```

> **⚠️ IMPORTANTE**: Los horarios están en UTC. Para convertir a tu zona horaria local, 
> resta/agrega las horas correspondientes. Ejemplo: UTC+8 (Singapur) = UTC + 8 horas.

## 🔌 API Endpoints

### Principales

- `GET /api/clusters` - Listar todos los clusters
- `POST /api/clusters/{name}/start` - Iniciar un cluster
- `POST /api/clusters/{name}/stop` - Detener un cluster
- `GET /api/health` - Health check
- `POST /api/config/reload` - Recargar configuración

### Ejemplos de Uso

```bash
# Listar clusters
curl http://localhost:7181/api/clusters

# Iniciar un cluster
curl -X POST http://localhost:7181/api/clusters/scoreappv2dockerqa-worker-2/start

# Health check
curl http://localhost:7181/api/health

# Recargar configuración
curl -X POST http://localhost:7181/api/config/reload
```

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

### Verificar Estado

```bash
# Ver logs en tiempo real (desarrollo)
docker-compose logs -f cloudnap

# Verificar servicios en Docker Swarm (producción)
docker service ls
docker service logs cloudnap_cloudnap
```

## 🔧 Comandos Útiles

### Docker Swarm

```bash
# Ver servicios desplegados
docker service ls

# Ver logs de un servicio
docker service logs cloudnap_cloudnap

# Escalar servicio
docker service scale cloudnap_cloudnap=3

# Actualizar stack
docker stack deploy -c docker-swarm.yaml cloudnap

# Eliminar stack
docker stack rm cloudnap

# Verificar red externa
docker network ls | grep cloudnap
```

### Docker Compose

```bash
# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down

# Reconstruir imagen
docker-compose build --no-cache
```

---

**¡Happy Cloud Napping! ☁️😴**
