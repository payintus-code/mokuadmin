import fs from "node:fs";

const envLines = fs
  .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split(/\r?\n/)
  .filter(Boolean);

const env = Object.fromEntries(
  envLines.map((line) => {
    const separator = line.indexOf("=");
    return [line.slice(0, separator), line.slice(separator + 1)];
  })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  process.exit(1);
}

const publicTables = [
  "app_users",
  "customers",
  "pets",
  "services",
  "rooms",
  "shop_settings",
  "bookings",
  "booking_items",
  "cash_transactions",
  "booking_payments"
];

const exposed = [];
const callableRpcHelpers = [];

for (const table of publicTables) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`
    }
  });

  const body = await response.text();
  const trimmed = body.trim();
  const leaksRows = response.ok && trimmed !== "[]" && !trimmed.includes("\"code\":\"PGRST");

  console.log(`${table}: ${response.status} ${trimmed.slice(0, 120)}`);

  if (leaksRows) {
    exposed.push(table);
  }
}

if (exposed.length > 0) {
  console.error(`Public data exposure detected in: ${exposed.join(", ")}`);
  process.exit(1);
}

for (const fn of ["current_app_role", "is_active_app_user", "is_admin"]) {
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  const body = await response.text();
  console.log(`rpc ${fn}: ${response.status} ${body.slice(0, 120)}`);

  if (response.ok) {
    callableRpcHelpers.push(fn);
  }
}

if (callableRpcHelpers.length > 0) {
  console.error(`Public RPC helper exposure detected in: ${callableRpcHelpers.join(", ")}`);
  process.exit(1);
}

console.log("No public tables returned rows and no RLS helper RPCs were callable with the publishable key.");
