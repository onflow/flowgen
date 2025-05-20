This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## web3.storage dev setup

1. Create an account on web3.storage
2. Create a space
3. Install the w3 cli
4. login with the cli and call `w3 space use <did_of_space>`
5. Follow https://docs.storacha.network/how-to/http-bridge/#generating-auth-headers-with-w3cli
6. Save your project did, auth header, and secret to .env.local:

```bash
W3_DELEGATED_DID=
W3_STORAGE_AUTH_HEADER=
W3_STORAGE_AUTH_SECRET=
```

## Open AI

1. Create an OpenAI Key

- You need to have a validated organisation to use gpt-image-1
- Save your API key to .env

```bash
OPENAI_API_KEY=
```

## Database

1. Create a postgres database (use Neon or Supabase)

```bash
DATABASE_URL=
```

## Flow Setup

1. Install the Flow CLI
2. Generate a private key for: emulator-account - keys/emulator-account.pkey

- For testnet Generate a private key for admin-testnet

3. Start the emulator

```bash
flow emulator start
```

4. Set these environment variables for emulator (or for testnet use those)

```bash
NEXT_PUBLIC_FLOW_ENDPOINT_URL='http://localhost:8888'
NEXT_PUBLIC_FLOW_NETWORK='emulator'

FLOW_CONTRACT_ADDRESS=
NEXT_PUBLIC_FLOW_ADMIN_ADDRESS=
NEXT_PUBLIC_FLOW_ENDPOINT_URL=
FLOW_ADMIN_HASH_ALGORITHM=
FLOW_ADMIN_SIGN_ALGORITHM=
NEXT_PUBLIC_FLOW_NETWORK=
NEXT_PUBLIC_FLOW_ADMIN_ADDRESS=
```

4. Start the dev wallet

```bash
flow dev-wallet
```

5. Deploy the contracts

```bash
pnpm flow:deploy:emulator
```

6. Seed the background image

- If you want to replace the background image, you may want to run the transaction directly. Look at package.json to get the command

```
pnpm flow:seed:background:emulator
```

7. Seed the database

- This is important otherwise the cron job will index the entire blockchain. It sets the starting blocks

```
pnpm db:seed
```
