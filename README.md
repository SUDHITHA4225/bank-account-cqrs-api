# Bank Account Management API (Event Sourcing + CQRS)

## Overview
This project implements a **Bank Account Management System** using **Event Sourcing** and **Command Query Responsibility Segregation (CQRS)**.

Instead of storing only the current state, all changes are recorded as immutable events. Read models are built using projections, enabling fast queries and complete auditability.

---

## Architecture

### Event Sourcing
- All state changes are stored in the `events` table.
- The current state of an account is reconstructed by replaying events.
- Snapshots are created after every **50 events** to optimize performance.

### CQRS (Command Query Responsibility Segregation)
- **Command Side (Write Model):**
  - Handles account creation, deposits, withdrawals, and closure.
  - Stores events in the event store.

- **Query Side (Read Model):**
  - Uses projection tables:
    - `account_summaries`
    - `transaction_history`
  - Provides fast and optimized read operations.

---

## Tech Stack

- Node.js (Express)
- PostgreSQL
- Docker & Docker Compose

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
│ └── 001_schema.sql
│
└── src/
└── index.js
```

---

## Setup & Run

### 1. Start the application

```
docker-compose up --build
```

### 2. API Base URL

The API will be available at:
```
http://localhost:8080
```

---

## Environment Variables
Example .env.example:

```
API_PORT=8080
DATABASE_URL=postgresql://user:password@db:5432/bank_db
DB_USER=user
DB_PASSWORD=password
DB_NAME=bank_db
```

---

## API Endpoints

### Command Endpoints (Write)

|  **Method**  |         **Endpoint**           |	  **Description**       |
|--------------|--------------------------------|-------------------------- |
|POST	       |   /api/accounts	            |      Create account       |
|POST	       |  /api/accounts/{id}/deposit	|      Deposit money        |
|POST	       |  /api/accounts/{id}/withdraw   |      Withdraw money       |
|POST	       |  /api/accounts/{id}/close	    |      Close account        |

---
## Query Endpoints (Read)

| Method | Endpoint                                  | Description                |
| ------ | ----------------------------------------- | -------------------------- |
| GET    | /api/accounts/{id}                        | Get account summary        |
| GET    | /api/accounts/{id}/transactions           | Get paginated transactions |
| GET    | /api/accounts/{id}/events                 | Get event stream           |
| GET    | /api/accounts/{id}/balance-at/{timestamp} | Time-travel balance        |

---

## Administrative Endpoints

| Method | Endpoint                 | Description         |
| ------ | ------------------------ | ------------------- |
| POST   | /api/projections/rebuild | Rebuild projections |
| GET    | /api/projections/status  | Projection status   |

---

## Snapshot Strategy

    - A snapshot is created after every 50 events.
    - Stored in the snapshots table.
    - Helps avoid replaying the entire event stream.

---

## Example Usage
### Create Account
```
curl -X POST http://localhost:8080/api/accounts \
-H "Content-Type: application/json" \
-d '{"accountId":"acc-test-12345","ownerName":"Jane Doe","initialBalance":0,"currency":"USD"}'
```

### Deposit Money
```
curl -X POST http://localhost:8080/api/accounts/acc-test-12345/deposit \
-H "Content-Type: application/json" \
-d '{"amount":100,"description":"deposit","transactionId":"tx1"}'
```

### Get Account
```
curl http://localhost:8080/api/accounts/acc-test-12345
```

---

## Key Features

- Event-sourced architecture
- CQRS pattern implementation
- Time-travel queries
- Snapshot optimization
- Idempotent transactions
- Fully containerized deployment

---

## How It Works

1. Commands generate events.
2. Events are stored in the event store.
3. Projections update read models.
4. Queries read from optimized projections.
5. Snapshots reduce replay cost.

---

## Conclusion
This system demonstrates how Event Sourcing + CQRS can be used to build scalable, auditable, and reliable backend systems for financial applications.