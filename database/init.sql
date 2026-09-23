CREATE TABLE IF NOT EXISTS marcaciones (
  id SERIAL PRIMARY KEY,
  codigo_empleado VARCHAR(20) NOT NULL,
  nombre_empleado VARCHAR(100) NOT NULL,
  fecha DATE NOT NULL,
  hora_ingreso_programada TIME NOT NULL,
  hora_ingreso_real TIME,
  hora_salida_programada TIME NOT NULL,
  hora_salida_real TIME,
  estado VARCHAR(20) NOT NULL,
  observacion VARCHAR(255)
);

INSERT INTO marcaciones (codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real, hora_salida_programada, hora_salida_real, estado)
VALUES ('EMP001', 'Ana Pérez', '2026-09-23', '08:00', '07:56', '16:00', '16:05', 'PUNTUAL');
