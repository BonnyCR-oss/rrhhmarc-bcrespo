# RRHH – Sistema de Marcaciones

Examen práctico de Cloud Computing – Universidad del Valle.

Aplicación para registrar y consultar las marcaciones de ingreso y salida de empleados, desplegada con **Docker Compose** en tres contenedores.

## Arquitectura

```
Navegador ──► web (nginx :8080) ──/api/──► api (Node.js/Express :3000) ──► database (PostgreSQL 16)
                                                                              │
                                                                        volumen pgdata
```

| Servicio   | Tecnología            | Puerto host | Función |
|------------|-----------------------|-------------|---------|
| `web`      | nginx:alpine          | 8080        | Sirve el frontend y reenvía `/api/` al API |
| `api`      | Node.js 20 + Express  | 3000        | API REST (CRUD y filtros) |
| `database` | postgres:16-alpine    | — (interno) | Base de datos con volumen persistente y health check |

- El frontend nunca accede directamente a la base de datos; solo habla con el API.
- La base de datos no expone puertos al host; solo es accesible dentro de la red `rrhh-net`.
- El `api` espera a que `database` esté **healthy** (`depends_on: condition: service_healthy`).
- Los datos se guardan en el volumen `pgdata`, por lo que sobreviven a la eliminación del contenedor.

## Estructura

```
├── docker-compose.yml
├── .env.example
├── README.md
├── EvidenciasPruebas.docx   # Evidencias de ejecución
├── web/                     # Frontend (HTML + JS) servido con nginx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── index.html
│   └── app.js
├── api/                     # API REST
│   ├── Dockerfile
│   ├── package.json
│   └── index.js
└── database/
    └── init.sql             # Creación de la tabla y dato inicial
```

## Cómo ejecutarlo

Requisitos: Docker y Docker Compose.

```bash
git clone https://github.com/BonnyCR-oss/rrhhmarc-bcrespo.git
cd rrhhmarc-bcrespo
cp .env.example .env        # obligatorio; se puede cambiar DB_PASSWORD
docker compose up -d --build
docker ps
```

- Web: http://localhost:8080
- API: http://localhost:3000/api/marcaciones

Para detener: `docker compose down` (conserva los datos) o `docker compose down -v` (borra también el volumen).

## API REST

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET    | `/api/marcaciones` | Lista todas las marcaciones |
| GET    | `/api/marcaciones?empleado=EMP001` | Filtra por código de empleado |
| GET    | `/api/marcaciones?fecha=2026-09-23` | Filtra por fecha |
| GET    | `/api/marcaciones/:id` | Obtiene una marcación |
| POST   | `/api/marcaciones` | Crea una marcación |
| PUT    | `/api/marcaciones/:id` | Actualiza una marcación |
| DELETE | `/api/marcaciones/:id` | Elimina una marcación |

Ejemplo de cuerpo para POST/PUT:

```json
{
  "codigo_empleado": "EMP001",
  "nombre_empleado": "Ana Pérez",
  "fecha": "2026-09-23",
  "hora_ingreso_programada": "08:00",
  "hora_ingreso_real": "08:12",
  "hora_salida_programada": "16:00",
  "hora_salida_real": "16:05"
}
```

El API valida los datos (400 si son inválidos) y calcula el campo `estado`:

| Estado | Condición |
|--------|-----------|
| `PUNTUAL` | Ingresó a tiempo y salió a la hora o después |
| `ATRASO` | Ingreso real posterior al programado |
| `SALIDA ANTICIPADA` | Salida real anterior a la programada |
| `INCOMPLETO` | Falta la hora de ingreso o de salida real |

## Pruebas

Las evidencias (capturas) de cada prueba están en **`EvidenciasPruebas.docx`**. Las peticiones se realizaron con Bruno.

1. **Levantamiento:** `docker compose up -d`
2. **Estado de los contenedores:** `docker ps` muestra `web`, `api` y `database (healthy)`.
3. **Creación de una marcación:** `POST /api/marcaciones` con el cuerpo de ejemplo → `201 Created`, estado `ATRASO`.
4. **Consulta por API:** `GET /api/marcaciones` → `200 OK`.
5. **Consulta desde la web:** http://localhost:8080 muestra la misma información.
6. **Filtro:** `GET /api/marcaciones?empleado=EMP001` y `GET /api/marcaciones?fecha=2026-09-23` (también desde la web con el botón *Filtrar*).
7. **Persistencia:**
   ```bash
   docker compose rm -sf database   # elimina el contenedor
   docker volume ls                 # el volumen pgdata sigue existiendo
   docker compose up -d database    # recrea el contenedor
   ```
   `GET /api/marcaciones` devuelve los mismos datos.
8. **Falla del API:**
   ```bash
   docker stop rrhhmarc-bcrespo-api-1
   ```
   - **Afectación:** no se pueden consultar ni registrar marcaciones; la web muestra *"No se pudo conectar con la API"*.
   - **Sigue funcionando:** `web` (nginx sirve la página) y `database` (sigue healthy y conserva los datos).
   - **Restauración:** `docker start rrhhmarc-bcrespo-api-1`, y la funcionalidad vuelve a estar disponible.

**Health check:**

```bash
docker inspect --format '{{.State.Health.Status}}' rrhhmarc-bcrespo-database-1   # healthy
```
