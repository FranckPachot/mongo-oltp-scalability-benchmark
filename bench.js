try {
  db.adminCommand({ ping: 1 });
} catch (e) {
  print("Connection not ready: " + e.message);
  quit(1);
}

const BATCH_SIZE    = parseInt(process.env.BATCH_SIZE    || "10000");
const ACCOUNT_RANGE = parseInt(process.env.ACCOUNT_RANGE || "10000000");
const CATEGORIES    = parseInt(process.env.CATEGORIES    || "3");

db.accounts.createIndex({
  "category": 1,
  "operations.date": 1,
});

function insert(num) {
  const ops = [];
  for (let i = 0; i < num; i++) {
    const account  = Math.floor(Math.random() * ACCOUNT_RANGE) + 1;
    const category = Math.floor(Math.random() * CATEGORIES);
    const operation = {
      date: new Date(),
      amount: Math.floor(Math.random() * 10000) + 1,
    };
    ops.push({
      updateOne: {
        filter: { _id: account },
        update: {
          $set: { category: category },
          $push: { operations: operation },
        },
        upsert: true,
      }
    });
  }
  db.accounts.bulkWrite(ops);
}

function query(category) {
  return db.accounts.find(
    { category: category },
    { "operations.amount": 1 , "operations.date": 1 }
  ).sort({ "operations.date": -1 })
   .limit(1);
}

let time1 = Date.now(); insert(BATCH_SIZE);          let time2 = Date.now()
let time3 = Date.now(); print(query(1).toArray()); let time4 = Date.now()
let count = db.accounts.estimatedDocumentCount();

const host = db.getMongo()._uri.replace(/^mongodb:\/\/(?:[^@]+@)?([^/]+)\/.*$/, "$1").padEnd(30, ' ');
const insertTime = String(time2 - time1).padStart(6, ' ');
const queryTime  = String(time4 - time3).padStart(6, ' ');

print(`Host: ${host} Insert elapsed: ${insertTime} ms (${count} docs) Query elapsed: ${queryTime} ms `);
