# Authentication & Authorization (RBAC) Architecture

The security architecture guarantees that user credentials are protected with industry-standard cryptographic techniques, and device/incident data is isolated per account.

---

## 1. Authentication Specifications

* **Password Hashing**: `bcrypt` with work factor (salt rounds) = 12. Plain-text passwords are never persisted to disk or logs.
* **Token Standard**: JSON Web Tokens (JWT) signed via HMAC-SHA256 (`HS256`).
  * `access_token`: Short-lived (default 24 hours), contains `sub` (User ID), `email`, and `role`.
  * `refresh_token`: Long-lived (7 days), stored securely to refresh access tokens without re-authenticating.
* **User ID Generation**: Sequential identity tags (`USER-001`, `USER-002`, `USER-003`).

---

## 2. API Endpoints

### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "StrongPassword123!",
  "confirm_password": "StrongPassword123!"
}
```
* **Validation**: Email format validation, duplicate email prevention, password minimum length (8 chars), confirmation match check.

### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "jane@example.com",
  "password": "StrongPassword123!"
}
```
* **Response**: Returns JWT `access_token`, `refresh_token`, and user profile.

---

## 3. Account Isolation & Authorization Rules

1. Normal users can only view their own registered devices (`WHERE owner_user_id = current_user.user_id`).
2. If a user attempts to access another user's device (`GET /api/devices/{foreign_id}`), the backend immediately raises an `HTTP 403 Forbidden` response.
3. Incidents and detection events are strictly tied to the owner's account.
