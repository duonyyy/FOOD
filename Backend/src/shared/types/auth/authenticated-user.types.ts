export interface AuthenticatedUser {
  id: string;
  uid?: string;
  userId?: string;
  sub?: string;
  role?: unknown;
  [key: string]: unknown;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
  headers?: {
    authorization?: string;
    [key: string]: unknown;
  };
}

export interface GraphqlAuthContext {
  req: AuthenticatedRequest;
}
