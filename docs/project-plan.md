# AI-Generated Million Dollar Homepage on Flow Blockchain

This document outlines the architecture and implementation plan for an NFT-based pixel art marketplace with AI generation capabilities built on the Flow blockchain. This plan has been updated to reflect initial contract development and learnings.

## Project Overview

This project reimagines the classic "Million Dollar Homepage" concept with two key innovations:

1.  Users can generate pixel art using AI instead of uploading their own (AI generation itself is an off-chain process; the results are minted as NFTs).
2.  The platform is built on Flow blockchain, with purchases made in Flow tokens and ownership recorded as NFTs.

## Architecture Components

### 1. Flow Blockchain Integration

#### NFT Standards & Cadence 1.0

- Implement Flow's native NFT standard (`NonFungibleToken.cdc`) for universal compatibility.
- Utilize `MetadataViews.cdc` for structured, interoperable metadata.
- All contracts developed in Cadence 1.0.
- Emphasize clear import strategies using `flow.json` for standard contracts (e.g., `NonFungibleToken`, `MetadataViews`, `FungibleToken`, `ViewResolver`) and project contracts.

#### Smart Contracts

- **`FlowGenPixel.cdc`**:
  - Defines the core pixel NFT, including its metadata structure (name, description, thumbnail URL, AI prompt, image URIs for high-res & pixel art, image hash, coordinates).
  - Implements `NonFungibleToken.NFT` and `MetadataViews.Resolver`.
  - Manages total supply and ensures unique pixel minting via on-chain registration of coordinates (`registeredPixelKeys: {String: UInt64}`).
  - Handles royalty setup for creators at the time of minting, compatible with `MetadataViews.Royalty`.
  - Provides public functions to query pixel status (e.g., `isPixelMinted`, `getPixelNFTID`) and canvas constants (e.g., `CanvasResolution`).
- **`FlowGenCanvas.cdc`**:
  - Acts as an informational/view layer for the pixel grid.
  - Imports `FlowGenPixel.cdc` to query pixel states (e.g., `isPixelTaken`, `getNFTIDForPixel`).
  - Exposes canvas dimensions and potentially aggregated data like total/sold pixels and current primary sale price.
  - Does _not_ handle NFT ownership or minting directly; defers to `FlowGenPixel.cdc`.
- **Marketplace Contract (using `NFTStorefrontV2.cdc`)**:
  - Leverage the standard `NFTStorefrontV2` for non-custodial NFT listings and marketplace functionality for secondary sales (and potentially primary sales if structured that way).
  - Requires transactions to list `FlowGenPixel.NFT`s, purchase them, and manage listings.

#### Wallet Integration & Transactions

- Support Flow Wallet and other FCL-compatible wallets.
- Key transactions:
  - `setup_flowgenpixel_collection.cdc`: For users to initialize their accounts to receive `FlowGenPixel.NFT`s.
  - `PurchasePixel.cdc` (Primary Sale): For users to pay a fee to have a new `FlowGenPixel.NFT` minted for a specific coordinate, including AI art metadata and creator royalty setup. This transaction interacts with `FlowGenPixel.NFTMinter`.
  - Future marketplace transactions: list, unlist, buy (interacting with `NFTStorefrontV2`).
- Key scripts:
  - `GetCanvasState.cdc`: To retrieve overall canvas statistics.
  - `GetPixelInfo.cdc`: To get information about a specific pixel (taken status, NFT ID).
  - Scripts to view marketplace listings.

#### Payment Processing

- Use FLOW token (via `FungibleToken.cdc`) for payments.
- `PurchasePixel.cdc` handles primary sale payments to a designated fee receiver.
- Royalties for NFT creators are embedded in `FlowGenPixel.NFT` metadata and processed by marketplaces compatible with `MetadataViews.Royalty`.

### 2. AI Image Generation

#### Generation API

- Hybrid approach:
  - OpenAI DALL-E series for high-quality artistic content.
  - Stability AI for potentially more cost-effective options or different styles.
- This process is off-chain. The user interacts with a web UI, generates image data and metadata.

#### Cost Management for AI Generation

- The cost for AI generation itself might be bundled into the primary sale price of a pixel (handled by `PurchasePixel.cdc`) or managed separately by the platform.
- Smart contracts (`PurchasePixel.cdc`) handle the collection of a primary sale fee.

#### Image Storage & Metadata

- Generated image files (high-res, pixel art version) stored on IPFS.
- `FlowGenPixel.NFT` metadata will store:
  - IPFS CIDs (or HTTP URLs) for `thumbnailURL`, `imageURI`, `pixelArtURI`.
  - `aiPrompt`, `imageHash` (for integrity).
- Use Flow's Cadence smart contracts to verify image integrity through hash validation stored in metadata.

#### Pixel Art Constraints

- Standardize on a base canvas resolution (e.g., `FlowGenPixel.CanvasResolution = "1024x1024"`).
- Client-side will handle display optimizations.

### 3. Application Architecture

#### Frontend

