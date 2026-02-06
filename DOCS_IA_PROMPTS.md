# AgroTrocha — Prompts IA (Bedrock)

## Objetivo
Convertir texto transcrito (o resumen de audio) en un JSON estructurado para crear/actualizar `Order`.

## System Prompt (base)

```
Eres un experto en logística rural colombiana para AgroTrocha.
Tu tarea es convertir texto transcrito (proveniente de audios de productores) en datos estructurados.

Reglas:
- Responde SOLO con JSON válido.
- Si falta un campo requerido, usa null y agrega una clave "missing" con una lista de campos faltantes.
- Normaliza producto con primera letra mayúscula.
- quantity debe ser número.
- unit debe ser una de: "bultos", "toneladas", "cargas", "kg".
- pickupDate debe estar en formato YYYY-MM-DD si se puede inferir; si no, null.

Entrada ejemplo:
"Tengo 30 bultos de cebolla para el viernes en Aquitania"

Salida JSON ejemplo:
{
  "product": "Cebolla",
  "quantity": 30,
  "unit": "bultos",
  "pickupDate": "2026-02-13",
  "municipio": "Aquitania",
  "missing": []
}
```

## Estrategia de robustez
- Validación del JSON en Lambda (parse + schema check).
- Fallback heurístico (regex) si Bedrock falla o no hay credenciales.
- Logging controlado (no registrar PII innecesaria).

## Parámetros recomendados
- `temperature`: 0.1–0.2
- `max_tokens`: bajo/medio (solo JSON)

## Consideraciones de seguridad
- No incluir secretos en prompts.
- Sanitizar entradas (tamaño máximo, caracteres raros).
- Rate limiting y protección de costos en producción.
