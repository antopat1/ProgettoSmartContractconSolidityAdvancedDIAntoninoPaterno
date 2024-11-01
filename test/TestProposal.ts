import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress } from "viem";
import hre from "hardhat";
import type { PublicClient, WalletClient } from "viem";

interface DAOContract {
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
    buyTokens(
      options?: { value: bigint; account: `0x${string}` }
    ): Promise<`0x${string}`>;
  };
  read: {
    getProposal(args: readonly [bigint]): Promise<any>;
  };
}

describe("Proposal Contract Tests", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2] = await hre.viem.getWalletClients();
    
    // Prima deployiamo il GovernanceToken
    const governanceToken = await hre.viem.deployContract("GovernanceToken");

    // Poi deployiamo il DAO passando l'indirizzo del token
    const dao = await hre.viem.deployContract("DAO", [governanceToken.address]) as unknown as DAOContract;
    
    const publicClient = await hre.viem.getPublicClient();
    
    // Acquisto di alcuni token per i test
    const tokenPrice = 10n ** 16n; // 0.01 ETH
    await dao.write.buyTokens({ 
      value: tokenPrice * 100n,
      account: owner.account.address
    }); 
    
    await dao.write.buyTokens({ 
      value: tokenPrice * 50n,
      account: user1.account.address 
    });
    
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

      await dao.write.createProposal([title, description, recipient, amount], {
        account: owner
      });

      const proposal = await dao.read.getProposal([0n]);
      
      expect(proposal.id).to.equal(0n);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(recipient));
      expect(proposal.amount).to.equal(amount);
    });

    it("Dovrebbe memorizzare correttamente i dettagli opzionali", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal([
        "Proposta con dettagli",
        "Descrizione completa",
        user1,
        100n
      ], {
        account: owner
      });

      const proposal = await dao.read.getProposal([0n]);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(user1));
      expect(proposal.amount).to.equal(100n);
    });
  });

  describe("Validazione delle proposte vuote", function () {
    it("Non dovrebbe accettare proposte con descrizione vuota", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await expect(
        dao.write.createProposal(["Titolo", "", user1, 100n], {
          account: owner
        })
      ).to.be.rejectedWith("La descrizione non puo' essere vuota");
    });
  });

  describe("Votazione e stato della proposta", function () {
    it("Dovrebbe registrare correttamente i voti e determinare l'esito", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal([
        "Test Votazione", 
        "Descrizione", 
        user1, 
        100n
      ], {
        account: owner
      });

      await dao.write.vote([0n, true, false], {
        account: owner
      }); 

      await dao.write.vote([0n, true, false], { 
        account: user1
      });

      await dao.write.executeProposal([0n], {
        account: owner
      });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.passed).to.be.true;
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Esecuzione delle proposte", function () {
    it("Dovrebbe eseguire una proposta approvata una sola volta", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal([
        "Proposta Esecutiva", 
        "Descrizione", 
        user1, 
        50n
      ], {
        account: owner
      });

      await dao.write.vote([0n, true, false], {
        account: owner
      });

      await dao.write.executeProposal([0n], {
        account: owner
      });

      await expect(
        dao.write.executeProposal([0n], {
          account: owner
        })
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });
  });

  describe("Proposte non approvate", function () {
    it("Non dovrebbe eseguire trasferimenti per proposte rifiutate", async function () {
      const { dao, owner, user1, user2 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal([
        "Proposta da Rifiutare", 
        "Descrizione", 
        user2, 
        100n
      ], {
        account: owner
      });

      await dao.write.vote([0n, false, false], {
        account: owner
      });

      await dao.write.vote([0n, false, false], { 
        account: user1
      });

      await dao.write.executeProposal([0n], {
        account: owner
      });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.passed).to.be.false;
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Verifica del registro proposte", function () {
    it("Dovrebbe mantenere un registro accurato delle proposte eseguite", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      // Crea prima proposta
      await dao.write.createProposal([
        "Proposta 1", 
        "Descrizione 1", 
        user1, 
        50n
      ], {
        account: owner
      });

      // Crea seconda proposta
      await dao.write.createProposal([
        "Proposta 2", 
        "Descrizione 2", 
        user1, 
        30n
      ], {
        account: owner
      });

      // Vota e esegui la prima proposta (approvata)
      await dao.write.vote([0n, true, false], {
        account: owner
      });
      
      await dao.write.executeProposal([0n], {
        account: owner
      });

      // Vota e esegui la seconda proposta (rifiutata)
      await dao.write.vote([1n, false, false], {
        account: owner
      });
      
      await dao.write.executeProposal([1n], {
        account: owner
      });

      // Verifica lo stato di entrambe le proposte
      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);

      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
      expect(proposal1.passed).to.be.true;
      expect(proposal2.passed).to.be.false;
    });
  });

  describe("Autorizzazioni per la creazione di proposte", function () {
    it("Solo membri con token dovrebbero poter creare proposte", async function () {
      const { dao, user2 } = await loadFixture(deployContractsFixture);

      // Tenta di creare una proposta con un account senza token
      await expect(
        dao.write.createProposal([
          "Proposta Non Autorizzata", 
          "Descrizione", 
          user2, 
          100n
        ], {
          account: user2
        })
      ).to.be.rejectedWith("Solo i membri possono creare proposte");
    });
  });
  
  });