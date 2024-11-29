import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";
import { deployContractsFixture } from "../scripts/deployContracts";

describe("DAO Contract Tests", function () {
  describe("Proposal Creation", function () {
    it("Should create a proposal with a unique ID and all correct details", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      const title = "Prima Proposta";
      const description = "Descrizione dettagliata della prima proposta";
      const recipient = user1.account.address as `0x${string}`;
      const amount = 1000n;

      await dao.write.createProposal([title, description, recipient, amount], {
        account: owner.account.address as `0x${string}`,
      });

      const proposal = await dao.read.getProposal([0n]);

      expect(proposal.id).to.equal(0n);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(recipient));
      expect(proposal.amount).to.equal(amount);
      expect(getAddress(proposal.proposer)).to.equal(getAddress(owner.account.address));
      expect(proposal.executed).to.be.false;
      expect(proposal.passed).to.be.false;
      expect(proposal.forVotes).to.equal(0n);
      expect(proposal.againstVotes).to.equal(0n);
      expect(proposal.abstainVotes).to.equal(0n);
    });
    
    it("Should reject proposals with an empty description", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await expect(
        dao.write.createProposal(
          ["Titolo", "", user1.account.address, 100n],
          { account: owner.account.address }
        )
      ).to.be.rejectedWith("La descrizione non puo' essere vuota");
    });
   

    it("Should allow proposals without recipient and amount", async function () {
      const { dao, owner } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        [
          "Proposta Semplice",
          "Solo descrizione",
          "0x0000000000000000000000000000000000000000",
          0n,
        ],
        { account: owner.account.address }
      );

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.amount).to.equal(0n);
      expect(getAddress(proposal.recipient)).to.equal(
        getAddress("0x0000000000000000000000000000000000000000")
      );
    });
  });

  describe("Voting and Execution", function () {
  

    it("Should allow token holders to vote", async function () {
      const { dao, owner } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        [
          "Proposta Test",
          "Descrizione test",
          "0x0000000000000000000000000000000000000000",
          0n,
        ],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.forVotes > 0n).to.be.true;
    });

    it("Should correctly execute an approved proposal", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Proposta Test", "Descrizione test", user1.account.address, 100n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.executeProposal([0n], { account: owner.account.address });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Closing Votes", function () {
    it("Should allow closing of votes only after all proposals are executed", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Proposta Finale", "Descrizione", user1.account.address, 100n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.executeProposal([0n], { account: owner.account.address });
      await dao.write.closeVoting({ account: owner.account.address });

      const executive = await dao.read.executive();
      expect(executive).to.equal(false);
    });

    it("Should not allow voting on a proposal after it has been executed", async function () {
      const { dao, owner, user1, user2 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Proposta Test", "Descrizione della proposta", user1.account.address, 100n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.executeProposal([0n], { account: owner.account.address });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      
      if (!user2) {
        throw new Error("user1 is required for this test");
      }

      await expect(
        dao.write.vote([0n, true, false], { account: user2.account.address })
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });
  });

  describe("Voting System", function () {
    it("Should allow votes in favor, against, and abstentions", async function () {
      const { dao, owner, user1, user2 } = await loadFixture(deployContractsFixture);
      
      if (!user1  || !user2 ) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Test Votazione", "Descrizione", user1.account.address, 100n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.vote([0n, false, false], { account: user1.account.address });
      await dao.write.vote([0n, false, true], { account: user2.account.address });

      const proposal = await dao.read.getProposal([0n]);
      expect(Number(proposal.forVotes)).to.be.greaterThan(0);
      expect(Number(proposal.againstVotes)).to.be.greaterThan(0);
      expect(Number(proposal.abstainVotes)).to.be.greaterThan(0);
    });
    
    it("Should not allow proposal creation and voting by non-token holders", async function () {
      const { dao, user3, owner } = await loadFixture(deployContractsFixture);
    
      // Controllo che user3 esista nel contesto del test
      if (!user3) {
        throw new Error("user3 is required for this test");
      }
    
      // Verifica che un utente senza token non possa creare una proposta
      await expect(
        dao.write.createProposal(
          ["Proposta Test", "Descrizione", user3.account.address, 10n], // Parametri di una proposta
          { account: user3.account.address } // Proposta inviata da user3
        )
      ).to.be.rejectedWith("Solo i membri possono creare proposte");
    
      // Creazione di una proposta valida da parte del proprietario (owner)
      await dao.write.createProposal(
        ["Proposta Test", "Descrizione", user3.account.address, 10n],
        { account: owner.account.address }
      );
    
      // Verifica che un utente senza token non possa votare sulla proposta
      await expect(
        dao.write.vote(
          [0n, true, false], // Parametri del voto: proposalId = 0, a favore = true, contrario = false
          { account: user3.account.address } // Voto inviato da user3
        )
      ).to.be.rejectedWith("Devi possedere dei token per votare");
    });

    // it("Should not allow proposal creation and voting by non-token holders", async function () {
    //   const { dao, user3, owner } = await loadFixture(deployContractsFixture);
      
    //   if (!user3) {
    //     throw new Error("user1 is required for this test");
    //   }

    //   await expect(
    //     dao.write.createProposal(
    //       ["Proposta Test", "Descrizione", user3.account.address, 0n],
    //       { account: user3.account.address }
    //     )
    //   ).to.be.rejectedWith("Solo i membri possono creare proposte");

    //   await dao.write.createProposal(
    //     ["Proposta Test", "Descrizione", user3.account.address, 0n],
    //     { account: owner.account.address }
    //   );

    //   await expect(
    //     dao.write.vote([0n, true, false], { account: user3.account.address })
    //   ).to.be.rejectedWith("Devi possedere dei token per votare");
    // });
  });

  describe("Proposal Execution", function () {
    it("Should correctly execute an approved proposal", async function () {
      const { dao, owner, user1, governanceToken } = await loadFixture(
        deployContractsFixture
      );
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Proposta di Finanziamento", "Descrizione", user1.account.address, 1000n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.executeProposal([0n], { account: owner.account.address });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;

      const balance = await governanceToken.read.balanceOf([user1.account.address]);
      expect(balance > 0n).to.be.true;
    });

    it("Should not execute an already executed proposal", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
      
      if (!user1) {
        throw new Error("user1 is required for this test");
      }

      await dao.write.createProposal(
        ["Proposta Test", "Descrizione", user1.account.address, 100n],
        { account: owner.account.address }
      );

      await dao.write.vote([0n, true, false], { account: owner.account.address });
      await dao.write.executeProposal([0n], { account: owner.account.address });

      await expect(
        dao.write.executeProposal([0n], { account: owner.account.address })
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });

    it("Should correctly handle multiple proposals and prevent double voting", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);
    
      if (!user1) {
        throw new Error("user1 is required for this test");
      }
    
      // Creazione di due proposte
      await dao.write.createProposal(
        ["Proposta 1", "Descrizione 1", user1.account.address, 100n],
        { account: owner.account.address }
      );
    
      await dao.write.createProposal(
        ["Proposta 2", "Descrizione 2", user1.account.address, 200n],
        { account: owner.account.address }
      );
    
      // Voto dell'utente sulla prima proposta
      await dao.write.vote([0n, true, false], { account: owner.account.address });
    
      // Tenta di votare di nuovo sulla stessa proposta (deve fallire)
      await expect(
        dao.write.vote([0n, false, false], { account: owner.account.address })
      ).to.be.rejectedWith("Hai gia' votato su questa proposta.");
    
      // Voto dell'utente sulla seconda proposta
      await dao.write.vote([1n, true, false], { account: owner.account.address });
    
      // Esecuzione di entrambe le proposte
      await dao.write.executeMultipleProposals([[0n, 1n]], { account: owner.account.address });
    
      // Verifica che entrambe le proposte siano state eseguite
      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);
    
      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
    });

  });
});

