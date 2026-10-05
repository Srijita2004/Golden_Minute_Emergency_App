# Admin Dashboard & Governance Setup

The **Admin Portal** provides authorized administrators with platform-wide health monitoring, device fleet status, user management, and audit logging.

---

## 1. Role-Based Access Control (RBAC)

* The system enforces two roles: `USER` and `ADMIN`.
* All administrative API endpoints under `/api/admin/*` require an authenticated session where `user.role == "ADMIN"`.
* If a normal user accesses an admin endpoint, the server returns `HTTP 403 Forbidden`.

---

## 2. Zero-Secrets Exposure Principle (CRITICAL)

To maintain absolute user privacy and meet cryptographic compliance standards:
* **Passwords**: Password hashes (`hashed_password`) are never sent in any administrative API response.
* **Tokens**: Password reset tokens and refresh tokens are excluded from user serialization models.
* **Device Secrets**: Device pairing codes and cryptographic hardware keys are never exposed in administrative device lists.

---

## 3. Administrative Capabilities

1. **System Health Metrics**:
   * Total registered users and active accounts
   * Total registered devices, connected devices, and offline devices
   * Total emergency incidents and active critical hazards
   * Pipeline operational status
2. **User Management**:
   * Filter and search users by name, email, or User ID
   * View user status, registered device count, and incident count
3. **Device Inventory**:
   * Monitor online/offline status, battery levels, last seen timestamps, and connection types (BLE / Wi-Fi)
4. **Audit Trail**:
   * Immutable audit logs recording administrative and user actions with actor User ID, IP address, and timestamp.
