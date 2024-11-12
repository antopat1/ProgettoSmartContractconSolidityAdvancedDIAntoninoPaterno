    %% Nodes and Labels
    subgraph User Accounts
        A[Users]
    end

    subgraph Smart Contracts
        B[GovernanceToken]
        C[DAO]
    end

    subgraph Owner Account
        D[Owner]
    end

    %% Token Purchase Flow
    A -- Buys Tokens with ETH --> B
    B -- Issues Tokens --> A

    %% Proposal Creation and Voting Flow
    A -- Creates Proposal --> C
    A -- Votes on Proposal --> C

    %% Proposal Execution Flow
    C -- Executes Approved Proposals --> B
    C -- Distributes Tokens/ETH --> A

    %% Withdraw Funds
    D -- Withdraws ETH from Treasury --> C
    D -- Receives ETH --> D

    %% External Interactions
    A -. Uses Tokens to Participate .-> C
    C -. Tracks Votes and Execution Status .-> A
