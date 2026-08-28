import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from 'src/infra/cache/cache.constants';

interface OtpRecord {
  hash: string;
}

@Injectable()
export class OtpService {
  private readonly otpTtlSeconds = 5 * 60;
  private readonly sendLimitTtlSeconds = 10 * 60;
  private readonly verifyLimitTtlSeconds = 5 * 60;
  private readonly maxSendsPerWindow = 3;
  private readonly maxVerifyAttempts = 5;

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async sendOtp(phone: string): Promise<{ message: string }> {
    this.assertPhone(phone);

    const sendCountKey = this.sendCountKey(phone);
    const sendCount = await this.incrementCounter(sendCountKey, this.sendLimitTtlSeconds);
    if (sendCount > this.maxSendsPerWindow) {
      throw new HttpException(
        'Too many OTP requests. Please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await this.setRecord(
      this.otpKey(phone),
      { hash: this.hashOtp(phone, otp) },
      this.otpTtlSeconds,
    );
    await this.deleteKey(this.verifyCountKey(phone));

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(phone: string, otp: string): Promise<{ message: string }> {
    this.assertPhone(phone);
    if (!otp) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const verifyCountKey = this.verifyCountKey(phone);
    const verifyCount = await this.incrementCounter(verifyCountKey, this.verifyLimitTtlSeconds);
    if (verifyCount > this.maxVerifyAttempts) {
      await this.deleteKey(this.otpKey(phone));
      throw new HttpException(
        'Too many invalid OTP attempts. Please request a new OTP.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const record = await this.getRecord<OtpRecord>(this.otpKey(phone));
    if (!record || record.hash !== this.hashOtp(phone, otp)) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    await this.deleteKey(this.otpKey(phone));
    await this.deleteKey(verifyCountKey);
    return { message: 'OTP verified successfully' };
  }

  private async incrementCounter(key: string, ttlSeconds: number): Promise<number> {
    try {
      const next = await this.redis.incr(key);
      if (next === 1) {
        await this.redis.expire(key, ttlSeconds);
      }
      return next;
    } catch {
      throw new ServiceUnavailableException('OTP service is temporarily unavailable');
    }
  }

  private async getRecord<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      throw new ServiceUnavailableException('OTP service is temporarily unavailable');
    }
  }

  private async setRecord<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch {
      throw new ServiceUnavailableException('OTP service is temporarily unavailable');
    }
  }

  private async deleteKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      throw new ServiceUnavailableException('OTP service is temporarily unavailable');
    }
  }

  private hashOtp(phone: string, otp: string): string {
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
  }

  private assertPhone(phone: string): void {
    if (!phone || typeof phone !== 'string') {
      throw new BadRequestException('Phone is required');
    }
  }

  private otpKey(phone: string): string {
    return `auth:otp:${phone}`;
  }

  private sendCountKey(phone: string): string {
    return `auth:otp-send-count:${phone}`;
  }

  private verifyCountKey(phone: string): string {
    return `auth:otp-verify-count:${phone}`;
  }
}
