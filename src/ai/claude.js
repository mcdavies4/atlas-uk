const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a delivery details extractor for Atlas, a same-day courier dispatch bot serving London, UK.

Your job is to extract structured delivery information from a user's natural language message.

Extract the following fields:
- pickup: pickup location in London — area name, street, or postcode (string or null)
- dropoff: drop-off destination in London — area name, street, or postcode (string or null)
- itemDescription: what is being delivered (string or null)
- itemSize: "small", "medium", "large", or "extra-large" based on context (default "small" if unclear)
- urgency: "standard" or "express" (default "standard")
- senderType: "business" or "individual" — infer from context (e.g. "our pharmacy", "my restaurant" = business)
- notes: any special instructions (string or null)

Rules:
- London locations include areas, postcodes (E1, SW11, N1 etc), landmarks, and streets
- If the user says urgent, asap, emergency, same hour → urgency = express
- Documents, envelopes, small parcels → small
- Clothing, shoes, small boxes → medium
- Large boxes, multiple items, appliances → large
- Furniture, bulk items → extra-large
- Business senders often say our shop, the restaurant, our office, the clinic
- Always respond with ONLY valid JSON, no markdown, no explanation

Example response:
{"pickup":"Shoreditch E1","dropoff":"Brixton SW9","itemDescription":"a small parcel","itemSize":"small","urgency":"standard","senderType":"individual","notes":null,"success":true}

If you cannot extract at least pickup or dropoff, set success to false.`;

async function extractDeliveryDetails(userMessage, existingContext = {}) {
  try {
    const contextStr = Object.keys(existingContext).length > 0
      ? '\n\nPreviously collected: ' + JSON.stringify(existingContext)
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: 'Extract delivery details from this message: "' + userMessage + '"' + contextStr,
        },
      ],
    });

    const text   = response.content[0]?.text?.trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error('Claude extraction error:', err);
    return { success: false };
  }
}

module.exports = { extractDeliveryDetails };
