interface ValidationError {
  line?: number;
  field: string;
  message: string;
  recommendation: string;
  documentIndex?: number;
  logIndex?: number;
  severity: 'error' | 'warning';
  context?: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalDocuments: number;
    validDocuments: number;
    totalLogs: number;
    validLogs: number;
  };
}

export class JsonImportValidator {
  static validateImportJson(jsonContent: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let summary = {
      totalDocuments: 0,
      validDocuments: 0,
      totalLogs: 0,
      validLogs: 0
    };

    try {
      const data = JSON.parse(jsonContent);
      
      // Vérifier la structure principale
      if (!data || typeof data !== 'object') {
        errors.push({
          field: 'root',
          message: 'Structure JSON invalide : le fichier doit contenir un objet principal',
          recommendation: 'Assurez-vous que le fichier commence par { et se termine par }. Exemple : {"documents": [], "logs": []}',
          severity: 'error',
          context: 'Racine du fichier JSON'
        });
        return { isValid: false, errors, warnings, summary };
      }

      // Vérifier la présence du tableau documents
      if (!data.documents) {
        errors.push({
          field: 'documents',
          message: 'Tableau "documents" manquant : ce champ est obligatoire pour l\'importation',
          recommendation: 'Ajoutez le tableau documents : "documents": [{"url_doc": "https://example.com/file.pdf", "document_name": "Mon document"}]',
          severity: 'error',
          context: 'Structure principale'
        });
      } else if (!Array.isArray(data.documents)) {
        errors.push({
          field: 'documents',
          message: 'Type incorrect : "documents" doit être un tableau, pas un objet ou une chaîne',
          recommendation: 'Changez en tableau : "documents": [...] au lieu de "documents": "..." ou "documents": {...}',
          severity: 'error',
          context: 'Type de données'
        });
      } else {
        summary.totalDocuments = data.documents.length;
        
        if (data.documents.length === 0) {
          warnings.push({
            field: 'documents',
            message: 'Tableau "documents" vide : aucun document ne sera importé',
            recommendation: 'Ajoutez au moins un document avec un champ "url_doc" valide',
            severity: 'warning',
            context: 'Contenu du tableau'
          });
        }

        // Vérifier les doublons d'URL
        const urlDocMap = new Map<string, number[]>();
        data.documents.forEach((doc: any, index: number) => {
          if (doc && doc.url_doc && typeof doc.url_doc === 'string') {
            const url = doc.url_doc.trim();
            if (url) {
              if (!urlDocMap.has(url)) {
                urlDocMap.set(url, []);
              }
              urlDocMap.get(url)!.push(index);
            }
          }
        });

        // Signaler les doublons
        urlDocMap.forEach((indices, url) => {
          if (indices.length > 1) {
            errors.push({
              field: 'url_doc',
              message: `URL dupliquée "${url}" trouvée dans les documents ${indices.map(i => i + 1).join(', ')}`,
              recommendation: `Supprimez les doublons ou modifiez les URL pour qu'elles soient uniques. Gardez seulement le document le plus récent ou le plus complet.`,
              severity: 'error',
              context: `Documents en doublon : positions ${indices.join(', ')}`
            });
          }
        });
        // Valider chaque document
        data.documents.forEach((doc: any, index: number) => {
          const isValid = this.validateDocument(doc, index, errors, warnings);
          if (isValid) summary.validDocuments++;
        });
      }

      // Vérifier la présence du tableau logs
      if (!data.logs) {
        warnings.push({
          field: 'logs',
          message: 'Tableau "logs" manquant : les logs d\'incidents ne seront pas importés',
          recommendation: 'Ajoutez le tableau logs (optionnel) : "logs": [{"level": "info", "message": "Log message"}]',
          severity: 'warning',
          context: 'Structure optionnelle'
        });
      } else if (!Array.isArray(data.logs)) {
        errors.push({
          field: 'logs',
          message: 'Type incorrect : "logs" doit être un tableau',
          recommendation: 'Changez en tableau : "logs": [...] au lieu de "logs": "..." ou "logs": {...}',
          severity: 'error',
          context: 'Type de données'
        });
      } else {
        summary.totalLogs = data.logs.length;
        
        // Valider chaque log
        data.logs.forEach((log: any, index: number) => {
          const isValid = this.validateLog(log, index, errors, warnings);
          if (isValid) summary.validLogs++;
        });
      }

      // Vérifications globales
      if (summary.totalDocuments > 1000) {
        warnings.push({
          field: 'documents',
          message: `Nombre élevé de documents (${summary.totalDocuments}) : l'importation peut prendre du temps`,
          recommendation: 'Considérez diviser l\'importation en plusieurs fichiers plus petits (max 500 documents par fichier)',
          severity: 'warning',
          context: 'Performance'
        });
      }

    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Erreur inconnue';
      errors.push({
        field: 'json',
        message: `Erreur de syntaxe JSON : ${errorMessage}`,
        recommendation: 'Vérifiez la syntaxe JSON avec un validateur en ligne. Erreurs courantes : virgules manquantes, guillemets non fermés, accolades déséquilibrées',
        severity: 'error',
        context: 'Parsing JSON'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      summary
    };
  }

  private static validateDocument(doc: any, index: number, errors: ValidationError[], warnings: ValidationError[]): boolean {
    const docPrefix = `Document ${index + 1}`;
    let isValid = true;

    // Vérifier que c'est un objet
    if (!doc || typeof doc !== 'object') {
      errors.push({
        documentIndex: index,
        field: 'document',
        message: `${docPrefix} : structure invalide - doit être un objet JSON`,
        recommendation: `Remplacez par un objet : {"url_doc": "https://...", "document_name": "..."}`,
        severity: 'error',
        context: `Position dans le tableau : index ${index}`
      });
      return false;
    }

    // Vérifier le champ obligatoire url_doc
    if (!doc.url_doc) {
      errors.push({
        documentIndex: index,
        field: 'url_doc',
        message: `${docPrefix} : champ "url_doc" manquant - ce champ est obligatoire pour le téléchargement`,
        recommendation: `Ajoutez l'URL de téléchargement : "url_doc": "https://example.com/document.pdf"`,
        severity: 'error',
        context: `Document à l'index ${index}`
      });
      isValid = false;
    } else if (typeof doc.url_doc !== 'string') {
      errors.push({
        documentIndex: index,
        field: 'url_doc',
        message: `${docPrefix} : "url_doc" doit être une chaîne de caractères, pas ${typeof doc.url_doc}`,
        recommendation: `Changez en chaîne : "url_doc": "https://..." au lieu de "url_doc": ${JSON.stringify(doc.url_doc)}`,
        severity: 'error',
        context: `Type de données incorrect`
      });
      isValid = false;
    } else if (doc.url_doc.trim() === '') {
      errors.push({
        documentIndex: index,
        field: 'url_doc',
        message: `${docPrefix} : "url_doc" ne peut pas être vide`,
        recommendation: `Fournissez une URL valide : "url_doc": "https://example.com/document.pdf"`,
        severity: 'error',
        context: `Valeur vide détectée`
      });
      isValid = false;
    } else {
      // Vérifier que c'est une URL valide
      try {
        new URL(doc.url_doc);
      } catch {
        errors.push({
          documentIndex: index,
          field: 'url_doc',
          message: `${docPrefix} : URL invalide "${doc.url_doc}"`,
          recommendation: `Utilisez une URL complète avec protocole : "https://example.com/file.pdf" au lieu de "${doc.url_doc}"`,
          severity: 'error',
          context: `Format d'URL incorrect`
        });
        isValid = false;
      }
    }

    // Vérifications optionnelles avec avertissements
    if (!doc.document_name || doc.document_name.trim() === '') {
      warnings.push({
        documentIndex: index,
        field: 'document_name',
        message: `${docPrefix} : "document_name" manquant - le nom sera généré automatiquement`,
        recommendation: `Ajoutez un nom descriptif : "document_name": "Rapport annuel 2024"`,
        severity: 'warning',
        context: `Métadonnée optionnelle`
      });
    }

    if (!doc.filename || doc.filename.trim() === '') {
      warnings.push({
        documentIndex: index,
        field: 'filename',
        message: `${docPrefix} : "filename" manquant - sera extrait de l'URL`,
        recommendation: `Spécifiez le nom de fichier : "filename": "rapport_2024.pdf"`,
        severity: 'warning',
        context: `Nom de fichier automatique`
      });
    }

    if (doc.date_edition && !this.isValidDate(doc.date_edition)) {
      warnings.push({
        documentIndex: index,
        field: 'date_edition',
        message: `${docPrefix} : format de date invalide "${doc.date_edition}"`,
        recommendation: `Utilisez le format ISO : "date_edition": "2024-01-15" ou "2024-01-15T10:30:00Z"`,
        severity: 'warning',
        context: `Format de date incorrect`
      });
    }

    // Vérifier les champs numériques
    if (doc.annee && (!Number.isInteger(doc.annee) || doc.annee < 1900 || doc.annee > new Date().getFullYear() + 1)) {
      warnings.push({
        documentIndex: index,
        field: 'annee',
        message: `${docPrefix} : année invalide "${doc.annee}"`,
        recommendation: `Utilisez une année valide : "annee": ${new Date().getFullYear()}`,
        severity: 'warning',
        context: `Valeur numérique incorrecte`
      });
    }

    return isValid;
  }

  private static validateLog(log: any, index: number, errors: ValidationError[], warnings: ValidationError[]): boolean {
    const logPrefix = `Log ${index + 1}`;
    let isValid = true;

    // Vérifier que c'est un objet
    if (!log || typeof log !== 'object') {
      errors.push({
        logIndex: index,
        field: 'log',
        message: `${logPrefix} : structure invalide - doit être un objet JSON`,
        recommendation: `Remplacez par un objet : {"level": "error", "message": "Description de l'erreur"}`,
        severity: 'error',
        context: `Position dans le tableau : index ${index}`
      });
      return false;
    }

    // Vérifier le niveau de log
    if (!log.level) {
      warnings.push({
        logIndex: index,
        field: 'level',
        message: `${logPrefix} : "level" manquant - sera défini par défaut à "info"`,
        recommendation: `Spécifiez le niveau : "level": "error", "warning" ou "info"`,
        severity: 'warning',
        context: `Niveau de log par défaut`
      });
    } else if (!['error', 'warning', 'info'].includes(log.level)) {
      warnings.push({
        logIndex: index,
        field: 'level',
        message: `${logPrefix} : niveau "${log.level}" non reconnu`,
        recommendation: `Utilisez un niveau valide : "level": "error", "warning" ou "info"`,
        severity: 'warning',
        context: `Niveau de log invalide`
      });
    }

    // Vérifier le message
    if (!log.message) {
      warnings.push({
        logIndex: index,
        field: 'message',
        message: `${logPrefix} : "message" manquant - le log sera créé avec un message par défaut`,
        recommendation: `Ajoutez une description : "message": "Description détaillée de l'incident"`,
        severity: 'warning',
        context: `Message de log manquant`
      });
    } else if (typeof log.message !== 'string') {
      warnings.push({
        logIndex: index,
        field: 'message',
        message: `${logPrefix} : "message" doit être une chaîne de caractères`,
        recommendation: `Changez en chaîne : "message": "Votre message ici"`,
        severity: 'warning',
        context: `Type de message incorrect`
      });
    }

    // Vérifier la timestamp si présente
    if (log.timestamp && !this.isValidDate(log.timestamp)) {
      warnings.push({
        logIndex: index,
        field: 'timestamp',
        message: `${logPrefix} : format de timestamp invalide "${log.timestamp}"`,
        recommendation: `Utilisez le format ISO : "timestamp": "2024-01-15T10:30:00Z"`,
        severity: 'warning',
        context: `Format de timestamp incorrect`
      });
    }

    // Vérifier l'URL si présente
    if (log.url && typeof log.url === 'string' && log.url.trim() !== '') {
      try {
        new URL(log.url);
      } catch {
        warnings.push({
          logIndex: index,
          field: 'url',
          message: `${logPrefix} : URL invalide "${log.url}"`,
          recommendation: `Utilisez une URL complète : "url": "https://example.com/page"`,
          severity: 'warning',
          context: `Format d'URL incorrect`
        });
      }
    }

    return isValid;
  }

  private static isValidDate(dateString: string): boolean {
    if (!dateString || typeof dateString !== 'string') return false;
    
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && dateString.length >= 8; // Au moins YYYY-MM-DD
  }

  // Méthode utilitaire pour extraire les données valides avec nettoyage
  static extractValidData(jsonContent: string): { documents: any[], logs: any[], obstacles_globaux: string[], recommandations: string | null } {
    try {
      const data = JSON.parse(jsonContent);
      
      // Nettoyer et valider les documents en supprimant les doublons
      const seenUrls = new Set<string>();
      // Nettoyer et valider les documents
      const cleanDocuments = Array.isArray(data.documents) 
        ? data.documents
            .filter(doc => doc && typeof doc === 'object' && doc.url_doc)
            .filter(doc => {
              const url = doc.url_doc.trim();
              if (seenUrls.has(url)) {
                console.warn(`🔄 Document en doublon ignoré: ${url}`);
                return false; // Ignorer les doublons
              }
              seenUrls.add(url);
              return true;
            })
            .map(doc => ({
              // Champs obligatoires
              url_doc: doc.url_doc,
              
              // Champs optionnels avec valeurs par défaut
              document_name: doc.document_name || '',
              filename: doc.filename || '',
              date_edition: doc.date_edition || '',
              auteurs: doc.auteurs || '',
              langue: doc.langue || '',
              resume: doc.resume || '',
              statut: doc.statut || '',
              issue_number: doc.issue_number || '',
              annee: doc.annee || new Date().getFullYear(),
              format: doc.format || '',
              type_document: doc.type_document || '',
              content_text: doc.content_text || '',
              pdf_pattern_verified: Boolean(doc.pdf_pattern_verified),
              notes: doc.notes || '',
              obstacles: doc.obstacles || ''
            }))
        : [];

      // Nettoyer et valider les logs
      const cleanLogs = Array.isArray(data.logs)
        ? data.logs
            .filter(log => log && typeof log === 'object')
            .map(log => ({
              level: log.level || 'info',
              message: log.message || 'Log importé sans message',
              timestamp: log.timestamp || new Date().toISOString(),
              url: log.url || '',
              details: log.details || {}
            }))
        : [];

      // Nettoyer les obstacles globaux
      const cleanObstaclesGlobaux = Array.isArray(data['obstacles-globaux'])
        ? data['obstacles-globaux']
            .filter(obstacle => typeof obstacle === 'string')
            .map(obstacle => obstacle.trim())
            .filter(obstacle => obstacle.length > 0)
        : [];

      // Nettoyer les recommandations
      const cleanRecommandations = typeof data.recommandations === 'string' && data.recommandations.trim()
        ? data.recommandations.trim()
        : null;
      return { 
        documents: cleanDocuments, 
        logs: cleanLogs,
        obstacles_globaux: cleanObstaclesGlobaux,
        recommandations: cleanRecommandations
      };
    } catch {
      return { documents: [], logs: [], obstacles_globaux: [], recommandations: null };
    }
  }

  // Générer un rapport de validation détaillé
  static generateValidationReport(result: ValidationResult): string {
    let report = `📊 RAPPORT DE VALIDATION JSON\n`;
    report += `${'='.repeat(50)}\n\n`;
    
    // Résumé
    report += `📈 RÉSUMÉ :\n`;
    report += `• Documents détectés : ${result.summary.totalDocuments}\n`;
    report += `• Documents valides : ${result.summary.validDocuments}\n`;
    report += `• Logs détectés : ${result.summary.totalLogs}\n`;
    report += `• Logs valides : ${result.summary.validLogs}\n`;
    report += `• Statut global : ${result.isValid ? '✅ VALIDE' : '❌ ERREURS DÉTECTÉES'}\n\n`;

    // Erreurs critiques
    if (result.errors.length > 0) {
      report += `🚨 ERREURS CRITIQUES (${result.errors.length}) :\n`;
      result.errors.forEach((error, index) => {
        report += `${index + 1}. ${error.message}\n`;
        report += `   💡 Solution : ${error.recommendation}\n`;
        if (error.context) {
          report += `   📍 Contexte : ${error.context}\n`;
        }
        report += `\n`;
      });
    }

    // Avertissements
    if (result.warnings.length > 0) {
      report += `⚠️ AVERTISSEMENTS (${result.warnings.length}) :\n`;
      result.warnings.forEach((warning, index) => {
        report += `${index + 1}. ${warning.message}\n`;
        report += `   💡 Recommandation : ${warning.recommendation}\n`;
        if (warning.context) {
          report += `   📍 Contexte : ${warning.context}\n`;
        }
        report += `\n`;
      });
    }

    if (result.isValid) {
      report += `✅ Le fichier JSON est prêt pour l'importation !\n`;
    } else {
      report += `❌ Corrigez les erreurs critiques avant de procéder à l'importation.\n`;
    }

    return report;
  }
}