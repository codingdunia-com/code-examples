// satisfies: validated against RouteConfig, and route.method stays 'GET'.
import { handleGet, type RouteConfig } from './route-config.js';

const route = {
  method: 'GET',
  path: '/users',
} satisfies RouteConfig;

export const result = handleGet(route.method);
