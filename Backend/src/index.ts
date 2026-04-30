import app from './app';
import { connectDB } from './core/db/db.config';
import { env } from './Validator/env.validator';

app.listen(env.PORT, async () => {
  await connectDB();
  console.log(`Server is Running on Port ${env.PORT}`);
});
