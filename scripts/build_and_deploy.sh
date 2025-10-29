#!/bin/bash

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

NETWORK=""
DEPLOY_FLAG=""
VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
    --network)
        NETWORK="$2"
        shift 2
        ;;
    --deploy)
        DEPLOY_FLAG="--deploy"
        shift
        ;;
    --version)
        VERSION="$2"
        shift 2
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 --network <network_name> [--deploy] [--version <x.y.z>]${NC}"
        exit 1
        ;;
    esac
done

if [[ -z "$NETWORK" ]]; then
    echo -e "${YELLOW}Usage: $0 --network <network_name> [--deploy] [--version <x.y.z>]${NC}"
    exit 1
fi

# Check version if deploying
if [[ "$DEPLOY_FLAG" == "--deploy" ]]; then
    if [[ -z "$VERSION" ]]; then
        echo -e "${RED}Error: --version is required for deployment${NC}"
        echo -e "${YELLOW}Usage: $0 --network <network_name> --deploy --version x.y.z${NC}"
        exit 1
    fi
    
    # Validate semver format inline
    if [[ ! $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo -e "${RED}Error: Version must follow semantic versioning format (MAJOR.MINOR.PATCH)${NC}"
        echo -e "${YELLOW}Example: 1.2.3${NC}"
        exit 1
    fi
fi

# Construct subgraph name
SUBGRAPH_NAME="odyssey-subgraph-${NETWORK}"

# Dynamically get valid networks from config directory
VALID_NETWORKS=($(ls -1 config | grep -v '^[.]*$'))
if [[ ! " ${VALID_NETWORKS[@]} " =~ " $NETWORK " ]]; then
    echo -e "\n${RED}Unknown network: $NETWORK${NC}"
    echo -e "${YELLOW}Valid networks are: ${PURPLE}${VALID_NETWORKS[*]}${NC}\n"
    exit 1
fi

# Copy address.ts from config/<network> to src/utils
fromPath=config/$NETWORK/address.ts
toPath=src/utils/address.ts
echo -e "${CYAN}Preparing build for ${PURPLE}$NETWORK${NC}"
graph clean

echo -e "\n${YELLOW}Copying address file from:${NC} $fromPath ${YELLOW}to:${NC} $toPath"
cp "$fromPath" "$toPath"

# generate subgraph.yaml from template using network specific config
echo -e "${CYAN}Generating subgraph.yaml from template...${NC}"
mustache "config/$NETWORK/config.json" subgraph.template.yaml >subgraph.yaml

# generate code from graphql schema
echo -e "${CYAN}Running graph codegen...${NC}"
graph codegen

# deploy subgraph
if [[ "$DEPLOY_FLAG" == "--deploy" ]]; then
    if [[ "$NETWORK" == "plasma" ]]; then
        # build
        graph build
        # deploy
        echo -e "${CYAN}Deploying ${PURPLE}${SUBGRAPH_NAME}${CYAN} to GoldSky...${NC}"
        goldsky subgraph deploy "$SUBGRAPH_NAME/$VERSION" --path .
    else 
        echo -e "${CYAN}Deploying ${PURPLE}${SUBGRAPH_NAME}${CYAN} to TheGraph...${NC}"
        # deploy command will build and deploy
        graph deploy --node https://api.studio.thegraph.com/deploy/ \
             ${SUBGRAPH_NAME} \
             --version-label ${VERSION}
    fi
    echo -e "\n${GREEN}Deploy for ${PURPLE}$NETWORK ${GREEN}completed with version ${PURPLE}${VERSION}${GREEN}.${NC}\n"
else
    # build subgraph
    echo -e "${CYAN}Building subgraph...${NC}"
    graph build
    echo -e "${GREEN}Build for ${PURPLE}$NETWORK ${GREEN}completed.${NC}\n"
fi
