import { EFFECT_PRESETS, EFFECT_SHAPES, type CustomEffect } from './effects';
import { FX_RECIPES, type FxRecipe } from './show-design';
/** The same factory conversion used by the Programmer, plus durable saved snapshots. */
export function fxLibrary(saved: readonly CustomEffect[]): FxRecipe[] {
  const factory = EFFECT_PRESETS.map(preset => {
    const shape = EFFECT_SHAPES[preset.id];
    const recipe = FX_RECIPES.find(r => r.id === (preset.id === 'sweep' ? 'circle' : preset.id === 'rainbow' ? 'rainbow' : preset.id === 'color-chase' ? 'sunset' : ''));
    const effect: CustomEffect = recipe ? {...structuredClone(recipe.effect), id: 'factory-' + preset.id, name: preset.name, bpm: preset.defaultBpm} : {
      id: 'factory-' + preset.id, name: preset.name, parameter: shape.parameter, waveform: shape.waveform,
      bpm: preset.defaultBpm, depth: 100, phaseSpread: shape.phaseSpread, offset: 0, cycleBeats: 1, mode: 'absolute',
    };
    return {id: 'factory:' + preset.id, name: preset.name, category: 'Custom' as const, description: preset.description, effect};
  });
  return [...FX_RECIPES, ...factory, ...saved.map(effect => ({id: 'custom:' + effect.id, name: effect.name,
    category: 'Custom' as const, description: 'Saved Programmer FX', effect: structuredClone(effect)}))];
}
