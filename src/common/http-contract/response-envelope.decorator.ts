import { SetMetadata } from '@nestjs/common';

export const RESPONSE_ENVELOPE_KEY = 'foodee:response-envelope';

export const ResponseEnvelope = (): MethodDecorator => SetMetadata(RESPONSE_ENVELOPE_KEY, true);
