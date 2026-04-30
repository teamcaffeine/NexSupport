import { Router } from 'express';
import { authController } from './Auth.controller';

const router: Router = Router();

router.post('/auth/signup', authController.signUp);

router.post('/auth/signUp/invite', authController.signUp_Invite);

export { router as AuthRoute };
