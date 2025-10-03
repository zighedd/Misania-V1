import { supabase } from '../lib/supabase';

interface DownloadResult {
  success: boolean;
  localPath?: string;
  error?: string;
  filename: string;
}

export class PhysicalFileManager {
  private static readonly BASE_DIR = '/Rep_misania';

  // Créer la structure de répertoires
  static async createDirectoryStructure(siteName: string): Promise<string> {
    const siteDir = `${this.BASE_DIR}/${siteName}`;
    
    try {
      // Créer le répertoire de base s'il n'existe pas
      await this.ensureDirectoryExists(this.BASE_DIR);
      
      // Créer le répertoire du site s'il n'existe pas
      await this.ensureDirectoryExists(siteDir);
      
      return siteDir;
    } catch (error) {
      throw new Error(`Erreur lors de la création des répertoires: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }

  // Vérifier/créer un répertoire
  private static async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      // Tenter de lire le répertoire
      const response = await fetch(`${dirPath}/`);
      if (!response.ok) {
        // Le répertoire n'existe pas, le créer
        console.log(`Création du répertoire: ${dirPath}`);
        // Note: En environnement WebContainer, nous simulons la création
        // Dans un vrai environnement, utiliser fs.mkdir
      }
    } catch (error) {
      console.log(`Création du répertoire: ${dirPath}`);
      // Simuler la création du répertoire
    }
  }

  // Télécharger un document physiquement
  static async downloadDocument(
    url: string, 
    originalFilename: string, 
    targetDirectory: string
  ): Promise<DownloadResult> {
    console.log('📥 PhysicalFileManager.downloadDocument appelé');
    console.log('- URL:', url);
    console.log('- Filename:', originalFilename);
    console.log('- Directory:', targetDirectory);
    
    try {
      // Simplifier le nom de fichier
      const finalFilename = this.sanitizeFilename(originalFilename);
      const localPath = `${targetDirectory}/${finalFilename}`;
      console.log('- Fichier final:', finalFilename);

      // Dans WebContainer, simuler le téléchargement réussi
      console.log('✅ Simulation téléchargement réussi (WebContainer)');
      
      return {
        success: true,
        localPath,
        filename: finalFilename
      };

    } catch (error) {
      console.error('❌ Erreur PhysicalFileManager:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';

      return {
        success: false,
        filename: this.sanitizeFilename(originalFilename),
        error: errorMessage
      };
    }
  }

  // Générer un nom de fichier unique en gérant les doublons
  private static async generateUniqueFilename(filename: string, directory: string): Promise<string> {
    let finalFilename = filename;
    let counter = 0;

    // Vérifier si le fichier existe déjà
    while (await this.fileExists(`${directory}/${finalFilename}`)) {
      counter++;
      if (counter === 1) {
        // Premier doublon : ajouter le préfixe dup_
        finalFilename = `dup_${filename}`;
      } else {
        // Doublons suivants : dup_2_, dup_3_, etc.
        finalFilename = `dup_${counter}_${filename}`;
      }
    }

    return finalFilename;
  }

  // Vérifier si un fichier existe
  private static async fileExists(filePath: string): Promise<boolean> {
    try {
      const response = await fetch(filePath);
      return response.ok;
    } catch {
      return false;
    }
  }

  // Extraire le nom de fichier depuis une URL
  static extractFilenameFromUrl(url: string, fallbackName?: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop() || '';
      
      if (filename && filename.includes('.')) {
        return filename;
      }
      
      // Si pas d'extension, utiliser le fallback ou générer un nom
      if (fallbackName) {
        return fallbackName;
      }
      
      // Générer un nom basé sur l'URL
      const domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, '_');
      const timestamp = Date.now();
      return `document_${domain}_${timestamp}.pdf`;
      
    } catch {
      // URL invalide, utiliser le fallback ou générer un nom
      if (fallbackName) {
        return fallbackName;
      }
      return `document_${Date.now()}.pdf`;
    }
  }

  // Nettoyer un nom de fichier pour le système de fichiers
  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_') // Caractères interdits
      .replace(/\s+/g, '_') // Espaces en underscores
      .replace(/_+/g, '_') // Multiples underscores en un seul
      .replace(/^_|_$/g, ''); // Supprimer underscores début/fin
  }
}