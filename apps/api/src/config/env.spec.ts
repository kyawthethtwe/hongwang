import { loadEnv } from './env';

const base = {
  DATABASE_URL: 'postgres://hongwang@localhost:5433/hongwang',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};

const r2 = {
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  S3_BUCKET: 'hongwang-photos',
  S3_ACCESS_KEY_ID: 'key-id',
  S3_SECRET_ACCESS_KEY: 'secret',
  S3_PUBLIC_URL: 'https://photos.example.com',
};

describe('loadEnv: photo storage', () => {
  it('uses local disk by default in development', () => {
    expect(loadEnv(base).STORAGE_DRIVER).toBe('local');
  });

  it('refuses local disk in production, including when STORAGE_DRIVER is left unset', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/STORAGE_DRIVER: must be 's3' in production/);
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', STORAGE_DRIVER: 'local' })).toThrow(/STORAGE_DRIVER/);
  });

  it('accepts S3 in production', () => {
    const env = loadEnv({ ...base, ...r2, NODE_ENV: 'production' });
    expect(env.STORAGE_DRIVER).toBe('s3');
    expect(env.S3_REGION).toBe('auto');
  });

  it('names every missing S3 setting when STORAGE_DRIVER=s3', () => {
    const run = () => loadEnv({ ...base, ...r2, S3_BUCKET: '', S3_PUBLIC_URL: undefined });
    expect(run).toThrow(/S3_BUCKET: required when STORAGE_DRIVER=s3/);
    expect(run).toThrow(/S3_PUBLIC_URL: required when STORAGE_DRIVER=s3/);
  });
});
