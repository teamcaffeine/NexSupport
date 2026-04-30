import app from './app';
import { env } from './Validator/env.validator';

app.listen(env.PORT, () => {
  console.log(`Server is Running on Port ${env.PORT}`);
});
