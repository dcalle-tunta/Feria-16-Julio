# Instrucciones para Copilot - Backend Feria 16
- Usa NestJS con TypeScript y TypeORM.
- Aplica validaciones estrictas en DTOs con class-validator.
- No uses lógica directa dentro de los Controllers; toda la lógica de negocio pertenece a los Services.
- Para las búsquedas en la base de datos MySQL, usa TypeORM QueryBuilder.
- Mantén las reglas de negocio: celular boliviano (8 dígitos iniciando con 6 o 7), contraseñas alfanuméricas de mínimo 8 caracteres, validación estricta de límites de palabras.