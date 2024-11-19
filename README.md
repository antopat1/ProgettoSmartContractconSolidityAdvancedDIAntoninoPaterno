# Advanced Solidity Smart Contract DAO Project

This is a Web3 project implementing a DAO through 3 Smart Contracts using Hardhat, TypeScript, and Viem.

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
- Never commit sensitive information to the repository
- Ensure you have the correct Node.js and npm versions installed
- Always use environment variables for sensitive information

