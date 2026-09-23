#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    token, Address, BytesN, Env,
};

// ─── Data Types ───────────────────────────────────────────────

#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum Status {
    None,
    Funded,
    Released,
    Refunded,
    Disputed,
}

#[contracttype]
#[derive(Clone)]
pub struct Trade {
    pub buyer:            Address,
    pub supplier:         Address,
    pub logistics:        Address,
    pub goods_amount:     i128,
    pub logistics_amount: i128,
    pub platform_fee:     i128,
    pub status:           Status,
}

#[contracttype]
pub enum DataKey {
    Trade(BytesN<32>),
    Admin,
    Token,
    Treasury,
}

// ─── Contract ─────────────────────────────────────────────────

#[contract]
pub struct AgriFlowEscrow;

#[contractimpl]
impl AgriFlowEscrow {

    /// Called once right after deployment
    pub fn init(env: Env, admin: Address, token: Address, treasury: Address) {
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin,    &admin);
        env.storage().instance().set(&DataKey::Token,    &token);
        env.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    /// Admin or Buyer creates an escrow trade record before deposit
    pub fn create_trade(
        env: Env,
        tx_id:            BytesN<32>,
        buyer:            Address,
        supplier:         Address,
        logistics:        Address,
        goods_amount:     i128,
        logistics_amount: i128,
    ) {
        buyer.require_auth();

        let key = DataKey::Trade(tx_id.clone());
        assert!(env.storage().persistent().get::<_, Trade>(&key).is_none(), "Trade exists");

        let fee = goods_amount / 100; // 1% platform fee
        env.storage().persistent().set(&key, &Trade {
            buyer,
            supplier,
            logistics,
            goods_amount,
            logistics_amount,
            platform_fee: fee,
            status: Status::None,
        });
    }

    /// Atomically create trade and deposit USDC into escrow in a single transaction
    pub fn create_and_deposit(
        env: Env,
        tx_id:            BytesN<32>,
        buyer:            Address,
        supplier:         Address,
        logistics:        Address,
        goods_amount:     i128,
        logistics_amount: i128,
    ) {
        buyer.require_auth();

        let key = DataKey::Trade(tx_id.clone());
        assert!(env.storage().persistent().get::<_, Trade>(&key).is_none(), "Trade exists");

        let fee = goods_amount / 100; // 1% platform fee
        let total = goods_amount + logistics_amount + fee;
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        token::Client::new(&env, &token)
            .transfer(&buyer, &env.current_contract_address(), &total);

        env.storage().persistent().set(&key, &Trade {
            buyer,
            supplier,
            logistics,
            goods_amount,
            logistics_amount,
            platform_fee: fee,
            status: Status::Funded,
        });
    }

    /// Buyer deposits USDC — funds the escrow atomically (no separate approve needed on Stellar)
    pub fn deposit(env: Env, tx_id: BytesN<32>) {
        let key = DataKey::Trade(tx_id.clone());
        let mut trade: Trade = env.storage().persistent()
            .get(&key).expect("Trade not found");

        assert!(trade.status == Status::None, "Already funded");
        trade.buyer.require_auth();

        let total = trade.goods_amount + trade.logistics_amount + trade.platform_fee;
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        token::Client::new(&env, &token)
            .transfer(&trade.buyer, &env.current_contract_address(), &total);

        trade.status = Status::Funded;
        env.storage().persistent().set(&key, &trade);
    }

    /// Buyer confirms receipt — releases USDC to supplier + logistics + treasury
    pub fn release(env: Env, tx_id: BytesN<32>) {
        let key = DataKey::Trade(tx_id.clone());
        let mut trade: Trade = env.storage().persistent()
            .get(&key).expect("Trade not found");

        assert!(trade.status == Status::Funded, "Not funded");
        trade.buyer.require_auth();

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let client = token::Client::new(&env, &token);
        let escrow = env.current_contract_address();

        client.transfer(&escrow, &trade.supplier,  &trade.goods_amount);
        client.transfer(&escrow, &trade.logistics, &trade.logistics_amount);
        client.transfer(&escrow, &treasury,        &trade.platform_fee);

        trade.status = Status::Released;
        env.storage().persistent().set(&key, &trade);
    }

    /// Buyer or supplier raises a dispute — freezes funds
    pub fn raise_dispute(env: Env, tx_id: BytesN<32>, caller: Address) {
        caller.require_auth();
        let key = DataKey::Trade(tx_id.clone());
        let mut trade: Trade = env.storage().persistent()
            .get(&key).expect("Trade not found");

        assert!(trade.status == Status::Funded, "Not funded");
        assert!(caller == trade.buyer || caller == trade.supplier, "Not a party");

        trade.status = Status::Disputed;
        env.storage().persistent().set(&key, &trade);
    }

