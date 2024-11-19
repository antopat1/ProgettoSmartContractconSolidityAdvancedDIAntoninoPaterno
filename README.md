# DAO Governance System Based on UN's 2030 Agenda Goals

## Overview
This repository contains a Web3 project developed in TypeScript, leveraging **Hardhat** as the development framework and **Viem** for interactions with smart contracts. The project is a fully-fledged DAO (Decentralized Autonomous Organization) designed to align with the company's objectives under the UN's 2030 Agenda, incorporating both **direct** and **representative democracy** governance models.

The system enables stakeholders to participate in governance by purchasing membership tokens (ERC-20) and exercising **weighted voting rights** on proposals related to company operations.

---

## Key Features
### Governance and Voting Mechanism
- **ERC-20 Token for Membership**: Users acquire membership tokens by purchasing them with ETH, which serves as proof of participation and determines voting weight.
- **Proposal Creation and Voting**: Members can create proposals and vote on them, with token holdings influencing voting power.
- **Proposal Execution**: Approved proposals are executed automatically, with associated actions triggered in smart contracts.

### Ownership and Treasury Management
- A designated **Owner Account** manages treasury funds, ensuring accountability and transparency.
- The treasury is funded by ETH contributions from token purchases and other DAO revenues.

---

## Project Components
### Smart Contracts
1. **GovernanceToken**: 
   - Implements the ERC-20 token standard.
   - Handles token issuance and transfers.
   - Provides token balance information for governance weight calculation.
   
2. **DAO Contract**: 
   - Facilitates proposal creation, voting, and execution.
   - Tracks vote counts and proposal statuses.
   - Manages the treasury and ETH withdrawals by the owner.

### Testing
- Comprehensive test coverage ensures the functionality and security of all critical components:
  - **GovernanceToken**:
    - Token issuance and transfers.
    - Handling edge cases such as double-spending or insufficient balance.
  - **DAO**:
    - Proposal lifecycle: creation, voting, execution.
    - Weighted voting mechanics based on token balances.
    - Treasury interactions, including ETH withdrawal logic.

### Deployment
- Deployment scripts are structured to automate the setup of the **GovernanceToken** and **DAO** contracts.
- Network configurations support both local testing (via Hardhat) and deployment to live Ethereum-compatible chains.

---

## Technical Highlights
1. **Viem**: 
   - Used for interacting with deployed smart contracts.
   - Ensures type-safe and optimized interactions with Ethereum.
   
2. **Hardhat**: 
   - Simplifies contract development, testing, and deployment.
   - Provides tools for local blockchain simulation and debugging.

3. **TypeScript Best Practices**:
   - Ensures maintainable and type-safe code.
   - Clear separation of concerns for easier readability and scalability.

---

## Usage
### Token Purchase
1. Users send ETH to the **GovernanceToken** contract.
2. Tokens are issued to the user's account.

### Voting on Proposals
1. Create a proposal using the **DAO contract**.
2. Vote on proposals using the weight of your token holdings.
3. View proposal status and track approved actions.

### Treasury Management
- The **Owner Account** manages funds stored in the DAO's treasury.
- ETH can be withdrawn for specific actions aligned with approved proposals.

---

## Goals and Future Enhancements
- Align DAO governance with evolving UN 2030 Agenda goals.
- Expand voting mechanisms to support quadratic voting and delegation.
- Integrate additional layers of security and analytics to improve decision-making transparency.

---

By combining **technical rigor** with **practical applications of decentralized governance**, this project demonstrates a scalable and efficient model for Web3-based organizational frameworks. The repository is structured to provide clarity for developers and stakeholders alike.

## Prerequisites

- Node.js version 14.x or higher
- npm version 6.x or higher
- Git installed on your machine

## Repository Setup

Clone the repository using the following command:
```bash
git clone https://github.com/antopat1/ProgettoSmartContractconSolidityAdvancedDIAntoninoPaterno.git
cd ProgettoSmartContractconSolidityAdvancedDIAntoninoPaterno
```

## Installation and Configuration


### Install the required dependencies:
```bash
npm install --save-dev @nomicfoundation/hardhat-toolbox-viem@3.0.0
npm install --save-dev @openzeppelin/contracts@4.8.0
npm install --save-dev hardhat@2.22.15
npm install --save-dev viem@2.21.37
npm install --save-dev dotenv@16.4.5
```

### Environment Configuration
Create a .env file in the project root with the following content:
```bash
PRIVATE_KEY=your_private_key_here
```

## Available Commands

#### Compile Contracts
```bash
npx hardhat compile
```

#### Execute Test
```bash
npx hardhat test
```

#### Deploy to Local Test Network
```bash
npx hardhat run scripts/deployContracts.ts
```

#### Deploy to Public Test Network
```bash
npx hardhat run scripts/deployContracts.ts --network arbitrumSepolia
```



Notes and Best Practices

- Keep your PRIVATE_KEY secret
- Never commit sensitive information to the Repository
- Ensure you have the correct Node.js and npm versions installed
- Always use environment variables for sensitive information

