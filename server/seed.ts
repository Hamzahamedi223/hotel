import bcrypt from 'bcryptjs';
import { run, get, all, transaction, exec } from './db.js';
import SCHEMA from './schema.js';

const DEFAULT_SETTINGS: Record<string, string> = {
  company_name: 'Caisse Panne Hôtel',
  company_address: '',
  company_phone: '',
  company_email: '',
  currency: 'TND',
  low_stock_alert: '1',
};

export async function seedCoreData() {
  await transaction(async () => {
    if ((await get<{ c: number }>('SELECT COUNT(*) c FROM users'))!.c === 0) {
      const users = [
        { username: 'admin', password: 'admin123', full_name: 'Administrateur', role: 'admin' },
        { username: 'manager', password: 'manager123', full_name: 'Responsable Maintenance', role: 'manager' },
        { username: 'reception', password: 'reception123', full_name: 'Réception', role: 'reception' },
        { username: 'housekeeping', password: 'housekeeping123', full_name: 'Housekeeping', role: 'housekeeping' },
        { username: 'technicien', password: 'technicien123', full_name: 'Karim — Technicien', role: 'technician' },
      ];
      for (const u of users) {
        await run('INSERT INTO users (username, password_hash, full_name, role) VALUES (?,?,?,?)', [
          u.username, bcrypt.hashSync(u.password, 10), u.full_name, u.role,
        ]);
      }
    }
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', [key, value]);
    }
  });
}

