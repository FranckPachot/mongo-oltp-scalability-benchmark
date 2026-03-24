This Docker Compose setup starts:
- MongoDB (the Atlas local image)
- Oracle Database (with MongoDB compatibility via ORDS)
- DocumentDB (PostgreSQL with a MongoDB-compatible API)

The `bench.sh` script runs `bench.js` against each database and reports the elapsed time for two operations: 
 - a batch insert of documents
 - a typical OLTP query with pagination

This is similar to the benchmark described in this blog post: [How does it scale?](https://dev.to/franckpachot/how-does-it-scale-the-most-basic-benchmark-on-mongodb-p9b)

The goal is to measure scalability: verifying that query response time remains consistent as the collection grows.

Another script, `update.sh`, can be run to measure response time when updating fields, similar to the experiments described in this blog post: [Updating "denormalized" aggregates with "duplicates"](https://dev.to/franckpachot/updating-denormalized-aggregates-with-duplicates-mongodb-vs-postgresql-3bi1).

## Quick start

Start it as:
```
# start the ones you want to test
docker compose up -d mongodb
docker compose up -d documentdb
docker compose up -d oracle
# run the benchmark on those who are up
docker compose up bench 2>&1 | grep -v "getaddrinfo ENOTFOUND"

```

_Note: For the Oracle Database image, you need to_ `docker login container-registry.oracle.com` _with your Oracle SSO e-mail and secret key you get by logging in to https://container-registry.oracle.com/ and 'Auth Key' in the upper-right menu with your name. If you don't want to run Oracle, remove it from the `docker-compose.yaml` and `bench.sh`. It may take several minutes for Oracle to become available. Watch out for `ORAMLVERSION null` in the container logs. MongoDB and PostgreSQL are fast to start._

After a while, all connections are available, and the response time is displayed for each:

<img width="1066" height="764" alt="image" src="https://github.com/user-attachments/assets/7f1f38e5-6a38-4a3a-ae58-8a937f6bfe1e" />

## Query scalability

The benchmark inserts batches of 10,000 operations into 10 million random accounts, then queries the account with the most recent operation in a specific category. This is a common  OLTP scenario using filtering and pagination. As the collection grows, a complete collection scan would slow down, so secondary indexes are essential. It is created according to the MongoDB [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/?utm_campaign=devrel&utm_source=third-party-content&utm_term=franck_pachot&utm_medium=devto&utm_content=mongo-oltp-scalability-benchmark):
```
db.accounts.createIndex({
  "category": 1,
  "operations.date": 1,
  "operations.amount": 1,
});
```

With each iteration, the data size grows. The objective is to ensure that the query response time does not increase. As the dataset grows, the average number of operations per account increases, but distributing the data across 10 million accounts keeps the density low, making it representative of an OLTP query.

<img width="1015" height="852" alt="image" src="https://github.com/user-attachments/assets/0fedc9e0-fa47-4426-8d1e-ed0ea2fd0869" />

Note: the numbers in the screenshots are not representative, as all databases have been started with their default configuration. You can tune it to compare on your infrastructure. I recommend testing with replicas for high availability, as that's how OLTP should run.

## Update scalability

When you have enough data, try a secondary use case. When arrays are embedded in documents, you may need to update specific items and fields. For example, let's say that the business requires that all amounts lower than 10 must be set to zero for categories higher than 1:
```
db.accounts.updateMany(  
  {  
    category: { $gt: 1 },  
    "operations.amount": { $lt: 10 }  
  },  
  {  
    $set: {  
      "operations.$[op].amount": 0  
    }  
  },  
  {  
    arrayFilters: [  
      { "op.amount": { $lt: 10 } }  
    ]  
  }  
);  

```
In MongoDB, this uses the existing index to find the documents to update and, within each document, updates only the necessary item. Other databases may have updated all index entries, including those that did not change.

You can run it automatically on the three databases with:
```

docker compose run --rm --entrypoint bash bench /update.sh

```

Here is an example:

<img width="860" height="569" alt="image" src="https://github.com/user-attachments/assets/51724e62-ced7-4b3f-beae-7558f81dc53a" />


## Why those two queries?

In data models where application aggregates are stored as documents, you typically see those two query patterns:
- Using compound indexes to filter across one-to-many relationships, avoiding the filter-join-filter patterns of normalized models by applying selective filtering upfront, including pagination.
- Updating fields in array items across many documents, which is common when duplicated values result from “denormalization”, or simply decoupling [aggregates](https://martinfowler.com/bliki/DDD_Aggregate.html) in Domain-Driven Design.

This small benchmark validates that those two patterns scale when the collection grows.


## Managed services

You can use `bench.js` to run it directly with a managed service, for example, here is a run on Amazon DocumentDB:
```
while true
do
 mongosh docdb-2026-03-10-20-05-55.cluster-cywlwrcont2f.us-east-1.docdb.amazonaws.com:27017 --tls --tlsCAFile global-bundle.pem --retryWrites=false --username franck --password xxx mongo-oltp-scalability-benchmark/bench.js
done
```
<img width="1190" height="785" alt="image" src="https://github.com/user-attachments/assets/afe37802-bece-4baf-9231-1e41c8df3c18" />

This was run on Amazon DocumentDB 8.0 with the Query Planner Version 3:

```
  executionStats: {
    executionSuccess: true,
    executionTimeMillis: '1532.959',
    planningTimeMillis: '0.087',
    executionStages: {
      stage: 'SUBSCAN',
      nReturned: '1',
      executionTimeMillisEstimate: '1532.817',
      inputStage: {
        stage: 'LIMIT_SKIP',
        nReturned: '1',
        executionTimeMillisEstimate: '1532.794',
        inputStage: {
          stage: 'SORT',
          nReturned: '1',
          executionTimeMillisEstimate: '1532.792',
          sortPattern: { 'operations.date': -1 },
          inputStage: {
            stage: 'FETCH',
            nReturned: '309964',
            executionTimeMillisEstimate: '999.059',
            inputStage: {
              stage: 'IXSCAN',
              nReturned: '325926',
              executionTimeMillisEstimate: '70.678',
              indexName: 'category_1_operations.date_1_operations.amount_1',
              indexCond: { '$and': [ { category: { '$eq': 1 } } ] }
            }
          }
        }
      }
    }
  },

```

Here, the index filters on `{ category: 1 }`, but all matching documents are still fetched and sorted for pagination, so response time grows with the collection size.

## Duality Views

Oracle Database can store documents in a relational format. I tried as:
```
CREATE TABLE accounts (
    account_id NUMBER PRIMARY KEY,
    category   NUMBER NOT NULL
);

CREATE TABLE operations (
    operation_id NUMBER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    account_id   NUMBER NOT NULL,
    op_date      TIMESTAMP WITH TIME ZONE NOT NULL,
    amount       NUMBER NOT NULL,
    CONSTRAINT fk_ops_account
        FOREIGN KEY (account_id) REFERENCES accounts(account_id)
);

-- Filter by category
CREATE INDEX idx_accounts_category
ON accounts(category)
;

-- Sort and limit by latest operation
CREATE INDEX idx_ops_account_date_amount
ON operations(account_id, op_date DESC, amount)
;

CREATE OR REPLACE JSON RELATIONAL DUALITY VIEW "accounts" AS
SELECT JSON {
    '_id'        : a.account_id,
    'category'   : a.category,
    'operations' : [
        SELECT JSON {
            '_id'    : o.operation_id,
            'date'   : o.op_date,
            'amount' : o.amount
        }
        FROM operations o
        WITH INSERT UPDATE DELETE
        WHERE o.account_id = a.account_id
    ]
}
FROM accounts a
WITH INSERT UPDATE DELETE;
```

This doesn't solve the indexing problem, as you have to create one index per table, and anyway, the upsert to add operatios to the account fails:
```
Write Errors: [
  WriteError {
    err: {
      index: 0,
      code: 3037,
      errmsg: 'upsert option is not supported on duality view collections.',
      errInfo: undefined,
      op: {
        q: { _id: 6954073 },
        u: {
          '$set': { category: 0 },
          '$push': {
            operations: { date: ISODate('2026-03-12T08:17:22.787Z'), amount: 544 }
          }
        },
        upsert: true
      }
    }
  }
]
```

The updateMany also fails: `arrayFilters option is not supported on duality view collections`.
