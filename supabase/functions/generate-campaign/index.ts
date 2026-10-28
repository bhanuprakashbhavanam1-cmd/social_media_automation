import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ====================================================================
// OMNIMARKET AI - SUPABASE EDGE FUNCTION (PHASE 3)
// Function: generate-campaign
// Runtime: Deno (Supabase Edge Function)
// AI Model: Google Gemini 1.5 Pro (gemini-1.5-pro) via REST API
// ====================================================================

// Define CORS Headers for Frontend Requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RequestPayload {
  mediaUrl: string;
  platforms: string[];
  marketingGoal: string;
}

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Authenticate user using Supabase auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Optional: Parse user from JWT for verification / billing / credits
    // In production: const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    // and verify JWT: const { data: { user } } = await supabase.auth.getUser(token)

    // 2. Parse request parameters
    const { mediaUrl, platforms, marketingGoal } = await req.json() as RequestPayload;
    if (!mediaUrl || !platforms || platforms.length === 0 || !marketingGoal) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mediaUrl, platforms, and marketingGoal are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Retrieve DeepSeek API Key from environment (falls back to Gemini key if needed during transition)
    const deepseekApiKey = Deno.env.get("DEEPSEEK_API_KEY") || Deno.env.get("GEMINI_API_KEY");
    if (!deepseekApiKey) {
      console.error("DEEPSEEK_API_KEY is not configured in Supabase environment");
      return new Response(
        JSON.stringify({ error: "AI Engine is temporarily unavailable. Config missing." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Construct the structured response schema for DeepSeek API
    const responseSchema = {
      type: "OBJECT",
      properties: {
        instagram: {
          type: "OBJECT",
          properties: {
            caption: { type: "STRING", description: "Engaging and visual caption suited for an Instagram Reel/Post. Include emojis, structured line breaks, and a call to action." },
            hashtags: { type: "ARRAY", items: { type: "STRING" }, description: "Array of 10-15 trending and niche hashtags optimized for Instagram's search algorithms." }
          },
          required: ["caption", "hashtags"]
        },
        youtube: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING", description: "SEO-optimized video title (strictly under 60 characters) with high CTR appeal." },
            description: { type: "STRING", description: "Keyword-dense video description, including hooks, summary of content, placeholder links, and video hashtags." },
            tags: { type: "ARRAY", items: { type: "STRING" }, description: "Array of search terms and video tags for metadata indexing." }
          },
          required: ["title", "description", "tags"]
        },
        x: {
          type: "OBJECT",
          properties: {
            caption: { type: "STRING", description: "A highly engaging, punchy text hook suited for X. Must be strictly under 280 characters including spaces." }
          },
          required: ["caption"]
        },
        facebook: {
          type: "OBJECT",
          properties: {
            caption: { type: "STRING", description: "A detailed, community-centric, professional and engaging copy suited for Facebook business pages." }
          },
          required: ["caption"]
        },
        suggested_publish_time: {
          type: "STRING",
          description: "An ISO 8601 UTC timestamp suggesting the optimal publication time based on standard audience activity spikes in this marketing niche."
        },
        analysis_reasoning: {
          type: "STRING",
          description: "A professional explanation of why these captions, tags, and scheduled time slots were chosen."
        }
      },
      required: ["instagram", "youtube", "x", "facebook", "suggested_publish_time", "analysis_reasoning"]
    };

    const currentTimeISO = new Date().toISOString();

    // 5. Build prompt incorporating media context and platforms
    const prompt = `
      --- CAMPAIGN CONTEXT ---
      Current Time Reference: ${currentTimeISO} (IMPORTANT: Today is ${currentTimeISO}. The suggested publication time MUST be strictly in the future relative to this current time.)
      Media Asset URL: ${mediaUrl}
      Requested Platforms: ${platforms.join(", ")}
      Marketing Goal/Context: "${marketingGoal}"

      --- HIGH-REACH DIGITAL MARKETING INSTRUCTIONS ---
      1. PLATFORM CUSTOMIZATION: Write highly optimized, custom title/description/hook variants ONLY for the requested platforms: "${platforms.join(", ")}".
         - For Facebook: Write relatable, community-focused post copies optimized for high algorithmic distribution, utilizing clean bulleted structures, active calls-to-action (CTAs), and bold hooks.
         - For Instagram: Write short, visually-appealing, lifestyle-oriented captions suited for Reels/Posts with structured line breaks and high-converting CTAs.
         - For YouTube: Craft highly-clickable titles (strictly under 60 characters) and keyword-dense descriptions containing hooks and video search tags to maximize organic search indexing.
         - For X (Twitter): Write high-converting hooks strictly under 280 characters with visual formatting to drive clicks.

      2. ACTIVE HASHTAG CURATION: Retrieve and compile highly relevant, high-reach, platform-appropriate hashtags. Do NOT use fake or generic placeholders. Tailor them specifically to the marketing goal and selected platforms. Instagram/Facebook should contain a mix of broad, industry-level, and high-engagement niche tags.

      3. ADVANCED PUBLISHING TRIGGER SLOT: Suggest a high-converting, strategic publication slot. Today's date/time reference is ${currentTimeISO}.
         - Analyze standard peak audience activity spikes for the selected platforms:
           * Instagram/Facebook: Peak engagement spikes are typically between 5:00 PM and 8:00 PM local time, or midday 12:00 PM - 2:00 PM on weekdays.
           * YouTube: Ideal posting is 12:00 PM – 4:00 PM to allow indexation before peak evening viewing.
           * X (Twitter): Peak click-through activity occurs between 12:00 PM and 3:00 PM.
         - Select the absolute highest-converting overall future slot that falls AFTER the reference time ${currentTimeISO} (typically tomorrow or later today at one of these peak slots). Output this strictly as a standard ISO 8601 UTC timestamp in "suggested_publish_time".

      4. DETAILED REACH STRATEGY: In the "analysis_reasoning" field, provide a professional, data-backed explanation. Detail:
         - Why this specific peak publication time was chosen for "${platforms.join(", ")}".
         - The strategic rationale behind the selected high-reach hashtags and how they align with current platform algorithms for maximum organic visibility.
    `;

    // 6. Execute API Request to DeepSeek API (deepseek-chat is OpenAI compatible)
    const deepseekEndpoint = "https://api.deepseek.com/chat/completions";

    const systemPrompt = `You are "OmniMarket AI", a Senior Growth Architect and Viral Marketing Expert.
Your goal is to take a raw marketing concept and media assets, then generate hyper-optimized, platform-native content variants.

You must return strictly a raw, valid JSON object conforming exactly to this JSON schema:
${JSON.stringify(responseSchema, null, 2)}

Do NOT wrap the output in markdown code blocks (e.g. \`\`\`json ... \`\`\`), do not include conversational introductions, explanations, or trailing commentary. The response must contain only the valid parsed JSON object.`;

    const deepseekResponse = await fetch(deepseekEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_object"
        },
        temperature: 0.7,
        max_tokens: 2048,
      })
    });

    if (!deepseekResponse.ok) {
      const errorText = await deepseekResponse.text();
      console.error("DeepSeek API Error Response:", errorText);
      throw new Error(`DeepSeek API responded with status ${deepseekResponse.status}: ${errorText}`);
    }

    const responseData = await deepseekResponse.json();
    const aiText = responseData.choices?.[0]?.message?.content;
    if (!aiText) {
      throw new Error("No text content returned from DeepSeek API");
    }

    const aiOutput = JSON.parse(aiText.trim());

    // 8. Return response back to frontend
    return new Response(
      JSON.stringify({ success: true, data: aiOutput }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error inside generate-campaign function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
