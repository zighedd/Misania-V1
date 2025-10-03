import { supabase } from '../lib/supabase';

export class DatabaseConstraintService {
  // Vérifier si un nom de site est unique
  static async isDataSourceNameUnique(name: string, excludeId?: string): Promise<boolean> {
    if (!supabase) {
      throw new Error('Supabase n\'est pas configuré');
    }

    let query = supabase
      .from('data_sources')
      .select('id')
      .eq('name', name);

    // Exclure l'ID actuel lors de la modification
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erreur lors de la vérification d'unicité: ${error.message}`);
    }

    return !data || data.length === 0;
  }

  // Suggérer un nom unique basé sur le nom proposé
  static async suggestUniqueName(baseName: string, excludeId?: string): Promise<string> {
    let counter = 1;
    let suggestedName = baseName;

    while (!(await this.isDataSourceNameUnique(suggestedName, excludeId))) {
      suggestedName = `${baseName}_${counter}`;
      counter++;
    }

    return suggestedName;
  }

  // Valider un nom avant création/modification
  static async validateDataSourceName(name: string, excludeId?: string): Promise<{ isValid: boolean; suggestion?: string; error?: string }> {
    try {
      const isUnique = await this.isDataSourceNameUnique(name, excludeId);
      
      if (!isUnique) {
        const suggestion = await this.suggestUniqueName(name, excludeId);
        return {
          isValid: false,
          suggestion,
          error: `Le nom "${name}" est déjà utilisé. Suggestion: "${suggestion}"`
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Erreur de validation'
      };
    }
  }
}