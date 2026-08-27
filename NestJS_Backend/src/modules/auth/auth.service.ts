import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities';
import { JwtConfig } from '../../config/configuration';
import { PasswordPolicyService } from '../security/password-policy.service';
import {
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from '../../common/utils/totp';

/** Label shown for this system inside authenticator apps. */
const TOTP_ISSUER = 'PBX Suite';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: {
    id: string;
    username: string;
    role: string;
    extension: string | null;
    fullName: string | null;
  };
}

/** Returned by login when the account has 2FA enabled — step 1 of 2. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  mfaToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  private jwtCfg(): JwtConfig {
    return this.config.get<JwtConfig>('jwt')!;
  }

  async validateUser(username: string, password: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.username = :username', { username })
      .getOne();

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(
    username: string,
    password: string,
  ): Promise<AuthResult | TwoFactorChallenge> {
    const user = await this.validateUser(username, password);
    if (user.twoFactorEnabled) {
      const mfaToken = await this.jwt.signAsync(
        { sub: user.id, type: '2fa' },
        { secret: this.jwtCfg().accessSecret, expiresIn: '5m' },
      );
      return { twoFactorRequired: true, mfaToken };
    }
    return this.issueFor(user);
  }

  /* --------------------------- Two-factor auth ------------------------- */

  /** Load a user including the normally-hidden TOTP secret. */
  private loadWithSecret(userId: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('u')
      .addSelect('u.twoFactorSecret')
      .where('u.id = :id', { id: userId })
      .getOne();
  }

  /** Step 2 of login: verify the challenge token + TOTP code, issue tokens. */
  async verifyTwoFactor(mfaToken: string, code: string): Promise<AuthResult> {
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(mfaToken, {
        secret: this.jwtCfg().accessSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }
    if (payload.type !== '2fa') {
      throw new UnauthorizedException('Invalid token type');
    }
    const user = await this.loadWithSecret(payload.sub);
    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Two-factor auth is not enabled');
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    return this.issueFor(user);
  }

  /** Provision a new secret (not yet active). Returns the otpauth URI to scan. */
  async setupTwoFactor(
    userId: string,
  ): Promise<{ secret: string; otpauthUri: string }> {
    const user = await this.loadWithSecret(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled) {
      throw new BadRequestException(
        'Two-factor auth is already enabled; disable it first to re-provision',
      );
    }
    const secret = generateTotpSecret();
    await this.users.update(userId, { twoFactorSecret: secret });
    return { secret, otpauthUri: otpauthUri(secret, user.username, TOTP_ISSUER) };
  }

  /** Confirm the first code to activate 2FA on the account. */
  async enableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.loadWithSecret(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor auth is already enabled');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Call /auth/2fa/setup before enabling');
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.users.update(userId, { twoFactorEnabled: true });
  }

  /** Turn 2FA off (requires a valid current code) and wipe the secret. */
  async disableTwoFactor(userId: string, code: string): Promise<void> {
    const user = await this.loadWithSecret(userId);
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Two-factor auth is not enabled');
    }
    if (!verifyTotp(user.twoFactorSecret, code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    await this.users.update(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
    });
  }

  async twoFactorStatus(userId: string): Promise<{ enabled: boolean }> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return { enabled: user.twoFactorEnabled };
  }

  private async issueFor(user: User): Promise<AuthResult> {
    const cfg = this.jwtCfg();
    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        username: user.username,
        role: user.role,
        extension: user.extension,
        type: 'access',
      },
      { secret: cfg.accessSecret, expiresIn: cfg.accessTtl },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, username: user.username, type: 'refresh' },
      { secret: cfg.refreshSecret, expiresIn: cfg.refreshTtl },
    );

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.users.update(user.id, { refreshTokenHash });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        extension: user.extension,
        fullName: user.fullName,
      },
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const cfg = this.jwtCfg();
    let payload: { sub: string; type: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: cfg.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.refreshTokenHash')
      .where('u.id = :id', { id: payload.sub })
      .getOne();

    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Session no longer valid');
    }
    const ok = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!ok) throw new UnauthorizedException('Refresh token revoked');

    // Rotate.
    return this.issueFor(user);
  }

  async logout(userId: string): Promise<void> {
    await this.users.update(userId, { refreshTokenHash: null });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.id = :id', { id: userId })
      .getOne();
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');
    this.passwordPolicy.assertValid(newPassword);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.update(userId, { passwordHash, refreshTokenHash: null });
  }
}
