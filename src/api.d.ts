export {};

interface HotelApi {
  auth: {
    login(username: string, password: string): Promise<{ id: number; username: string; full_name: string; role: import('../shared/types').UserRole }>;
  };
  users: {
    list(): Promise<any[]>;
    technicians(): Promise<any[]>;
    create(actorId: number, input: any): Promise<{ id: number }>;
    update(actorId: number, userId: number, input: { username: string; full_name: string; role: string }): Promise<void>;
    setActive(actorId: number, userId: number, active: boolean): Promise<void>;
    resetPassword(actorId: number, userId: number, pw: string): Promise<void>;
  };
  lookups: { all(): Promise<any> };
  buildings: {
    list(): Promise<any[]>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
  };
  rooms: {
    list(opts?: any): Promise<any[]>;
    get(id: number): Promise<any>;
    history(id: number): Promise<any>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
  };
  areas: {
    list(): Promise<any[]>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
  };
  equipment: {
    list(opts?: any): Promise<any[]>;
    get(id: number): Promise<any>;
    history(id: number): Promise<any>;
    create(actorId: number, input: any): Promise<{ id: number; code: string }>;
    update(actorId: number, id: number, input: any): Promise<void>;
    delete(actorId: number, id: number): Promise<void>;
  };
  contractors: {
    list(): Promise<any[]>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
  };
  suppliers: {
    list(): Promise<any[]>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
  };
  pannes: {
    list(opts?: any): Promise<any[]>;
    get(id: number): Promise<any>;
    create(actorId: number, input: any): Promise<any>;
    assign(actorId: number, id: number, input: any): Promise<any>;
    setStatus(actorId: number, id: number, next: string, notes?: string): Promise<any>;
    comment(actorId: number, id: number, input: { body?: string; status?: string | null }): Promise<any>;
    diagnosis(actorId: number, id: number, input: any): Promise<any>;
    intervention(actorId: number, input: any): Promise<any>;
    costs(actorId: number, id: number, input: any): Promise<any>;
    addPart(actorId: number, input: any): Promise<any>;
    removePart(actorId: number, partRowId: number): Promise<any>;
    addPhoto(actorId: number, input: any): Promise<any>;
  };
  archives: {
    list(): Promise<{ afterDays: number; pending: number; archives: any[] }>;
    download(id: number): Promise<{ url: string; name: string }>;
    run(actorId: number): Promise<{ archived: number; remaining: number; archives: { id: number; tickets: number }[] }>;
  };
  inventory: {
    list(): Promise<any[]>;
    lowStock(): Promise<any[]>;
    movements(partId?: number): Promise<any[]>;
    save(actorId: number, input: any): Promise<{ id: number }>;
    delete(actorId: number, id: number): Promise<void>;
    receive(actorId: number, input: any): Promise<any>;
    adjust(actorId: number, input: any): Promise<any>;
  };
  purchaseOrders: {
    list(): Promise<any[]>;
    get(id: number): Promise<any>;
    create(actorId: number, input: any): Promise<any>;
    receive(actorId: number, id: number): Promise<any>;
  };
  maintenanceSchedules: {
    list(opts?: any): Promise<any[]>;
    completions(scheduleId: number): Promise<any[]>;
    save(actorId: number, id: number | null, input: any): Promise<number>;
    delete(actorId: number, id: number): Promise<void>;
    complete(actorId: number, id: number, input: any): Promise<any>;
  };
  handovers: {
    list(limit?: number): Promise<any[]>;
    add(actorId: number, input: any): Promise<{ id: number }>;
  };
  dashboard: { summary(): Promise<any> };
  reports: {
    frequency(actorId: number, from: string, to: string): Promise<any[]>;
    rooms(actorId: number, from: string, to: string): Promise<any[]>;
    equipment(actorId: number, from: string, to: string): Promise<any[]>;
    costs(actorId: number, from: string, to: string): Promise<any>;
    technicians(actorId: number, from: string, to: string): Promise<any[]>;
    resolutionTime(actorId: number, from: string, to: string): Promise<any>;
    auditLog(actorId: number, limit?: number): Promise<any[]>;
    dailyLog(date: string): Promise<any[]>;
  };
  sync: { version(): Promise<number> };
  settings: { get(): Promise<Record<string, string>>; set(actorId: number, key: string, value: string): Promise<void> };
  /** create downloads a JSON file; restore asks for one (false if the user cancelled). */
  backup: { create(actorId: number): Promise<{ path: string }>; restore(actorId: number): Promise<boolean> };
  /** Opens the camera / gallery; resolves to a resized image as a data URL. */
  photos: { pick(actorId: number): Promise<string | null> };
  print: { document(html: string): Promise<void> };
}

declare global {
  interface Window {
    api: HotelApi;
  }
}
