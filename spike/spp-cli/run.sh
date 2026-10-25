#!/usr/bin/env bash
# Private payroll on our own SPP testnet deployment, using the released spp 0.2.0 CLI.
# Maya and the employer register; the employer deposits into the pool and pays Maya privately; Maya withdraws part.
set -euo pipefail
B=/Users/harshul.bhatt/Documents/Claude/Projects/HarshOS/workbench/career/2026-10-25-hackmeridian-lisbon/vendor
SPP=$B/spp-cli/bin/spp
DEPLOY=$B/spp-v020/deployments/testnet/deployments.json
POOL=$(python3 -c "import json;print(json.load(open('$DEPLOY'))['pools'][0]['poolContractId'])")
WALLETS=$HOME/.local/share/nomad-vault-spp
spp() { local who=$1; shift; "$SPP" "$@" --deployment "$DEPLOY" --data-dir "$WALLETS/$who" --circuits-dir "$B/spp-cli/data/circuits" --account "nv-$who" --json; }
step() { echo; echo "== $*"; }

step "onboard maya";    spp maya onboard --accept --register --no-bootnode --explorer-url https://stellar.expert/explorer/testnet
step "onboard employer"; spp employer onboard --accept --register --no-bootnode --explorer-url https://stellar.expert/explorer/testnet
step "employer deposits 20 XLM"; spp employer deposit "$POOL" 20
step "employer pays maya 5 XLM privately"; spp employer transfer "$POOL" 5 --to "$(stellar keys address nv-maya)"
step "maya overview"; spp maya overview "$POOL"
step "maya withdraws 2 XLM"; spp maya withdraw "$POOL" 2
step "maya overview after"; spp maya overview "$POOL"
step "employer overview"; spp employer overview "$POOL"
