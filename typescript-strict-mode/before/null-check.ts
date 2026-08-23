// strictNullChecks: getUser() can hand back null, so user.name is not safe.
interface User {
  name: string;
}

function getUser(): User | null {
  return Math.random() > 0.5 ? { name: 'Ada' } : null;
}

function greet(name: string): string {
  return `Hello, ${name.toUpperCase()}`;
}

const user = getUser();
export const greeting = greet(user.name);
