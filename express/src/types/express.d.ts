export interface AuthUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
}

declare global {
  namespace Express {
    // Extend Passport's User interface so req.user has our fields
    interface User extends AuthUser {}

    interface Request {
      requestId: string;
    }
  }
}
