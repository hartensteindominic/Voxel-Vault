# VoxelFlip Factory

Factory is a conservative sale-to-reinvestment workflow. It observes settled external sales, requires a real net-profit ledger before reinvestment, reserves most realized profit, and keeps spending/mint/list actions approval-gated until a separately tested bounded executor exists.

It must never count self-trades, minting, or unsold inventory as profit. Automatic spending/signing is intentionally off.