    /// Admin refunds buyer (dispute upheld or cancellation)
    pub fn refund(env: Env, tx_id: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let key = DataKey::Trade(tx_id.clone());
        let mut trade: Trade = env.storage().persistent()
            .get(&key).expect("Trade not found");

        assert!(
            trade.status == Status::Funded || trade.status == Status::Disputed,
            "Cannot refund"
        );

        let total = trade.goods_amount + trade.logistics_amount + trade.platform_fee;
        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();

        token::Client::new(&env, &token)
            .transfer(&env.current_contract_address(), &trade.buyer, &total);

        trade.status = Status::Refunded;
        env.storage().persistent().set(&key, &trade);
    }

    /// Read trade state — used by frontend to show live on-chain status
    pub fn get_trade(env: Env, tx_id: BytesN<32>) -> Option<Trade> {
        env.storage().persistent().get(&DataKey::Trade(tx_id))
    }
}

// ─── Tests ────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{
        testutils::Address as _,
        token::{Client as TokenClient, StellarAssetClient},
        Address, BytesN, Env,
    };

    fn setup() -> (Env, AgriFlowEscrowClient<'static>, Address, Address, Address, Address, Address, TokenClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();

        let admin     = Address::generate(&env);
        let buyer     = Address::generate(&env);
        let supplier  = Address::generate(&env);
        let logistics = Address::generate(&env);
        let treasury  = Address::generate(&env);

        // Deploy mock token
        let token_id = env.register_stellar_asset_contract_v2(admin.clone());
        let token_admin = StellarAssetClient::new(&env, &token_id.address());
        // Mint 10_000 tokens (7 decimals) to buyer
        token_admin.mint(&buyer, &10_000_0000000);
        let token_client = TokenClient::new(&env, &token_id.address());

        // Deploy escrow
        let contract_id = env.register_contract(None, AgriFlowEscrow);
        let escrow = AgriFlowEscrowClient::new(&env, &contract_id);
        escrow.init(&admin, &token_id.address(), &treasury);

        (env, escrow, admin, buyer, supplier, logistics, treasury, token_client)
    }

    fn make_tx_id(env: &Env, s: &str) -> BytesN<32> {
        let bytes = s.as_bytes();
        let mut arr = [0u8; 32];
        let len = bytes.len().min(32);
        arr[..len].copy_from_slice(&bytes[..len]);
        BytesN::from_array(env, &arr)
    }

    #[test]
    fn test_happy_path() {
        let (env, escrow, _admin, buyer, supplier, logistics, _treasury, token) = setup();
        let tx_id = make_tx_id(&env, "TXN-4821");

        escrow.create_trade(&tx_id, &buyer, &supplier, &logistics, &100_0000000, &10_0000000);
        escrow.deposit(&tx_id);

        assert_eq!(token.balance(&supplier), 0);
        escrow.release(&tx_id);
        assert_eq!(token.balance(&supplier), 100_0000000);
        assert_eq!(token.balance(&logistics), 10_0000000);
    }

    #[test]
    fn test_create_and_deposit_atomic() {
        let (env, escrow, _admin, buyer, supplier, logistics, _treasury, token) = setup();
        let tx_id = make_tx_id(&env, "TXN-ATOMIC");

        escrow.create_and_deposit(&tx_id, &buyer, &supplier, &logistics, &100_0000000, &10_0000000);

        let trade = escrow.get_trade(&tx_id).unwrap();
        assert_eq!(trade.status, Status::Funded);

        escrow.release(&tx_id);
        assert_eq!(token.balance(&supplier), 100_0000000);
        assert_eq!(token.balance(&logistics), 10_0000000);
    }

    #[test]
    fn test_dispute_and_refund() {
        let (env, escrow, _admin, buyer, supplier, logistics, _treasury, token) = setup();
        let tx_id = make_tx_id(&env, "TXN-DISPUTE");
        let buyer_balance_before = token.balance(&buyer);

        escrow.create_and_deposit(&tx_id, &buyer, &supplier, &logistics, &100_0000000, &10_0000000);
        escrow.raise_dispute(&tx_id, &buyer);
        escrow.refund(&tx_id);

        assert_eq!(token.balance(&buyer), buyer_balance_before);
    }

    #[test]
    #[should_panic(expected = "Already funded")]
    fn test_double_deposit_fails() {
        let (env, escrow, _, buyer, supplier, logistics, _, _) = setup();
        let tx_id = make_tx_id(&env, "TXN-DBL");
        escrow.create_and_deposit(&tx_id, &buyer, &supplier, &logistics, &100_0000000, &10_0000000);
        escrow.deposit(&tx_id); // panics: Already funded
    }
}
