import { UserModel } from './Auth.Schema';
import { CreateUserInput } from './Auth.types';
import { AuthUtils } from './Auth.utils';

class AuthService {
  static async createUser(data: CreateUserInput ) {
    // Normalize email
    const email = AuthUtils.normalizeEmail(data.email);

    // Hash password
    const hashedPassword = await AuthUtils.hashPassword(data.password);

    // Generate internal token (can be used for verification / session)
    const token = crypto.randomUUID();

    const user = await UserModel.create({
      name: data.name,
      email,
      password: hashedPassword,
      tenantId: data.tenantId,
      mobileNumber: data.mobileNumber,
      role: data.role,
      token,
    });

    return AuthUtils.sanitizeUser(user);
  }
}


export let authService = new AuthService()