// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title GovernanceToken
/// @dev Token di governance usato per partecipare alla DAO. Protezione contro il reentrancy attack con ReentrancyGuard.
contract GovernanceToken is ERC20, Ownable, ReentrancyGuard {

    uint public constant TOKEN_PRICE = 0.01 ether;

    constructor() ERC20("GovernanceToken", "GT") {}

    /// @notice Acquisto di token di governance. Prezzo fisso per token.
    function buyTokens() external payable nonReentrant {
        require(msg.value > 0, "Devi inviare Ether per acquistare token.");
        uint tokensToMint = (msg.value * 10**decimals()) / TOKEN_PRICE; 
        _mint(msg.sender, tokensToMint);
    }

    /// @notice Funzione per prelevare gli Ether accumulati dalla vendita dei token. Solo l'owner può chiamarla.
    function withdraw() external onlyOwner nonReentrant {
        uint balance = address(this).balance;
        require(balance > 0, "Nessun Ether da prelevare.");
        payable(owner()).transfer(balance); // Trasferiamo il saldo al proprietario del contratto
    }
}
