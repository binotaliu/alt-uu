import type { KeyValueStoreRepository } from '../../db/keyValueStore';
import { ValidationError } from '../account/validation';
import { readJsonRecord } from '../app-preference/appPreferenceStore';

const STORAGE_KEY = 'preference:material-html-scale';
const DEFAULT_SCALE = 1;
export const MIN_MATERIAL_FONT_SCALE = 0.7;
export const MAX_MATERIAL_FONT_SCALE = 1.6;

/** Legacy MaterialFontScalePreferenceViewModel. */
export interface MaterialFontScalePreference {
  scale: number;
}

/** Port of MaterialPreferenceStore + GetMaterialFontScale / SetMaterialFontScale. */
export function createMaterialPreferenceServices(deps: {
  keyValues: KeyValueStoreRepository;
}) {
  return {
    async getFontScale(): Promise<MaterialFontScalePreference> {
      const record = await readJsonRecord(deps.keyValues, STORAGE_KEY);
      const scale = record?.scale;

      if (!isNumeric(scale)) {
        return { scale: DEFAULT_SCALE };
      }

      return { scale: clamp(Number(scale)) };
    },

    /** Rejects values outside 0.7 to 1.6 like the legacy request rules. */
    async setFontScale(scale: number): Promise<MaterialFontScalePreference> {
      if (
        typeof scale !== 'number' ||
        !Number.isFinite(scale) ||
        scale < MIN_MATERIAL_FONT_SCALE ||
        scale > MAX_MATERIAL_FONT_SCALE
      ) {
        throw ValidationError.field('scale', 'scale 必須介於 0.7 到 1.6。');
      }

      const clamped = clamp(scale);
      await deps.keyValues.set(STORAGE_KEY, JSON.stringify({ scale: clamped }));

      return { scale: clamped };
    },
  };
}

export type MaterialPreferenceServices = ReturnType<
  typeof createMaterialPreferenceServices
>;

function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
  );
}

function clamp(value: number): number {
  return Math.min(
    MAX_MATERIAL_FONT_SCALE,
    Math.max(MIN_MATERIAL_FONT_SCALE, value),
  );
}
