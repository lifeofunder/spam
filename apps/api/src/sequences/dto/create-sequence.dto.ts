import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SequenceStepInputDto {
  @IsInt()
  @Min(0)
  @Max(10_000)
  order!: number;

  @IsString()
  @MinLength(1)
  templateId!: string;

  @IsInt()
  @Min(0)
  @Max(525_600)
  delayMinutes!: number;
}

export class CreateSequenceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SequenceStepInputDto)
  steps!: SequenceStepInputDto[];
}
