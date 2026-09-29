import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, getSupabaseSecretKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (body.kind === "poojas") {
      const [{ data, error }, { data: feeSetting }] = await Promise.all([
        supabase.from("poojas")
          .select("id,slug,name,description,duration_minutes,base_price_inr,image_url,is_active")
          .eq("is_active", true)
          .order("base_price_inr", { ascending: true }),
        supabase.from("platform_settings")
          .select("value")
          .eq("key", "payment_service_fee_percent")
          .maybeSingle(),
      ]);
      if (error) throw error;
      const serviceFeePercent = Number(feeSetting?.value || 10);
      return json({ poojas: data || [], service_fee_percent: serviceFeePercent });
    }

    if (body.kind === "settings") {
      const { data: feeSetting } = await supabase.from("platform_settings")
        .select("value")
        .eq("key", "payment_service_fee_percent")
        .maybeSingle();
      return json({ service_fee_percent: Number(feeSetting?.value || 10) });
    }

    if (body.kind === "profile") {
      const priestId = clean(body.priest_id);
      const priestSlug = clean(body.priest_slug);
      if (!priestId && !priestSlug) return json({ error: "Profile identifier is required" }, 400);
      let profileQuery = supabase.from("priest_profiles")
        .select("id,user_id,slug,display_name,profile_headline,bio,years_experience,languages,service_areas,pooja_slugs,photo_url,portfolio_urls,verification_status,rating,review_count,tradition,availability_notes,starting_price_inr,max_price_inr,primary_service_area")
        .eq("verification_status", "verified")
        .not("photo_url", "is", null)
        .not("submitted_at", "is", null);
      profileQuery = priestId ? profileQuery.eq("id", priestId) : profileQuery.eq("slug", priestSlug);
      const { data, error } = await profileQuery.maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Profile not found" }, 404);
      const { data: services, error: servicesError } = await supabase.from("priest_services")
        .select("pooja_slug,price_paise,duration_minutes,is_active")
        .eq("priest_id", data.id)
        .eq("is_active", true)
        .order("price_paise", { ascending: true });
      if (servicesError) throw servicesError;
      const { data: reviews, error: reviewsError } = await supabase.from("reviews")
        .select("id,rating,comment,created_at")
        .eq("priest_id", data.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (reviewsError) throw reviewsError;
      return json({
        profile: {
          ...mapPriest(data),
          services: (services || []).map((service: any) => ({
            pooja_slug: service.pooja_slug,
            price_inr: Number(service.price_paise || 0) / 100,
            duration_minutes: service.duration_minutes,
          })),
          reviews: reviews || [],
        },
      });
    }

    const poojaSlug = clean(body.pooja_slug);
    const area = clean(body.area);
    const language = clean(body.language);
    const q = clean(body.query).toLowerCase();
    const minPrice = Number(body.min_price_inr || 0);
    const maxPrice = Number(body.max_price_inr || 0);

    let query = supabase.from("priest_profiles")
      .select("id,user_id,slug,display_name,profile_headline,bio,years_experience,languages,service_areas,pooja_slugs,photo_url,portfolio_urls,verification_status,rating,review_count,tradition,availability_notes,starting_price_inr,max_price_inr,primary_service_area")
      .eq("verification_status", "verified")
      .not("photo_url", "is", null)
      .not("submitted_at", "is", null)
      .order("rating", { ascending: false })
      .limit(200);

    if (poojaSlug) query = query.contains("pooja_slugs", [poojaSlug]);
    if (area && area !== "All") query = query.contains("service_areas", [area]);
    if (language && language !== "All") query = query.contains("languages", [language]);
    if (minPrice > 0) query = query.gte("max_price_inr", minPrice);
    if (maxPrice > 0) query = query.lte("starting_price_inr", maxPrice);

    const { data, error } = await query;
    if (error) throw error;

    const filtered = (data || []).filter((profile) => {
      const languages = profile.languages || [];
      const areas = profile.service_areas || [];
      const searchBlob = [
        profile.display_name,
        profile.bio,
        profile.tradition,
        profile.primary_service_area,
        ...languages,
        ...areas,
        ...(profile.pooja_slugs || []),
      ].join(" ").toLowerCase();
      const matchesSearch = !q || searchBlob.includes(q);
      return matchesSearch;
    });

    return json({ priests: filtered.map(mapPriest) });
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function mapPriest(profile: any) {
  return {
    id: profile.id,
    slug: profile.slug,
    user_id: profile.user_id,
    name: profile.display_name,
    display_name: profile.display_name,
    bio: profile.bio,
    profile_headline: profile.profile_headline,
    experience: profile.years_experience,
    experience_years: profile.years_experience,
    languages: profile.languages || [],
    areas: profile.service_areas || [],
    service_areas: profile.service_areas || [],
    pooja_specialties: profile.pooja_slugs || [],
    pooja_slugs: profile.pooja_slugs || [],
    photo_url: profile.photo_url,
    portfolio_urls: profile.portfolio_urls || [],
    verified: profile.verification_status === "verified",
    rating: Number(profile.rating || 0),
    reviews_count: profile.review_count || 0,
    rating_count: profile.review_count || 0,
    tradition: profile.tradition,
    availability_notes: profile.availability_notes,
    starting_price_inr: profile.starting_price_inr,
    max_price_inr: profile.max_price_inr,
    primary_service_area: profile.primary_service_area,
  };
}

function getSupabaseSecretKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys);
    if (parsed.default) return parsed.default;
  }
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceRole) return serviceRole;
  throw new Error("Supabase secret key is not configured for this function.");
}
