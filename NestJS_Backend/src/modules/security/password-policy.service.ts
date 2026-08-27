import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasswordPolicyConfig, SecurityConfig } from '../../config/configuration';

/**
 * Central password-policy enforcement (Module 10). Every path that sets a
 * password (user create/update, admin reset, self change-password) runs
 * `assertValid` so the rules live in exactly one place and are configurable via
 * env (PASSWORD_MIN_LENGTH / PASSWORD_REQUIRE_*).
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly config: ConfigService) {}

  policy(): PasswordPolicyConfig {
    return this.config.get<SecurityConfig>('security')!.passwordPolicy;
  }

  /** Throws BadRequestException listing every rule the password fails. */
  assertValid(password: string): void {
    const p = this.policy();
    const errors: string[] = [];

    if (!password || password.length < p.minLength) {
      errors.push(`be at least ${p.minLength} characters`);
    }
    if (p.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('contain an uppercase letter');
    }
    if (p.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('contain a lowercase letter');
    }
    if (p.requireNumber && !/[0-9]/.test(password)) {
      errors.push('contain a number');
    }
    if (p.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
      errors.push('contain a symbol');
    }

    if (errors.length > 0) {
      throw new BadRequestException(`Password must ${errors.join(', ')}.`);
    }
  }
}
