import { Global, Module } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';

/**
 * Shared security primitives (Module 10). Global so any module that sets a
 * password can inject PasswordPolicyService without re-importing.
 */
@Global()
@Module({
  providers: [PasswordPolicyService],
  exports: [PasswordPolicyService],
})
export class SecurityModule {}
