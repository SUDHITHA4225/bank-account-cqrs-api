const express = require('express');
const { Pool } = require('pg');
const { randomUUID } = require('crypto');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

/* HEALTH */
app.get('/health', (req, res) => res.send('OK'));

/* SNAPSHOT */
async function createSnapshotIfNeeded(accountId) {

  const countResult = await pool.query(
    "SELECT COUNT(*) FROM events WHERE aggregate_id=$1",
    [accountId]
  );

  const eventCount = parseInt(countResult.rows[0].count);
  if (eventCount % 50 !== 0) return;

  const events = await pool.query(
    "SELECT * FROM events WHERE aggregate_id=$1 ORDER BY event_number",
    [accountId]
  );

  let balance = 0;
  let status = 'OPEN';

  events.rows.forEach(e => {
    if (e.event_type === 'MoneyDeposited')
      balance += Number(e.event_data.amount);

    if (e.event_type === 'MoneyWithdrawn')
      balance -= Number(e.event_data.amount);

    if (e.event_type === 'AccountClosed')
      status = 'CLOSED';
  });

  await pool.query(
    `INSERT INTO snapshots
     (snapshot_id, aggregate_id, snapshot_data, last_event_number)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (aggregate_id)
     DO UPDATE SET snapshot_data=$3,last_event_number=$4`,
    [randomUUID(), accountId,
     JSON.stringify({ balance, status }),
     eventCount]
  );
}

/* PROJECTION */
async function updateProjections(eventType, accountId, data) {

  if (eventType === 'AccountCreated') {
    await pool.query(
      `INSERT INTO account_summaries
      VALUES ($1,$2,$3,$4,'OPEN',1)
      ON CONFLICT DO NOTHING`,
      [accountId, data.ownerName,
       data.initialBalance || 0, data.currency]
    );
  }

  if (eventType === 'MoneyDeposited') {
    await pool.query(
      `UPDATE account_summaries
       SET balance=balance+$1,version=version+1
       WHERE account_id=$2`,
      [data.amount, accountId]
    );

    await pool.query(
      `INSERT INTO transaction_history
       VALUES ($1,$2,'DEPOSIT',$3,$4,NOW())
       ON CONFLICT DO NOTHING`,
      [data.transactionId, accountId,
       data.amount, data.description]
    );
  }

  if (eventType === 'MoneyWithdrawn') {
    await pool.query(
      `UPDATE account_summaries
       SET balance=balance-$1,version=version+1
       WHERE account_id=$2`,
      [data.amount, accountId]
    );

    await pool.query(
      `INSERT INTO transaction_history
       VALUES ($1,$2,'WITHDRAW',$3,$4,NOW())
       ON CONFLICT DO NOTHING`,
      [data.transactionId, accountId,
       data.amount, data.description]
    );
  }

  if (eventType === 'AccountClosed') {
    await pool.query(
      `UPDATE account_summaries
       SET status='CLOSED',version=version+1
       WHERE account_id=$1`,
      [accountId]
    );
  }
}

/* CREATE ACCOUNT */
app.post('/api/accounts', async (req, res) => {

  const { accountId, ownerName, initialBalance, currency } = req.body;
  if (!accountId || !ownerName || !currency)
    return res.status(400).send("Invalid request");

  const check = await pool.query(
    "SELECT 1 FROM events WHERE aggregate_id=$1 LIMIT 1",
    [accountId]
  );

  if (check.rows.length)
    return res.status(409).send("Account exists");

  await pool.query(
    `INSERT INTO events
     VALUES ($1,$2,'BankAccount','AccountCreated',$3,1,NOW(),1)`,
    [randomUUID(), accountId,
     JSON.stringify({ ownerName, initialBalance, currency })]
  );

  await updateProjections('AccountCreated', accountId,
    { ownerName, initialBalance, currency });

  await createSnapshotIfNeeded(accountId);

  res.status(202).send("Account created");
});

/* DEPOSIT */
app.post('/api/accounts/:accountId/deposit', async (req, res) => {

  const { accountId } = req.params;
  const { amount, description, transactionId } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).send("Invalid amount");

  const dup = await pool.query(
    "SELECT 1 FROM transaction_history WHERE transaction_id=$1",
    [transactionId]
  );
  if (dup.rows.length)
    return res.status(409).send("Duplicate transaction");

  const events = await pool.query(
    "SELECT COUNT(*) FROM events WHERE aggregate_id=$1",
    [accountId]
  );

  if (!events.rows.length)
    return res.status(404).send("Account not found");

  const next = parseInt(events.rows[0].count) + 1;

  await pool.query(
    `INSERT INTO events
     VALUES ($1,$2,'BankAccount','MoneyDeposited',$3,$4,NOW(),1)`,
    [randomUUID(), accountId,
     JSON.stringify({ amount, description, transactionId }),
     next]
  );

  await updateProjections('MoneyDeposited', accountId,
    { amount, description, transactionId });

  await createSnapshotIfNeeded(accountId);

  res.status(202).send("Deposit accepted");
});

