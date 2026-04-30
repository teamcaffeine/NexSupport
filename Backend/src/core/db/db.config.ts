import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from '../../Validator/env.validator';

let mongo: MongoMemoryServer | null = null;

// ================== DB CONFIG ==================

export const connectDB = async () => {
  try {
    let uri: string;

    const isTestEnv = env.NODE_ENV === 'test';

    console.log('NODE_ENV:', env.NODE_ENV);

    if (isTestEnv) {
      mongo = await MongoMemoryServer.create({
        binary: {
          version: '6.0.6',
        },
      });

      uri = mongo.getUri();

      console.log('Using MongoMemoryServer:', uri);
    } else {
      uri = env.MONGODB_URL;

      console.log('Using REAL MongoDB:', uri);
    }

    await mongoose.connect(uri).then(() => {
      console.log('MongoDB connected successfully');
    });
  } catch (err) {
    console.error('Mongo setup failed:', err);
    throw err;
  }
};

export const disconnectDB = async () => {
  await mongoose.connection.close();

  if (mongo) {
    await mongo.stop();
    mongo = null;
    console.log('MongoMemoryServer stopped');
  }
};

export const DropDB = async () => {
  await mongoose.connection.dropDatabase();
};
