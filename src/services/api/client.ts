export type ApiResult<T> =
  { data: T } | { error: { code: string; message: string } };

export interface ApiClient {
  get<T>(path: string, init?: RequestInit): Promise<ApiResult<T>>;
}
