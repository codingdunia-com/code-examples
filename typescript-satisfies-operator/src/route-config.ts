export interface RouteConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
}

export function handleGet(method: 'GET'): string {
  return `handling ${method}`;
}
