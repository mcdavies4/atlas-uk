const { sendMessage } = require('../utils/messenger');
const { getSession, updateSession, clearSession } = require('../utils/session');
const { extractDeliveryDetails } = require('../ai/claude');
const { estimatePrice } = require('../pricing/engine');
const { findAvailableRiders } = require('../riders/matcher');
const { createJob } = require('../jobs/manager');

// Conversation states
const STATES = {
  IDLE: 'IDLE',
  COLLECTING: 'COLLECTING',
  CONFIRMING: 'CONFIRMING',
  SELECTING_RIDER: 'SELECTING_RIDER',
  DONE: 'DONE',
};

async function processMessage(phone, text, channel = 'whatsapp') {
  const session = await getSession(phone);
  const state = session?.state || STATES.IDLE;

  console.log(`[${phone}][${channel}] State: ${state}`);

  switch (state) {
    case STATES.IDLE:
      return handleIdle(phone, text, session, channel);
    case STATES.COLLECTING:
      return handleCollecting(phone, text, session, channel);
    case STATES.CONFIRMING:
      return handleConfirming(phone, text, session, channel);
    case STATES.SELECTING_RIDER:
      return handleSelectingRider(phone, text, session, channel);
    default:
      return handleIdle(phone, text, session, channel);
  }
}

// ─── IDLE ───────────────────────────────────────────────────────────────────

async function handleIdle(phone, text, session, channel) {
  const lower = text.toLowerCase();

  if (['hi', 'hello', 'start', 'hey', 'hiya'].some(k => lower.includes(k)) || !session) {
    await sendMessage(phone, `👋 Welcome to *Atlas* — your Abuja delivery assistant!

To get started, just tell me about your delivery. Include:
📍 *Pickup* location
📍 *Drop-off* location
📦 What you're sending

Example: _"Pick up a parcel from Wuse 2, deliver to Gwarinpa, it's a small package"_`, channel);

    await updateSession(phone, { state: STATES.COLLECTING, context: {} });
    return;
  }

  return handleCollecting(phone, text, { state: STATES.COLLECTING, context: {} }, channel);
}

// ─── COLLECTING ─────────────────────────────────────────────────────────────

async function handleCollecting(phone, text, session, channel) {
  if (text.toLowerCase() === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "No problem! Type *hi* whenever you need a delivery 👍", channel);
  }

  await sendMessage(phone, "Got it, let me work out the details... ⏳", channel);

  const context = session?.context || {};
  const details = await extractDeliveryDetails(text, context);

  if (!details.success) {
    await sendMessage(phone, `Hmm, I couldn't quite understand that. Could you try again?

Please include:
📍 Pickup location (area/street in Abuja)
📍 Drop-off location
📦 What you're sending

Example: _"Pick up clothes from Maitama, deliver to Kubwa"_`, channel);
    return;
  }

  const missing = [];
  if (!details.pickup) missing.push('📍 *pickup location*');
  if (!details.dropoff) missing.push('📍 *drop-off location*');
  if (!details.itemDescription) missing.push('📦 *what you\'re sending*');

  if (missing.length > 0) {
    await updateSession(phone, { state: STATES.COLLECTING, context: { ...context, ...details } });
    return sendMessage(phone, `Almost there! I still need:\n${missing.join('\n')}`, channel);
  }

  const pricing = await estimatePrice(details);

  const summary = `✅ *Here's your delivery summary:*

📍 *From:* ${details.pickup}
📍 *To:* ${details.dropoff}
📦 *Item:* ${details.itemDescription}
⚖️ *Size:* ${details.itemSize || 'Standard'}

💰 *Estimated price: ₦${pricing.estimate.toLocaleString()}*
_(${pricing.zone} zone · ${pricing.distance} · cash on delivery)_

Does this look right? Reply *YES* to see available riders, or *EDIT* to change details.`;

  await updateSession(phone, { state: STATES.CONFIRMING, context: { ...details, pricing } });
  await sendMessage(phone, summary, channel);
}

// ─── CONFIRMING ─────────────────────────────────────────────────────────────

async function handleConfirming(phone, text, session, channel) {
  const lower = text.toLowerCase().trim();

  if (lower === 'yes' || lower === 'confirm' || lower === 'ok' || lower === 'okay') {
    const riders = await findAvailableRiders(session.context);

    if (riders.length === 0) {
      await sendMessage(phone, `😔 Sorry, no riders are available in your area right now.

We'll notify you when one becomes available. You can also try again in a few minutes.

Type *hi* to restart.`, channel);
      await clearSession(phone);
      return;
    }

    let menu = `🏍️ *Available Riders Near You:*\n\n`;
    riders.forEach((r, i) => {
      menu += `*${i + 1}.* ${r.name} — ${r.company || 'Independent'}\n`;
      menu += `   ⭐ ${r.rating}/5 · ${r.zone}\n\n`;
    });
    menu += `Reply with the *number* of the rider you want (e.g. *1*)`;

    await updateSession(phone, { state: STATES.SELECTING_RIDER, context: { ...session.context, riders } });
    await sendMessage(phone, menu, channel);
    return;
  }

  if (lower === 'edit' || lower === 'change') {
    await updateSession(phone, { state: STATES.COLLECTING, context: {} });
    return sendMessage(phone, "No problem! Tell me your delivery details again 👇", channel);
  }

  if (lower === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "Delivery cancelled. Type *hi* to start a new one 👍", channel);
  }

  await sendMessage(phone, "Please reply *YES* to confirm, *EDIT* to change details, or *CANCEL* to stop.", channel);
}

// ─── SELECTING RIDER ────────────────────────────────────────────────────────

async function handleSelectingRider(phone, text, session, channel) {
  const lower = text.toLowerCase().trim();

  if (lower === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "Delivery cancelled. Type *hi* to start a new one 👍", channel);
  }

  const choice = parseInt(text.trim(), 10);
  const riders = session.context?.riders || [];

  if (isNaN(choice) || choice < 1 || choice > riders.length) {
    return sendMessage(phone, `Please reply with a number between 1 and ${riders.length}, or *CANCEL* to stop.`, channel);
  }

  const selectedRider = riders[choice - 1];
  const context = session.context;

  const job = await createJob({
    senderPhone:     phone,
    pickup:          context.pickup,
    dropoff:         context.dropoff,
    itemDescription: context.itemDescription,
    itemSize:        context.itemSize,
    estimatedPrice:  context.pricing?.estimate,
    riderId:         selectedRider.id,
    channel,
  });

  await clearSession(phone);

  await sendMessage(phone, `🎉 *Delivery booked!*

📋 *Job ID:* ${job.id.slice(0, 8).toUpperCase()}
🏍️ *Rider:* ${selectedRider.name}
📞 *Contact rider on WhatsApp:* wa.me/${selectedRider.phone}

*What happens next:*
1. Contact your rider on WhatsApp to confirm pickup time
2. Pay ₦${context.pricing?.estimate?.toLocaleString()} cash on delivery
3. Get your item delivered!

Thank you for using *Atlas* 🚀
Type *hi* to book another delivery.`, channel);
}

module.exports = { processMessage };
