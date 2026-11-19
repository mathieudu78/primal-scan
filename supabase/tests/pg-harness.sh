#!/usr/bin/env bash
# Démarre un Postgres jetable (port 54399) pour les tests SQL. Usage: pg-harness.sh start|stop
set -e
DIR=${PG_TEST_DIR:-/tmp/primal-pg}
BIN=$(ls -d /usr/lib/postgresql/*/bin | tail -1)
case "$1" in
 start)
  rm -rf "$DIR"; mkdir -p "$DIR"; chown postgres "$DIR"
  su postgres -c "$BIN/initdb -D $DIR/data -A trust >/dev/null"
  su postgres -c "$BIN/pg_ctl -D $DIR/data -o '-p 54399 -k $DIR' -l $DIR/log -w start >/dev/null"
  ;;
 stop) su postgres -c "$BIN/pg_ctl -D $DIR/data -m immediate stop" >/dev/null 2>&1 || true ;;
esac
