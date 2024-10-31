import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
// import { time } from "@nomicfoundation/hardhat-toolbox-viem/time";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { parseEther } from "viem";

describe("DAO", function () {
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3] = await hre.viem.getWalletClients();
    
    // Deploy the contract
    const dao = await hre.viem.deployContract("DAO");
    
    // Buy some tokens for testing
    await dao.write.buyTokens({ value: parseEther("0.1"), account: addr1.account });
    await dao.write.buyTokens({ value: parseEther("0.2"), account: addr2.account });
    
    return { dao, owner, addr1, addr2, addr3 };
  }

  describe("Proposal Creation and Management", function () {
    it("Should allow members to create proposals", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal(["Test Proposal", "Description", addr1.account.address, parseEther("1")], {
        account: addr1.account
      });
      
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.title).to.equal("Test Proposal");
    });

    it("Should track voting correctly", async function () {
      const { dao, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal(["Test Proposal", "Description", addr1.account.address, parseEther("1")], {
        account: addr1.account
      });
      
      await dao.write.vote([0n, true, false], { account: addr1.account });
      await dao.write.vote([0n, true, false], { account: addr2.account });
      
      const proposal = await dao.read.getProposal([0n]);
      const expectedVotes = parseEther("0.3"); // 0.1 + 0.2 ETH worth of tokens
      expect(proposal.forVotes).to.equal(expectedVotes);
    });

    it("Should not allow non-token holders to vote", async function () {
      const { dao, addr3 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal(["Test Proposal", "Description", addr3.account.address, parseEther("1")], {
        account: addr3.account
      });
      
      await expect(
        dao.write.vote([0n, true, false], { account: addr3.account })
      ).to.be.rejectedWith("Devi possedere dei token per votare");
    });
  });

  describe("Proposal Execution", function () {
    it("Should execute approved proposals", async function () {
      const { dao, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal(["Test Proposal", "Description", addr1.account.address, parseEther("1")], {
        account: addr1.account
      });
      
      await dao.write.vote([0n, true, false], { account: addr1.account });
      await dao.write.vote([0n, true, false], { account: addr2.account });
      
      await dao.write.executeProposal([0n], { account: addr1.account });
      
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;
    });

    it("Should handle multiple proposal execution", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      // Create multiple proposals
      await dao.write.createProposal(["Proposal 1", "Description 1", addr1.account.address, parseEther("1")], {
        account: addr1.account
      });
      await dao.write.createProposal(["Proposal 2", "Description 2", addr1.account.address, parseEther("1")], {
        account: addr1.account
      });
      
      // Vote on both proposals
      await dao.write.vote([0n, true, false], { account: addr1.account });
      await dao.write.vote([1n, true, false], { account: addr1.account });
      
      // Execute multiple proposals
      await dao.write.executeMultipleProposals([[0n, 1n]], { account: addr1.account });
      
      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);
      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
    });
  });

  describe("Voting Period Management", function () {
    it("Should close voting after duration", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal(["Test Proposal", "Description", owner.account.address, parseEther("1")], {
        account: owner.account
      });
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 1); // 1 week + 1 second
      
      await dao.write.recoverUnexecutedProposals({ account: owner.account });
      
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
    });
  });
});