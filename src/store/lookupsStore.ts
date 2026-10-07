import { create } from 'zustand';
import { setCurrency } from '../lib/format';

interface LookupsState {
  loaded: boolean;
  buildings: any[];
  rooms: any[];
  areas: any[];
  equipment: any[];
  contractors: any[];
  suppliers: any[];
  technicians: any[];
  parts: any[];
  settings: Record<string, string>;
  refresh: () => Promise<void>;
}

export const useLookups = create<LookupsState>((set) => ({
  loaded: false,
  buildings: [],
  rooms: [],
  areas: [],
  equipment: [],
  contractors: [],
  suppliers: [],
  technicians: [],
  parts: [],
  settings: {},
  refresh: async () => {
    const data = await window.api.lookups.all();
    setCurrency(data.settings?.currency ?? 'TND');
    set({
      loaded: true,
      buildings: data.buildings,
      rooms: data.rooms,
      areas: data.areas,
      equipment: data.equipment,
      contractors: data.contractors,
      suppliers: data.suppliers,
      technicians: data.technicians,
      parts: data.parts,
      settings: data.settings ?? {},
    });
  },
}));
