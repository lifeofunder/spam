import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class EnrollSequenceDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  contactIds!: string[];
}
