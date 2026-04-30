// src/modules/auth/Auth.Controller.ts

import { Request, Response } from 'express';

import { authService } from './Auth.Service';
import { AuthUtils } from './Auth.utils';
import { signupSchema } from './Auth.Validator';
import { inviteService } from '../Invite/Invite.Service';

class AuthController {
  signUp = async (req: Request, res: Response) => {
    try {
      // 1. Validate input
      const parsed = signupSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format(),
        });
      }

      const data = parsed.data;

      // 2. Check existing user (multi-tenant safe)
      const existing = await AuthUtils.findUserByEmail(data.email);

      if (existing) {
        return res.status(400).json({
          success: false,
          message: 'User already exists',
        });
      }

      // 3. Create user (via service)
      const user = await authService.createUser(data);

      // 4. Generate tokens
      const accessToken = AuthUtils.generateAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      const refreshToken = AuthUtils.generateRefreshToken({
        userId: user._id.toString(),
      });

      // 5. Response
      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user,
          accessToken,
          refreshToken,
        },
      });
    } catch (error: any) {
      console.error('Signup Error:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  signIn = async (req: Request, res: Response) => {
    try {
      const { email, password, tenantId } = req.body;

      // 1. Basic validation (can also use zod schema)
      if (!email || !password || !tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and tenantId are required',
        });
      }

      // 2. Find user
      const user = await AuthUtils.findUserByEmail(email);
      console.log(user?.role);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // 3. Check status
      AuthUtils.ensureActiveUser(user);

      // 4. Compare password
      const isMatch = await AuthUtils.comparePassword(password, user.password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      // 5. Generate tokens
      const accessToken = AuthUtils.generateAccessToken({
        userId: user._id.toString(),
        role: user.role,
      });

      const refreshToken = AuthUtils.generateRefreshToken({
        userId: user._id.toString(),
      });

      // 6. Update last seen
      await AuthUtils.updateLastSeen(user._id.toString());

      // 7. Response
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: AuthUtils.sanitizeUser(user),
          accessToken,
          refreshToken,
        },
      });
    } catch (error: any) {
      console.error('Signin Error:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };

  signUp_Invite = async (req: Request, res: Response) => {
    try {
      let { code } = req.query;

      if (!code) throw new Error('Please Provite Invite Code');

      let data = req.body;

      const parsed = signupSchema.safeParse(data);

      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          errors: parsed.error.format(),
        });
      }

      let signUp = await inviteService.acceptInvite({
        name: data.name,
        mobileNumber: data.mobileNumber,
        password: data.password,
        code: String(code),
      });

      return res.status(200).json({
        success: true,
        message: 'Congurant for joining the Company',
        data: {
          user: signUp,
        },
      });
    } catch (error) {
      console.error('SignUp Error:', error);

      return res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
}

export const authController = new AuthController();
