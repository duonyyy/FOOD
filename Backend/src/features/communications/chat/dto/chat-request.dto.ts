import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  userMessage: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
