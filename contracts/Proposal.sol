// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

/// @title Proposal
/// @dev Gestione delle proposte nella DAO. Include protezioni contro proposte con descrizione vuota.
///      Gestisce le proposte con campi per i voti, destinatari e ammontare di token opzionali.
interface IToken {
    function balanceOf(address account) external view returns (uint256);
}

contract Proposal {
    /// @notice Dettagli di una proposta
    struct ProposalDetails {
        uint id; // ID univoco della proposta
        string title; // Titolo della proposta
        string description; // Descrizione della proposta
        uint forVotes; // Numero totale di voti a favore
        uint againstVotes; // Numero totale di voti contrari
        uint abstainVotes; // Numero totale di voti di astensione
        bool executed; // Stato dell'esecuzione della proposta
        bool passed; // Stato dell'approvazione della proposta
        address proposer; // Indirizzo dell'utente che ha creato la proposta
        address recipient; // Destinatario dei fondi (se applicabile)
        uint amount; // Quantità di token da inviare (se applicabile)
    }

    ProposalDetails[] public allProposals; // Lista di tutte le proposte create
    mapping(uint => mapping(address => bool)) public voters; // Traccia chi ha votato per ogni proposta

    IToken public token; // Riferimento al contratto del token

    // Evento emesso quando viene creata una nuova proposta
    event ProposalCreated(uint id, string title);

    /// @notice Costruttore per inizializzare il contratto con il riferimento al token
    /// @param _tokenAddress Indirizzo del contratto del token
    constructor(address _tokenAddress) {
        token = IToken(_tokenAddress);
    }

    /// @notice Crea una nuova proposta
    /// @dev Protegge contro descrizioni vuote e ottimizza l'uso della memoria
    /// @param _title Titolo della proposta
    /// @param _description Descrizione della proposta
    /// @param _recipient Indirizzo destinatario dei fondi (può essere address(0) se non applicabile)
    /// @param _amount Quantità di token da inviare (può essere 0 se non applicabile)
    function createProposal(
        string calldata _title,
        string calldata _description,
        address _recipient,
        uint _amount
    ) external {
        require(
            bytes(_description).length > 0,
            "La descrizione non puo' essere vuota."
        );
        require(
            token.balanceOf(msg.sender) > 0,
            "Solo i membri possono creare proposte."
        );

        // Se un indirizzo è specificato, deve essere valido e l'importo > 0
        if (_recipient != address(0)) {
            require(_amount > 0, "L'importo deve essere maggiore di zero.");
        }

        uint proposalId = allProposals.length;
        allProposals.push(
            ProposalDetails({
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
            })
        );

        emit ProposalCreated(proposalId, _title);
    }

    // function createProposal(
    //     string calldata _title,
    //     string calldata _description,
    //     address _recipient,
    //     uint _amount
    // ) external {
    //     require(bytes(_description).length > 0, "La descrizione non puo' essere vuota.");
    //     require(token.balanceOf(msg.sender) > 0, "Solo i membri possono creare proposte.");

    //     uint proposalId = allProposals.length;
    //     allProposals.push(ProposalDetails({
    //         id: proposalId,
    //         title: _title,
    //         description: _description,
    //         forVotes: 0,
    //         againstVotes: 0,
    //         abstainVotes: 0,
    //         executed: false,
    //         passed: false,
    //         proposer: msg.sender,
    //         recipient: _recipient,
    //         amount: _amount
    //     }));

    //     emit ProposalCreated(proposalId, _title);
    // }

    /// @notice Ritorna i dettagli di una proposta tramite il suo ID
    /// @param _proposalId ID della proposta
    /// @return ProposalDetails I dettagli della proposta
    function getProposal(
        uint _proposalId
    ) public view returns (ProposalDetails memory) {
        require(_proposalId < allProposals.length, "Proposta non esistente.");
        return allProposals[_proposalId];
    }
}
