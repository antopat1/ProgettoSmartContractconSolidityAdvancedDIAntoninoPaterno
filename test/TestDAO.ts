import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { parseEther } from "viem";
import { deployDAOFixture } from "../scripts/deployContracts";

describe("DAO Governance Token Tests", function () {
  
  describe("Proposal Voting and Execution with Token Transfers", function () {
    
    it("Should allow a token-holding account to vote on a proposal", async function () {
      const { dao, governanceToken, addr1, addr2, publicClient } = await loadFixture(deployDAOFixture);

      // Step 1: Acquista token per addr1 e addr2
      const buyTokensTx1 = await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.02"),
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTokensTx1 });

      const buyTokensTx2 = await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01"),
      });
      await publicClient.waitForTransactionReceipt({ hash: buyTokensTx2 });

      // Verifica che addr1 e addr2 abbiano bilanci positivi
      const balance1 = await governanceToken.read.balanceOf([addr1.account.address]);
      const balance2 = await governanceToken.read.balanceOf([addr2.account.address]);
      expect(Number(balance1)).to.be.gt(0);
      expect(Number(balance2)).to.be.gt(0);

      // Step 2: Creazione di una proposta con addr1
      const createProposalTx = await dao.write.createProposal(
        ["Fund Project", "Fund development", addr2.account.address, parseEther("1")],
        { account: addr1.account.address }
      );
      await publicClient.waitForTransactionReceipt({ hash: createProposalTx });

      // Verifica che la proposta sia stata creata
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.title).to.equal("Fund Project");

      // Step 3: addr1 vota sulla proposta
      const voteTx1 = await dao.write.vote([0n, true, false], { account: addr1.account.address });
      await publicClient.waitForTransactionReceipt({ hash: voteTx1 });

      // Verifica che il voto sia registrato
      const updatedProposal = await dao.read.getProposal([0n]);
      expect(Number(updatedProposal.forVotes)).to.be.gt(0);
    });

    it("Should execute proposal and transfer tokens when majority is reached", async function () {
      const { dao, governanceToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);

      // Step 1: Membri acquistano token
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.02"),
      });
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01"),
      });

      const proposalAmount = parseEther("1");
      await dao.write.createProposal(
        ["Financial Proposal", "Transfer tokens to addr3", addr3.account.address, proposalAmount],
        { account: addr1.account.address }
      );

      // Step 3: addr1 vota a favore, addr2 vota contro
      await dao.write.vote([0n, true, false], { account: addr1.account.address });
      await dao.write.vote([0n, false, false], { account: addr2.account.address });

      // Step 4: Esegui la proposta
      await dao.write.executeProposal([0n], { account: addr1.account.address });

      // Step 5: Verifica trasferimento token
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;

      const recipientBalance = await governanceToken.read.balanceOf([addr3.account.address]);
      expect(recipientBalance).to.equal(proposalAmount);
    });

    it("Should not execute proposal when majority is not reached", async function () {
      const { dao, governanceToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);

      // Distribuzione token inversa
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01"),
      });
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.02"),
      });

      const proposalAmount = parseEther("1");
      await dao.write.createProposal(
        ["Financial Proposal", "Transfer tokens to addr3", addr3.account.address, proposalAmount],
        { account: addr1.account.address }
      );

      await dao.write.vote([0n, true, false], { account: addr1.account.address });
      await dao.write.vote([0n, false, false], { account: addr2.account.address });

      await dao.write.executeProposal([0n], { account: addr1.account.address });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.false;

      const recipientBalance = await governanceToken.read.balanceOf([addr3.account.address]);
      expect(recipientBalance).to.equal(0n);
    });
  });

  describe("Proposal Expiration and Voting Period", function () {

    it("Should handle proposal expiration correctly", async function () {
      const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);

      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01"),
      });
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01"),
      });

      await dao.write.createProposal(
        ["Expiry Proposal", "Test proposal expiration", addr2.account.address, parseEther("1")],
        { account: addr1.account.address }
      );

      await dao.write.vote([0n, true, false], { account: addr1.account.address });
      const proposalBeforeExpiry = await dao.read.getProposal([0n]);
      expect(Number(proposalBeforeExpiry.forVotes)).to.be.greaterThan(0);

      await time.increase(7 * 24 * 60 * 60 + 1);
      await dao.write.recoverUnexecutedProposals({ account: addr1.account.address });

      await expect(
        dao.write.vote([0n, true, false], { account: addr2.account.address })
      ).to.be.rejectedWith("Proposta gia' eseguita.");

      const proposalAfterExpiry = await dao.read.getProposal([0n]);
      expect(proposalAfterExpiry.executed).to.be.true;
      expect(proposalAfterExpiry.passed).to.be.false;
    });

    it("Should allow multiple proposal recovery at once", async function () {
      const { dao, governanceToken, addr1 } = await loadFixture(deployDAOFixture);

      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01"),
      });

      for (let i = 0; i < 3; i++) {
        await dao.write.createProposal(
          [`Proposal ${i}`, "Testing multiple proposals", addr1.account.address, parseEther("1")],
          { account: addr1.account.address }
        );
      }

      await time.increase(7 * 24 * 60 * 60 + 1);
      await dao.write.recoverUnexecutedProposals({ account: addr1.account.address });

      for (let i = 0; i < 3; i++) {
        const proposal = await dao.read.getProposal([BigInt(i)]);
        expect(proposal.executed).to.be.true;
        expect(proposal.passed).to.be.false;
      }
    });
    
    it("Should track proposal timing correctly", async function () {
      const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      // Acquisto token iniziale
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01")
      });
    
      // Creazione della proposta
      await dao.write.createProposal([
        "Proposta con timing",
        "Test del timing della proposta",
        addr2.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
    
      // Avanzamento del tempo di quasi una settimana (6 giorni)
      await time.increase(6 * 24 * 60 * 60);
    
      // Verifica che il voto sia ancora possibile
      await dao.write.vote([0n, true, false], {
        account: addr1.account.address
      });
    
      const proposalMidway = await dao.read.getProposal([0n]);
      expect(proposalMidway.executed).to.be.false;
      
      // Avanzamento del tempo oltre la scadenza
      await time.increase(2 * 24 * 60 * 60); 
    
      // Recupero della proposta scaduta
      await dao.write.recoverUnexecutedProposals({
        account: addr1.account.address
      });
    
      const proposalEnd = await dao.read.getProposal([0n]);
      expect(proposalEnd.executed).to.be.true;
    });

  });
});


