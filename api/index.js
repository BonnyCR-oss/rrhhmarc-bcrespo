const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());


const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;


function calcularEstado(m) {
  if (!m.hora_ingreso_real || !m.hora_salida_real) return 'INCOMPLETO';
  if (m.hora_ingreso_real.slice(0, 5) > m.hora_ingreso_programada.slice(0, 5)) return 'ATRASO';
  if (m.hora_salida_real.slice(0, 5) < m.hora_salida_programada.slice(0, 5)) return 'SALIDA ANTICIPADA';
  return 'PUNTUAL';
}

function validar(m) {
  const errores = [];
  if (!m.codigo_empleado) errores.push('codigo_empleado es obligatorio');
  if (!m.nombre_empleado) errores.push('nombre_empleado es obligatorio');
  if (!m.fecha || !FECHA.test(m.fecha)) errores.push('fecha es obligatoria (YYYY-MM-DD)');
  if (!HORA.test(m.hora_ingreso_programada || '')) errores.push('hora_ingreso_programada inválida (HH:MM)');
  if (!HORA.test(m.hora_salida_programada || '')) errores.push('hora_salida_programada inválida (HH:MM)');
  if (m.hora_ingreso_real && !HORA.test(m.hora_ingreso_real)) errores.push('hora_ingreso_real inválida (HH:MM)');
  if (m.hora_salida_real && !HORA.test(m.hora_salida_real)) errores.push('hora_salida_real inválida (HH:MM)');
  if (errores.length === 0) {
    if (m.hora_salida_programada < m.hora_ingreso_programada)
      errores.push('hora_salida_programada no puede ser anterior a hora_ingreso_programada');
    if (m.hora_ingreso_real && m.hora_salida_real && m.hora_salida_real < m.hora_ingreso_real)
      errores.push('hora_salida_real no puede ser anterior a hora_ingreso_real');
  }
  return errores;
}

const CAMPOS = `id, codigo_empleado, nombre_empleado, to_char(fecha, 'YYYY-MM-DD') AS fecha,
  to_char(hora_ingreso_programada, 'HH24:MI') AS hora_ingreso_programada,
  to_char(hora_ingreso_real, 'HH24:MI') AS hora_ingreso_real,
  to_char(hora_salida_programada, 'HH24:MI') AS hora_salida_programada,
  to_char(hora_salida_real, 'HH24:MI') AS hora_salida_real,
  estado, observacion`;

function valores(m) {
  return [
    m.codigo_empleado, m.nombre_empleado, m.fecha,
    m.hora_ingreso_programada, m.hora_ingreso_real || null,
    m.hora_salida_programada, m.hora_salida_real || null,
    calcularEstado(m), m.observacion || null,
  ];
}


app.get('/api/marcaciones', async (req, res) => {
  try {
    const cond = [];
    const params = [];
    if (req.query.empleado) {
      params.push(req.query.empleado);
      cond.push(`codigo_empleado = $${params.length}`);
    }
    if (req.query.fecha) {
      if (!FECHA.test(req.query.fecha)) return res.status(400).json({ error: 'fecha inválida (YYYY-MM-DD)' });
      params.push(req.query.fecha);
      cond.push(`fecha = $${params.length}`);
    }
    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    const r = await pool.query(`SELECT ${CAMPOS} FROM marcaciones ${where} ORDER BY fecha DESC, id DESC`, params);
    res.status(200).json(r.rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.get('/api/marcaciones/:id', async (req, res) => {
  try {
    const r = await pool.query(`SELECT ${CAMPOS} FROM marcaciones WHERE id = $1`, [Number(req.params.id) || 0]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Marcación no encontrada' });
    res.status(200).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.post('/api/marcaciones', async (req, res) => {
  const errores = validar(req.body);
  if (errores.length) return res.status(400).json({ errores });
  try {
    const r = await pool.query(
      `INSERT INTO marcaciones (codigo_empleado, nombre_empleado, fecha, hora_ingreso_programada, hora_ingreso_real,
        hora_salida_programada, hora_salida_real, estado, observacion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${CAMPOS}`,
      valores(req.body)
    );
    res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.put('/api/marcaciones/:id', async (req, res) => {
  const errores = validar(req.body);
  if (errores.length) return res.status(400).json({ errores });
  try {
    const r = await pool.query(
      `UPDATE marcaciones SET codigo_empleado=$1, nombre_empleado=$2, fecha=$3, hora_ingreso_programada=$4,
        hora_ingreso_real=$5, hora_salida_programada=$6, hora_salida_real=$7, estado=$8, observacion=$9
       WHERE id=$10 RETURNING ${CAMPOS}`,
      [...valores(req.body), Number(req.params.id) || 0]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Marcación no encontrada' });
    res.status(200).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.delete('/api/marcaciones/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM marcaciones WHERE id = $1', [Number(req.params.id) || 0]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Marcación no encontrada' });
    res.status(200).json({ mensaje: 'Marcación eliminada' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

app.listen(3000, () => console.log('API escuchando en el puerto 3000'));
