import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { parseEther } from "viem";
import { toAddress } from '../interfaces/contracts';
import { deployGovernanceTokenFixture } from "../scripts/deployContracts";

describe("GovernanceToken", function () {
  describe("Token Purchase", function () {
    it("Should allow users to buy tokens with correct ETH amount", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      const tokenPrice = await governanceToken.read.TOKEN_PRICE();

      await governanceToken.write.buyTokens({ 
        value: parseEther("0.1"), 
        account: toAddress(addr1.account) 
      });

      const balance = await governanceToken.read.balanceOf([addr1.account.address]);
      expect(balance).to.equal(parseEther("10"));
    });

    it("Should update total supply after token purchase", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      
      const initialSupply = await governanceToken.read.totalSupply();
      await governanceToken.write.buyTokens({ 
        value: parseEther("0.1"), 
        account: toAddress(addr1.account) 
      });
      
      const finalSupply = await governanceToken.read.totalSupply();
      expect(finalSupply).to.equal(initialSupply + 10n * parseEther("1"));
    });

    it("Should not allow purchase with 0 ETH", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      
      await expect(
        governanceToken.write.buyTokens({ 
          value: 0n, 
          account: toAddress(addr1.account) 
        })
      ).to.be.rejectedWith("Devi inviare Ether per acquistare token");
    });
  });

  describe("Withdrawal", function () {
    it("Should allow owner to withdraw accumulated ETH", async function () {
      const { governanceToken, owner, addr1, publicClient } = await loadFixture(deployGovernanceTokenFixture);
      
      await governanceToken.write.buyTokens({ 
        value: parseEther("0.1"), 
        account: toAddress(addr1.account) 
      });
      
      const initialBalance = await publicClient.getBalance({ 
        address: owner.account.address 
      });
      
      await governanceToken.write.withdraw({ 
        account: owner.account 
      });
      
      const finalBalance = await publicClient.getBalance({ 
        address: owner.account.address 
      });
      
      expect(finalBalance > initialBalance).to.be.true;
    });

    it("Should not allow non-owner to withdraw", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      
      await expect(
        governanceToken.write.withdraw({ 
          account: addr1.account 
        })
      ).to.be.rejected;
    });
  });

  describe("Token Balance Management", function () {
    it("Should accurately track multiple purchases from same address", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      
      await governanceToken.write.buyTokens({ 
        value: parseEther("0.05"), 
        account: toAddress(addr1.account) 
      });
      await governanceToken.write.buyTokens({ 
        value: parseEther("0.05"), 
        account: toAddress(addr1.account) 
      });
      
      const finalBalance = await governanceToken.read.balanceOf([addr1.account.address]);
      expect(finalBalance).to.equal(10n * parseEther("1"));
    });

    it("Should protect against reentrancy attacks", async function () {
      const { governanceToken, addr1 } = await loadFixture(deployGovernanceTokenFixture);
      
      await Promise.all([
        governanceToken.write.buyTokens({ 
          value: parseEther("0.01"), 
          account: toAddress(addr1.account) 
        }),
        governanceToken.write.buyTokens({ 
          value: parseEther("0.01"), 
          account: toAddress(addr1.account) 
        })
      ]);
      
      const balance = await governanceToken.read.balanceOf([addr1.account.address]);
      expect(balance).to.equal(2n * parseEther("1"));
    });
  });
});

