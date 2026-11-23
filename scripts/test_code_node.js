// Prueba el nodo "Procesar Respuesta IA" y los mensajes de Discord de workflow.json sin necesitar n8n.
// Uso: node scripts/test_code_node.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const workflow = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'workflow.json'), 'utf8'));
const nodo = (nombre) => workflow.nodes.find((n) => n.name === nombre);
const codigo = nodo('Procesar Respuesta IA').parameters.jsCode;

function ejecutar(ticket, respuestaHttp) {
  const $ = (nombre) => {
    assert.strictEqual(nombre, 'On form submission');
    return { first: () => ({ json: ticket }) };
  };
  const $input = { first: () => ({ json: respuestaHttp }) };
  const [item] = new Function('$', '$input', codigo)($, $input);
  return item.json;
}

const ticketBase = {
  Cliente: 'Lucía G.',
  Email: 'lucia@example.com',
  'Numero de pedido': 'A-1001',
  Problema: 'Me cobraron dos veces el pedido.',
  submittedAt: '2026-11-23T10:00:00.000Z',
};
const respuestaIA = (obj) => ({ choices: [{ message: { content: typeof obj === 'string' ? obj : JSON.stringify(obj) } }] });
const iaOk = {
  categoria: 'Pagos',
  urgencia: 'Alta',
  departamento: 'Facturacion',
  resumen: 'Cobro duplicado del pedido',
  respuesta_cliente: 'Lamentamos lo ocurrido. Revisaremos el cobro.',
};

const pruebas = [];
const prueba = (nombre, fn) => pruebas.push([nombre, fn]);

prueba('respuesta válida se conserva', () => {
  const r = ejecutar(ticketBase, respuestaIA(iaOk));
  assert.strictEqual(r.urgencia, 'Alta');
  assert.strictEqual(r.departamento, 'Facturacion');
  assert.strictEqual(r.revision_manual, false);
  assert.strictEqual(r.problema, 'Me cobraron dos veces el pedido.');
});

prueba('urgencia en minúsculas o con tilde se normaliza', () => {
  assert.strictEqual(ejecutar(ticketBase, respuestaIA({ ...iaOk, urgencia: 'alta' })).urgencia, 'Alta');
  assert.strictEqual(ejecutar(ticketBase, respuestaIA({ ...iaOk, urgencia: 'media', categoria: 'Envíos' })).categoria, 'Envios');
});

prueba('urgencia media y baja no se suben a alta', () => {
  assert.strictEqual(ejecutar(ticketBase, respuestaIA({ ...iaOk, urgencia: 'Media' })).urgencia, 'Media');
  assert.strictEqual(ejecutar(ticketBase, respuestaIA({ ...iaOk, urgencia: 'Baja' })).urgencia, 'Baja');
});

prueba('urgencia desconocida => Alta + revisión manual', () => {
  const r = ejecutar(ticketBase, respuestaIA({ ...iaOk, urgencia: 'Urgente' }));
  assert.strictEqual(r.urgencia, 'Alta');
  assert.strictEqual(r.revision_manual, true);
  assert.ok(r.resumen.includes('revisar a mano'));
});

prueba('falta la urgencia => Alta + revisión manual', () => {
  const { urgencia, ...sinUrgencia } = iaOk;
  assert.strictEqual(ejecutar(ticketBase, respuestaIA(sinUrgencia)).revision_manual, true);
});

prueba('JSON roto => no falla, Alta + revisión manual', () => {
  const r = ejecutar(ticketBase, respuestaIA('esto no es json {'));
  assert.strictEqual(r.urgencia, 'Alta');
  assert.strictEqual(r.revision_manual, true);
});

prueba('error de la API (sin choices) => no falla, Alta + revisión manual', () => {
  const r = ejecutar(ticketBase, { error: { message: 'rate limit', code: 429 } });
  assert.strictEqual(r.urgencia, 'Alta');
  assert.strictEqual(r.revision_manual, true);
});

prueba('JSON que no es un objeto => revisión manual', () => {
  assert.strictEqual(ejecutar(ticketBase, respuestaIA('["a"]')).revision_manual, true);
});

prueba('las menciones de Discord quedan neutralizadas', () => {
  const r = ejecutar(
    { ...ticketBase, Cliente: '@everyone', Problema: 'hola @here' },
    respuestaIA({ ...iaOk, resumen: '@everyone mira', respuesta_cliente: '@here' })
  );
  for (const campo of ['cliente', 'problema', 'resumen', 'respuesta_cliente']) {
    assert.ok(!/@(?!​)/.test(r[campo]), `${campo} conserva una mención`);
  }
});

prueba('pedido vacío => "No indicado"', () => {
  assert.strictEqual(ejecutar({ ...ticketBase, 'Numero de pedido': '' }, respuestaIA(iaOk)).pedido, 'No indicado');
});

prueba('los mensajes de Discord nunca superan 2000 caracteres', () => {
  const largo = 'x'.repeat(5000);
  const r = ejecutar(
    { ...ticketBase, Cliente: largo, Email: largo, 'Numero de pedido': largo, Problema: largo },
    respuestaIA({ ...iaOk, resumen: largo, respuesta_cliente: largo })
  );
  for (const nombre of ['🚨 Alerta Crítica (Discord)', '📋 Ticket Estándar (Discord)']) {
    const plantilla = nodo(nombre).parameters.content.replace(/^=/, '');
    const mensaje = plantilla.replace(/\{\{\s*\$json\.(\w+)\s*\}\}/g, (_, campo) => {
      assert.ok(campo in r, `el mensaje usa un campo que no existe: ${campo}`);
      return String(r[campo]);
    });
    assert.ok(mensaje.length <= 2000, `${nombre}: ${mensaje.length} caracteres`);
  }
});

prueba('el mensaje de Discord incluye el texto original del ticket', () => {
  for (const nombre of ['🚨 Alerta Crítica (Discord)', '📋 Ticket Estándar (Discord)']) {
    assert.ok(nodo(nombre).parameters.content.includes('$json.problema'), nombre);
  }
});

let fallos = 0;
for (const [nombre, fn] of pruebas) {
  try {
    fn();
    console.log('ok   -', nombre);
  } catch (e) {
    fallos++;
    console.log('FAIL -', nombre, '\n      ', e.message);
  }
}
console.log(`\n${pruebas.length - fallos}/${pruebas.length} pruebas correctas`);
process.exit(fallos ? 1 : 0);
