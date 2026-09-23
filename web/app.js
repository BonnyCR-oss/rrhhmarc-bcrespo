const API = '/api/marcaciones';
const CAMPOS = ['codigo_empleado', 'nombre_empleado', 'fecha', 'hora_ingreso_programada',
  'hora_ingreso_real', 'hora_salida_programada', 'hora_salida_real', 'observacion'];
const $ = (id) => document.getElementById(id);
let marcaciones = [];

async function cargar() {
  const params = new URLSearchParams();
  if ($('f_empleado').value) params.set('empleado', $('f_empleado').value);
  if ($('f_fecha').value) params.set('fecha', $('f_fecha').value);
  try {
    const res = await fetch(`${API}?${params}`);
    if (!res.ok) throw new Error();
    marcaciones = await res.json();
    $('mensaje').textContent = '';
  } catch {
    marcaciones = [];
    $('mensaje').textContent = 'No se pudo conectar con la API';
  }
  $('tabla').innerHTML = '';
  for (const m of marcaciones) {
    const tr = document.createElement('tr');
    for (const c of ['id', ...CAMPOS.slice(0, 7), 'estado', 'observacion']) {
      const td = document.createElement('td');
      td.textContent = m[c] ?? '';
      tr.appendChild(td);
    }
    const td = document.createElement('td');
    td.innerHTML = `<button onclick="editar(${m.id})">Editar</button> <button onclick="eliminar(${m.id})">Eliminar</button>`;
    tr.appendChild(td);
    $('tabla').appendChild(tr);
  }
}

function limpiarForm() {
  $('form').reset();
  $('id').value = '';
  $('titulo-form').textContent = 'Nueva marcación';
}

function editar(id) {
  const m = marcaciones.find((x) => x.id === id);
  $('id').value = m.id;
  for (const c of CAMPOS) $(c).value = m[c] ?? '';
  $('titulo-form').textContent = `Editar marcación #${id}`;
}

async function eliminar(id) {
  if (!confirm(`¿Eliminar la marcación #${id}?`)) return;
  await fetch(`${API}/${id}`, { method: 'DELETE' });
  cargar();
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const datos = {};
  for (const c of CAMPOS) datos[c] = $(c).value;
  const id = $('id').value;
  try {
    const res = await fetch(id ? `${API}/${id}` : API, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    const body = await res.json();
    if (!res.ok) {
      $('mensaje').textContent = body.errores ? body.errores.join(', ') : body.error;
      return;
    }
    limpiarForm();
    cargar();
  } catch {
    $('mensaje').textContent = 'No se pudo conectar con la API';
  }
});

$('cancelar').addEventListener('click', limpiarForm);
$('filtrar').addEventListener('click', cargar);
$('limpiar').addEventListener('click', () => { $('f_empleado').value = ''; $('f_fecha').value = ''; cargar(); });

cargar();
