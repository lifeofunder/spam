import { IsNotEmpty, IsString } from 'class-validator';

export class UnsubscribeQueryDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
