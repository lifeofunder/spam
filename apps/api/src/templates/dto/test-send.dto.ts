import { IsEmail, IsObject, IsOptional } from 'class-validator';

export class TestSendDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsObject()
  sampleVariables?: Record<string, string>;
}
