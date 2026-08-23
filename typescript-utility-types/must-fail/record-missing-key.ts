// Record<HttpStatus, string> refuses to compile when a status has no message.
import { type HttpStatus } from '../src/types.js';

export const incomplete: Record<HttpStatus, string> = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
};
