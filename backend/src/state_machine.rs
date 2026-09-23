//! 1:1 Rust port of `src/services/transactionStateMachine.ts` from the React app.
//!
//! This is the authoritative version once the backend is wired in — the
//! frontend's copy becomes a display-only mirror. Keep the transition table
//! and actor table in sync with the TS file until that file is deleted.

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TransactionStatus {
    Pending,
    PendingSupplierAcceptance,
    Accepted,
    Rejected,
    PaymentPending,
    PaymentConfirmed,
    PaymentFailed,
    PaymentCancelled,
    LogisticsPending,
    LogisticsAssigned,
    LogisticsAccepted,
    LogisticsRejected,
    ReadyForPickup,
    PickedUp,
    InTransit,
    Delivered,
    BuyerConfirmationPending,
    DeliveryConfirmed,
    Completed,
    Cancelled,
    Disputed,
    DeliveryFailed,
}

impl TransactionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            TransactionStatus::Pending => "PENDING",
            TransactionStatus::PendingSupplierAcceptance => "PENDING_SUPPLIER_ACCEPTANCE",
            TransactionStatus::Accepted => "ACCEPTED",
            TransactionStatus::Rejected => "REJECTED",
            TransactionStatus::PaymentPending => "PAYMENT_PENDING",
            TransactionStatus::PaymentConfirmed => "PAYMENT_CONFIRMED",
            TransactionStatus::PaymentFailed => "PAYMENT_FAILED",
            TransactionStatus::PaymentCancelled => "PAYMENT_CANCELLED",
            TransactionStatus::LogisticsPending => "LOGISTICS_PENDING",
            TransactionStatus::LogisticsAssigned => "LOGISTICS_ASSIGNED",
            TransactionStatus::LogisticsAccepted => "LOGISTICS_ACCEPTED",
            TransactionStatus::LogisticsRejected => "LOGISTICS_REJECTED",
            TransactionStatus::ReadyForPickup => "READY_FOR_PICKUP",
            TransactionStatus::PickedUp => "PICKED_UP",
            TransactionStatus::InTransit => "IN_TRANSIT",
            TransactionStatus::Delivered => "DELIVERED",
            TransactionStatus::BuyerConfirmationPending => "BUYER_CONFIRMATION_PENDING",
            TransactionStatus::DeliveryConfirmed => "DELIVERY_CONFIRMED",
            TransactionStatus::Completed => "COMPLETED",
            TransactionStatus::Cancelled => "CANCELLED",
            TransactionStatus::Disputed => "DISPUTED",
            TransactionStatus::DeliveryFailed => "DELIVERY_FAILED",
        }
    }

    /// Valid next states from this status — mirrors the `TRANSITIONS` map in
    /// transactionStateMachine.ts exactly.
    pub fn allowed_transitions(&self) -> &'static [TransactionStatus] {
        use TransactionStatus::*;
        match self {
            Pending => &[PendingSupplierAcceptance, Accepted, Rejected, Cancelled],
            PendingSupplierAcceptance => &[Accepted, Rejected, Cancelled],
            Accepted => &[PaymentPending, Cancelled],
            Rejected => &[],
            PaymentPending => &[PaymentConfirmed, PaymentFailed, PaymentCancelled],
            PaymentConfirmed => &[
                LogisticsPending,
                LogisticsAssigned,
                LogisticsAccepted,
                ReadyForPickup,
                PickedUp,
                InTransit,
                Delivered,
                Completed,
            ],
            PaymentFailed => &[PaymentPending, Cancelled],
            PaymentCancelled => &[Cancelled],
            LogisticsPending => &[LogisticsAssigned, LogisticsAccepted, ReadyForPickup, PickedUp, InTransit, Delivered, Completed],
            LogisticsAssigned => &[LogisticsAccepted, LogisticsRejected, ReadyForPickup, PickedUp, InTransit, Delivered, Completed],
            LogisticsAccepted => &[ReadyForPickup, PickedUp, InTransit, Delivered, Completed],
            LogisticsRejected => &[LogisticsPending],
            ReadyForPickup => &[PickedUp, InTransit, Delivered, Completed],
            PickedUp => &[InTransit, Delivered, Completed],
            InTransit => &[Delivered, BuyerConfirmationPending, DeliveryConfirmed, Completed, DeliveryFailed],
            Delivered => &[BuyerConfirmationPending, DeliveryConfirmed, Completed, Disputed],
            BuyerConfirmationPending => &[DeliveryConfirmed, Completed, Disputed],
            DeliveryConfirmed => &[Completed],
            DeliveryFailed => &[Disputed],
            Completed => &[],
            Cancelled => &[],
            Disputed => &[Completed, Cancelled],
        }
    }

    /// Roles allowed to *drive the transaction into* this status — mirrors
    /// `ALLOWED_ACTORS` in transactionStateMachine.ts. `None` means any role
    /// involved in the transaction may trigger it (no table entry on the TS side).
    pub fn allowed_actors(&self) -> Option<&'static [Actor]> {
        use Actor::*;
        use TransactionStatus::*;
        match self {
            PendingSupplierAcceptance => Some(&[Buyer, System]),
            Accepted => Some(&[Supplier]),
            Rejected => Some(&[Supplier]),
            PaymentPending => Some(&[Buyer, System]),
            PaymentConfirmed => Some(&[Buyer, System, Admin]),
            PaymentFailed => Some(&[Buyer, System, Admin]),
            PaymentCancelled => Some(&[Buyer, System, Admin]),
            LogisticsPending => Some(&[Buyer, System, Admin]),
            LogisticsAssigned => Some(&[Admin, System, Logistics]),
            LogisticsAccepted => Some(&[Logistics, System, Admin]),
            LogisticsRejected => Some(&[Logistics, System, Admin]),
            ReadyForPickup => Some(&[Logistics, System, Admin]),
            PickedUp => Some(&[Logistics, System, Admin]),
            InTransit => Some(&[Logistics, System, Admin]),
            Delivered => Some(&[Logistics, System, Admin]),
            BuyerConfirmationPending => Some(&[Logistics, System, Admin]),
            DeliveryConfirmed => Some(&[Buyer, System, Admin]),
            DeliveryFailed => Some(&[Buyer, Logistics, Admin]),
            Completed => Some(&[Buyer, System, Admin, Logistics, Supplier]),
            Cancelled => Some(&[Buyer, Supplier, Admin]),
            Disputed => Some(&[Buyer]),
            _ => None,
        }
    }
}

