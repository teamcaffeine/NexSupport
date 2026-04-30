# 🔐 Authentication Module API Documentation

This document provides complete documentation for the authentication module based on the current implementation.

---

## 📚 Table of Contents

- [Overview](#overview)
- [Base Route](#base-route)
- [Implemented Endpoint](#implemented-endpoint)
  - [User Signup](#user-signup)
- [User Schema](#user-schema)
- [Authentication Utilities](#authentication-utilities)
- [Security Details](#security-details)
- [Indexes](#indexes)
- [Example Auth Flow](#example-auth-flow)
- [Error Response Format](#error-response-format)
- [Recommended Future Endpoints](#recommended-future-endpoints)
- [Developer Notes](#developer-notes)

---

## 🚀 Overview

This authentication module is built using:

- Express
- Mongoose
- TypeScript
- Argon2 (password hashing)
- JWT (authentication)

### ✅ Features

- User registration
- Secure password hashing
- Email normalization
- Access & refresh token generation
- User sanitization
- Role & status helpers

---

## 🌐 Base Route

```http
/auth
```

---

## 📌 Implemented Endpoint

### 🧑‍💻 User Signup

Create a new user account.

#### Endpoint

```http
POST /auth/signup
```

#### Request Body

| Field        | Type   | Required | Description       |
| ------------ | ------ | -------- | ----------------- |
| name         | string | Yes      | User full name    |
| email        | string | Yes      | User email        |
| mobileNumber | string | Yes      | Mobile number     |
| password     | string | Yes      | Plain password    |
| role         | string | No       | Default: CUSTOMER |

#### Example Request

```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "mobileNumber": "+1234567890",
  "password": "StrongPassword123!",
  "role": "CUSTOMER"
}
```

---

## ⚙️ Internal Process

1. Normalize email
2. Hash password (Argon2)
3. Generate UUID token
4. Store user in database
5. Return sanitized response

---

## ✅ Success Response

```json
{
  "_id": "6630ef5e2f3f7b9b3d44a001",
  "name": "John Doe",
  "email": "john.doe@example.com",
  "mobileNumber": "+1234567890",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "token": "uuid-token",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

## ❌ Error Responses

### 400 - Validation Error

```json
{
  "message": "Validation failed",
  "errors": {
    "email": "Invalid email"
  }
}
```

### 409 - Duplicate User

```json
{
  "message": "User already exists"
}
```

### 500 - Server Error

```json
{
  "message": "Something went wrong"
}
```

---

## 🧱 User Schema

| Field        | Type   | Notes                    |
| ------------ | ------ | ------------------------ |
| name         | String | Required                 |
| email        | String | Unique, lowercase        |
| mobileNumber | String | Required                 |
| password     | String | Hidden (`select: false`) |
| role         | String | Default: CUSTOMER        |
| status       | String | Default: ACTIVE          |
| token        | String | UUID                     |
| createdAt    | Date   | Auto                     |
| updatedAt    | Date   | Auto                     |

---

## 🛠 Authentication Utilities

### Password

- `hashPassword()`
- `comparePassword()`

### JWT

- `generateAccessToken()` → 15 min
- `generateRefreshToken()` → 7 days
- `verifyToken()`

### User Helpers

- `findUserByEmail()`
- `findUserById()`
- `ensureActiveUser()`
- `sanitizeUser()`

---

## 🔒 Security Details

- Passwords hashed with **Argon2**
- JWT secured via `JWT_SECRET`
- Sensitive fields removed before response

---

## 📊 Indexes

```js
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });
UserSchema.index({ tenantId: 1, role: 1 });
UserSchema.index({ tenantId: 1, status: 1 });
```

⚠️ **Issue:** `tenantId` is missing in schema → must be added if multi-tenant

---

## 🔄 Example Auth Flow

### Signup Flow

1. POST `/auth/signup`
2. Validate input
3. Hash password
4. Store user
5. Return response

---

## 📦 Error Format (Recommended)

```json
{
  "success": false,
  "message": "Error message",
  "errors": null
}
```

---

## 🚀 Recommended Future Endpoints

### Login

```http
POST /auth/login
```

### Refresh Token

```http
POST /auth/refresh-token
```

### Get Profile

```http
GET /auth/me
```

### Change Password

```http
POST /auth/change-password
```

### Forgot Password

```http
POST /auth/forgot-password
```

### Reset Password

```http
POST /auth/reset-password
```

### Verify Email

```http
POST /auth/verify-email
```

### Logout

```http
POST /auth/logout
```

---

## 🧠 Developer Notes

### Current Route

```ts
router.post('/auth/signup', authController.signUp);
```

### Observations

- ❌ Missing login implementation
- ❌ No validation layer
- ❌ No refresh token storage
- ❌ tenantId mismatch in schema
- ❌ crypto import not shown

---

## 🧠 Best Practices

- Add validation (Zod / Joi)
- Add global error handler
- Implement rate limiting
- Add email verification flow
- Add refresh token rotation
- Implement audit logging

---

## 📌 Summary

This auth module already provides:

- Secure password hashing
- JWT support
- Clean architecture (service + utils)
