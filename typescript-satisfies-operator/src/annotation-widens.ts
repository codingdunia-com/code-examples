// Option A: explicit annotation. Validates the shape, loses the literal.
// routeA.method is the whole 'GET' | 'POST' | 'PUT' | 'DELETE' union, so the
// call below fails even though the value is demonstrably 'GET'.
import { handleGet, type RouteConfig } from './route-config.js';

const routeA: RouteConfig = {
  method: 'GET',
  path: '/users',
};

export const result = handleGet(routeA.method);
