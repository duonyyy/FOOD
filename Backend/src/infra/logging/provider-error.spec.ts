import { getProviderErrorCode, getProviderErrorType } from './provider-error';

describe('provider error metadata', () => {
  it('extracts a bounded provider error code without retaining response data', () => {
    const error = {
      response: {
        data: {
          resultCode: '42',
          signature: 'secret-signature',
        },
      },
    };

    expect(getProviderErrorCode(error)).toBe('42');
    expect(getProviderErrorType(error)).toBe('UnknownError');
  });

  it('uses UNKNOWN when a provider error has no safe code', () => {
    expect(getProviderErrorCode({ code: 'unsafe code with spaces' })).toBe('UNKNOWN');
  });
});
