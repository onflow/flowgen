# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is a Next.js application integrated with Flow blockchain. It's designed to create an NFT-based pixel art marketplace with AI generation capabilities, inspired by the "Million Dollar Homepage" concept.

## Commands

### Next.js Commands

```bash
# Start development server with turbopack
pnpm dev

# Build the application
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

### Flow Blockchain Commands

```bash
# Start Flow emulator (local blockchain)
flow emulator

# Deploy contracts to emulator
flow project deploy --network=emulator

# Run transactions
flow transactions send cadence/transactions/IncrementCounter.cdc --network=emulator --signer=emulator-account

# Run scripts to read data
flow scripts execute cadence/scripts/GetCounter.cdc --network=emulator

# Run tests
flow test cadence/tests/Counter_test.cdc
```

## Architecture

The application consists of two main parts:

1. **Next.js Frontend**

   - React-based user interface
   - Currently using standard Next.js structure with app router
   - Uses Tailwind CSS for styling

2. **Flow Blockchain Backend**
   - Smart contracts written in Cadence (Flow's programming language)
   - Use Cadence 1.0. See https://cadence-lang.org/docs/cadence-migration-guide/improvements
   - Currently includes a basic Counter contract for demonstration
   - Configuration in flow.json for multiple networks (emulator, testnet, mainnet)

### Flow Integration

The Flow blockchain integration uses:

- `@onflow/kit` for React components and hooks
- Cadence contracts, transactions, and scripts

### Project Structure

```
flowgen/
├── app/                    # Next.js application files
├── cadence/                # Flow blockchain files
│   ├── contracts/          # Smart contracts
│   ├── scripts/            # Read-only interactions
│   ├── transactions/       # State-changing interactions
│   └── tests/              # Contract tests
├── docs/                   # Project documentation
│   └── project-plan.md     # AI-Generated Million Dollar Homepage plan
├── flow.json               # Flow blockchain configuration
└── public/                 # Static assets
```

## Development Workflow

1. Make frontend changes in the `app/` directory
2. Develop Flow contracts in the `cadence/contracts/` directory
3. Create transactions and scripts in their respective directories
4. Test contracts with Flow test framework
5. Deploy contracts to emulator for local testing
6. Connect frontend to Flow blockchain using @onflow/kit

## Important Notes

- The project is currently using pnpm as package manager
- Flow emulator requires the emulator-account.pkey file for authentication
- The Counter contract serves as a basic example but will be extended for NFT functionality
- Refer to the project plan in docs/project-plan.md for the planned implementation
- Use kebab case for file naming
