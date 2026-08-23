import { type HttpStatus } from './types.js';

// Record forces a message for every member of the union. Add a status to
// HttpStatus and this object stops compiling until you add its message.
export const statusMessages: Record<HttpStatus, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
};

export function describe(status: HttpStatus): string {
  return `${status} ${statusMessages[status]}`;
}
