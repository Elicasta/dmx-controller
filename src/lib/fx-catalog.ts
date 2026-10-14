import type { FxRecipe } from './show-design';

/** UI-only taxonomy. Keeps recipe IDs and saved show files stable. */
export const FX_FAMILIES = ['All', 'Dimmer', 'Color', 'Movement', 'Chase', 'Custom'] as const;
export type FxFamily = (typeof FX_FAMILIES)[number];

export function fxFamily(recipe: FxRecipe): Exclude<FxFamily, 'All'> {
  if (recipe.category === 'Custom') return 'Custom';
  if (recipe.category === 'Rows') return 'Chase';
  if (recipe.category === 'Movement') return 'Movement';
  if (recipe.category === 'Color') return 'Color';
  if (recipe.effect.waveform === 'step' || recipe.effect.waveform === 'square') return 'Chase';
  return 'Dimmer';
}

export function describeFx(recipe: FxRecipe): string {
  const effect = recipe.effect;
  const shape = effect.motionShape?.replace(/-/g, ' ') || effect.waveform?.replace(/-/g, ' ') || 'custom';
  const beats = effect.cycleBeats;
  return [shape, Number.isFinite(beats) && beats > 0 ? `${beats} beats` : null]
    .filter(Boolean).join(' · ');
}

export function filterFxCatalog(
  recipes: readonly FxRecipe[],
  options: { query?: string; family?: FxFamily; savedOnly?: boolean } = {},
): FxRecipe[] {
  const query = (options.query ?? '').trim().toLocaleLowerCase();
  const family = options.family ?? 'All';
  return recipes.filter(recipe => {
    if (options.savedOnly && !recipe.id.startsWith('custom:')) return false;
    if (family !== 'All' && fxFamily(recipe) !== family) return false;
    if (!query) return true;
    return [recipe.name, recipe.description, recipe.category, fxFamily(recipe), recipe.effect.parameter,
      recipe.effect.waveform, recipe.effect.motionShape ?? '']
      .join(' ').toLocaleLowerCase().includes(query);
  });
}
