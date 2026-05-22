TARGETS=${TARGETS:-"mongodb documentdb oracle"}

run_target() {
  local target=$1
  local uri icon
  case "$target" in
    mongodb)    uri='mongodb://mongodb:27017'; icon='🟢' ;;
    documentdb) uri='mongodb://xxx:xxx@documentdb:10260/?tls=true&tlsAllowInvalidCertificates=true'; icon='🔵' ;;
    oracle)     uri='mongodb://admin:MongoDB-emulation-23ai@oracle:27017/ora?authMechanism=PLAIN&authSource=$external&ssl=true&retryWrites=false&loadBalanced=true&tlsAllowInvalidCertificates=true'; icon='🔴' ;;
    *) return ;;
  esac
  mongosh --quiet "$uri" /bench.js |
    sed -e "/elapsed/s/$/  ${icon}/" || echo "$target unavailable ${icon}"
}

for i in $(seq 1 100)
do
  for target in $TARGETS; do
    run_target "$target"
  done
done
