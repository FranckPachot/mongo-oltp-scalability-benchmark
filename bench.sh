mongosh --quiet 'mongodb://mongodb:27017' /bench.js | 
 sed -e '/elapsed/s/$/  🟢/'
mongosh --quiet 'mongodb://xxx:xxx@documentdb:10260/?tls=true&tlsAllowInvalidCertificates=true' /bench.js |
 sed -e '/elapsed/s/$/  🔵/'
mongosh --quiet 'mongodb://admin:MongoDB-emulation-23ai@oracle:27017/ora?authMechanism=PLAIN&authSource=$$external&ssl=true&retryWrites=false&loadBalanced=true&tlsAllowInvalidCertificates=true'  /bench.js|
 sed -e '/elapsed/s/$/  🔴/'
