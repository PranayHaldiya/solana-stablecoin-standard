# Operations Guide

## Deployment

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.31.1
avm use 0.31.1

# Install Node.js dependencies
npm install
```

### Build Programs

```bash
anchor build
```

This generates:
- `target/deploy/sss_token.so` — Core stablecoin program
- `target/deploy/sss_transfer_hook.so` — Transfer hook program
- `target/types/sss_token.ts` — TypeScript IDL types
- `target/idl/sss_token.json` — JSON IDL

### Deploy to Devnet

```bash
# Set cluster
solana config set --url devnet

# Get devnet SOL
solana airdrop 5

# Deploy programs
anchor deploy --provider.cluster devnet

# Note the program IDs from output and update Anchor.toml
```

### Deploy to Mainnet

```bash
# Set cluster
solana config set --url mainnet-beta

# IMPORTANT: Use a hardware wallet or secure key management
# Do NOT use file-based keypairs for mainnet deployments

# Deploy with specific keypair
anchor deploy --provider.cluster mainnet \
  --provider.wallet /path/to/deployer-keypair.json

# Verify deployment
solana program show <PROGRAM_ID>
```

## Post-Deployment Setup

### 1. Initialize Stablecoin

```bash
sss init \
  --preset sss-2 \
  --name "My Compliant USD" \
  --symbol MCUSD \
  --uri "https://example.com/metadata.json" \
  --cluster devnet
```

### 2. Configure Roles

```bash
# Add minter
sss add-minter \
  --mint <MINT_ADDRESS> \
  --minter <MINTER_PUBKEY> \
  --quota 1000000000000
```

### 3. Start Backend Services

```bash
cd services

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start with Docker
docker-compose up -d

# Or start individually
npm run mint-burn    # Port 3001
npm run indexer      # Port 3002
npm run compliance   # Port 3003
npm run webhook      # Port 3004
```

## Monitoring

### Health Checks

```bash
# Check all services
curl http://localhost:3001/health  # Mint/Burn
curl http://localhost:3002/health  # Indexer
curl http://localhost:3003/health  # Compliance
curl http://localhost:3004/health  # Webhook
```

### On-Chain Monitoring

```bash
# Check program status
solana program show <SSS_TOKEN_PROGRAM_ID>
solana program show <SSS_TRANSFER_HOOK_PROGRAM_ID>

# Watch program logs
solana logs <SSS_TOKEN_PROGRAM_ID>
```

### Token Supply

```bash
sss info --mint <MINT_ADDRESS> --cluster devnet
```

## Security Best Practices

### Key Management

- Use hardware wallets for master authority in production
- Consider multisig (e.g., Squads) for critical operations
- Rotate keys periodically
- Never store keypairs in version control

### Program Security

- Deploy as immutable when confident in the code
- Or use multisig upgrade authority
- Run security audits before mainnet deployment
- Test thoroughly on devnet first

### Operational Security

- Use rate limiting on backend services
- Implement API authentication
- Monitor for unusual minting patterns
- Set conservative minter quotas
- Enable webhook notifications for all critical events

## Troubleshooting

### Common Issues

**"Program not found"**
- Verify program IDs in Anchor.toml match deployed programs
- Check that you're on the correct cluster

**"Unauthorized" errors**
- Verify the signing wallet matches the expected role
- Check that the minter is active and has sufficient quota

**"Account not found"**
- Ensure the stablecoin has been initialized
- Check that token accounts exist (create ATAs if needed)

**Transfer hook failures**
- Verify the transfer hook program is deployed on the same cluster
- Check that ExtraAccountMetaList has been initialized
- Ensure blacklist PDAs are being resolved correctly

## Backup & Recovery

- Back up all keypairs in a secure location
- Document all role assignments
- Keep records of all deployed program IDs
- Maintain a list of all initialized stablecoins
- Store compliance records separately for regulatory access
