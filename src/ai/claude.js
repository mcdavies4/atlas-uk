const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a delivery details extractor for Atlas, an Abuja, Nigeria logistics bot.

Your job is to extract structured delivery information from a user's natural language message.

Extract the following fields:
- pickup: pickup location/area in Abuja (string or null)
- dropoff: drop-off/destination location in Abuja (string or null)  
- itemDescription: what is being delivered (string or null)
- itemSize: "small", "medium", "large", or "extra-large" based on context (default "small" if unclear)
- urgency: "standard" or "express" (default "standard")
- notes: any special instructions (string or null)

Rules:
- Abuja areas include: Maitama, Wuse, Wuse 2, Garki, Asokoro, Gwarinpa, Kubwa, Lugbe, Karu, Nyanya, Gwagwalada, Lokogoma, Life Camp, Jabi, Central Area, Area 1-11, Airport Road, etc.
- If the user says things like "urgent", "asap", "emergency", set urgency to "express"
- If item mentions "document", "envelope", "letter" → small
- If item mentions "bag", "clothing", "shoes" → medium  
- If item mentions "box", "appliance", "furniture" → large or extra-large
- Always respond with ONLY valid JSON, no markdown, no explanation.

Example response:
{"pickup":"Wuse 2","dropoff":"Gwarinpa","itemDescription":"a small parcel","itemSize":"small","urgency":"standard","notes":null,"success":true}

If you cannot extract at least pickup or dropoff, set success to false.`;

async function extractDeliveryDetails(userMessage, existingContext = {}) {
  try {
    // Merge existing context into the prompt so Claude can fill gaps
    const contextStr = Object.keys(existingContext).length > 0
      ? `\n\nPreviously collected: ${JSON.stringify(existingContext)}`
      : '';

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Extract delivery details from this message: "${userMessage}"${contextStr}`,
        },
      ],
    });

    const text = response.content[0]?.text?.trim();
    const parsed = JSON.parse(text);
    return parsed;
  } catch (err) {
    console.error('Claude extraction error:', err);
    return { success: false };
  }
}

module.exports = { extractDeliveryDetails };
