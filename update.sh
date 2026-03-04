
update='
let time1 = Date.now();
print(

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
)

);
let time2 = Date.now();
const execTime  = String(time2 - time1).padStart(6, " ");
const host = db.getMongo()._uri.replace(/^mongodb:\/\/(?:[^@]+@)?([^/]+)\/.*$/, "$1").padEnd(30, " ");
print(`Host: ${host} - elapsed: ${execTime} ms`);
'

mongosh --quiet 'mongodb://mongodb:27017' --eval "$update" | 
 sed -e '/elapsed/s/$/  🟢/'
mongosh --quiet 'mongodb://xxx:xxx@documentdb:10260/?tls=true&tlsAllowInvalidCertificates=true' --eval "$update" |
 sed -e '/elapsed/s/$/  🔵/'
mongosh --quiet 'mongodb://admin:MongoDB-emulation-23ai@oracle:27017/ora?authMechanism=PLAIN&authSource=$$external&ssl=true&retryWrites=false&loadBalanced=true&tlsAllowInvalidCertificates=true' --eval  "$update" |
 sed -e '/elapsed/s/$/  🔴/'