- Next.js application with React.
- Interactive canvas for selecting/viewing pixel areas (using data from `FlowGenCanvas.cdc` and `NFTStorefrontV2`).
- AI prompt interface (off-chain interaction) leading to data for minting transaction.
- Wallet connection (FCL) and transaction management for setup, purchase, and marketplace interactions.

#### Backend / Middleware (Optional but likely)

- May coordinate AI image generation process (calling external AI APIs).
- May assist in preparing metadata for NFT minting transactions.
- Could manage API keys for AI services securely.
- Not directly involved in on-chain payment processing or minting if transactions are user-signed.

#### Smart Contract Layer (Recap)

- `FlowGenPixel.cdc`: NFT definition, minting logic (via `NFTMinter`), ownership, coordinate uniqueness, royalty data.
- `FlowGenCanvas.cdc`: Canvas views and information.
- `NFTStorefrontV2.cdc` (Standard Contract): Marketplace for secondary sales.

## Implementation Roadmap & Testing

### Phase 1: Foundation

- Set up Next.js project structure.
- Configure `flow.json` with correct contract paths and aliases for standard contracts (Cadence 1.0).
- Implement basic Flow wallet integration (FCL).
- **Develop and test `FlowGenPixel.cdc`**:
  - Core NFT struct, metadata, `NFTMinter`.
  - Coordinate registration for uniqueness.
  - Royalty capabilities.
  - **Testing**: Contract deployment, account setup for collection, NFT minting, metadata resolution, coordinate queries.
- **Develop and test `FlowGenCanvas.cdc`**:
  - Canvas dimension initialization.
  - Pixel status query functions (interacting with `FlowGenPixel.cdc`).
  - **Testing**: Deployment, initial state, pixel queries (before and after mints).
- Develop initial scripts and transactions for setup (`setup_flowgenpixel_collection.cdc`) and primary sale/minting (`PurchasePixel.cdc`).
  - **Testing**: Execution of these core transactions.
- Develop basic pixel grid visualization on frontend.

### Phase 2: Core Features (AI & Initial Interaction)

- Integrate AI image generation APIs into the platform (off-chain).
- Implement frontend flow for user to:
  - Select pixel coordinates.
  - Enter AI prompt, generate image (off-chain).
  - Review and approve.
  - Initiate `PurchasePixel.cdc` transaction with generated metadata and payment.
- Refine metadata storage and linking (IPFS for images).
- **Testing**: End-to-end flow of selecting a pixel, generating art data, and successfully minting the `FlowGenPixel.NFT` via `PurchasePixel.cdc`.

### Phase 3: Marketplace Integration

- Deploy or configure an instance of `NFTStorefrontV2.cdc`.
- Develop transactions for:
  - Listing `FlowGenPixel.NFT`s on the storefront.
  - Purchasing listed NFTs.
  - Unlisting NFTs.
- Develop scripts to read listing data from the storefront.
- Integrate marketplace views into the frontend.
- **Testing**: Full marketplace lifecycle: list, buy, unlist. Royalty payouts on secondary sales.

### Phase 4: Enhancement

- Add social features and sharing.
- Optimize for mobile experience.
- Consider advanced features like batch operations or community challenges.
- **Testing**: UI/UX testing, performance testing.

### General Testing Strategy

- **Unit Tests (.cdc)**: For individual functions and resource logic within contracts using the Flow test framework.
- **Integration Tests (Transactions/Scripts)**: Testing interactions between contracts, and the behavior of transactions and scripts using the Flow CLI or SDK-based test runners (e.g., Jest with FCL).
- **End-to-End Tests**: Testing the full user flow from UI interaction to blockchain confirmation.
- Test coverage should address successful paths and failure conditions (e.g., insufficient funds, trying to mint an already taken pixel, incorrect transaction arguments).

## Technical Considerations

### Scalability

- Leverage Flow's architecture for transaction throughput.
- Efficient on-chain storage: Store only essential metadata and URIs on-chain; images on IPFS.
- `FlowGenCanvas.cdc` primarily provides views, minimizing its own state storage.

### Security

- Audit all custom smart contracts (`FlowGenPixel.cdc`, `FlowGenCanvas.cdc`) before mainnet deployment.
- Follow secure wallet connection patterns (FCL).
- Protect AI generation service from abuse.
- Securely manage any server-side API keys.
- Ensure roles and permissions are correctly defined (e.g., `NFTMinter` access).

### User Experience

- Minimize blockchain complexity for users (FCL helps).
- Clear feedback during transaction processes.
- Intuitive AI prompt interface.
- Transparent display of pixel ownership and availability.

## Conclusion

This project combines the appeal of pixel art canvases with modern blockchain (Flow) and AI technology. The refined contract structure (`FlowGenPixel.cdc` for NFTs, `FlowGenCanvas.cdc` for views, `NFTStorefrontV2` for marketplace) provides a solid foundation. A strong emphasis on Cadence 1.0 standards and thorough testing will be key to a successful and robust platform.
