const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://fvvmfrbfqwdypkagtdce.supabase.co";
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_sEbAdNoOCjP5Vs3DV9Y6SA_DDkZMGfy";

async function runTests() {
  console.log("=========================================");
  console.log("  Purohith Connect Automated Test Suite  ");
  console.log("=========================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name, condition, details = "") {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} ${details ? `- ${details}` : ""}`);
      failed++;
    }
  }

  // 1. Supabase Client Initialization
  console.log("1. Testing Supabase Database Connection...");
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  assert("Supabase Client initialized", Boolean(supabase));

  // 2. Query Poojas table
  try {
    const { data: poojas, error } = await supabase.from("poojas").select("slug,name,base_price_inr").limit(5);
    assert("Fetch poojas from database", !error && Array.isArray(poojas), error?.message || `Found ${poojas?.length || 0} poojas`);
  } catch (err) {
    assert("Fetch poojas from database", false, err.message);
  }

  // 3. Query Priest Profiles table
  try {
    const { data: priests, error } = await supabase.from("priest_profiles").select("id,display_name,starting_price_inr,max_price_inr").limit(5);
    assert("Fetch priest profiles", !error && Array.isArray(priests), error?.message || `Found ${priests?.length || 0} priests`);
    if (priests && priests.length > 0) {
      const allValidPrices = priests.every(p => !p.starting_price_inr || !p.max_price_inr || p.max_price_inr >= p.starting_price_inr);
      assert("Priest price range constraint (max >= starting)", allValidPrices);
    }
  } catch (err) {
    assert("Fetch priest profiles", false, err.message);
  }

  // 4. Query Bangalore Areas / Mock preferences
  console.log("\n2. Testing Location & Areas Data...");
  try {
    const areas = require("../src/data/bangalore-areas.json");
    assert("Bangalore areas dataset is loaded", Array.isArray(areas) && areas.length > 0, `Loaded ${areas.length} areas`);
    const whitefield = areas.find(a => a.name.toLowerCase().includes("whitefield"));
    assert("Default area Whitefield exists in dataset", Boolean(whitefield));
  } catch (err) {
    assert("Bangalore areas dataset", false, err.message);
  }

  // 5. Test Edge Function Health & Cashfree Gateway API response
  console.log("\n3. Testing Supabase Edge Functions & Cashfree Gateway...");
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/payment-workflow`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
      },
      body: JSON.stringify({ action: "create_cashfree_order" }),
    });
    const result = await response.json();
    assert("Edge function payment-workflow is live and enforcing auth", response.status === 401 || response.status === 400, `Status: ${response.status} (${JSON.stringify(result)})`);
  } catch (err) {
    assert("Edge function payment-workflow reachability", false, err.message);
  }

  console.log("\n=========================================");
  console.log(`  Tests Complete: ${passed} Passed, ${failed} Failed`);
  console.log("=========================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
