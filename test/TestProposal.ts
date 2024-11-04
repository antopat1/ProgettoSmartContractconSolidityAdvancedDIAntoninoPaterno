import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { getAddress, parseEther } from "viem";
import hre from "hardhat";

interface DAOContract {
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

interface GovernanceTokenContract {
  address: `0x${string}`;
  write: {
    buyTokens(options?: {
      value: bigint;
      account: `0x${string}`;
    }): Promise<`0x${string}`>;
    transferOwnership( // Aggiunta questa funzione
      args: readonly [`0x${string}`],
      options?: { account: `0x${string}` }
    ): Promise<`0x${string}`>;
    mint( // Opzionalmente, potresti voler aggiungere anche questa
      args: readonly [`0x${string}`, bigint],
      options?: { account: `0x${string}` }
    ): Promise<`0x${string}`>;
  };
  read: {
    balanceOf(args: readonly [`0x${string}`]): Promise<bigint>;
  };
}

const compareBigInt = (actual: bigint, expected: bigint) => {
  return {
    eq: () => expect(actual === expected).to.be.true,
    gt: () => expect(actual > expected).to.be.true,
    gte: () => expect(actual >= expected).to.be.true,
    lt: () => expect(actual < expected).to.be.true,
    lte: () => expect(actual <= expected).to.be.true,
  };
};

describe("DAO Contract Tests", function () {
  async function deployContractsFixture() {
    const [owner, user1, user2, user3] = await hre.viem.getWalletClients();

    const governanceToken = (await hre.viem.deployContract(
      "GovernanceToken"
    )) as unknown as GovernanceTokenContract;
    const dao = (await hre.viem.deployContract("DAO", [
      governanceToken.address,
    ])) as unknown as DAOContract;

    const publicClient = await hre.viem.getPublicClient();

    // NOTA IMPORTANTE: Qui transferiamo l'ownership del GovernanceToken al contratto DAO
    // Questo è necessario per permettere al DAO di mintare token quando le proposte vengono approvate
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
      owner: owner.account.address,
      user1: user1.account.address,
      user2: user2.account.address,
      user3: user3.account.address,
      publicClient,
    };
  }

  describe("Creazione delle proposte", function () {
    it("Dovrebbe creare una proposta con ID univoco e tutti i dettagli corretti", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      const title = "Prima Proposta";
      const description = "Descrizione dettagliata della prima proposta";
      const recipient = user1;
      const amount = 1000n;

      await dao.write.createProposal([title, description, recipient, amount], {
        account: owner,
      });

      const proposal = await dao.read.getProposal([0n]);

      expect(proposal.id).to.equal(0n);
      expect(proposal.title).to.equal(title);
      expect(proposal.description).to.equal(description);
      expect(getAddress(proposal.recipient)).to.equal(getAddress(recipient));
      expect(proposal.amount).to.equal(amount);
      expect(getAddress(proposal.proposer)).to.equal(getAddress(owner));
      expect(proposal.executed).to.be.false;
      expect(proposal.passed).to.be.false;
      expect(proposal.forVotes).to.equal(0n);
      expect(proposal.againstVotes).to.equal(0n);
      expect(proposal.abstainVotes).to.equal(0n);
    });

    it("Dovrebbe rifiutare proposte con descrizione vuota", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await expect(
        dao.write.createProposal(["Titolo", "", user1, 100n], {
          account: owner,
        })
      ).to.be.rejectedWith("La descrizione non puo' essere vuota");
    });

    it("Dovrebbe permettere proposte senza recipient e amount", async function () {
      const { dao, owner } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        [
          "Proposta Semplice",
          "Solo descrizione",
          "0x0000000000000000000000000000000000000000",
          0n,
        ],
        { account: owner }
      );

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.amount).to.equal(0n);
      expect(getAddress(proposal.recipient)).to.equal(
        getAddress("0x0000000000000000000000000000000000000000")
      );
    });
  });

  describe("Votazione e Esecuzione", function () {
    it("Dovrebbe permettere ai possessori di token di votare", async function () {
      const { dao, owner } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        [
          "Proposta Test",
          "Descrizione test",
          "0x0000000000000000000000000000000000000000",
          0n,
        ],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      const proposal = await dao.read.getProposal([0n]);

      // Utilizzo della utility function
      compareBigInt(proposal.forVotes, 0n).gt();

      // Oppure usando la conversione a number
      expect(Number(proposal.forVotes)).to.be.gt(0);

      // Oppure usando il confronto diretto
      expect(proposal.forVotes > 0n).to.be.true;
    });

    it("Dovrebbe eseguire correttamente una proposta approvata", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        ["Proposta Test", "Descrizione test", user1, 100n],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      await dao.write.executeProposal([0n], { account: owner });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
    });
  });

  describe("Chiusura delle votazioni", function () {
    it("Dovrebbe permettere la chiusura delle votazioni solo dopo l'esecuzione di tutte le proposte", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        ["Proposta Finale", "Descrizione", user1, 100n],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      await dao.write.executeProposal([0n], { account: owner });
      await dao.write.closeVoting({ account: owner });

      const executive = await dao.read.executive();
      expect(executive).to.equal(0n);
    });

    it("Non dovrebbe permettere di votare su una proposta dopo che è stata eseguita", async function () {
      const { dao, governanceToken, owner, user1, user2 } = await loadFixture(
        deployContractsFixture
      );

      // Creazione della proposta
      await dao.write.createProposal(
        ["Proposta Test", "Descrizione della proposta", user1, 100n],
        { account: owner }
      );

      // Prima votazione (valida)
      await dao.write.vote([0n, true, false], { account: owner });

      // Esecuzione della proposta
      await dao.write.executeProposal([0n], { account: owner });

      // Verifica che la proposta sia stata eseguita
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;

      // Tentativo di votare dopo l'esecuzione (dovrebbe fallire)
      await expect(
        dao.write.vote([0n, true, false], { account: user2 })
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });
  });

  describe("Sistema di votazione", function () {
    it("Dovrebbe permettere voti a favore, contro e astensioni", async function () {
      const { dao, owner, user1, user2 } = await loadFixture(
        deployContractsFixture
      );

      // Creiamo la proposta
      await dao.write.createProposal(
        ["Test Votazione", "Descrizione", user1, 100n],
        { account: owner }
      );

      // Voto a favore - nota il 0n invece di 0
      await dao.write.vote([0n, true, false], { account: owner });

      // Voto contro
      await dao.write.vote([0n, false, false], { account: user1 });

      // Astensione
      await dao.write.vote([0n, false, true], { account: user2 });

      const proposal = await dao.read.getProposal([0n]);
      // Convertiamo il bigint in number per chai
      expect(Number(proposal.forVotes)).to.be.greaterThan(0);
      expect(Number(proposal.againstVotes)).to.be.greaterThan(0);
      expect(Number(proposal.abstainVotes)).to.be.greaterThan(0);
    });

    it("Non dovrebbe permettere la creazione di proposte e il voto a chi non ha token", async function () {
      const { dao, user3, owner } = await loadFixture(deployContractsFixture);

      // Prima verifichiamo che non possa creare una proposta
      await expect(
        dao.write.createProposal(["Proposta Test", "Descrizione", user3, 0n], {
          account: user3,
        })
      ).to.be.rejectedWith("Solo i membri possono creare proposte");

      // Per testare il voto, dobbiamo prima creare una proposta con un account valido
      // Assumiamo che owner abbia dei token (dal fixture)
      await dao.write.createProposal(
        ["Proposta Test", "Descrizione", user3, 0n],
        { account: owner }
      );

      // Ora testiamo che user3 non possa votare
      await expect(
        dao.write.vote([0n, true, false], { account: user3 })
      ).to.be.rejectedWith("Devi possedere dei token per votare");
    });
  });

  describe("Esecuzione delle proposte", function () {
    it("Dovrebbe eseguire correttamente una proposta approvata", async function () {
      const { dao, owner, user1, governanceToken } = await loadFixture(
        deployContractsFixture
      );

      await dao.write.createProposal(
        ["Proposta di Finanziamento", "Descrizione", user1, 1000n],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      await dao.write.executeProposal([0n], { account: owner });

      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;

      const balance = await governanceToken.read.balanceOf([user1]);
      compareBigInt(balance, 0n).gt();
    });

    it("Non dovrebbe eseguire una proposta già eseguita", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        ["Proposta Test", "Descrizione", user1, 100n],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      await dao.write.executeProposal([0n], { account: owner });

      await expect(
        dao.write.executeProposal([0n], { account: owner })
      ).to.be.rejectedWith("Proposta gia' eseguita");
    });

    it("Dovrebbe gestire correttamente proposte multiple", async function () {
      const { dao, owner, user1 } = await loadFixture(deployContractsFixture);

      await dao.write.createProposal(
        ["Proposta 1", "Descrizione 1", user1, 100n],
        { account: owner }
      );

      await dao.write.createProposal(
        ["Proposta 2", "Descrizione 2", user1, 200n],
        { account: owner }
      );

      await dao.write.vote([0n, true, false], { account: owner });
      await dao.write.vote([1n, true, false], { account: owner });

      await dao.write.executeMultipleProposals([[0n, 1n]], { account: owner });

      const proposal1 = await dao.read.getProposal([0n]);
      const proposal2 = await dao.read.getProposal([1n]);

      expect(proposal1.executed).to.be.true;
      expect(proposal2.executed).to.be.true;
    });
  });
});