/* WITHDRAW */
app.post('/api/accounts/:accountId/withdraw', async (req, res) => {

  const { accountId } = req.params;
  const { amount, description, transactionId } = req.body;

  if (!amount || amount <= 0)
    return res.status(400).send("Invalid amount");

  const dup = await pool.query(
    "SELECT 1 FROM transaction_history WHERE transaction_id=$1",
    [transactionId]
  );
  if (dup.rows.length)
    return res.status(409).send("Duplicate transaction");

  const ev = await pool.query(
    "SELECT * FROM events WHERE aggregate_id=$1",
    [accountId]
  );

  if (!ev.rows.length)
    return res.status(404).send("Account not found");

  let balance = 0;
  ev.rows.forEach(e=>{
    if(e.event_type==='MoneyDeposited')
      balance+=Number(e.event_data.amount);
    if(e.event_type==='MoneyWithdrawn')
      balance-=Number(e.event_data.amount);
  });

  if (balance < amount)
    return res.status(409).send("Insufficient funds");

  const next = ev.rows.length + 1;

  await pool.query(
    `INSERT INTO events
     VALUES ($1,$2,'BankAccount','MoneyWithdrawn',$3,$4,NOW(),1)`,
    [randomUUID(), accountId,
     JSON.stringify({ amount, description, transactionId }),
     next]
  );

  await updateProjections('MoneyWithdrawn', accountId,
    { amount, description, transactionId });

  await createSnapshotIfNeeded(accountId);

  res.status(202).send("Withdrawal accepted");
});

/* CLOSE ACCOUNT */
app.post('/api/accounts/:accountId/close', async (req,res)=>{
  const {accountId}=req.params;

  const acc=await pool.query(
    "SELECT balance FROM account_summaries WHERE account_id=$1",
    [accountId]
  );

  if(!acc.rows.length)
    return res.status(404).send("Not found");

  if(Number(acc.rows[0].balance)!==0)
    return res.status(409).send("Balance not zero");

  const ev=await pool.query(
    "SELECT COUNT(*) FROM events WHERE aggregate_id=$1",
    [accountId]
  );

  const next=parseInt(ev.rows[0].count)+1;

  await pool.query(
    `INSERT INTO events
     VALUES ($1,$2,'BankAccount','AccountClosed','{}',$3,NOW(),1)`,
    [randomUUID(),accountId,next]
  );

  await updateProjections('AccountClosed',accountId,{});
  await createSnapshotIfNeeded(accountId);

  res.status(202).send("Account closed");
});

/* ACCOUNT QUERY */
app.get('/api/accounts/:accountId',async(req,res)=>{
  const r=await pool.query(
    "SELECT * FROM account_summaries WHERE account_id=$1",
    [req.params.accountId]
  );
  if(!r.rows.length) return res.status(404).send("Not found");
  res.json(r.rows[0]);
});

/* TRANSACTIONS */
app.get('/api/accounts/:accountId/transactions', async (req, res) => {

  const { accountId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const pageSize = parseInt(req.query.pageSize) || 10;
  const offset = (page - 1) * pageSize;

  const countRes = await pool.query(
    "SELECT COUNT(*) FROM transaction_history WHERE account_id=$1",
    [accountId]
  );

  const totalCount = parseInt(countRes.rows[0].count);

  const dataRes = await pool.query(
    `SELECT transaction_id, type, amount, description, timestamp
     FROM transaction_history
     WHERE account_id=$1
     ORDER BY timestamp DESC
     LIMIT $2 OFFSET $3`,
    [accountId, pageSize, offset]
  );

  res.json({
    currentPage: page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    totalCount,
    items: dataRes.rows
  });
});

/* EVENTS STREAM */
app.get('/api/accounts/:accountId/events',async(req,res)=>{
  const r=await pool.query(
    "SELECT * FROM events WHERE aggregate_id=$1 ORDER BY event_number",
    [req.params.accountId]
  );
  res.json(r.rows);
});

/* TIME TRAVEL */
app.get('/api/accounts/:accountId/balance-at/:timestamp',async(req,res)=>{
  const r=await pool.query(
    `SELECT * FROM events
     WHERE aggregate_id=$1 AND timestamp<=$2`,
    [req.params.accountId,req.params.timestamp]
  );
  let bal=0;
  r.rows.forEach(e=>{
    if(e.event_type==='MoneyDeposited') bal+=Number(e.event_data.amount);
    if(e.event_type==='MoneyWithdrawn') bal-=Number(e.event_data.amount);
  });
  res.json({balance:bal});
});

/* REBUILD PROJECTIONS */
app.post('/api/projections/rebuild',async(req,res)=>{
  await pool.query("DELETE FROM account_summaries");
  await pool.query("DELETE FROM transaction_history");
  const ev=await pool.query("SELECT * FROM events");
  for(const e of ev.rows)
    await updateProjections(e.event_type,e.aggregate_id,e.event_data);
  res.status(202).json({message:"Projection rebuild initiated."});
});

/* PROJECTION STATUS */
app.get('/api/projections/status', async (req, res) => {

  const totalRes = await pool.query("SELECT COUNT(*) FROM events");
  const total = parseInt(totalRes.rows[0].count);
  const processed = total;

  res.json({
    totalEventsInStore: total,
    projections: [
      {
        name: "AccountSummaries",
        lastProcessedEventNumberGlobal: processed,
        lag: total - processed
      },
      {
        name: "TransactionHistory",
        lastProcessedEventNumberGlobal: processed,
        lag: total - processed
      }
    ]
  });
});

const PORT=process.env.API_PORT||8080;
app.listen(PORT,()=>console.log(`Server running on ${PORT}`));
