import express, { Express } from 'express';
const app: Express = express();
import { AuthRoute } from './api/v1/Auth/Auth.routes';

app.use('/api/v1', AuthRoute);

export default app;
