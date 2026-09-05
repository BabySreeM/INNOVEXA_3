# Innovexa Dashboard

Innovexa is a responsive monitoring and control dashboard for an ESP32-based water distribution and leak-isolation prototype. It opens in a Firebase-not-configured state and includes a complete local Demo Mode so the operating model can be explored before the hardware is assembled.

## Run locally

1. Copy `.env.example` to `.env` and fill in the Firebase web app values when a Realtime Database is available.
2. Install dependencies with `pnpm install`.
3. Start the app with the managed Innovexa web workflow.

Without Firebase values, choose **Run in Demo Mode** from the entry screen. The demo is intentionally local and does not fabricate live hardware data.

## Firebase Realtime Database

The dashboard reads the exact paths below and writes commands only under `/commands`:

- `/system`: `phase`, `pump_on`, `last_updated`
- `/tanks/A`, `/tanks/B`, `/tanks/C`: `level_cm`, `level_pct`, `is_critical`
- `/source`: `level_pct`, `critical`
- `/valves`: `SV1`, `SV2`, `SV3`, `bypass_manual`
- `/flow`: `main_header_lpm`, `branch_A_lpm`, `branch_B_inferred_lpm`, `branch_C_inferred_lpm`
- `/alerts`: `leak_detected`, `bucket_leak_sensor`, `source_critical`
- `/commands`: `bypass_confirm`, `estop_triggered`, `priority_tank`, and `manual_valve_override/{valve_id}`
- `/events/{push-id}`: `timestamp`, `type`, `message`

The ESP32 owns the phase state machine. The dashboard never writes `/system`, `/valves`, or `/alerts`; it only reads those values and sends operator commands under `/commands`.