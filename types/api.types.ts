export interface ApiError {
  error: string;
}

export type ApiOk<T> = T & { message?: string };
