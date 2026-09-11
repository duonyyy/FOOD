export interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user: {
    id: string;
    uid?: string;
    sub?: string;
    userId?: string;
    [key: string]: unknown;
  };
}
