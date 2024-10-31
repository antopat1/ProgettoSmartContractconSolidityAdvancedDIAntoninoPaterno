import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";
import hre from "hardhat";

describe("Proposal Contract Tests", function () {
  // Fixture che distribuisce i contratti e imposta l'ambiente di test
  async function deployContractsFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    
    // Deploy del contratto DAO (che include Proposal e GovernanceToken)
    const dao = await hre.viem.deployContract("DAO");
    const publicClient = await hre.viem.getPublicClient();
    
    // Acquisto di alcuni token per i test
    const tokenPrice = 10n ** 16n; // 0.01 ETH
    await dao.write.buyTokens({ value: tokenPrice * 100n }); // 100 token per owner
    await dao.write.buyTokens({ account: user1.account.address, value: tokenPrice * 50n }); // 50 token per user1
    
    return { 
      dao, 
      owner: owner.account.address, 
      user1: user1.account.address, 
      user2: user2.account.address,
      publicClient
    };
  }

  describe("Creazione di una nuova proposta", function () {
    it("Dovrebbe creare una proposta con ID univoco e dettagli corretti", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      const title = "Prima Proposta";
      const description = "Descrizione della prima proposta";
      const recipient = user1;
      const amount = 10n;

      await dao.write.createProposal([title, description, recipient, amount]);

      const proposal = await dao.read.getProposal([0n]);
      
      expect(proposal.id).to.equal(0n);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(recipient));
      expect(proposal.amount).to.equal(amount);
    });

    it("Dovrebbe memorizzare correttamente i dettagli opzionali", async function () {
      const { dao, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal([
        "Proposta con dettagli",
        "Descrizione completa",
        user1,
        100n
      ]);

      const proposal = await dao.read.getProposal([0n]);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(user1));
      expect(proposal.amount).to.equal(100n);
    });
  });

  describe("Validazione delle proposte vuote", function () {
    it("Non dovrebbe accettare proposte con descrizione vuota", async function () {
      const { dao, user1 } = await loadFixture(deployContractsFixture);

      await expect(
        dao.write.createProposal(["Titolo", "", user1, 100n])
      ).to.be.rejectedWith("La descrizione non puo' essere vuota");
    });
  });

  describe("Votazione e stato della proposta", function () {
    it("Dovrebbe registrare correttamente i voti e determinare l'esito", async function () {
      const { dao, user1 } = await loadFixture(deployContractsFixture);

      // Crea proposta
      await dao.write.createProposal(["Test Votazione", "Descrizione", user1, 100n]);

      // Vota
      await dao.write.vote([0n, true, false]); // Owner vota a favore
      await dao.write.vote([0n, true, false], { account: user1 }); // User1 vota a favore

      // Esegui la proposta
      await dao.write.executeProposal([0n]);

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.passed).to.be.true;
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Esecuzione delle proposte", function () {
    it("Dovrebbe eseguire una proposta approvata una sola volta", async function () {
      const { dao, user1 } = await loadFixture(deployContractsFixture);

      // Crea e vota la proposta
      await dao.write.createProposal(["Proposta Esecutiva", "Descrizione", user1, 50n]);
      await dao.write.vote([0n, true, false]); // Owner vota a favore

      // Prima esecuzione
      await dao.write.executeProposal([0n]);

      // Verifica che non si possa eseguire di nuovo
      await expect(
        dao.write.executeProposal([0n])
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });
  });

  describe("Proposte non approvate", function () {
    it("Non dovrebbe eseguire trasferimenti per proposte rifiutate", async function () {
      const { dao, user1, user2 } = await loadFixture(deployContractsFixture);

      // Crea proposta
      await dao.write.createProposal(["Proposta da Rifiutare", "Descrizione", user2, 100n]);

      // Vota contro
      await dao.write.vote([0n, false, false]); // Owner vota contro
      await dao.write.vote([0n, false, false], { account: user1 }); // User1 vota contro

      // Esegui la proposta
      await dao.write.executeProposal([0n]);

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.passed).to.be.false;
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Verifica del registro proposte", function () {
    it("Dovrebbe mantenere un registro accurato delle proposte eseguite", async function () {
      const { dao, user1 } = await loadFixture(deployContractsFixture);

      // Crea multiple proposte
      await dao.write.createProposal(["Proposta 1", "Descrizione 1", user1, 50n]);
      await dao.write.createProposal(["Proposta 2", "Descrizione 2", user1, 30n]);

      // Vota ed esegui
      await dao.write.vote([0n, true, false]);
      await dao.write.executeProposal([0n]);

      await dao.write.vote([1n, false, false]);
      await dao.write.executeProposal([1n]);

      // Verifica i dettagli di entrambe le proposte
      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);

      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
      expect(proposal1.passed).to.not.equal(proposal2.passed);
    });
  });

  describe("Autorizzazioni per la creazione di proposte", function () {
    it("Solo membri con token dovrebbero poter creare proposte", async function () {
      const { dao, user2 } = await loadFixture(deployContractsFixture);

      // Verifica che user2 (senza token) non possa creare proposte
      await expect(
        dao.write.createProposal(
          ["Proposta Non Autorizzata", "Descrizione", user2, 100n],
          { account: user2 }
        )
      ).to.be.rejected;
    });
  });
});