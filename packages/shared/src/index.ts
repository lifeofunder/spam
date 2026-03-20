export interface AuthUserDto {
  id: string;
  email: string;
  name: string;
  workspaceId: string;
}

export interface AuthTokensDto {
  accessToken: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  name: string;
  email: string;
  password: string;
}

export type ContactStatusDto = 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'BOUNCED';

export interface ContactPublicDto {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  status: ContactStatusDto;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContactsListResponseDto {
  items: ContactPublicDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CsvImportResultDto {
  inserted: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}
