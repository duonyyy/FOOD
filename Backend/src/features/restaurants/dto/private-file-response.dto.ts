import { ApiProperty } from '@nestjs/swagger';

export class PrivateFileResponseDto {
  @ApiProperty({
    description: 'Short-lived signed URL. Do not store or share this URL.',
  })
  url: string;
}
