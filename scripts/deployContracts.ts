import hre from "hardhat";
import { parseEther } from "viem";
import { DAOContract, GovernanceTokenContract } from '../interfaces/contracts';

export interface DeployedContracts {
  dao: DAOContract;
  governanceToken: GovernanceTokenContract;
  owner: { account: { address: string }};
  user1: { account: { address: string }};
  user2: { account: { address: string }};
  user3: { account: { address: string }};
  publicClient: any;
}

// Funzione per deployare sia DAO che GovernanceToken
export async function deployContractsFixture() {
  const [owner, user1, user2, user3] = await hre.viem.getWalletClients();

  const governanceToken = (await hre.viem.deployContract(
    "GovernanceToken"
  )) as unknown as GovernanceTokenContract;
  
  const dao = (await hre.viem.deployContract("DAO", [
    governanceToken.address,
  ])) as unknown as DAOContract;

  const publicClient = await hre.viem.getPublicClient();

  // NOTA: Transferiamo l'ownership del GovernanceToken al contratto DAO
  await governanceToken.write.transferOwnership([dao.address], {
    account: owner.account.address,
  });

  // Acquisto token per i test
  const tokenPrice = parseEther("0.01");
  await governanceToken.write.buyTokens({
    value: tokenPrice * 100n,
    account: owner.account.address,
  });

  await governanceToken.write.buyTokens({
    value: tokenPrice * 50n,
    account: user1.account.address,
  });

  await governanceToken.write.buyTokens({
    value: tokenPrice * 25n,
    account: user2.account.address,
  });

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

// Funzione specifica per deployare GovernanceToken
export async function deployGovernanceTokenFixture() {
  const [owner, addr1, addr2] = await hre.viem.getWalletClients();

  const governanceToken = (await hre.viem.deployContract(
    "GovernanceToken"
  )) as unknown as GovernanceTokenContract;

  const publicClient = await hre.viem.getPublicClient();
  return { governanceToken, owner, addr1, addr2, publicClient };
}

export async function deployDAOFixture() {
  const [owner, addr1, addr2, addr3] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();

  const governanceToken = await hre.viem.deployContract("GovernanceToken");

  const dao = await hre.viem.deployContract("DAO", [governanceToken.address]);

  const transferTx = await governanceToken.write.transferOwnership(
    [dao.address],
    { account: owner.account.address }
  );
  await publicClient.waitForTransactionReceipt({ hash: transferTx });

  return { dao, governanceToken, publicClient, owner, addr1, addr2, addr3 };
}