This Docker Compose starts MongoDB, Oracle Database (with MongoDB compatibility though ORDS), and DocumentDB (postgreSQL with the MongoDB compatible API)

The script [bench.sh](./bench.sh) runs [bench.js](./bench.js) on each database and shows the elapsed time for a batch insert of documents, and a query (similar to [this blog post](https://dev.to/franckpachot/how-does-it-scale-the-most-basic-benchmark-on-mongodb-p9b)). The goal is to verify scalability: the query response time remains consistent as the collection grows.

Start it as:
```

docker compose up bench

```
It may take time for Oracle to become available, as it takes a while to start.

After a while, all connections are available, and the response time is displayed for each:

<img width="1066" height="764" alt="image" src="https://github.com/user-attachments/assets/7f1f38e5-6a38-4a3a-ae58-8a937f6bfe1e" />

The benchmark inserts batches of 10,000 operations into 10 million random accounts, then queries the account with the most recent operation in a specific category. This is a common  OLTP scenario using filtering and pagination. As the collection grows, a complete collection scan would slow down, so secondary indexes are essential. It is created as:
```
db.accounts.createIndex({
  "category": 1,
  "operations.date": 1,
  "operations.amount": 1,
});
```

With each iteration, the data size grows. The objective is to ensure that the query response time does not increase. As the dataset grows, the average number of operations per account increases, but distributing the data across 10 million accounts keeps the density low, making it representative of an OLTP query.

<img width="1015" height="852" alt="image" src="https://github.com/user-attachments/assets/0fedc9e0-fa47-4426-8d1e-ed0ea2fd0869" />

Note: the numbers in the screenshots are not representative as all databases have been started with their default configuration. You can tune it to compare on your infrastructure.




