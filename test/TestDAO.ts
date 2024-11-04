import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { parseEther } from "viem";

describe("DAO", function () {
  async function deployDAOFixture() {
    const [owner, addr1, addr2, addr3] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    // Prima deployiamo il GovernanceToken
    const governanceToken = await hre.viem.deployContract("GovernanceToken");

    // Poi deployiamo il DAO passando l'indirizzo del token come parametro
    const dao = await hre.viem.deployContract("DAO", [governanceToken.address]);
    
    // Importante: Transfiere ownership del GovernanceToken al DAO
    const transferTx = await governanceToken.write.transferOwnership(
      [dao.address],
      { account: owner.account.address }
    );
    await publicClient.waitForTransactionReceipt({ hash: transferTx });

    return { dao, governanceToken, publicClient, owner, addr1, addr2, addr3 };
  }

  describe("Proposal Creation and Management", function () {     

    it("Should allow members to create proposals", async function () {
      const { dao, governanceToken, addr1, publicClient } = await loadFixture(deployDAOFixture);
      
      // Compra token per addr1 utilizzando direttamente il contratto `governanceToken`
      const buyTokensTx = await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01")
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTokensTx });
      
      // Verifica saldo token per addr1
      const balance = await governanceToken.read.balanceOf([addr1.account.address]);
      expect(Number(balance)).to.be.greaterThan(0);
      console.log("PRIMO_LOG:Balance after buying tokens:", balance.toString());

      // Crea una proposta
      const createProposalTx = await dao.write.createProposal(
        ["Test Proposal", "Description", addr1.account.address, parseEther("1")],
        { account: addr1.account.address }
      );
      await publicClient.waitForTransactionReceipt({ hash: createProposalTx });
      
      // Verifica la proposta
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.title).to.equal("Test Proposal");
      expect(proposal.proposer.toLowerCase()).to.equal(addr1.account.address.toLowerCase());
    });
    
    it("Should not allow non-members to create proposals", async function () {
      const { dao, addr2 } = await loadFixture(deployDAOFixture);
      
      // Tenta di creare una proposta senza possedere token
      await expect(
        dao.write.createProposal(
          ["Test Proposal", "Description", addr2.account.address, parseEther("1")],
          { account: addr2.account.address }
        )
      ).to.be.rejectedWith("Solo i membri possono creare proposte");
    });

    it("Should allow a token-holding account to vote on a proposal", async function () {
      const { dao, governanceToken, addr1, addr2, publicClient } = await loadFixture(deployDAOFixture);
    
      // Step 1: Compra token per `addr1` e `addr2`
      const buyTokensTx1 = await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.02")
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTokensTx1 });
    
      const buyTokensTx2 = await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01")
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTokensTx2 });
    
      // Verifica che `addr1` e `addr2` abbiano un bilancio token positivo
      const balance1 = await governanceToken.read.balanceOf([addr1.account.address]);
      const balance2 = await governanceToken.read.balanceOf([addr2.account.address]);
    
      expect(Number(balance1)).to.be.a("number").and.to.be.gt(0, "addr1 dovrebbe possedere dei token per votare");
      expect(Number(balance2)).to.be.a("number").and.to.be.gt(0, "addr2 dovrebbe possedere dei token per votare");
    
      // Step 2: Creazione di una proposta con `addr1`
      const createProposalTx = await dao.write.createProposal(
        ["Fund Project", "Fund development", addr2.account.address, parseEther("1")],
        { account: addr1.account.address }
      );
      await publicClient.waitForTransactionReceipt({ hash: createProposalTx });
    
      // Verifica che la proposta sia stata creata con successo
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.id).to.equal(0n);
    
      // Step 3: `addr1` vota sulla proposta appena creata
      const voteTx1 = await dao.write.vote(
        [0n, true, false], // Usa `0n` come `proposalId` per il tipo `bigint`
        { account: addr1.account.address }
      );
      await publicClient.waitForTransactionReceipt({ hash: voteTx1 });
    
      // Verifica che il voto sia stato registrato senza errori
      const updatedProposal = await dao.read.getProposal([0n]);
      expect(Number(updatedProposal.forVotes)).to.be.gt(0, "Il voto di `addr1` dovrebbe essere registrato nella proposta");
    });
  });
  describe("Proposal Execution", function () {
    it("Should execute approved proposals", async function () {
      const { dao, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal([
        "Test Proposal",
        "Description",
        addr1.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
      
      await dao.write.vote([0n, true, false], { 
        account: addr1.account.address 
      });
      await dao.write.vote([0n, true, false], { 
        account: addr2.account.address 
      });
      
      await dao.write.executeProposal([0n], { 
        account: addr1.account.address 
      });
      
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;
    });
  
    it("Should handle multiple proposal execution", async function () {
      const { dao, addr1 } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal([
        "Proposal 1",
        "Description 1",
        addr1.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
      await dao.write.createProposal([
        "Proposal 2",
        "Description 2",
        addr1.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
      
      await dao.write.vote([0n, true, false], { 
        account: addr1.account.address 
      });
      await dao.write.vote([1n, true, false], { 
        account: addr1.account.address 
      });
      
      await dao.write.executeMultipleProposals([[0n, 1n]], { 
        account: addr1.account.address 
      });
      
      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);
      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
    });
  });
  describe("Voting Period Management", function () {
    it("Should close voting after duration", async function () {
      const { dao, owner } = await loadFixture(deployDAOFixture);
      
      await dao.write.createProposal([
        "Test Proposal",
        "Description",
        owner.account.address,
        parseEther("1")
      ], {
        account: owner.account.address
      });
      
      // Fast forward time
      await time.increase(7 * 24 * 60 * 60 + 1); // 1 week + 1 second
      
      await dao.write.recoverUnexecutedProposals({ 
        account: owner.account.address 
      });
      
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
    });
  });
});





