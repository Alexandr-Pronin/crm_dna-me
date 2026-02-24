import type { FastifyInstance } from 'fastify';
import { authService } from '../../services/authService.js';
import { recordSystemActivity } from '../../services/activityService.js';
import {
  loginSchema,
  registerSchema,
  verify2FASchema,
  validate2FASchema,
  type LoginInput,
  type RegisterInput,
  type Verify2FAInput,
  type Validate2FAInput
} from '../schemas/auth.js';
import { ValidationError, AuthenticationError } from '../../errors/index.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  
  // Register
  fastify.post<{ Body: RegisterInput }>(
    '/auth/register',
    async (request, reply) => {
      const { email, password, name, role, avatar } = request.body;

      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        throw new ValidationError('Email already in use');
      }

      const userCount = await authService.countUsers();
      const isFirstUser = userCount === 0;

      // First user is always admin and active
      // Subsequent users are 'bdr' by default (if not specified) and inactive (pending approval)
      const userRole = isFirstUser ? 'admin' : (role || 'bdr');
      const isActive = isFirstUser; // Only first user is active by default

      const passwordHash = await authService.hashPassword(password);
      const user = await authService.createUser(email, passwordHash, name, userRole, isActive, avatar ?? null);

      if (!user) {
        throw new Error('Failed to create user');
      }

      await recordSystemActivity({
        event_type: 'team_member_registered',
        event_category: 'system',
        source: 'system',
        metadata: {
          label: 'Neuer Benutzer registriert',
          team_member_id: user.id,
          team_member_email: user.email,
          team_member_name: user.name ?? undefined,
        },
      });

      const userPayload = { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar ?? undefined };

      if (!isActive) {
        return reply.code(201).send({
          message: 'Registration successful. Please wait for an administrator to approve your account.',
          user: { ...userPayload, is_active: user.is_active }
        });
      }

      // Generate token for active users
      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });

      return { user: userPayload, token };
    }
  );

  // Login
  fastify.post<{ Body: LoginInput }>(
    '/auth/login',
    async (request, reply) => {
      const { email, password } = request.body;

      const user = await authService.findUserByEmail(email);
      if (!user || !user.password_hash) {
        throw new AuthenticationError('Invalid credentials');
      }

      const isValid = await authService.verifyPassword(password, user.password_hash);
      if (!isValid) {
        throw new AuthenticationError('Invalid credentials');
      }

      if (user.is_two_factor_enabled) {
        return { require2fa: true, userId: user.id };
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return { user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar ?? undefined }, token };
    }
  );

  // 2FA Setup (Protected)
  fastify.post(
    '/auth/2fa/setup',
    {
      onRequest: [fastify.authenticate]
    },
    async (request, reply) => {
      const user = request.user as { email: string, id: string };
      const { secret, qrCodeUrl } = await authService.generate2FASecret(user.email);
      
      await authService.saveTempSecret(user.id, secret);

      return { secret, qrCodeUrl };
    }
  );

  // 2FA Verify (Enable) (Protected)
  fastify.post<{ Body: Verify2FAInput }>(
    '/auth/2fa/verify',
    {
      onRequest: [fastify.authenticate]
    },
    async (request, reply) => {
      const { token } = request.body;
      const userId = (request.user as { id: string }).id;
      
      const user = await authService.findUserById(userId);
      if (!user) {
        throw new ValidationError('User not found');
      }
      if (!user.temp_two_factor_secret) {
        throw new ValidationError('2FA setup not initiated');
      }

      const isValid = authService.verify2FAToken(token, user.temp_two_factor_secret);
      if (!isValid) {
        throw new AuthenticationError('Invalid 2FA token');
      }

      await authService.enable2FA(userId, user.temp_two_factor_secret);

      return { success: true };
    }
  );

  // 2FA Validate (Login step 2)
  fastify.post<{ Body: Validate2FAInput }>(
    '/auth/2fa/validate',
    async (request, reply) => {
      const { userId, token } = request.body;

      const user = await authService.findUserById(userId);
      if (!user || !user.is_two_factor_enabled) {
        throw new AuthenticationError('Invalid request');
      }

      if (!user.two_factor_secret) {
        throw new AuthenticationError('2FA not configured');
      }

      const isValid = authService.verify2FAToken(token, user.two_factor_secret);
      if (!isValid) {
        throw new AuthenticationError('Invalid 2FA token');
      }

      const jwtToken = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role });
      return { user: { id: user.id, email: user.email, name: user.name, role: user.role, avatar: user.avatar ?? undefined }, token: jwtToken };
    }
  );
}
