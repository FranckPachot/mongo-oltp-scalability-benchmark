db.accounts.ensureIndex({  
  "category": 1,  
  "operations.date": 1,  
  "operations.amount": 1  
});  

function insert(num) {
  const ops = [];
  for (let i = 0; i < num; i++) {
    const account  = Math.floor(Math.random() * 10_000_000) + 1;
    const category = Math.floor(Math.random() * 3);
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

let time1 = Date.now(); insert(10_000);              let time2 = Date.now()
let time3 = Date.now(); print(query(1).toArray()); let time4 = Date.now()

const host = db.getMongo()._uri.replace(/^mongodb:\/\/(?:[^@]+@)?([^/]+)\/.*$/, "$1").padEnd(30, ' ');
const insertTime = String(time2 - time1).padStart(6, ' ');
const queryTime  = String(time4 - time3).padStart(6, ' ');  
  
print(`Host: ${host} Insert elapsed: ${insertTime} ms Query elapsed: ${queryTime} ms`);  


//print(`Host: ${db.getMongo()._uri.replace(/^mongodb:\/\/(?:[^@]+@)?([^/]+)\/.*$/, "$1")} Batch insert elapsed: ${time2 - time1} ms Query elapsed: ${time4 - time3} ms`);  



