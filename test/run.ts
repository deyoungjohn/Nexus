// One explicit entry point keeps named-test reporting visible in agent shells
// and avoids discovering obsolete files left in the compilation directory.
import "./amount.test.js";
import "./instrument.test.js";
import "./allocation.test.js";
import "./ledger.test.js";
import "./coordinator.test.js";
import "./coordinator-store.test.js";
import "./market-gate.test.js";
import "./pyth-pro.test.js";
import "./ondo-quantity.test.js";
import "./chainlink-bsc-equity.test.js";
import "./binance-rwa-status.test.js";
import "./nyse-calendar.test.js";
import "./owner-attestation.test.js";
import "./ondo-beacon-risk.test.js";
import "./xstocks-bsc.test.js";
import "./bstocks-bsc.test.js";
import "./bstocks-transfer.test.js";
