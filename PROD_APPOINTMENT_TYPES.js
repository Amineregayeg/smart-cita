// PROD APPOINTMENT TYPES - Complete mapping from production Smart Agenda
// Source: https://www.smartagenda.fr/pro/laserostop-esh (PROD environment)
// Date extracted: 2025-10-23
//
// INSTRUCTIONS FOR FRONTEND UPDATE:
// Replace the APPOINTMENT_TYPES object in index.html with this data
//
const APPOINTMENT_TYPES = {
  '10': [ // Valencia
    { id: '26', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 30, price: 170, deposit: 170, centerId: '10' },
    { id: '1',  kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 30, price: 190, deposit: 0, centerId: '10' },
    { id: '30', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 30, price: 160, deposit: 320, centerId: '10' },
    { id: '9',  kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 30, price: 170, deposit: 0, centerId: '10' },
    { id: '3',  kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '10' },
    { id: '28', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 30, price: 170, deposit: 170, centerId: '10' },
    { id: '18', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '10' },
    { id: '19', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '10' },
    { id: '42', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 30, price: 190, deposit: 20, centerId: '10' }
  ],
  '43': [ // Barcelona
    { id: '25', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '43' },
    { id: '20', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 60, price: 190, deposit: 0, centerId: '43' },
    { id: '29', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 90, price: 160, deposit: 320, centerId: '43' },
    { id: '21', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 90, price: 170, deposit: 0, centerId: '43' },
    { id: '22', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '43' },
    { id: '27', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 60, price: 170, deposit: 170, centerId: '43' },
    { id: '23', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '43' },
    { id: '24', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '43' },
    { id: '40', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 60, price: 190, deposit: 20, centerId: '43' }
  ],
  '44': [ // Sevilla
    { id: '31', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '44' },
    { id: '32', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 30, price: 190, deposit: 0, centerId: '44' },
    { id: '33', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 30, price: 160, deposit: 320, centerId: '44' },
    { id: '34', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 30, price: 170, deposit: 0, centerId: '44' },
    { id: '35', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '44' },
    { id: '36', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 30, price: 170, deposit: 170, centerId: '44' },
    { id: '37', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '44' },
    { id: '38', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '44' },
    { id: '41', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 30, price: 190, deposit: 20, centerId: '44' }
  ],
  '49': [ // Torrejón
    { id: '52', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 30, price: 170, deposit: 170, centerId: '49' },
    { id: '53', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 30, price: 190, deposit: 0, centerId: '49' },
    { id: '54', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 30, price: 160, deposit: 320, centerId: '49' },
    { id: '56', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 30, price: 170, deposit: 0, centerId: '49' },
    { id: '57', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '49' },
    { id: '58', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 30, price: 170, deposit: 170, centerId: '49' },
    { id: '59', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '49' },
    { id: '60', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '49' },
    { id: '61', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 30, price: 190, deposit: 20, centerId: '49' }
  ],
  '48': [ // Madrid Chamartín
    { id: '43', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '48' },
    { id: '44', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 60, price: 190, deposit: 0, centerId: '48' },
    { id: '45', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 90, price: 160, deposit: 320, centerId: '48' },
    { id: '46', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 90, price: 170, deposit: 0, centerId: '48' },
    { id: '47', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '48' },
    { id: '48', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 60, price: 170, deposit: 170, centerId: '48' },
    { id: '49', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '48' },
    { id: '50', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '48' },
    { id: '51', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 60, price: 190, deposit: 20, centerId: '48' }
  ],
  '50': [ // Madrid Atocha
    { id: '62', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '50' },
    { id: '63', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 60, price: 190, deposit: 0, centerId: '50' },
    { id: '64', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 90, price: 160, deposit: 320, centerId: '50' },
    { id: '65', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 90, price: 170, deposit: 0, centerId: '50' },
    { id: '66', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '50' },
    { id: '67', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 60, price: 170, deposit: 170, centerId: '50' },
    { id: '68', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '50' },
    { id: '69', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '50' },
    { id: '70', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 60, price: 190, deposit: 20, centerId: '50' }
  ],
  '52': [ // San Sebastián
    { id: '80', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '52' },
    { id: '81', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 60, price: 190, deposit: 0, centerId: '52' },
    { id: '82', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 90, price: 160, deposit: 320, centerId: '52' },
    { id: '83', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 90, price: 170, deposit: 0, centerId: '52' },
    { id: '84', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '52' },
    { id: '85', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 60, price: 170, deposit: 170, centerId: '52' },
    { id: '86', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '52' },
    { id: '87', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '52' },
    { id: '88', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 60, price: 190, deposit: 20, centerId: '52' }
  ],
  '51': [ // Majadahonda
    { id: '71', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (170€)', duration: 60, price: 170, deposit: 170, centerId: '51' },
    { id: '72', kind: 'solo_cig',     name: 'Solo – Dejar de fumar (190€)', duration: 60, price: 190, deposit: 0, centerId: '51' },
    { id: '73', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (160€)', duration: 90, price: 160, deposit: 320, centerId: '51' },
    { id: '74', kind: 'duo_cig',      name: 'Duo – Dejar de fumar (170€)', duration: 90, price: 170, deposit: 0, centerId: '51' },
    { id: '75', kind: 'rechute',      name: 'En caso de recaída', duration: 30, price: 0, deposit: 0, centerId: '51' },
    { id: '76', kind: 'solo_drugs',   name: 'Cannabis primera (170€)', duration: 60, price: 170, deposit: 170, centerId: '51' },
    { id: '77', kind: 'solo_drugs',   name: 'Cannabis primera (190€)', duration: 30, price: 190, deposit: 0, centerId: '51' },
    { id: '78', kind: 'solo_drugs',   name: 'Cannabis segunda', duration: 30, price: 0, deposit: 0, centerId: '51' },
    { id: '79', kind: 'solo_cig',     name: 'Solo con anticipo (190€)', duration: 60, price: 190, deposit: 20, centerId: '51' }
  ]
};
