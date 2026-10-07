import { useLookups } from '../store/lookupsStore';

/**
 * "Mode simple" (the default) keeps the app to its core: report a problem,
 * the team answers. The extra modules (equipment, preventive maintenance,
 * stock, contractors, reports, audit, and the diagnosis/parts/costs parts of
 * a ticket) only show in "Mode complet" (Réglages). Their data is kept either way.
 */
export function useSimpleMode(): boolean {
  return useLookups((s) => s.settings.ui_mode) !== 'full';
}
