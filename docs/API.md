# Backend Services API Reference

## Overview

The SSS backend consists of four microservices that support production stablecoin operations.

| Service | Default Port | Purpose |
|---------|-------------|---------|
| Mint/Burn | 3001 | Token minting and burning REST API |
| Indexer | 3002 | On-chain event monitoring |
| Compliance | 3003 | Blacklist and compliance management |
| Webhook | 3004 | Event dispatch to external endpoints |

All services return JSON responses and accept JSON request bodies.

---

## Mint/Burn Service (Port 3001)

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "mint-burn",
  "cluster": "devnet"
}
```

### Mint Tokens

```
POST /mint
```

**Request Body:**
```json
{
  "mint": "So11111111111111111111111111111111111111112",
  "recipient": "RecipientPubkey...",
  "amount": "1000000"
}
```

**Response:**
```json
{
  "status": "accepted",
  "mint": "So11...",
  "recipient": "Recip...",
  "amount": "1000000",
  "message": "Mint request queued for processing"
}
```

### Burn Tokens

```
POST /burn
```

**Request Body:**
```json
{
  "mint": "MintPubkey...",
  "amount": "500000"
}
```

### Get Supply

```
GET /supply/:mint
```

**Response:**
```json
{
  "mint": "MintPubkey...",
  "totalMinted": "10000000",
  "totalBurned": "500000",
  "currentSupply": "9500000"
}
```

---

## Indexer Service (Port 3002)

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "service": "indexer",
  "cluster": "devnet",
  "eventsIndexed": 42
}
```

### List Events

```
GET /events?type=StablecoinInitialized&limit=50
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | — | Filter by event type |
| `limit` | number | 50 | Maximum results |

**Response:**
```json
{
  "total": 5,
  "events": [
    {
      "signature": "5abc...",
      "slot": 12345,
      "blockTime": 1700000000,
      "type": "StablecoinInitialized",
      "data": { ... }
    }
  ]
}
```

### Events by Mint

```
GET /events/mint/:mint
```

---

## Compliance Service (Port 3003)

### Health Check

```
GET /health
```

### Check Blacklist Status

```
GET /check/:mint/:address
```

**Response:**
```json
{
  "mint": "MintPubkey...",
  "address": "AddressPubkey...",
  "blacklisted": true,
  "record": {
    "address": "AddressPubkey...",
    "mint": "MintPubkey...",
    "reason": "OFAC SDN List match",
    "addedAt": 1700000000,
    "addedBy": "service"
  }
}
```

### Add to Blacklist

```
POST /blacklist/add
```

**Request Body:**
```json
{
  "mint": "MintPubkey...",
  "address": "TargetPubkey...",
  "reason": "Sanctions compliance"
}
```

### Remove from Blacklist

```
POST /blacklist/remove
```

**Request Body:**
```json
{
  "mint": "MintPubkey...",
  "address": "TargetPubkey..."
}
```

### Get Full Blacklist

```
GET /blacklist/:mint
```

**Response:**
```json
{
  "mint": "MintPubkey...",
  "total": 3,
  "entries": [
    {
      "address": "...",
      "mint": "...",
      "reason": "...",
      "addedAt": 1700000000,
      "addedBy": "service"
    }
  ]
}
```

### Compliance Report

```
GET /report/:mint
```

**Response:**
```json
{
  "mint": "MintPubkey...",
  "generatedAt": "2025-01-15T12:00:00.000Z",
  "summary": {
    "totalBlacklisted": 3,
    "recentActions": [ ... ]
  },
  "compliance": {
    "transferHookActive": true,
    "permanentDelegateActive": true,
    "blacklistEnforced": true
  }
}
```

---

## Webhook Service (Port 3004)

### Health Check

```
GET /health
```

### Subscribe to Events

```
POST /subscribe
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhook",
  "events": ["TokensMinted", "BlacklistAdded"],
  "mint": "Optional mint filter..."
}
```

**Valid Events:**
- `StablecoinInitialized`
- `TokensMinted`
- `TokensBurned`
- `AccountFrozen`
- `AccountThawed`
- `Paused`
- `Unpaused`
- `BlacklistAdded`
- `BlacklistRemoved`
- `TokensSeized`
- `MinterUpdated`
- `RoleUpdated`
- `AuthorityTransferred`

**Response:**
```json
{
  "status": "created",
  "subscription": {
    "id": "wh_1",
    "url": "https://...",
    "events": ["TokensMinted"],
    "active": true,
    "createdAt": 1700000000000
  }
}
```

### Unsubscribe

```
DELETE /subscribe/:id
```

### List Subscriptions

```
GET /subscriptions
```

### Dispatch Event (Internal)

```
POST /dispatch
```

**Request Body:**
```json
{
  "type": "TokensMinted",
  "data": {
    "mint": "...",
    "amount": "1000000",
    "recipient": "..."
  }
}
```

---

## Docker Deployment

```bash
cd services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Environment Variables

| Variable | Default | Service | Description |
|----------|---------|---------|-------------|
| `MINT_BURN_PORT` | 3001 | mint-burn | Service port |
| `INDEXER_PORT` | 3002 | indexer | Service port |
| `COMPLIANCE_PORT` | 3003 | compliance | Service port |
| `WEBHOOK_PORT` | 3004 | webhook | Service port |
| `SOLANA_CLUSTER` | devnet | all | Solana cluster |
| `SSS_PROGRAM_ID` | SSS111... | indexer | Program to monitor |
| `KEYPAIR_PATH` | ~/.config/solana/id.json | mint-burn | Signer keypair |
