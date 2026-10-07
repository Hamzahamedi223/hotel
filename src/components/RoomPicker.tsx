import { useMemo, useState } from 'react';

/** Room chooser for 300+ rooms: type the number (numeric keypad on phones), then pick from the matches. */
export function roomLabel(r: any): string {
  return [r.room_number, r.building_name, r.notes].filter(Boolean).join(' · ');
}

export default function RoomPicker({ rooms, value, onChange }: { rooms: any[]; value: any; onChange: (id: string) => void }) {
  const selected = rooms.find((r) => String(r.id) === String(value));
  const [q, setQ] = useState(selected?.room_number ?? '');

  const matches = useMemo(() => {
    const s = q.trim();
    const list = s ? rooms.filter((r) => String(r.room_number).startsWith(s)) : rooms;
    return [...list].sort((a, b) => String(a.room_number).localeCompare(String(b.room_number), 'fr', { numeric: true }));
  }, [rooms, q]);

  function type(v: string) {
    setQ(v);
    const s = v.trim();
    const exact = rooms.find((r) => String(r.room_number) === s);
    const list = s ? rooms.filter((r) => String(r.room_number).startsWith(s)) : [];
    onChange(exact ? String(exact.id) : list.length === 1 ? String(list[0].id) : '');
  }

  return (
    <div className="space-y-2">
      <input
        className="input"
        inputMode="numeric"
        placeholder="N° de chambre, ex. 412"
        value={q}
        onChange={(e) => type(e.target.value)}
      />
      <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">
          {matches.length === 0 ? 'Aucune chambre ne correspond' : `— Choisir (${matches.length} chambre${matches.length > 1 ? 's' : ''}) —`}
        </option>
        {matches.map((r) => (
          <option key={r.id} value={r.id}>{roomLabel(r)}</option>
        ))}
      </select>
    </div>
  );
}
