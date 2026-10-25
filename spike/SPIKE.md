# Phase 0 spike: results and architecture decision

Date: 25 Oct 2026, Stellar Testnet. All accounts below are throwaway testnet accounts created for the demo.

## 1. Smart-account treasury with a spending limit: WORKS

Company treasury = OpenZeppelin smart account (contract account), reusing contracts SDF already deployed on testnet, so no Rust build is needed.

| Item | Value |
|---|---|
| Treasury contract | `CDOTGUOHQIZMIRA7WEKW4NMXH23LPPTPTOWLP6WA7ZV2AMQDUQRIME6X` |
| Account wasm hash | `1b5f4534a76322da2ad7c745f6900857a6802b0ca79850c35a03561df997785a` |
| Ed25519 verifier | `CAAVTMCBXEIBPR64EAASKFXERVPYFZA2JYP5A3BG6PESWEFUJX5IHKN4` |
| Spending-limit policy | `CABXBYJNZ7IUW4G3D6BND5YCAQF3ASSDMDAOKQQ63UYFSO7WUU2TIP5G` |
| Token | native XLM asset contract `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Rules on the account:

- Rule 0 "Default": admin key, no limit.
- Rule 1 "payroll": operator key, only `transfer` calls on the XLM token, at most 20 XLM per 17,280 ledgers (about one day), expires after 120,960 ledgers (about one week).

Demo run (`spike/treasury/treasury.mjs`):

| Step | Result | Transaction |
|---|---|---|
| Admin adds the payroll rule | success | [4dccd2e1…](https://stellar.expert/explorer/testnet/tx/4dccd2e180e3fc8a7e9212c0e2140e877a4ac7ee6831d2f1891566202f866989) |
| Operator pays Maya 12 XLM | success | [584b65e5…](https://stellar.expert/explorer/testnet/tx/584b65e59074783a6175d90f69c3db379d160473878aec765ef9b236a4827ec6) |
| Operator pays another 12 XLM (24 > 20) | rejected, `Error(Contract, #3221)` = SpendingLimitExceeded | none (refused in simulation) |
| Admin pays 12 XLM | success | [5124673a…](https://stellar.expert/explorer/testnet/tx/5124673a16da30eb6ab9c5e8070ad9f3e557ef833c98709aa617fb2502876223) |

Gotchas found:

- The deployed account predates OpenZeppelin v0.8, so signers sign `sha256(signature_payload || xdr(rule_ids))`, not the v0.8 `auth_digest` preimage.
- Use `@stellar/stellar-sdk` 14. Version 17 changed XDR objects to plain properties and OpenZeppelin's reference code breaks.
- `Keypair.rawPublicKey()` returns a Uint8Array in newer SDKs; wrap it in `Buffer.from` before hex-encoding.

## 2. Stellar Private Payments (SPP): shared deployment unusable, own deployment in progress

What happened:

1. Nethermind redeployed the shared testnet contracts on 21 Oct (ledger 5,316,526). The newest npm SDK (0.2.1, 16 Oct) and released CLI (`spp` 0.2.0, 16 Oct) predate it. Registration fails: the registry now expects a key-ownership proof (`Func(MismatchingParameterLen)`).
2. Their hosted web build (23 Oct, matches the contracts) loads and syncs with a scripted signer, but registration preparation fails with `minResourceFee plus the rent margin does not fit into u32`.
3. The CLI built from `main` fails on macOS with `database is locked` before it reaches the network.
4. Since the 21 Oct redeploy, the shared registry and pools show no user events at all (one init event on the registry, four on the XLM pool). Nobody appears to be using that deployment successfully.

Decision: deploy our own SPP stack from the 16 Oct release tag (`cli-v0.2.0`, commit 8e637fe). That matches the released `spp` CLI and npm SDK, which already got through key derivation in our tests. Our deployment is fresh, so public RPC keeps its full event history for the whole hackathon and no bootnode is needed.

Result on our own deployment (registry `CAL4OMZX…EQ`, pool `CBN3QXLC…RQL4`, ledger 5,384,956):

- Registration works: Maya [c9f615a9…](https://stellar.expert/explorer/testnet/tx/c9f615a9a95e538da149dff7f9b3253d9c4cbdadac718d1dbda4a3b58d464951), employer [46cf49e7…](https://stellar.expert/explorer/testnet/tx/46cf49e7d498fe06f7fe29ada538f5bdd45362c97e6422de2be7238adffb16e6).
- Deposit cannot be submitted. Simulation asks for a resource fee of 36,263,673,391 stroops (about 3,626 XLM), but a transaction's total fee is a u32, capped at about 429 XLM. The deposit itself is small (65M instructions, 4,740 write bytes, 5 written entries), so the cost is testnet storage pricing, not the circuit.
- The same pricing shows elsewhere: our treasury `add_context_rule` was charged 127.3 XLM in fees and one SPP registration 23.3 XLM. Normal mainnet costs for these are fractions of an XLM.
- This also explains the earlier "minResourceFee plus the rent margin does not fit into u32" error from Nethermind's newest client on their shared deployment.

Signer note for the browser SDK: a scripted keypair signer works if `signMessage` returns base64 of the SEP-53 signature, `signAuthEntry` signs `sha256(preimage)`, and both re-wrap signature bytes with `Buffer.from` first.

## 3. Architecture decision

Fallback architecture from the build guide, section 9:

- Company treasury: OpenZeppelin smart account with a real spending-limit policy (working).
- Private payroll: SPP on our own testnet deployment, driven by the `spp` CLI from the backend payroll runner (or the browser SDK).
- Product layer: presents both as one workflow. The demo must say that unified passkey control of SPP is the intended integration, not something already built.
