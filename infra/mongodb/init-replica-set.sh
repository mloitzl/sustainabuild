#!/bin/bash
set -e

# Generate MongoDB keyfile if it doesn't exist
KEYFILE_PATH="/data/keyfile/mongo-keyfile"
if [ ! -f "$KEYFILE_PATH" ]; then
  echo "Generating MongoDB keyfile..."
  mkdir -p /data/keyfile
  openssl rand -base64 756 > "$KEYFILE_PATH"
  chmod 600 "$KEYFILE_PATH"
  chown 999:999 "$KEYFILE_PATH"
  echo "MongoDB keyfile generated at $KEYFILE_PATH"
else
  echo "MongoDB keyfile already exists at $KEYFILE_PATH"
fi

echo "Waiting for MongoDB to be ready..."

# Wait for MongoDB to be available (try without auth first, then with auth)
echo "Waiting for MongoDB to start..."
until mongosh --host mongodb --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; do
  echo "MongoDB not ready yet, waiting..."
  sleep 2
done

echo "MongoDB started, waiting for authentication to be ready..."
until mongosh --host mongodb \
              --username "$MONGO_INITDB_ROOT_USERNAME" \
              --password "$MONGO_INITDB_ROOT_PASSWORD" \
              --authenticationDatabase admin \
              --eval "db.adminCommand('ping')" \
              --quiet > /dev/null 2>&1; do
  echo "MongoDB authentication not ready yet, waiting..."
  sleep 2
done

echo "MongoDB is ready!"

# Check if replica set is already initialized
RS_STATUS=$(mongosh --host mongodb \
                     --username "$MONGO_INITDB_ROOT_USERNAME" \
                     --password "$MONGO_INITDB_ROOT_PASSWORD" \
                     --authenticationDatabase admin \
                     --eval "try { rs.status().ok } catch(e) { 0 }" \
                     --quiet)

if [ "$RS_STATUS" = "1" ]; then
  echo "Replica set already initialized"
  mongosh --host mongodb \
          --username "$MONGO_INITDB_ROOT_USERNAME" \
          --password "$MONGO_INITDB_ROOT_PASSWORD" \
          --authenticationDatabase admin \
          --eval "rs.status().members" \
          --quiet
else
  echo "Initializing replica set 'rs0'..."
  mongosh --host mongodb \
          --username "$MONGO_INITDB_ROOT_USERNAME" \
          --password "$MONGO_INITDB_ROOT_PASSWORD" \
          --authenticationDatabase admin \
          --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'mongodb:27017'}]})" \
          --quiet
  
  echo "Waiting for replica set to elect primary..."
  sleep 5
  
  echo "Replica set initialized successfully!"
  mongosh --host mongodb \
          --username "$MONGO_INITDB_ROOT_USERNAME" \
          --password "$MONGO_INITDB_ROOT_PASSWORD" \
          --authenticationDatabase admin \
          --eval "rs.status().members" \
          --quiet
fi

