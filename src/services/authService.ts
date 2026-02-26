import bcrypt from 'bcryptjs';
import { OTP } from 'otplib';
const authenticator = new OTP();
import QRCode from 'qrcode';
import { db } from '../db/index.js';
import type { TeamMember } from '../types/index.js';


export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  async generate2FASecret(email: string) {
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.generateURI({ label: email, issuer: 'DNA Marketing Engine', secret });
    const qrCodeUrl = await QRCode.toDataURL(otpauth);
    return { secret, qrCodeUrl };
  }

  verify2FAToken(token: string, secret: string): boolean {
    try {
      const result = authenticator.verifySync({ token, secret });
      return result && typeof result === 'object' && 'valid' in result ? result.valid : false;
    } catch (err) {
      console.error('2FA Verification Error:', err);
      return false;
    }
  }

  async enable2FA(userId: string, secret: string) {
    await db.query(
      'UPDATE team_members SET two_factor_secret = $1, is_two_factor_enabled = true, temp_two_factor_secret = NULL WHERE id = $2',
      [secret, userId]
    );
  }

  async saveTempSecret(userId: string, secret: string) {
    await db.query(
      'UPDATE team_members SET temp_two_factor_secret = $1 WHERE id = $2',
      [secret, userId]
    );
  }

  async countUsers(): Promise<number> {
    const res = await db.queryOne<{ count: string }>('SELECT COUNT(*) as count FROM team_members');
    return parseInt(res?.count || '0', 10);
  }

  async createUser(
    email: string,
    passwordHash: string,
    name: string,
    role: string,
    isActive: boolean = true,
    avatar: string | null = null
  ) {
    const user = await db.queryOne<TeamMember>(
      'INSERT INTO team_members (email, password_hash, name, role, is_active, avatar) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [email, passwordHash, name, role, isActive, avatar]
    );
    return user;
  }

  async findUserByEmail(email: string) {
    const user = await db.queryOne<TeamMember>('SELECT * FROM team_members WHERE email = $1', [email]);
    return user;
  }

  async findUserById(id: string) {
    const user = await db.queryOne<TeamMember>('SELECT * FROM team_members WHERE id = $1', [id]);
    return user;
  }
}

export const authService = new AuthService();