export async function seedDemo() {
  if ((await get<{ c: number }>('SELECT COUNT(*) c FROM buildings'))!.c > 0) {
    console.log('Demo data already present — skipping.');
    return;
  }

  await transaction(async () => {
    const buildings = ['Bâtiment principal', 'Annexe', 'Restaurant & Cuisine'];
    for (const b of buildings) await run('INSERT INTO buildings (name) VALUES (?)', [b]);
    const bRows = await all<{ id: number; name: string }>('SELECT id, name FROM buildings');
    const bId = (n: string) => bRows.find((r) => r.name === n)!.id;

    const rooms: Array<[string, string, string, string]> = [];
    for (let floor = 1; floor <= 3; floor++) {
      for (let n = 1; n <= 6; n++) {
        const num = `${floor}${String(n).padStart(2, '0')}`;
        rooms.push([bId('Bâtiment principal') as any, String(floor), num, n % 3 === 0 ? 'Suite' : 'Double']);
      }
    }
    for (const [buildingId, floor, room_number, room_type] of rooms) {
      await run('INSERT INTO rooms (building_id, floor, room_number, room_type) VALUES (?,?,?,?)', [buildingId, floor, room_number, room_type]);
    }
    const roomRows = await all<{ id: number; room_number: string }>('SELECT id, room_number FROM rooms');
    const roomId = (n: string) => roomRows.find((r) => r.room_number === n)!.id;

    const areas: Array<[string, string, string]> = [
      ['Bâtiment principal', 'Réception', 'reception'],
      ['Bâtiment principal', 'Couloir étage 1', 'corridor'],
      ['Bâtiment principal', 'Ascenseur principal', 'elevator'],
      ['Restaurant & Cuisine', 'Cuisine', 'kitchen'],
      ['Restaurant & Cuisine', 'Restaurant', 'restaurant'],
      ['Annexe', 'Buanderie', 'laundry'],
      ['Annexe', 'Local technique', 'technical_room'],
      ['Bâtiment principal', 'Piscine', 'pool'],
      ['Bâtiment principal', 'Parking', 'parking'],
    ];
    for (const [b, name, type] of areas) await run('INSERT INTO areas (building_id, name, area_type) VALUES (?,?,?)', [bId(b), name, type]);
    const areaRows = await all<{ id: number; name: string }>('SELECT id, name FROM areas');
    const areaId = (n: string) => areaRows.find((r) => r.name === n)!.id;

    const equipment: Array<[string, string, string, { room?: string; area?: string }, string, string]> = [
      ['AC-101', 'Climatiseur chambre 101', 'ac', { room: '101' }, 'Daikin', 'FTX35'],
      ['AC-204', 'Climatiseur chambre 204', 'ac', { room: '204' }, 'Daikin', 'FTX35'],
      ['ASC-01', 'Ascenseur principal', 'elevator', { area: 'Ascenseur principal' }, 'Otis', 'Gen2'],
      ['GEN-01', 'Groupe électrogène', 'generator', { area: 'Local technique' }, 'Cummins', 'C150D5'],
      ['CHAU-01', 'Chaudière centrale', 'boiler', { area: 'Local technique' }, 'Viessmann', 'Vitocrossal'],
      ['FRIGO-K1', 'Chambre froide cuisine', 'refrigerator', { area: 'Cuisine' }, 'Liebherr', 'GKPv 1490'],
      ['LL-01', 'Lave-linge industriel', 'washing_machine', { area: 'Buanderie' }, 'Electrolux', 'W5330H'],
      ['POMPE-PISC', 'Pompe filtration piscine', 'pump', { area: 'Piscine' }, 'Hayward', 'Super Pump'],
    ];
    for (const [code, name, category, loc, brand, model] of equipment) {
      await run(
        'INSERT INTO equipment (code, name, category, room_id, area_id, brand, model, install_date, warranty_expiry, status) VALUES (?,?,?,?,?,?,?,?,?,\'operational\')',
        [code, name, category, loc.room ? roomId(loc.room) : null, loc.area ? areaId(loc.area) : null, brand, model, '2024-01-15', '2027-01-15']
      );
    }
    const equipRows = await all<{ id: number; code: string }>('SELECT id, code FROM equipment');
    const eqId = (c: string) => equipRows.find((r) => r.code === c)!.id;

    const suppliers = [
      { name: 'ElectroPro Tunisie', contact_name: 'Sami', phone: '+216 71 200 300', email: 'contact@electropro.tn' },
      { name: 'Plomberie Générale', contact_name: 'Nabil', phone: '+216 71 400 500', email: 'contact@plomberiegen.tn' },
    ];
    for (const s of suppliers) await run('INSERT INTO suppliers (name, contact_name, phone, email) VALUES (?,?,?,?)', [s.name, s.contact_name, s.phone, s.email]);
    const supRows = await all<{ id: number; name: string }>('SELECT id, name FROM suppliers');

    const contractors = [
      { company: 'Ascenseurs Sud', contact_name: 'M. Trabelsi', phone: '+216 20 111 222', service_type: 'Ascenseurs' },
      { company: 'Clim Services', contact_name: 'M. Gharbi', phone: '+216 22 333 444', service_type: 'Climatisation' },
    ];
    for (const c of contractors) await run('INSERT INTO contractors (company, contact_name, phone, service_type) VALUES (?,?,?,?)', [c.company, c.contact_name, c.phone, c.service_type]);

    const parts: Array<[string, string, string, number, number, number]> = [
      ['ELEC-CAP-35', 'Condensateur AC 35µF', 'Électrique', 12, 5, 18],
      ['PLB-VAL-01', 'Vanne PVC 1"', 'Plomberie', 3, 10, 25],
      ['ELEC-LED-E27', 'Ampoule LED E27', 'Électrique', 40, 20, 6],
      ['FILT-AC-STD', 'Filtre climatisation standard', 'Climatisation', 8, 6, 9],
      ['PLB-JOINT', 'Joint plomberie universel', 'Plomberie', 25, 15, 2],
    ];
    for (const [code, name, category, qty, min, cost] of parts) {
      await run('INSERT INTO inventory_parts (code, name, category, quantity, min_quantity, unit_cost, supplier_id) VALUES (?,?,?,?,?,?,?)', [
        code, name, category, qty, min, cost, supRows[0]?.id ?? null,
      ]);
    }

    const technician = await get<{ id: number }>("SELECT id FROM users WHERE role = 'technician' LIMIT 1");
    const reception = await get<{ id: number }>("SELECT id FROM users WHERE role = 'reception' LIMIT 1");

    const pannes: Array<[string, string, string, string, string, string, string]> = [
      ['Climatiseur ne refroidit pas', 'AC ne produit plus de froid depuis ce matin.', 'ac', 'high', 'significant', '204', 'open'],
      ['Fuite d’eau sous le lavabo', 'Petite fuite continue sous le lavabo de la salle de bain.', 'plumbing', 'medium', 'minor', '101', 'assigned'],
      ['Ascenseur bloqué', 'Ascenseur principal bloqué entre le 1er et le 2e étage.', 'building', 'critical', 'hotel_wide', '', 'in_repair'],
    ];
    for (const [title, desc, category, priority, impact, roomNum, status] of pannes) {
      const number = `PANNE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900 + 100))}`;
      await run(
        `INSERT INTO pannes (ticket_number, title, description, category, priority, guest_impact, location_type, room_id, area_id, reported_by_user_id, reported_by_role, status, assigned_to, assigned_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          number, title, desc, category, priority, impact,
          roomNum ? 'room' : 'area', roomNum ? roomId(roomNum) : null, roomNum ? null : areaId('Ascenseur principal'),
          reception?.id ?? null, 'reception', status, status !== 'open' ? technician?.id ?? null : null, status !== 'open' ? new Date().toISOString() : null,
        ]
      );
    }

    await run(
      `INSERT INTO maintenance_schedules (title, equipment_id, frequency_type, frequency_value, checklist, next_due_date)
       VALUES (?,?,?,?,?, today_txt(interval '+3 days'))`,
      ['Entretien trimestriel climatisation', eqId('AC-101'), 'months', 3, JSON.stringify(['Nettoyer filtres', 'Vérifier compresseur', 'Contrôler température'])]
    );
    await run(
      `INSERT INTO maintenance_schedules (title, equipment_id, frequency_type, frequency_value, checklist, next_due_date)
       VALUES (?,?,?,?,?, today_txt(interval '-1 days'))`,
      ['Inspection mensuelle groupe électrogène', eqId('GEN-01'), 'months', 1, JSON.stringify(['Niveau huile', 'Batterie', 'Test démarrage', 'Arrêt urgence'])]
    );
  });

  console.log('Demo data seeded: 3 buildings, 18 rooms, 9 areas, 8 equipment, 3 pannes.');
}

/** Creates/updates tables and the default accounts. Idempotent. */
export async function initDatabase() {
  await exec(SCHEMA);
  await seedCoreData();
}

async function main() {
  console.log(process.env.DATABASE_URL ? 'Seeding DATABASE_URL' : 'Seeding local database (data/pglite)');
  await initDatabase();
  if (process.argv.includes('--demo')) await seedDemo();
  console.log('Seed complete. Logins: admin/admin123 · manager/manager123 · reception/reception123 · housekeeping/housekeeping123 · technicien/technicien123');
}

if (typeof require !== 'undefined' && require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
