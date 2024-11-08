import hre from "hardhat";
import { parseEther, formatEther, createWalletClient, custom, http } from "viem";
import { DAOContract, GovernanceTokenContract } from '../interfaces/contracts';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from "viem/chains";

export interface DeployedContracts {
  dao: DAOContract;
  governanceToken: GovernanceTokenContract;
  owner: { account: { address: string }};
  user1: { account: { address: string }};
  user2: { account: { address: string }};
  user3: { account: { address: string }};
  publicClient: any;
}

// Funzione di utility per il logging delle transazioni
async function logTransaction(description: string, address: string) {
  console.log("\n" + "=".repeat(50));
  console.log(`${description}`);
  console.log(`Contract Address: ${address}`);
  console.log("=".repeat(50) + "\n");
}

// Funzione migliorata per attendere la conferma della transazione
async function waitForTransactionConfirmation(
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

// Funzione semplificata per creare un wallet client per la rete pubblica
async function createPublicNetworkWalletClient(privateKey: string) {
  const account = privateKeyToAccount(`0x${privateKey}` as `0x${string}`);
  
  // Usa l'accesso diretto alla rete arbitrumSepolia configurata in hardhat.config.ts
  const networkUrl = (hre.config.networks.arbitrumSepolia as any).url;

  return createWalletClient({
    account,
    chain: arbitrumSepolia,
    transport: http(networkUrl)
  });
}

// Funzione per eseguire una transazione con gestione degli errori
async function executeTransaction<T>(
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

// Funzione principale per il deployment
export async function deployContractsFixture(isDirectDeploy: boolean = false) {
  const isTestNetwork = hre.network.name === 'hardhat' || hre.network.name === 'localhost';
  
  let owner, user1, user2, user3;
  
  if (isTestNetwork) {
    [owner, user1, user2, user3] = await hre.viem.getWalletClients();
  } else {
    // Per reti pubbliche, usa le chiavi private dall'ambiente
    const ownerKey = process.env.PRIVATE_KEY;
    const user1Key = process.env.USER1_PRIVATE_KEY;
    const user2Key = process.env.USER2_PRIVATE_KEY;
    const user3Key = process.env.USER3_PRIVATE_KEY;

    if (!ownerKey) throw new Error("Missing PRIVATE_KEY in environment");
    
    owner = await createPublicNetworkWalletClient(ownerKey);
    if (user1Key) user1 = await createPublicNetworkWalletClient(user1Key);
    if (user2Key) user2 = await createPublicNetworkWalletClient(user2Key);
    if (user3Key) user3 = await createPublicNetworkWalletClient(user3Key);
  }
  
  const publicClient = await hre.viem.getPublicClient();

  if (isDirectDeploy) {
    console.log("\n🚀 Starting deployment process...\n");
    console.log(`Network: ${hre.network.name}`);
    console.log(`\n👤 Deployer Address: ${owner.account.address}`);
    const balance = await publicClient.getBalance({ address: owner.account.address });
    console.log(`💰 Deployer Balance: ${formatEther(balance)} ETH\n`);
  }

  // Deploy GovernanceToken
  const governanceToken = await executeTransaction(
    async () => (await hre.viem.deployContract("GovernanceToken")) as unknown as GovernanceTokenContract,
    publicClient,
    isTestNetwork,
    "GovernanceToken Deployment"
  );

  if (isDirectDeploy) {
    await logTransaction("📝 GovernanceToken Deployment", governanceToken.address);
  }

  // Deploy DAO
  const dao = await executeTransaction(
    async () => (await hre.viem.deployContract("DAO", [governanceToken.address])) as unknown as DAOContract,
    publicClient,
    isTestNetwork,
    "DAO Deployment"
  );

  if (isDirectDeploy) {
    await logTransaction("🏛️ DAO Deployment", dao.address);
  }

  // Transfer ownership
  await executeTransaction(
    async () => governanceToken.write.transferOwnership([dao.address], { account: owner.account.address }),
    publicClient,
    isTestNetwork,
    "Ownership Transfer"
  );

  // Setup token distribution solo se siamo in test network o se abbiamo le chiavi degli utenti
  if (isTestNetwork || (user1 && user2)) {
    const tokenPrice = parseEther("0.01");
    const distributions = [
      { account: owner, amount: 100n, description: "Owner" },
      ...(user1 ? [{ account: user1, amount: 50n, description: "User1" }] : []),
      ...(user2 ? [{ account: user2, amount: 25n, description: "User2" }] : [])
    ];

    for (const { account, amount, description } of distributions) {
      try {
        await executeTransaction(
          async () => governanceToken.write.buyTokens({
            value: tokenPrice * amount,
            account: account.account.address,
          }),
          publicClient,
          isTestNetwork,
          `${description} Token Purchase`
        );
      } catch (error) {
        console.warn(`Warning: Failed to distribute tokens to ${description}`, error);
        // Continue with deployment even if token distribution fails
      }
    }
  }

  if (isDirectDeploy) {
    console.log("\n✅ Deployment Summary");
    console.log("=".repeat(50));
    console.log(`🏛️  DAO Address: ${dao.address}`);
    console.log(`💰 GovernanceToken Address: ${governanceToken.address}`);
    console.log(`👤 Owner Address: ${owner.account.address}`);
    console.log("=".repeat(50) + "\n");
  }

  return {
    dao,
    governanceToken,
    owner,
    user1,
    user2,
    user3,
    publicClient,
  };
}

// Le funzioni di fixture per i test rimangono invariate
export async function deployGovernanceTokenFixture() {
  const [owner, addr1, addr2] = await hre.viem.getWalletClients();
  const governanceToken = (await hre.viem.deployContract("GovernanceToken")) as unknown as GovernanceTokenContract;
  const publicClient = await hre.viem.getPublicClient();
  return { governanceToken, owner, addr1, addr2, publicClient };
}

export async function deployDAOFixture() {
  const [owner, addr1, addr2, addr3] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  const governanceToken = await hre.viem.deployContract("GovernanceToken");
  const dao = await hre.viem.deployContract("DAO", [governanceToken.address]);
  const transferTx = await governanceToken.write.transferOwnership([dao.address], { account: owner.account.address });
  await publicClient.waitForTransactionReceipt({ hash: transferTx });
  return { dao, governanceToken, publicClient, owner, addr1, addr2, addr3 };
}

// Funzione principale per l'esecuzione diretta dello script
async function main() {
  try {
    await deployContractsFixture(true);
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    process.exitCode = 1;
  }
}

// Esegui il deployment solo se lo script è eseguito direttamente
if (require.main === module) {
  main();
}