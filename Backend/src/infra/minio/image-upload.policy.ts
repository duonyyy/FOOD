import { BadRequestException } from '@nestjs/common';

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];

const IMAGE_EXTENSION: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function assertValidImageUpload(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'size'>,
): ImageContentType {
  if (!file.size || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new BadRequestException('Image files must be between 1 byte and 5 MB');
  }

  const detectedContentType = detectImageContentType(file.buffer);
  if (!detectedContentType || !IMAGE_CONTENT_TYPES.includes(file.mimetype as ImageContentType)) {
    throw new BadRequestException('Only JPEG, PNG, and WebP image files are allowed');
  }

  if (detectedContentType !== file.mimetype) {
    throw new BadRequestException('The image content does not match its declared content type');
  }

  return detectedContentType;
}

export function imageExtensionFor(contentType: ImageContentType): string {
  return IMAGE_EXTENSION[contentType];
}

function detectImageContentType(buffer: Buffer): ImageContentType | undefined {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }

  return undefined;
}
