import { Account , getAddress } from "viem";
import { expect } from "chai";

export const compareBigInt = (actual: bigint, expected: bigint) => {
  return {
    eq: () => expect(actual === expected).to.be.true,
    gt: () => expect(actual > expected).to.be.true,
    gte: () => expect(actual >= expected).to.be.true,
    lt: () => expect(actual < expected).to.be.true,
    lte: () => expect(actual <= expected).to.be.true,
  };
};

export interface DAOContract {
    address: `0x${string}`;
    write: {
      createProposal(
        args: readonly [string, string, `0x${string}`, bigint],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      vote(
        args: readonly [bigint, boolean, boolean],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      executeProposal(
        args: readonly [bigint],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      executeMultipleProposals(
        args: readonly [bigint[]],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      closeVoting(options?: { account: `0x${string}` }): Promise<`0x${string}`>;
    };
    read: {
      getProposal(args: readonly [bigint]): Promise<any>;
      executive(): Promise<bigint>;
    };
  }
  
  export interface GovernanceTokenContract {
    address: `0x${string}`;
    write: {
      buyTokens(options?: {
        value: bigint;
        account: `0x${string}`;
      }): Promise<`0x${string}`>;
      transferOwnership(
        args: readonly [`0x${string}`],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      mint(
        args: readonly [`0x${string}`, bigint],
        options?: { account: `0x${string}` }
      ): Promise<`0x${string}`>;
      withdraw(options?: { account: Account }): Promise<`0x${string}`>;
    };
    read: {
      TOKEN_PRICE(): Promise<bigint>;
      balanceOf(args: readonly [`0x${string}`]): Promise<bigint>;
      totalSupply(): Promise<bigint>;
    };
  }

// Funzione helper per convertire un Account in 0x${string}
export function toAddress(account: Account): `0x${string}` {
    return getAddress(account.address);
  }

