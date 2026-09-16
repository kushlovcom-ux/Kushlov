import { AdminSection, Role } from '@kushlov/types';

declare global {
  namespace Express {
    interface UserContext {
      id: string;
      role: Role;
      tokenVersion: number;
      isSubadmin?: boolean;
      adminSections?: AdminSection[];
    }
    interface Request {
      user?: UserContext;
    }
  }
}

export {};
