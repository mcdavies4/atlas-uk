const { sendMessage } = require('../utils/messenger');
const { getSession, updateSession, clearSession } = require('../utils/session');
const { extractDeliveryDetails } = require('../ai/claude');
const { estimatePrice } = require('../pricing/engine');
const { findAvailableRiders } = require('../riders/matcher');
const { createJob } = require('../jobs/manager');

const STATES = {
  IDLE:             'IDLE',
  COLLECTING:       'COLLECTING',
  CONFIRMING:       'CONFIRMING',
  SELECTING_RIDER:  'SELECTING_RIDER',
  DONE:             'DONE',
};

async function processMessage(phone, text, channel = 'whatsapp') {
  const session = await getSession(phone);
  const state   = session?.state || STATES.IDLE;

  console.log('[' + phone + '][' + channel + '] State: ' + state);

  switch (state) {
    case STATES.IDLE:            return handleIdle(phone, text, session, channel);
    case STATES.COLLECTING:      return handleCollecting(phone, text, session, channel);
    case STATES.CONFIRMING:      return handleConfirming(phone, text, session, channel);
    case STATES.SELECTING_RIDER: return handleSelectingRider(phone, text, session, channel);
    default:                     return handleIdle(phone, text, session, channel);
  }
}

// ─── IDLE ────────────────────────────────────────────────────────────────────

async function handleIdle(phone, text, session, channel) {
  const lower = text.toLowerCase();

  if (['hi', 'hello', 'start', 'hey', 'hiya', 'help'].some(k => lower.includes(k)) || !session) {
    await sendMessage(phone, `👋 Welcome to *Atlas* — same-day courier delivery across London.

To get a quote and book a courier, just tell me about your delivery:

📍 *Pickup* location
📍 *Drop-off* location
📦 *What* you're sending

Example: _"Pick up a parcel from our shop in Shoreditch, deliver to a customer in Brixton"_

Type *HELP* at any time to see this message again.`, channel);

    await updateSession(phone, { state: STATES.COLLECTING, context: {} });
    return;
  }

  return handleCollecting(phone, text, { state: STATES.COLLECTING, context: {} }, channel);
}

// ─── COLLECTING ──────────────────────────────────────────────────────────────

async function handleCollecting(phone, text, session, channel) {
  if (text.toLowerCase() === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "No problem! Type *hi* whenever you need a delivery. 👍", channel);
  }

  await sendMessage(phone, "Thanks — let me work out the details... ⏳", channel);

  const context = session?.context || {};
  const details = await extractDeliveryDetails(text, context);

  if (!details.success) {
    await sendMessage(phone, `Sorry, I couldn't quite get that. Could you try again?

Please include:
📍 Pickup location (area or postcode in London)
📍 Drop-off location
📦 What you're sending

Example: _"Collect documents from our office in Camden, deliver to a client in Canary Wharf"_`, channel);
    return;
  }

  const missing = [];
  if (!details.pickup)          missing.push('📍 *pickup location*');
  if (!details.dropoff)         missing.push('📍 *drop-off location*');
  if (!details.itemDescription) missing.push('📦 *what you\'re sending*');

  if (missing.length > 0) {
    await updateSession(phone, { state: STATES.COLLECTING, context: { ...context, ...details } });
    return sendMessage(phone, 'Almost there! I still need:\n' + missing.join('\n'), channel);
  }

  const pricing = await estimatePrice(details);

  const summary = `✅ *Delivery Summary*

📍 *From:* ${details.pickup}
📍 *To:* ${details.dropoff}
📦 *Item:* ${details.itemDescription}
⚖️ *Size:* ${details.itemSize || 'Small'}
⚡ *Service:* ${details.urgency === 'express' ? 'Express' : 'Standard'}

💰 *Estimated price: £${pricing.estimate.toFixed(2)}*
_(${pricing.zone} · ${pricing.distance} · cash or card on delivery)_

Does this look right? Reply *YES* to see available couriers, or *EDIT* to change details.`;

  await updateSession(phone, { state: STATES.CONFIRMING, context: { ...details, pricing } });
  await sendMessage(phone, summary, channel);
}

// ─── CONFIRMING ──────────────────────────────────────────────────────────────

async function handleConfirming(phone, text, session, channel) {
  const lower = text.toLowerCase().trim();

  if (['yes', 'confirm', 'ok', 'okay', 'yeah', 'yep', 'sure'].includes(lower)) {
    const riders = await findAvailableRiders(session.context);

    if (riders.length === 0) {
      await sendMessage(phone, `Sorry, no couriers are available in your area right now.

Please try again in a few minutes or contact us directly.

Type *hi* to restart.`, channel);
      await clearSession(phone);
      return;
    }

    let menu = `🚴 *Available Couriers:*\n\n`;
    riders.forEach((r, i) => {
      menu += `*${i + 1}.* ${r.name}${r.company ? ' — ' + r.company : ''}\n`;
      menu += `   ⭐ ${r.rating}/5 · ${r.zone}\n\n`;
    });
    menu += `Reply with the *number* of the courier you'd like (e.g. *1*)`;

    await updateSession(phone, { state: STATES.SELECTING_RIDER, context: { ...session.context, riders } });
    await sendMessage(phone, menu, channel);
    return;
  }

  if (['edit', 'change', 'no'].includes(lower)) {
    await updateSession(phone, { state: STATES.COLLECTING, context: {} });
    return sendMessage(phone, "No problem — please tell me your delivery details again 👇", channel);
  }

  if (lower === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "Booking cancelled. Type *hi* to start a new one. 👍", channel);
  }

  await sendMessage(phone, "Please reply *YES* to confirm, *EDIT* to change details, or *CANCEL* to stop.", channel);
}

// ─── SELECTING RIDER ─────────────────────────────────────────────────────────

async function handleSelectingRider(phone, text, session, channel) {
  const lower = text.toLowerCase().trim();

  if (lower === 'cancel') {
    await clearSession(phone);
    return sendMessage(phone, "Booking cancelled. Type *hi* to start a new one. 👍", channel);
  }

  const choice = parseInt(text.trim(), 10);
  const riders = session.context?.riders || [];

  if (isNaN(choice) || choice < 1 || choice > riders.length) {
    return sendMessage(phone, `Please reply with a number between 1 and ${riders.length}, or *CANCEL* to stop.`, channel);
  }

  const selectedRider = riders[choice - 1];
  const context       = session.context;

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

  await sendMessage(phone, `🎉 *Booking Confirmed!*

📋 *Job ID:* ${job.id.slice(0, 8).toUpperCase()}
🚴 *Courier:* ${selectedRider.name}
📞 *Contact your courier:* wa.me/${selectedRider.phone}

*What happens next:*
1. Your courier will contact you to confirm pickup
2. Payment of £${context.pricing?.estimate?.toFixed(2)} on delivery
3. Your item gets delivered!

ℹ️ *Please note:* Quoted price excludes VAT. If your route passes through the Congestion Charge zone or ULEZ area, a surcharge may apply — your courier will confirm this before pickup.

Thanks for using *Atlas* 🚀
Type *hi* to book another delivery.`, channel);
}

module.exports = { processMessage };
