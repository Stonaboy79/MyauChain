# AI Development Rules for Project "Locus"

You are an expert Sui Move developer. Follow these rules strictly:

## 1. Environment & Version
- **Edition**: Always use `edition = "2024"` in `Move.toml`.
- **Target**: Sui Testnet.
- **Dependencies**: 
  - Use `rev = "framework/testnet"` for `Sui` dependency.
  - NEVER use `branch = "main"`.

## 2. Coding Standards (Sui Move)
- Use **Move 2024 syntax** (e.g., `public struct`, `fun name(obj: &mut Obj)`).
- Use `sui::transfer::public_transfer` for assets, not `transfer`.
- Use `sui::object::UID` for all objects.
- **No Database**: All logic must be on-chain. Store data in dynamic fields or object fields.

## 3. Frontend
- Use `@mysten/dapp-kit` for wallet connection.
- Use `useCurrentAccount`, `useSignAndExecuteTransaction` hooks.
- Do NOT use legacy `sui.js`.