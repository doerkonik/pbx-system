import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  LoginDto,
  RefreshDto,
  TwoFactorCodeDto,
  TwoFactorVerifyDto,
} from './dto/auth.dto';
import { Public } from '../../common/decorators/public.decorator';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Tighter rate limit on credential-accepting endpoints (see AUTH_THROTTLE_LIMIT).
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.username, dto.password);
  }

  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  // Step 2 of a 2FA login: exchange the challenge token + code for tokens.
  @Public()
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  @Post('2fa/verify')
  @HttpCode(200)
  verifyTwoFactor(@Body() dto: TwoFactorVerifyDto) {
    return this.auth.verifyTwoFactor(dto.mfaToken, dto.code);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() user: AuthenticatedUser) {
    await this.auth.logout(user.sub);
  }

  /* --- Two-factor enrolment (authenticated) --- */

  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.twoFactorStatus(user.sub);
  }

  @Post('2fa/setup')
  @HttpCode(200)
  setupTwoFactor(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.setupTwoFactor(user.sub);
  }

  @Post('2fa/enable')
  @HttpCode(204)
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    await this.auth.enableTwoFactor(user.sub, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(204)
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    await this.auth.disableTwoFactor(user.sub, dto.code);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.auth.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
