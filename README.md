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

docker compose up bench

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

When you have enough data, try a secondary use case. With arrays embedded in documents, you may have to update specific items and fields. For example, let's say that the business requires that all amounts lower than 10 must be set to zero for categories higher than 1:
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
In MongoDB, this uses the existing index to find the documents to update and, within each document, updates only the necessary item. Other databases may to have update all index entries, including those that did not change.

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