impl fmt::Display for TransactionStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Matches `UserRole | 'system'` from the frontend.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Actor {
    Buyer,
    Supplier,
    Logistics,
    Admin,
    System,
}

impl fmt::Display for Actor {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            Actor::Buyer => "buyer",
            Actor::Supplier => "supplier",
            Actor::Logistics => "logistics",
            Actor::Admin => "admin",
            Actor::System => "system",
        };
        write!(f, "{s}")
    }
}

pub fn can_transition(from: TransactionStatus, to: TransactionStatus) -> bool {
    if from == to {
        return true;
    }
    // Idempotent re-accept, same special case as the TS version.
    if to == TransactionStatus::Accepted
        && matches!(
            from,
            TransactionStatus::PaymentPending | TransactionStatus::PaymentConfirmed
        )
    {
        return true;
    }
    from.allowed_transitions().contains(&to)
}

pub struct TransitionCheck {
    pub allowed: bool,
    pub reason: Option<String>,
}

pub fn can_actor_transition(
    from: TransactionStatus,
    to: TransactionStatus,
    actor: Actor,
) -> TransitionCheck {
    if from == to {
        return TransitionCheck {
            allowed: true,
            reason: None,
        };
    }
    if !can_transition(from, to) {
        return TransitionCheck {
            allowed: false,
            reason: Some(format!("Transition from {from} to {to} is not permitted.")),
        };
    }
    if let Some(allowed_actors) = to.allowed_actors() {
        if !allowed_actors.contains(&actor) {
            return TransitionCheck {
                allowed: false,
                reason: Some(format!("A {actor} cannot perform this action.")),
            };
        }
    }
    TransitionCheck {
        allowed: true,
        reason: None,
    }
}

