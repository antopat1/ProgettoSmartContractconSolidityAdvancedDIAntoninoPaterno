// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./GovernanceToken.sol";
import "./Proposal.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DAO
/// @dev Gestione delle votazioni, esecuzione delle proposte e finanziamento di progetti
contract DAO is Proposal, Ownable {

    uint public constant PROPOSAL_DURATION = 1 weeks;
    uint public executive = 1;
    address public daoCreator;      // Variabile per memorizzare l'indirizzo del creatore della DAO
    uint public proposalCounter;     // Contatore per il numero totale di proposte create
    GovernanceToken public governanceToken;  // Riferimento al contratto del token di governance

    // Costruttore che passa _tokenAddress al contratto Proposal e inizializza variabili
    constructor(address _tokenAddress) Proposal(_tokenAddress) {
        daoCreator = msg.sender;    // Imposta il creatore della DAO
        executive = 1;              // Imposta lo stato iniziale di executive
        proposalCounter = 0;        // Inizializza il contatore delle proposte a zero
        governanceToken = GovernanceToken(_tokenAddress); // Inizializza il riferimento al token
    }

    // Evento per notificare quando viene espresso un voto
    event Voted(uint proposalId, address voter, bool support, bool abstain);

    /// @notice Vota su una proposta. Gli utenti possono votare a favore, contro o astenersi.
    /// @dev Il peso del voto è proporzionato ai token posseduti dall'utente.
    function vote(uint _proposalId, bool _support, bool _abstain) public {
        require(governanceToken.balanceOf(msg.sender) > 0, "Devi possedere dei token per votare.");
        require(executive == 1, "La votazione e' chiusa.");

        ProposalDetails storage proposal = allProposals[_proposalId];
        require(!proposal.executed, "Proposta gia' eseguita.");

        if (_abstain) {
            proposal.abstainVotes += governanceToken.balanceOf(msg.sender);
        } else if (_support) {
            proposal.forVotes += governanceToken.balanceOf(msg.sender);
        } else {
            proposal.againstVotes += governanceToken.balanceOf(msg.sender);
        }

        emit Voted(_proposalId, msg.sender, _support, _abstain);
    }

    /// @notice Esegue una proposta, inclusa la possibilità di finanziare un indirizzo con token
    function executeProposal(uint _proposalId) public {
        ProposalDetails storage proposal = allProposals[_proposalId];

        require(executive == 1, "La votazione e' chiusa.");
        require(!proposal.executed, "Proposta gia' eseguita.");
        uint totalVotes = proposal.forVotes + proposal.againstVotes + proposal.abstainVotes;
        require(totalVotes > 0, "Nessun voto registrato.");

        uint percentageFor = (proposal.forVotes * 100) / totalVotes;

        if (percentageFor >= 50) {
            proposal.passed = true;
            if (proposal.recipient != address(0) && proposal.amount > 0) {
                governanceToken.mint(proposal.recipient, proposal.amount);
            }
        } else {
            proposal.passed = false;
        }

        proposal.executed = true;
    }

    /// @notice Funzione per unire l'esecuzione di più proposte in un'unica transazione.
    function executeMultipleProposals(uint[] calldata _proposalIds) public {
        require(_proposalIds.length <= 10, "Massimo 10 proposte per transazione.");

        for (uint i = 0; i < _proposalIds.length; i++) {
            executeProposal(_proposalIds[i]);
        }
    }

    /// @notice Funzione per chiudere la votazione una volta che tutte le proposte sono eseguite.
    function closeVoting() public onlyOwner {
        require(executive != 0, "La votazione e' gia' chiusa.");
        for (uint i = 0; i < allProposals.length; i++) {
            require(allProposals[i].executed, "Tutte le proposte devono essere eseguite.");
        }
        executive = 0; // Chiude la votazione
    }

    /// @notice Recupera tutte le proposte che non sono state eseguite entro una settimana.
    function recoverUnexecutedProposals() public {
        for (uint i = 0; i < allProposals.length; i++) {
            if (!allProposals[i].executed && block.timestamp >= PROPOSAL_DURATION) {
                allProposals[i].executed = true;
                allProposals[i].passed = false;
            }
        }
    }
}