import hre from "hardhat";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from "viem/chains";
import { Account , getAddress } from "viem";

// Funzione helper per convertire un Account in 0x${string}
export function toAddress(account: Account): `0x${string}` {
  return getAddress(account.address);
}

// Utility function for logging transactions
export async function logTransaction(description: string, address: string) {
  console.log("\n" + "=".repeat(50));
  console.log(`${description}`);
  console.log(`Contract Address: ${address}`);
  console.log("=".repeat(50) + "\n");
}

// Utility function for waiting for transaction confirmation
export async function waitForTransactionConfirmation(
  publicClient: any,
  hash: `0x${string}`,
  maxAttempts: number = 3
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') return;
      throw new Error(`Transaction failed with status: ${receipt.status}`);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Utility function for creating a public network wallet client
export async function createPublicNetworkWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);
  const networkUrl = (hre.config.networks.arbitrumSepolia as any).url;
  return createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(networkUrl)
  });
}

// Utility function for executing transactions with error handling
export async function executeTransaction<T>(
  action: () => Promise<T>,
  publicClient: any,
  isTestNetwork: boolean,
  description?: string
): Promise<T> {
  try {
    const result = await action();
    if (!isTestNetwork && typeof result === 'string' && result.startsWith('0x')) {
      await waitForTransactionConfirmation(publicClient, result as `0x${string}`);
    }
    if (description) {
      console.log(`✅ ${description} completed successfully`);
    }
    return result;
  } catch (error) {
    console.error(`❌ Error during ${description || 'transaction'}:`, error);
    throw error;
  }
}

// // Utility function for logging deployment start information
// export async function logDeploymentStart(owner: any, publicClient: any) {
//   console.log("\n🚀 Starting deployment process...\n");
//   console.log(`Network: ${hre.network.name}`);
//   console.log(`\n👤 Deployer Address: ${owner.account.address}`);
//   const balance = await publicClient.getBalance({ address: owner.account.address });
//   console.log(`💰 Deployer Balance: ${formatEther(balance)} ETH\n`);
// }

// // Utility function for logging deployment summary
// export function logDeploymentSummary(daoAddress: string, tokenAddress: string, ownerAddress: string) {
//   console.log("\n✅ Deployment Summary");
//   console.log("=".repeat(50));
//   console.log(`🏛️  DAO Address: ${daoAddress}`);
//   console.log(`💰 GovernanceToken Address: ${tokenAddress}`);
//   console.log(`👤 Owner Address: ${ownerAddress}`);
//   console.log("=".repeat(50) + "\n");
// }