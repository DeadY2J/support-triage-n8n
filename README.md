<img width="1909" height="909" alt="n8nWorkflowSupportTriage" src="https://github.com/user-attachments/assets/7b1ce75e-b3e1-458c-af29-662e5100e372" />

# 🎫 SupportTriage AI — Triaje Automático de Tickets con n8n + Groq

Flujo de automatización en **n8n** que recibe incidencias de clientes mediante un formulario web, las clasifica con IA aplicando reglas de negocio reales, prioriza los casos críticos con lógica condicional y notifica al equipo de operaciones en **Discord** con un borrador de respuesta listo para enviar.

## 🎯 Problema, Solución e Impacto

* **Problema:** Los equipos de soporte reciben tickets sin clasificar y mezclan consultas generales con incidencias críticas (cobros duplicados o pedidos perdidos), perdiendo tiempo en lectura manual y redacción repetitiva.
* **Solución:** Un pipeline orquestado en **n8n (local)** conectado a la API de **Groq** (`openai/gpt-oss-120b`) con salida JSON estricta y un nodo condicional (`IF`) que separa automáticamente las urgencias altas del soporte estándar.
* **Impacto:** Triaje y enrutamiento por departamento (*Facturación*, *Logística*, *Atención al Cliente*) en menos de 3 segundos, con alertas diferenciadas y borradores empáticos alineados a las políticas de la empresa.

## 🔀 Arquitectura del flujo

```text
[Formulario Web (n8n Form Trigger)]
                ↓
[Groq API (HTTP Request + JSON estructurado + Políticas)]
                ↓
[Procesar Respuesta IA (JavaScript Code Node)]
                ↓
[¿Es Urgencia Alta? (IF)]
   ├── True  ──> 🚨 Alerta Crítica en Discord (Prioridad Alta)
   └── False ──> 📋 Ticket Estándar en Discord (Prioridad Media/Baja)
