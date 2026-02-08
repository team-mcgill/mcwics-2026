# Masquerade

## Inspiration

People are more detached than ever, the damage from COVID still has its effect.

Furthermore, people find it easy to feel judged when showing interest in unique hobbies (anime, labubus, alt styles).

We wanted to create a safe space where everyone is anonymous and can freely express themselves in themed chatrooms. These chatrooms encourage like-minded people to discuss on equal standing, without the prejudice faced in the real world.

## What it does

It's a masquerade party online — you can create your own masks + cosmetics to freely express yourself. Save it forever on the blockchain.

**Key Features:**
- **Face Mesh Painting**: Use your webcam to paint custom masks directly on a real-time 3D face mesh using MediaPipe and Three.js
- **3D Accessories**: Equip wearable items (hats, helmets, etc.) that dynamically attach to your face and scale based on facial dimensions
- **NFT Minting**: Mint your mask designs as SPL NFTs on Solana with metadata stored on-chain
- **Multiplayer Rooms**: Join themed chat rooms with other masked avatars — WASD to move, space to jump, mouse to look, chat in real-time
- **Marketplace**: Buy and sell mask designs and accessories with SOL payments, fully verified on-chain
- **Wallet Integration**: Seamless Phantom wallet connection for authentication and transactions

Then, join a party and talk to others!

## How we built it

- **Frontend**: React.js + Tailwind CSS v4 + Three.js for real-time 3D face tracking and mask customization
- **Backend**: Python + FastAPI with async WebSocket support for real-time multiplayer rooms
- **Blockchain**: Solana Devnet — all masks and accessories are minted as SPL NFTs using Metaplex metadata standards
- **Face Tracking**: MediaPipe Face Landmarker for 468-point facial landmark detection
- **3D Rendering**: Three.js with custom UV mapping for paint-on-face texture workflow
- **Real-time Communication**: WebSocket-based multiplayer with presence tracking and chat
- **Storage**: JSON-based marketplace listings with file uploads for mask metadata and images

## Challenges we ran into

- **Face Mesh UV Mapping**: Mapping 2D paint strokes to a 3D face mesh required custom triangulation and UV coordinate calculations to ensure paint stays aligned with facial features
- **Accessory Positioning**: Dynamically fitting 3D accessories (GLB models) to different face shapes required complex scaling algorithms based on facial landmark distances
- **WebSocket State Management**: Handling player join/leave, movement interpolation, and cosmetic updates in real-time while maintaining sync across clients
- **NFT Transaction Handling**: Managing async blockchain transactions with optimistic UI updates, rollback on failure, and confirmation polling
- **Marketplace Security**: Implementing listing locks to prevent double-purchases and verifying payment signatures on-chain before NFT transfer
- **Performance**: Balancing MediaPipe face detection at 24 FPS with Three.js rendering and WebSocket communication without frame drops

## Accomplishments that we're proud of

- Built a fully functional real-time multiplayer 3D environment with custom avatars and chat
- Implemented paint-on-face technology that lets users express themselves creatively on a live face mesh
- Created a complete NFT marketplace with minting, buying, selling, and burning — all integrated with Solana
- Designed a responsive, elegant UI with Tailwind CSS that feels premium and masquerade-themed
- Solved complex 3D math problems for accessory fitting and face pose estimation
- Achieved smooth 60 FPS gameplay with multiple players, each rendering custom masks and accessories

## What we learned

- **MediaPipe + Three.js Integration**: How to bridge computer vision landmarks with 3D graphics for interactive experiences
- **Solana Development**: Deep understanding of SPL tokens, Metaplex metadata, transaction signing, and program-derived addresses
- **WebSocket Architecture**: Patterns for real-time game state management, player interpolation, and optimistic updates
- **3D Math for the Web**: Vector math, quaternion rotations, and UV mapping for browser-based 3D applications
- **Blockchain UX**: The importance of clear transaction states, error handling, and user feedback when dealing with async on-chain operations
- **Performance Optimization**: Techniques for rendering multiple 3D models, texture management, and reducing re-renders in React

## What's next for Masquerade

- **Mobile Support**: Optimize face tracking and 3D rendering for iOS/Android devices
- **Voice Chat**: Integrate proximity-based voice chat for more immersive social interactions
- **More Accessories**: Expand the accessory library with glasses, earrings, masks, and full outfits
- **Themed Events**: Special limited-time rooms with unique aesthetics and exclusive drops
- **DAO Governance**: Community voting on new features, accessories, and marketplace rules
- **Mainnet Migration**: Move from Solana Devnet to Mainnet for real value transactions
- **AR Mode**: Use WebXR to project masks onto users in their real environment