import { supabase } from "./supabase";

async function invokeMarketplace(body) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.functions.invoke("purohit-marketplace", { body });
  if (error) throw error;
  return data || {};
}

export async function fetchMarketplacePoojas() {
  return invokeMarketplace({ kind: "poojas" });
}

export async function fetchMarketplaceSettings() {
  return invokeMarketplace({ kind: "settings" });
}

export async function fetchMarketplacePriests(filters = {}) {
  return invokeMarketplace({ kind: "priests", ...filters });
}

export async function fetchMarketplaceProfile(priestId) {
  return invokeMarketplace({ kind: "profile", priest_id: priestId });
}