impl std::str::FromStr for TransactionStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        use TransactionStatus::*;
        Ok(match s {
            "PENDING" => Pending,
            "PENDING_SUPPLIER_ACCEPTANCE" => PendingSupplierAcceptance,
            "ACCEPTED" => Accepted,
            "REJECTED" => Rejected,
            "PAYMENT_PENDING" => PaymentPending,
            "PAYMENT_CONFIRMED" => PaymentConfirmed,
            "PAYMENT_FAILED" => PaymentFailed,
            "PAYMENT_CANCELLED" => PaymentCancelled,
            "LOGISTICS_PENDING" => LogisticsPending,
            "LOGISTICS_ASSIGNED" => LogisticsAssigned,
            "LOGISTICS_ACCEPTED" => LogisticsAccepted,
            "LOGISTICS_REJECTED" => LogisticsRejected,
            "READY_FOR_PICKUP" => ReadyForPickup,
            "PICKED_UP" => PickedUp,
            "IN_TRANSIT" => InTransit,
            "DELIVERED" => Delivered,
            "BUYER_CONFIRMATION_PENDING" => BuyerConfirmationPending,
            "DELIVERY_CONFIRMED" => DeliveryConfirmed,
            "COMPLETED" => Completed,
            "CANCELLED" => Cancelled,
            "DISPUTED" => Disputed,
            "DELIVERY_FAILED" => DeliveryFailed,
            other => return Err(format!("Unknown transaction status: {other}")),
        })
    }
}

impl std::str::FromStr for Actor {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Ok(match s {
            "buyer" => Actor::Buyer,
            "supplier" => Actor::Supplier,
            "logistics" => Actor::Logistics,
            "admin" => Actor::Admin,
            "system" => Actor::System,
            other => return Err(format!("Unknown actor role: {other}")),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buyer_can_initiate_supplier_acceptance() {
        let check = can_actor_transition(
            TransactionStatus::Pending,
            TransactionStatus::PendingSupplierAcceptance,
            Actor::Buyer,
        );
        assert!(check.allowed);
    }

    #[test]
    fn buyer_cannot_accept_on_suppliers_behalf() {
        let check = can_actor_transition(
            TransactionStatus::Pending,
            TransactionStatus::Accepted,
            Actor::Buyer,
        );
        assert!(!check.allowed);
    }

    #[test]
    fn terminal_states_have_no_transitions() {
        assert!(TransactionStatus::Completed.allowed_transitions().is_empty());
        assert!(TransactionStatus::Cancelled.allowed_transitions().is_empty());
        assert!(TransactionStatus::Rejected.allowed_transitions().is_empty());
    }

    #[test]
    fn idempotent_reaccept_from_payment_states() {
        assert!(can_transition(
            TransactionStatus::PaymentPending,
            TransactionStatus::Accepted
        ));
        assert!(can_transition(
            TransactionStatus::PaymentConfirmed,
            TransactionStatus::Accepted
        ));
    }

    #[test]
    fn only_logistics_can_drive_shipment_milestones() {
        for to in [
            TransactionStatus::ReadyForPickup,
            TransactionStatus::PickedUp,
            TransactionStatus::InTransit,
            TransactionStatus::Delivered,
        ] {
            let check = can_actor_transition(TransactionStatus::LogisticsAccepted, to, Actor::Buyer);
            assert!(!check.allowed, "buyer should not drive {to}");
        }
    }
}
