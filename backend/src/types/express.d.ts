import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      IdUser: string;
      IdOrganization: string;
      Role: string;
      Email: string;
    };
  }
}
