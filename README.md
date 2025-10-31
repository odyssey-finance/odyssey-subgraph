# Odyssey Subgraph
Subgraph for Odyssey Protocol

## Setup
Run `yarn install`

## Build
To build a subgraph, a `subgraph.yaml` file is required. This file is created from a `subgraph.template.yaml` based on the network configuration found in the `/config` directory.
Below command will automatically generate the `subgraph.yaml` file and build the subgraph.

* `yarn build --network <networkName>`
  For example: `yarn build --network ethereum`

> Supported networks: `base`, `ethereum`, `optimism`, and `plasma`.

## Deploy
Follow deployment guide [here](https://thegraph.com/docs/en/subgraphs/developing/deploying/using-subgraph-studio/) to understand the process of deployment.

**Graph auth**
- Get the graph deploy key, follow steps [here](https://thegraph.com/docs/en/subgraphs/developing/deploying/using-subgraph-studio/#graph-auth).
- Run `yarn graph auth <Deploy Key>
  
**Deploy Subgraph**
- `yarn deploy --network <networkName>` will build and deploy subgraph for given network.

> Deploy command is going to ask subgraph name. As a rule of thumb you should follow "odyssey-subgraph-${networkName}" pattern for subgraph name.