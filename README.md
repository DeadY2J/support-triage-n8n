# 🎫 SupportTriage AI — Triaje Automático de Tickets con n8n + Groq

<img width="1905" height="916" alt="n8nWorkflowSupportTriage" src="https://github.com/user-attachments/assets/297e61d9-4f18-43d3-a0a2-8f9a9bd4f95d" />


Flujo de automatización en **n8n** que recibe incidencias de clientes mediante un formulario web, las clasifica con IA aplicando reglas de negocio, prioriza los casos críticos con lógica condicional y notifica al equipo de operaciones en **Discord** con un borrador de respuesta para que una persona lo revise.

## 🎯 Problema, Solución e Impacto

* **Problema:** Los equipos de soporte reciben tickets sin clasificar y mezclan consultas generales con incidencias críticas (cobros duplicados o pedidos perdidos), perdiendo tiempo en lectura manual y redacción repetitiva.
* **Solución:** Un pipeline orquestado en **n8n (local)** conectado a la API de **Groq** (`openai/gpt-oss-120b`) con salida JSON, validación de la respuesta y un nodo condicional (`IF`) que separa automáticamente las urgencias altas del soporte estándar.
* **Impacto:** Triaje y enrutamiento por departamento (*Facturación*, *Logística*, *Atención al Cliente*) en pocos segundos, con alertas diferenciadas y borradores empáticos alineados a las políticas de la empresa.

## 🔀 Arquitectura del flujo

```text
[Formulario Web (n8n Form Trigger)]
                ↓
[Groq API (HTTP Request + JSON + políticas; 3 reintentos y 20 s de tiempo máximo)]
                ↓
[Procesar Respuesta IA (Code Node: valida, limpia el texto y decide la urgencia)]
                ↓
[¿Es Urgencia Alta? (IF)]
   ├── True  ──> 🚨 Alerta Crítica en Discord (Prioridad Alta)
   └── False ──> 📋 Ticket Estándar en Discord (Prioridad Media/Baja)
```

### Qué hace el nodo "Procesar Respuesta IA"

* **Valida** categoría, urgencia y departamento contra listas permitidas (sin distinguir mayúsculas ni tildes).
* **Ante la duda, urgencia Alta.** Si la IA falla, devuelve un JSON roto o una urgencia desconocida, el ticket va a la rama crítica marcado con `⚠️ … revisar a mano`. Un ticket nunca pasa desapercibido por un error de la IA.
* **Limpia el texto de terceros:** neutraliza las menciones (`@everyone`, `@here`) y limita la longitud para no superar los 2000 caracteres de Discord.
* El prompt indica al modelo que trate el ticket como contenido a analizar y no como instrucciones.
* El prompt también le prohíbe inventar plazos, precios o condiciones que no estén en las políticas. En una prueba con un ticket sobre envíos a Canarias, el modelo sin esa regla se inventó un plazo de entrega; por eso existe.

## ⚙️ Puesta en marcha

1. Importa el flujo en n8n: **Workflows → ⋯ → Import from file** y elige `workflow.json`.
2. Crea dos credenciales (los nodos las piden por estos nombres):
   * **`Groq API`** (tipo *Header Auth*): *Name* = `Authorization`, *Value* = `Bearer TU_CLAVE_DE_GROQ`.
   * **`Discord Operaciones`** (tipo *Discord Webhook*): la URL del webhook de tu canal.
3. Prueba con un ticket: abre el formulario (*Execute workflow* y la URL de prueba del nodo **On form submission**) y envía uno de [`examples/tickets.md`](examples/tickets.md).
4. O prueba los 6 casos de golpe pegando [`examples/tickets.json`](examples/tickets.json) como datos de prueba del nodo (instrucciones en `examples/tickets.md`).

## 🧪 Pruebas

La lógica del nodo de código y la longitud de los mensajes se prueban sin n8n, Groq ni Discord:

```bash
node scripts/test_code_node.js
```

## ⚠️ Límites y uso responsable

* **Las respuestas son borradores.** Una persona debe revisarlas antes de enviarlas: la IA puede equivocarse o ser manipulada por el texto del ticket.
* **La IA puede dar por hecho lo que no sabe.** En las pruebas, ante "¿Hacéis envíos a Canarias?", el borrador confirmó que sí se envía, aunque las políticas del prompt no lo dicen (lo del plazo inventado se corrigió con una regla en el prompt). Por eso el borrador va siempre a revisión humana y no se envía solo al cliente.
* **El formulario es público** si lo expones a internet: añade límite de peticiones o captcha antes de usarlo en producción (cada envío consume cuota de Groq y genera un mensaje en Discord).
* **Datos personales:** el nombre, el pedido y el problema se envían a Groq, y nombre, email y problema a Discord. Con datos reales de clientes aplica la RGPD. Los ejemplos de este repositorio son ficticios.
* Probado en una instancia local de n8n. No incluye gestión de errores a nivel de instancia (workflow de errores) ni persistencia de tickets.

## 🤝 Cómo se ha hecho

Desarrollado con ayuda de Claude (Anthropic). Yo diseñé el flujo y las políticas, lo probé en mi n8n con casos difíciles (órdenes escondidas, menciones, textos largos) y decido qué se incorpora al proyecto.

## 📄 Licencia

MIT. Consulta [LICENSE](LICENSE).
