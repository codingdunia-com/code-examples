// The same typo Option B swallowed, now caught at the declaration.
import { type RouteConfig } from './route-config.js';

export const routeWithTypo = {
  methdo: 'GET',
  path: '/users',
} satisfies RouteConfig;
