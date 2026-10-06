// The generic API envelope from "How Do You Type API Responses with Generics?".
// One wrapper type, any payload, and the payload's type survives the round trip.

export interface ApiResponse<T> {
  readonly data: T;
  readonly status: number;
  readonly fetchedAt: string;
}

export function wrap<T>(data: T, status = 200): ApiResponse<T> {
  return { data, status, fetchedAt: '2026-08-24T00:00:00.000Z' };
}

export function unwrap<T>(response: ApiResponse<T>): T {
  if (response.status >= 400) {
    throw new Error(`request failed with ${response.status}`);
  }
  return response.data;
}
