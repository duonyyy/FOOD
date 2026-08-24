export function assertProductionConfiguration(environment = process.env): void {
  if (environment.NODE_ENV !== 'production') {
    return;
  }

  const requiredSecrets = ['JWT_SECRET', 'DB_PASSWORD', 'MINIO_SECRET_KEY'] as const;
  const placeholders = new Set([
    'your_secret_key',
    'changeme',
    'password',
    '123456',
    'miniopassword',
  ]);
  for (const key of requiredSecrets) {
    const value = environment[key]?.trim();
    if (!value || placeholders.has(value.toLowerCase())) {
      throw new Error(`${key} must be configured with a non-placeholder production secret`);
    }
  }
  if (environment.ENABLE_DEMO_PAYMENT === 'true') {
    throw new Error('ENABLE_DEMO_PAYMENT must not be enabled in production');
  }
}
