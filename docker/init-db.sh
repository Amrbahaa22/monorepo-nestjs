#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
  CREATE DATABASE payments_api;
  CREATE DATABASE orchestrator;
  CREATE DATABASE ledger;
EOSQL
