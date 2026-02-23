
# Bank Account Management API using Event Sourcing and CQRS

## Overview
This project presents a **Bank Account Management API** built using **Event Sourcing** and **Command Query Responsibility Segregation (CQRS)** patterns.

Rather than persisting only the latest state, every change to an account is recorded as an immutable event. Read-optimized models are generated through projections, allowing efficient queries while maintaining a complete audit trail.

---

## Architecture

### Event Sourcing
- All domain changes are persisted as events in the `events` table.
- Account state is derived by replaying events in sequence.
- To improve performance, snapshots are generated after every **50 events**.

### CQRS (Command Query Responsibility Segregation)
- **Command Layer (Write Side):**
  - Processes account creation, deposits, withdrawals, and account closure.
  - Persists validated domain events into the event store.

- **Query Layer (Read Side):**
  - Uses projection tables:
    - `account_summaries`
    - `transaction_history`
  - Designed for fast and efficient read operations.

---

## Technology Stack

- Node.js with Express
- PostgreSQL
- Docker and Docker Compose

---

## Project Structure
```

bank-es-cqrs/
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

## Setup and Execution

### Start the application
```

docker-compose up --build

```

### API Base URL
Once started, the API is accessible at:
```

[http://localhost:8080](http://localhost:8080)

```

---

## Environment Configuration
Sample environment variables are provided in `.env.example`:

```

API_PORT=8080
DATABASE_URL=postgresql://user:password@db:5432/bank_db
DB_USER=user
DB_PASSWORD=password
DB_NAME=bank_db

```

---

## API Endpoints

### Command Endpoints (Write Operations)

| Method | Endpoint                       | Description        |
|------- |--------------------------------|--------------------|
| POST   | /api/accounts                  | Create account     |
| POST   | /api/accounts/{id}/deposit     | Deposit funds      |
| POST   | /api/accounts/{id}/withdraw    | Withdraw funds     |
| POST   | /api/accounts/{id}/close       | Close account      |

---

## Query Endpoints (Read Operations)

| Method | Endpoint                                   | Description                 |
|------- |-------------------------------------------|-----------------------------|
| GET    | /api/accounts/{id}                         | Fetch account summary       |
| GET    | /api/accounts/{id}/transactions            | Retrieve transactions       |
| GET    | /api/accounts/{id}/events                  | Retrieve event history      |
| GET    | /api/accounts/{id}/balance-at/{timestamp}  | Balance at specific time    |

---

## Administrative Endpoints

| Method | Endpoint                  | Description                |
|------- |---------------------------|----------------------------|
| POST   | /api/projections/rebuild  | Rebuild all projections    |
| GET    | /api/projections/status   | View projection status     |

---

## Snapshot Strategy
- A snapshot is created after every **50 events**.
- Snapshots are stored in the `snapshots` table.
- This minimizes the cost of replaying long event streams.

---

## Example Requests

### Create Account
```

curl -X POST [http://localhost:8080/api/accounts](http://localhost:8080/api/accounts) 
-H "Content-Type: application/json" 
-d '{"accountId":"acc-test-12345","ownerName":"Jane Doe","initialBalance":0,"currency":"USD"}'

```

### Deposit Funds
```

curl -X POST [http://localhost:8080/api/accounts/acc-test-12345/deposit](http://localhost:8080/api/accounts/acc-test-12345/deposit) 
-H "Content-Type: application/json" 
-d '{"amount":100,"description":"deposit","transactionId":"tx1"}'

```

### Get Account Details
```

curl [http://localhost:8080/api/accounts/acc-test-12345](http://localhost:8080/api/accounts/acc-test-12345)

```

---

## Key Capabilities

- Event-driven persistence model
- Clear separation of read and write concerns
- Support for time-based state reconstruction
- Snapshot-based optimization
- Idempotent transaction handling
- Fully containerized deployment

---

## Processing Flow

1. Client sends a command request.
2. The command is validated and converted into an event.
3. Events are stored in the event store.
4. Projection handlers update read models.
5. Queries are served from projection tables.
6. Snapshots reduce event replay overhead.

---

## Summary
This project demonstrates a practical implementation of **Event Sourcing** and **CQRS**, showcasing how these patterns can be applied to build scalable, auditable, and reliable backend systems, particularly for financial and transaction-heavy applications.


