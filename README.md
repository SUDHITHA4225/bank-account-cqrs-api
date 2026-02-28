# Bank Account Management API  
## Event Sourcing + CQRS Implementation

---

## Overview

This project implements a Bank Account Management API using **Event Sourcing** and **Command Query Responsibility Segregation (CQRS)**.

Instead of storing only the latest account state, every change is persisted as an immutable event. Read-optimized projections are built from these events, allowing efficient queries while maintaining full auditability.

---

## Architecture

### Event Sourcing

- All state changes are stored in the `events` table.
- Account state is reconstructed by replaying events.
- Events are immutable and sequentially ordered.
- Time-travel queries are supported.
- Snapshots are created after every 50 events to improve replay performance.

### CQRS

#### Command Side (Write Model)
- Handles:
  - Account creation
  - Deposit
  - Withdrawal
  - Account closure
- Validates business rules
- Persists domain events to the event store

#### Query Side (Read Model)
- Uses projection tables:
  - `account_summaries`
  - `transaction_history`
- Serves optimized read requests
- Can be fully rebuilt from the event store

---

## Technology Stack

- Node.js (Express)
- PostgreSQL
- Docker
- Docker Compose

---

## Project Structure

```
bank-account-cqrs-api/
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── submission.json
├── README.md
│
├── seeds/
│   └── 001_schema.sql
│
└── src/
    └── index.js
```

---

## Running the Application

### Start Containers

```bash
docker-compose up -d --build
```

Check running containers:

```bash
docker ps
```

API Base URL:

```
http://localhost:8080
```

---

## Demo Flow (Used in Recording)

### 1. Create Account

```bash
curl -X POST http://localhost:8080/api/accounts \
-H "Content-Type: application/json" \
-d '{"accountId":"acc-demo-1","ownerName":"John","initialBalance":0,"currency":"USD"}'
```

### 2. Deposit Money

```bash
curl -X POST http://localhost:8080/api/accounts/acc-demo-1/deposit \
-H "Content-Type: application/json" \
-d '{"amount":100,"description":"deposit","transactionId":"tx1"}'
```

### 3. Withdraw Money

```bash
curl -X POST http://localhost:8080/api/accounts/acc-demo-1/withdraw \
-H "Content-Type: application/json" \
-d '{"amount":50,"description":"withdraw","transactionId":"tx2"}'
```

### 4. Get Current Account State (Projection)

```bash
curl http://localhost:8080/api/accounts/acc-demo-1
```

### 5. Retrieve Event Stream

```bash
curl http://localhost:8080/api/accounts/acc-demo-1/events
```

### 6. Time-Travel Query

Before any events:

```bash
curl http://localhost:8080/api/accounts/acc-demo-1/balance-at/2026-02-28T04:30:00Z
```

Between deposit and withdrawal:

```bash
curl http://localhost:8080/api/accounts/acc-demo-1/balance-at/2026-02-28T04:33:10Z
```

### 7. Projection Rebuild

Delete projections manually:

```bash
docker exec -it bank-account-cqrs-api-main-db-1 psql -U user -d bank_db
```

Inside psql:

```sql
DELETE FROM account_summaries;
DELETE FROM transaction_history;
\q
```

Trigger rebuild:

```bash
curl -X POST http://localhost:8080/api/projections/rebuild
```

Verify:

```bash
curl http://localhost:8080/api/accounts/acc-demo-1
```

---

## API Endpoints

### Command Endpoints

| Method | Endpoint                        | Description |
|--------|--------------------------------|-------------|
| POST   | /api/accounts                   | Create account |
| POST   | /api/accounts/{id}/deposit      | Deposit money |
| POST   | /api/accounts/{id}/withdraw     | Withdraw money |
| POST   | /api/accounts/{id}/close        | Close account |

### Query Endpoints

| Method | Endpoint                                   | Description |
|--------|--------------------------------------------|-------------|
| GET    | /api/accounts/{id}                         | Account summary |
| GET    | /api/accounts/{id}/transactions            | Transaction history |
| GET    | /api/accounts/{id}/events                  | Event stream |
| GET    | /api/accounts/{id}/balance-at/{timestamp}  | Time-travel balance |

### Administrative Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST   | /api/projections/rebuild | Rebuild read models |
| GET    | /api/projections/status  | Projection status |

---

## Snapshot Strategy

- A snapshot is created after every 50 events.
- Stored in the `snapshots` table.
- Reduces aggregate reconstruction time.

---

## Processing Flow

1. Client sends a command.
2. Command is validated.
3. An event is generated and stored.
4. Projections update read models.
5. Queries read from projection tables.
6. Snapshots optimize replay performance.

---

## Summary

This implementation demonstrates a practical application of Event Sourcing and CQRS for building scalable, auditable, and reliable financial backend systems.

