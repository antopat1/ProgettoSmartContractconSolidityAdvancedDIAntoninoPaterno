import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox-viem/network-helpers";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import hre from "hardhat";
import { parseEther, formatUnits } from "viem";

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
  
  describe("Proposal Voting and Execution with Token Transfer", function () {
    it("Should execute proposal and transfer tokens when majority is reached", async function () {
      const { dao, governanceToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      // Step 1: Membri acquistano token per poter votare
      // addr1 acquista più token per avere più peso nel voto
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.02") // 2 token
      });
      
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01") // 1 token
      });

      // Verifica che i token siano stati distribuiti correttamente
      const addr1Balance = await governanceToken.read.balanceOf([addr1.account.address]);
      const addr2Balance = await governanceToken.read.balanceOf([addr2.account.address]);
      expect(Number(addr1Balance)).to.be.greaterThan(Number(addr2Balance));

      // Step 2: Creazione della proposta finanziaria
      const proposalAmount = parseEther("1"); // 1 token da trasferire
      await dao.write.createProposal([
        "Proposta Finanziaria",
        "Trasferimento token a addr3",
        addr3.account.address,
        proposalAmount
      ], {
        account: addr1.account.address
      });

      // Step 3: Votazione con peso differente
      // addr1 vota a favore (2 token = 2 voti)
      await dao.write.vote([0n, true, false], {
        account: addr1.account.address
      });

      // addr2 vota contro (1 token = 1 voto)
      await dao.write.vote([0n, false, false], {
        account: addr2.account.address
      });

      // Step 4: Esecuzione della proposta
      await dao.write.executeProposal([0n], {
        account: addr1.account.address
      });

      // Step 5: Verifiche finali
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.true;

      // Verifica che addr3 abbia ricevuto i token
      const recipientBalance = await governanceToken.read.balanceOf([addr3.account.address]);
      expect(recipientBalance).to.equal(proposalAmount);
    });

    it("Should not execute proposal when majority is not reached", async function () {
      const { dao, governanceToken, addr1, addr2, addr3 } = await loadFixture(deployDAOFixture);
      
      // Setup iniziale con distribuzione token inversa
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01") // 1 token
      });
      
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.02") // 2 token
      });

      // Creazione proposta
      const proposalAmount = parseEther("1");
      await dao.write.createProposal([
        "Proposta Finanziaria",
        "Trasferimento token a addr3",
        addr3.account.address,
        proposalAmount
      ], {
        account: addr1.account.address
      });

      // Votazione con maggioranza contro
      await dao.write.vote([0n, true, false], {
        account: addr1.account.address
      });
      
      await dao.write.vote([0n, false, false], {
        account: addr2.account.address
      });

      // Esecuzione proposta
      await dao.write.executeProposal([0n], {
        account: addr1.account.address
      });

      // Verifiche
      const proposal = await dao.read.getProposal([0n]);
      expect(proposal.executed).to.be.true;
      expect(proposal.passed).to.be.false;

      // Verifica che non ci sia stato trasferimento di token
      const recipientBalance = await governanceToken.read.balanceOf([addr3.account.address]);
      expect(recipientBalance).to.equal(0n);
    });
  });


  
  // describe("Proposal Expiration and Voting Period", function () {
  //   it("Should handle proposal expiration correctly", async function () {
  //     const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
  //     // Setup: Acquisto token per poter creare e votare proposte
  //     await governanceToken.write.buyTokens({
  //       account: addr1.account.address,
  //       value: parseEther("0.01")
  //     });
      
  //     await governanceToken.write.buyTokens({
  //       account: addr2.account.address,
  //       value: parseEther("0.01")
  //     });

  //     // Step 1: Creazione della proposta
  //     await dao.write.createProposal([
  //       "Proposta con scadenza",
  //       "Test della scadenza della proposta",
  //       addr2.account.address,
  //       parseEther("1")
  //     ], {
  //       account: addr1.account.address
  //     });

  //     // Step 2: Voto prima della scadenza
  //     await dao.write.vote([0n, true, false], {
  //       account: addr1.account.address
  //     });

  //     // Verifica che il voto sia stato registrato
  //     const proposalBeforeExpiry = await dao.read.getProposal([0n]);
  //     expect(proposalBeforeExpiry.forVotes).to.be.greaterThan(0n);

  //     // Step 3: Avanziamo il tempo di una settimana più un secondo
  //     await time.increase(7 * 24 * 60 * 60 + 1);

  //     // Step 4: Tentativo di voto dopo la scadenza
  //     try {
  //       await dao.write.vote([0n, true, false], {
  //         account: addr2.account.address
  //       });
  //       expect.fail("Il voto non dovrebbe essere permesso dopo la scadenza");
  //     } catch (error: any) {
  //       expect(error.message).to.include("revert");
  //     }

  //     // Step 5: Recupero delle proposte scadute
  //     await dao.write.recoverUnexecutedProposals({
  //       account: addr1.account.address
  //     });

  //     // Step 6: Verifiche finali
  //     const proposalAfterExpiry = await dao.read.getProposal([0n]);
  //     expect(proposalAfterExpiry.executed).to.be.true;
  //     expect(proposalAfterExpiry.passed).to.be.false;

  //     // Verifica che non ci siano stati trasferimenti di token
  //     const recipientBalance = await governanceToken.read.balanceOf([addr2.account.address]);
  //     const initialBalance = parseEther("0.01") / parseEther("0.01"); // Conversione dal valore in ether ai token
  //     expect(recipientBalance).to.equal(initialBalance);
  //   });

  //   it("Should allow multiple proposal recovery at once", async function () {
  //     const { dao, governanceToken, addr1 } = await loadFixture(deployDAOFixture);
      
  //     // Setup: Token purchase
  //     await governanceToken.write.buyTokens({
  //       account: addr1.account.address,
  //       value: parseEther("0.01")
  //     });

  //     // Step 1: Creazione di multiple proposte
  //     for (let i = 0; i < 3; i++) {
  //       await dao.write.createProposal([
  //         `Proposta ${i}`,
  //         "Test multiple proposte",
  //         addr1.account.address,
  //         parseEther("1")
  //       ], {
  //         account: addr1.account.address
  //       });
  //     }

  //     // Step 2: Avanziamo il tempo
  //     await time.increase(7 * 24 * 60 * 60 + 1);

  //     // Step 3: Recupero di tutte le proposte scadute
  //     await dao.write.recoverUnexecutedProposals({
  //       account: addr1.account.address
  //     });

  //     // Step 4: Verifica che tutte le proposte siano state chiuse
  //     for (let i = 0; i < 3; i++) {
  //       const proposal = await dao.read.getProposal([BigInt(i)]);
  //       expect(proposal.executed).to.be.true;
  //       expect(proposal.passed).to.be.false;
  //     }
  //   });

  //   it("Should track proposal timing correctly", async function () {
  //     const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
  //     // Setup: Token purchase
  //     await governanceToken.write.buyTokens({
  //       account: addr1.account.address,
  //       value: parseEther("0.01")
  //     });

  //     // Step 1: Creazione proposta
  //     await dao.write.createProposal([
  //       "Proposta con timing",
  //       "Test del timing della proposta",
  //       addr2.account.address,
  //       parseEther("1")
  //     ], {
  //       account: addr1.account.address
  //     });

  //     // Step 2: Avanziamo il tempo di quasi una settimana (6 giorni)
  //     await time.increase(6 * 24 * 60 * 60);

  //     // Il voto dovrebbe ancora essere possibile
  //     await dao.write.vote([0n, true, false], {
  //       account: addr1.account.address
  //     });

  //     const proposalMidway = await dao.read.getProposal([0n]);
  //     expect(proposalMidway.executed).to.be.false;
      
  //     // Step 3: Avanziamo il tempo oltre la scadenza
  //     await time.increase(2 * 24 * 60 * 60); // Altri 2 giorni

  //     // Step 4: Recupero della proposta scaduta
  //     await dao.write.recoverUnexecutedProposals({
  //       account: addr1.account.address
  //     });

  //     const proposalEnd = await dao.read.getProposal([0n]);
  //     expect(proposalEnd.executed).to.be.true;
  //   });
  // });

  describe("Proposal Expiration and Voting Period", function () {
    it("Should handle proposal expiration correctly", async function () {
      const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      // Setup: Acquisto token
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01")
      });
      
      await governanceToken.write.buyTokens({
        account: addr2.account.address,
        value: parseEther("0.01")
      });
  
      // Creazione proposta
      await dao.write.createProposal([
        "Proposta con scadenza",
        "Test della scadenza della proposta",
        addr2.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
  
      // Voto prima della scadenza
      await dao.write.vote([0n, true, false], {
        account: addr1.account.address
      });
  
      // Verifica del voto
      const proposalBeforeExpiry = await dao.read.getProposal([0n]);
      expect(Number(proposalBeforeExpiry.forVotes)).to.be.greaterThan(0);
  
      // Avanziamo il tempo di una settimana
      await time.increase(7 * 24 * 60 * 60 + 1);
  
      // Recupero proposte scadute
      await dao.write.recoverUnexecutedProposals({
        account: addr1.account.address
      });
  
      // Tentativo di voto dopo la scadenza
      await expect(
        dao.write.vote([0n, true, false], {
          account: addr2.account.address
        })
      ).to.be.rejectedWith("Proposta gia' eseguita.");
  
      // Verifiche finali
      const proposalAfterExpiry = await dao.read.getProposal([0n]);
      expect(proposalAfterExpiry.executed).to.be.true;
      expect(proposalAfterExpiry.passed).to.be.false;
  
      const recipientBalance = await governanceToken.read.balanceOf([addr2.account.address]);
      // Correggiamo il calcolo dell'expected balance
      const expectedBalance = 1000000000000000000n; // 1 token = 10^18 (considerando 18 decimali)
      expect(recipientBalance).to.equal(expectedBalance);
    });
  
    it("Should allow multiple proposal recovery at once", async function () {
      const { dao, governanceToken, addr1 } = await loadFixture(deployDAOFixture);
      
      // Setup: Token purchase
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01")
      });
  
      // Step 1: Creazione di multiple proposte
      for (let i = 0; i < 3; i++) {
        await dao.write.createProposal([
          `Proposta ${i}`,
          "Test multiple proposte",
          addr1.account.address,
          parseEther("1")
        ], {
          account: addr1.account.address
        });
      }
  
      // Step 2: Avanziamo il tempo
      await time.increase(7 * 24 * 60 * 60 + 1);
  
      // Step 3: Recupero di tutte le proposte scadute
      await dao.write.recoverUnexecutedProposals({
        account: addr1.account.address
      });
  
      // Step 4: Verifica che tutte le proposte siano state chiuse
      for (let i = 0; i < 3; i++) {
        const proposal = await dao.read.getProposal([BigInt(i)]);
        expect(proposal.executed).to.be.true;
        expect(proposal.passed).to.be.false;
      }
    });
  
    it("Should track proposal timing correctly", async function () {
      const { dao, governanceToken, addr1, addr2 } = await loadFixture(deployDAOFixture);
      
      // Setup: Token purchase
      await governanceToken.write.buyTokens({
        account: addr1.account.address,
        value: parseEther("0.01")
      });
  
      // Step 1: Creazione proposta
      await dao.write.createProposal([
        "Proposta con timing",
        "Test del timing della proposta",
        addr2.account.address,
        parseEther("1")
      ], {
        account: addr1.account.address
      });
  
      // Step 2: Avanziamo il tempo di quasi una settimana (6 giorni)
      await time.increase(6 * 24 * 60 * 60);
  
      // Il voto dovrebbe ancora essere possibile
      await dao.write.vote([0n, true, false], {
        account: addr1.account.address
      });
  
      const proposalMidway = await dao.read.getProposal([0n]);
      expect(proposalMidway.executed).to.be.false;
      
      // Step 3: Avanziamo il tempo oltre la scadenza
      await time.increase(2 * 24 * 60 * 60); // Altri 2 giorni
  
      // Step 4: Recupero della proposta scaduta
      await dao.write.recoverUnexecutedProposals({
        account: addr1.account.address
      });
  
      const proposalEnd = await dao.read.getProposal([0n]);
      expect(proposalEnd.executed).to.be.true;
    });
  });


});





