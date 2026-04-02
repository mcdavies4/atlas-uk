// ─── London Zone Map ─────────────────────────────────────────────────────────
// Based on TfL zone logic and common London delivery corridors

const ZONES = {
  central: {
    label: 'Central London',
    areas: [
      'city of london', 'ec1', 'ec2', 'ec3', 'ec4',
      'wc1', 'wc2', 'w1', 'sw1', 'se1',
      'shoreditch', 'clerkenwell', 'holborn', 'covent garden',
      'westminster', 'soho', 'mayfair', 'fitzrovia',
      'southwark', 'borough', 'bermondsey', 'waterloo',
      'canary wharf', 'e14', 'victoria', 'pimlico',
      'london bridge', 'aldgate', 'barbican', 'moorgate',
      "king's cross", 'euston', 'angel', 'farringdon',
    ],
  },
  inner: {
    label: 'Inner London',
    areas: [
      'hackney', 'e8', 'e9', 'e2', 'e3',
      'islington', 'n1', 'n4', 'n5', 'n7',
      'camden', 'nw1', 'nw3', 'nw5',
      'brixton', 'sw2', 'sw9', 'sw4',
      'peckham', 'se15', 'se5', 'se17',
      'lewisham', 'se13', 'se4',
      'greenwich', 'se10', 'se8',
      'whitechapel', 'e1', 'stepney',
      'bethnal green', 'clapham', 'sw11', 'sw8',
      'battersea', 'hammersmith', 'w6', 'w14',
      "shepherd's bush", 'w12',
      'kensington', 'w8', 'w11', 'notting hill',
      'fulham', 'sw6', 'sw10',
      'putney', 'sw15',
      'tooting', 'sw17', 'sw16',
      'streatham', 'deptford', 'se14',
      'new cross', 'walthamstow', 'e17',
      'leyton', 'e10', 'e11',
      'stratford', 'e15', 'e20',
      'west ham', 'e13', 'poplar',
    ],
  },
  outer: {
    label: 'Outer London',
    areas: [
      'croydon', 'cr0', 'cr7', 'bromley', 'br1', 'br2',
      'enfield', 'en1', 'en2', 'en3',
      'barnet', 'n11', 'n12', 'n14', 'n20',
      'harrow', 'ha1', 'ha2', 'ha3',
      'ealing', 'w5', 'w7', 'w13',
      'hounslow', 'tw3', 'tw4', 'tw5',
      'richmond', 'tw9', 'tw10',
      'kingston', 'kt1', 'kt2',
      'wimbledon', 'sw19', 'sw20',
      'sutton', 'sm1', 'sm2',
      'ilford', 'ig1', 'ig2', 'ig3',
      'romford', 'rm1', 'rm2',
      'barking', 'ig11', 'dagenham', 'rm8', 'rm9',
      'woolwich', 'se18', 'eltham', 'se9',
      'sidcup', 'da14', 'da15',
      'bexleyheath', 'da6', 'da7',
      'wembley', 'ha9', 'edgware', 'ha8',
      'finchley', 'n3', 'wood green', 'n22',
      'tottenham', 'n17', 'n15',
      'chingford', 'e4', 'woodford', 'e18', 'ig8',
    ],
  },
};

const PRICING = {
  central: {
    central: { base: 8,  label: 'Within Central London' },
    inner:   { base: 12, label: 'Central to Inner London' },
    outer:   { base: 18, label: 'Central to Outer London' },
  },
  inner: {
    central: { base: 12, label: 'Inner to Central London' },
    inner:   { base: 10, label: 'Within Inner London' },
    outer:   { base: 15, label: 'Inner to Outer London' },
  },
  outer: {
    central: { base: 18, label: 'Outer to Central London' },
    inner:   { base: 15, label: 'Outer to Inner London' },
    outer:   { base: 12, label: 'Within Outer London' },
  },
};

const SIZE_MULTIPLIER = {
  small:         1.0,
  medium:        1.3,
  large:         1.7,
  'extra-large': 2.2,
};

const URGENCY_MULTIPLIER = {
  standard: 1.0,
  express:  1.4,
};

function detectZone(location) {
  if (!location) return null;
  const lower = location.toLowerCase().trim();
  for (const [zoneKey, zoneData] of Object.entries(ZONES)) {
    if (zoneData.areas.some(area => lower.includes(area))) {
      return zoneKey;
    }
  }
  return 'inner';
}

async function estimatePrice(details) {
  const { pickup, dropoff, itemSize = 'small', urgency = 'standard' } = details;

  const pickupZone  = detectZone(pickup)  || 'inner';
  const dropoffZone = detectZone(dropoff) || 'inner';

  const matrix       = PRICING[pickupZone][dropoffZone];
  const sizeMulti    = SIZE_MULTIPLIER[itemSize]   || 1.0;
  const urgencyMulti = URGENCY_MULTIPLIER[urgency] || 1.0;

  const rawEstimate = matrix.base * sizeMulti * urgencyMulti;
  const estimate    = Math.round(rawEstimate * 2) / 2; // round to nearest 50p

  return {
    estimate,
    zone:     matrix.label,
    pickupZone,
    dropoffZone,
    distance: getDistanceLabel(pickupZone, dropoffZone),
    itemSize,
    urgency,
    currency: 'GBP',
  };
}

function getDistanceLabel(from, to) {
  if (from === to) return from === 'central' ? 'short distance' : 'same zone';
  if ((from === 'central' && to === 'outer') || (from === 'outer' && to === 'central')) return 'long distance';
  return 'medium distance';
}

module.exports = { estimatePrice, detectZone, ZONES };
