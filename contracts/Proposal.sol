// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Proposal
/// @dev Gestione delle proposte nella DAO. Protezione contro proposte con descrizione vuota.
interface IToken {
    function balanceOf(address account) external view returns (uint256);
}

contract Proposal {

    struct ProposalDetails {
        uint id;                   // ID univoco della proposta
        string title;              // Titolo della proposta
        string description;        // Descrizione della proposta
        uint forVotes;             // Voti a favore
        uint againstVotes;         // Voti contrari
        uint abstainVotes;         // Voti di astensione
        bool executed;             // Stato dell'esecuzione della proposta
        bool passed;               // Se la proposta è stata approvata
        address proposer;          // Indirizzo dell'utente che ha creato la proposta
        address recipient;         // Indirizzo destinatario dei fondi (se finanziaria)
        uint amount;               // Quantità di token da inviare (se applicabile)
    }

    ProposalDetails[] public allProposals;
    IToken public token;           // Riferimento al contratto del token

    // Evento per notificare quando viene creata una nuova proposta
    event ProposalCreated(uint id, string title);

    /// @notice Costruttore per impostare il contratto del token
    /// @param _tokenAddress Indirizzo del contratto del token
    constructor(address _tokenAddress) {
        token = IToken(_tokenAddress);
    }

    /// @notice Crea una nuova proposta
    /// @dev Impediamo descrizioni vuote e ottimizziamo l'uso di calldata
    function createProposal(
        string calldata _title,
        string calldata _description,
        address _recipient,
        uint _amount
    ) external {
        require(bytes(_description).length > 0, "La descrizione non puo' essere vuota.");
        require(token.balanceOf(msg.sender) > 0, "Solo i membri possono creare proposte");

        uint proposalId = allProposals.length;
        allProposals.push(ProposalDetails({
            id: proposalId,
            title: _title,
            description: _description,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            executed: false,
            passed: false,
            proposer: msg.sender,
            recipient: _recipient,
            amount: _amount
        }));

        emit ProposalCreated(proposalId, _title);
    }

    /// @notice Ritorna i dettagli di una proposta tramite il suo ID
    function getProposal(uint _proposalId) public view returns (ProposalDetails memory) {
        require(_proposalId < allProposals.length, "Proposta non esistente.");
        return allProposals[_proposalId];
    }
}
