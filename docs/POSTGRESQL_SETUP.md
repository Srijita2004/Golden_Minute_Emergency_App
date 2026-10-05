# PostgreSQL Database Setup & Production Migration Guide

The **AI-Based Accident Detection & Emergency Response System** is designed natively for **PostgreSQL 13+** for high-volume concurrent incident handling, idempotent transaction logs, and spatial location queries.

---

## 1. Create PostgreSQL Database

Open `psql` or pgAdmin as the postgres superuser:

```sql
CREATE DATABASE accident_db;
CREATE USER accident_admin WITH ENCRYPTED PASSWORD 'StrongEmergencyPassword123!';
GRANT ALL PRIVILEGES ON DATABASE accident_db TO accident_admin;
```

---

## 2. Execute Schema DDL Script

The full production DDL with primary keys, foreign keys, cascade rules, check constraints, and performance indexes is provided in:
[`backend/app/database/schema.sql`](file:///backend/app/database/schema.sql)

Run the script against your database:
```bash
psql -U accident_admin -d accident_db -f backend/app/database/schema.sql
```

---

## 3. Configure Backend Connection

In `backend/.env`, set `DATABASE_URL`:
```env
DATABASE_URL=postgresql://accident_admin:StrongEmergencyPassword123!@localhost:5432/accident_db
```

SQLAlchemy will automatically connect with `pool_pre_ping=True` and connection pooling enabled.

---

## 4. Run Initial Seeding

```bash
cd backend
python -m app.database.init_db
```

This populates the initial admin role, admin credentials, demo user, and seed devices directly in your PostgreSQL database.
