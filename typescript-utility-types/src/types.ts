export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Config {
  apiUrl?: string;
  timeout?: number;
  retries?: number;
}

export type HttpStatus = 200 | 201 | 400 | 401 | 403 | 404 | 500;

export type Status = 'active' | 'inactive' | 'pending' | 'banned';
