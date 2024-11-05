import { HardhatRuntimeEnvironment } from "hardhat/types";
import { parseEther } from "viem";
import { DAOContract, GovernanceTokenContract } from '../interfaces/contracts';

export interface DeployedContracts {
  dao: DAOContract;
  governanceToken: GovernanceTokenContract;
  owner: string;
  user1: string;
  user2: string;
  user3: string;
  publicClient: any;
}

export async function deployContractsFixture(hre: HardhatRuntimeEnvironment): Promise<DeployedContracts> {
  const [owner, user1, user2, user3] = await hre.viem.getWalletClients();

  // Deploy GovernanceToken
  const governanceToken = (await hre.viem.deployContract(
    "GovernanceToken"
  )) as unknown as GovernanceTokenContract;

  // Deploy DAO with GovernanceToken address
  const dao = (await hre.viem.deployContract("DAO", [
    governanceToken.address,
  ])) as unknown as DAOContract;

  const publicClient = await hre.viem.getPublicClient();

  // Transfer ownership of GovernanceToken to DAO
  await governanceToken.write.transferOwnership([dao.address], {
    account: owner.account.address,
  });

  // Buy tokens for testing
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
    owner: owner.account.address,
    user1: user1.account.address,
    user2: user2.account.address,
    user3: user3.account.address,
    publicClient,
  };
}