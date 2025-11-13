#!/bin/bash

while :; do
  bash scripts/ralph/sync.sh
  echo -e "==== 😴 ====\n"
  sleep 10
  echo -e "==== 👾 ====\n"
done
