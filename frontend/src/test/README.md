# Pruebas del frontend

## Ejecutar

```bash
npm run test        # una vez
npm run test:watch  # en modo watch
```

## Tests incluidos

- **src/services/api.test.ts**: contrato de `fetchContestStatistics` y `fetchSystemStatus` (formato de respuesta). No mockean la red; si el backend no está, las funciones devuelven valores por defecto y los tests siguen pasando.

Para tests de componentes con React (jsdom), se puede añadir `environment: 'jsdom'` y `setupFiles` con `@testing-library/jest-dom` en `vitest.config.ts` cuando se necesiten.
