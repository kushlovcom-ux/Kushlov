import { Role } from '@kushlov/types';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: Role;
      tokenVersion: number;
    }
    interface Request {
      user?: UserContext;
    }
  }
}

export {};
