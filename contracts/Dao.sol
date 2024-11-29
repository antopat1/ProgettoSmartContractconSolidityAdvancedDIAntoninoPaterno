// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./GovernanceToken.sol";
import "./Proposal.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DAO
/// @dev Gestione delle votazioni, esecuzione delle proposte e finanziamento di progetti.
contract DAO is Proposal, Ownable {
    uint public constant PROPOSAL_DURATION = 1 weeks; // Durata massima per una proposta
    bool public executive; // Stato del processo di votazione (aperto o chiuso)
    GovernanceToken public governanceToken; // Riferimento al contratto del token di governance

    // Evento per notificare quando viene espresso un voto
    event Voted(uint proposalId, address voter, bool support, bool abstain);

    /// @notice Costruttore per inizializzare la DAO
    /// @param _tokenAddress Indirizzo del contratto del token di governance
    constructor(address _tokenAddress) Proposal(_tokenAddress) {
        executive = true; // Imposta lo stato iniziale della votazione su "aperto"
        governanceToken = GovernanceToken(_tokenAddress);
    }

    /// @notice Permette di votare su una proposta
    /// @dev Gli utenti possono votare "a favore", "contro" o "astenersi".
    /// @param _proposalId ID della proposta
    /// @param _support Se il voto è a favore
    /// @param _abstain Se il voto è di astensione
    function vote(uint _proposalId, bool _support, bool _abstain) public {
        require(
            governanceToken.balanceOf(msg.sender) > 0,
            "Devi possedere dei token per votare."
        );
        require(executive, "La votazione e' chiusa.");

        ProposalDetails storage proposal = allProposals[_proposalId];
        require(!proposal.executed, "Proposta gia' eseguita.");
        require(
            !voters[_proposalId][msg.sender],
            "Hai gia' votato su questa proposta."
        );

        if (_abstain) {
            proposal.abstainVotes += governanceToken.balanceOf(msg.sender);
        } else if (_support) {
            proposal.forVotes += governanceToken.balanceOf(msg.sender);
        } else {
            proposal.againstVotes += governanceToken.balanceOf(msg.sender);
        }

        voters[_proposalId][msg.sender] = true;
        emit Voted(_proposalId, msg.sender, _support, _abstain);
    }

    /// @notice Esegue una proposta
    /// @dev Se la proposta è approvata, trasferisce i token al destinatario (se specificato)
    /// @param _proposalId ID della proposta
    function executeProposal(uint _proposalId) public {
        ProposalDetails storage proposal = allProposals[_proposalId];

        require(executive, "La votazione e' chiusa.");
        require(!proposal.executed, "Proposta gia' eseguita.");
        uint totalVotes = proposal.forVotes +
            proposal.againstVotes +
            proposal.abstainVotes;
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

        proposal.executed = true; // Segna la proposta come eseguita
    }

    function executeMultipleProposals(uint[] calldata _proposalIds) external {
        require(
            _proposalIds.length <= 10,
            "Massimo 10 proposte per transazione."
        );
        for (uint i = 0; i < _proposalIds.length; i++) {
            executeProposal(_proposalIds[i]);
        }
    }

    /// @notice Chiude la votazione dopo che tutte le proposte sono eseguite
    function closeVoting() public onlyOwner {
        require(executive, "La votazione e' gia' chiusa.");
        for (uint i = 0; i < allProposals.length; i++) {
            require(
                allProposals[i].executed,
                "Tutte le proposte devono essere eseguite."
            );
        }
        executive = false; // Chiude la votazione
    }

    /// @notice Recupera tutte le proposte non eseguite entro la durata limite
    function recoverUnexecutedProposals() public {
        for (uint i = 0; i < allProposals.length; i++) {
            if (
                !allProposals[i].executed &&
                block.timestamp >= PROPOSAL_DURATION
            ) {
                allProposals[i].executed = true;
                allProposals[i].passed = false;
            }
        }
    }
}
