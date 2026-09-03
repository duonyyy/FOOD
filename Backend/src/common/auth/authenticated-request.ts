export interface AuthenticatedUser {
  id: string;
  uid?: string;
  userId?: string;
  role?: unknown;
}

export interface AuthenticatedRequest {
  user: AuthenticatedUser;
}

export interface GraphqlAuthContext {
  req: AuthenticatedRequest;
}
