/*
  # Simulation d'insertion des données de moissonnage

  1. Insertion des résultats de moissonnage
     - Données des documents dans harvest_results
     - Métadonnées de synthèse
     - Chemins locaux simulés

  2. Insertion des logs d'alertes
     - Obstacles rencontrés (niveau warning)
     - Guidance humaine (niveau info)
*/

-- 1. Insertion du résultat de moissonnage dans harvest_results
INSERT INTO harvest_results (
  data_source_id,
  config_id,
  data,
  metadata,
  status,
  error_message,
  harvested_at,
  local_path
) VALUES (
  '2915782d-1f64-4da2-9693-6c400db6d947',
  (SELECT id FROM harvesting_configs WHERE data_source_id = '2915782d-1f64-4da2-9693-6c400db6d947' LIMIT 1),
  '{
    "documents": [
      {
        "url_doc": "https://zighed.com/wp-content/uploads/2023/07/D-A-Zighed-Rapp-Activite.pdf",
        "type_document": "CV détaillé / Rapport d''activité",
        "format": "PDF",
        "source_page": "https://zighed.com/?lang=fr",
        "document_name": "D A Zighed – Rapport d''activité (CV détaillé)",
        "date_edition": "2023-07",
        "auteurs": "Djamel Abdelkader Zighed",
        "langue": "fr",
        "resume": "CV détaillé de 44 pages couvrant positions, formations, projets, responsabilités et activités scientifiques.",
        "statut": "en ligne",
        "issue_number": null,
        "annee": 2023,
        "filename": "D-A-Zighed-Rapp-Activite.pdf",
        "contient_texte": "oui",
        "pattern_verified": true,
        "notes": "Découvert via la page d''accueil FR (lien « Télécharger le CV détaillé en Français »). Fichier stocké dans /wp-content/uploads/2023/07/. 44 pages. (zighed.com)",
        "obstacles": null,
        "local_path": "/documents/zighed.com/D-A-Zighed-Rapp-Activite.pdf"
      },
      {
        "url_doc": "https://zighed.com/wp-content/uploads/2016/06/CV-En-Zighed.pdf",
        "type_document": "Curriculum Vitae",
        "format": "PDF",
        "source_page": "https://zighed.com/?lang=en",
        "document_name": "CV (English)",
        "date_edition": "2016-06",
        "auteurs": "Djamel Abdelkader Zighed",
        "langue": "en",
        "resume": "English CV (39 pages) présentant éducation, postes, recherche et publications sélectionnées.",
        "statut": "en ligne",
        "issue_number": null,
        "annee": 2016,
        "filename": "CV-En-Zighed.pdf",
        "contient_texte": "oui",
        "pattern_verified": true,
        "notes": "Repéré via le lien « Download CV » sur la page d''accueil EN. 39 pages. (zighed.com)",
        "obstacles": null,
        "local_path": "/documents/zighed.com/CV-En-Zighed.pdf"
      }
    ]
  }'::jsonb,
  '{
    "total_documents": 2,
    "formats_found": ["PDF"],
    "languages_found": ["fr", "en"],
    "total_obstacles": 3,
    "has_human_guidance": true,
    "harvest_summary": {
      "success_count": 2,
      "error_count": 0,
      "warning_count": 3
    }
  }'::jsonb,
  'success',
  null,
  now(),
  '/documents/zighed.com/'
);

-- 2. Insertion des obstacles dans harvest_logs (niveau warning)
INSERT INTO harvest_logs (
  data_source_id,
  level,
  message,
  details,
  created_at
) VALUES 
(
  '2915782d-1f64-4da2-9693-6c400db6d947',
  'warning',
  'Répertoire non listable',
  '{
    "obstacle": "L''index du répertoire /wp-content/uploads/ n''est pas listable dans ce contexte; découverte limitée aux liens exposés dans les pages (risque de PDF orphelins non référencés).",
    "impact": "Risque de PDF orphelins non référencés",
    "context": "Accès aux répertoires WordPress"
  }'::jsonb,
  now()
),
(
  '2915782d-1f64-4da2-9693-6c400db6d947',
  'warning',
  'Accès intermittent aux URL internes',
  '{
    "obstacle": "Ouvertures de certaines URL internes intermittentes (erreurs ponctuelles lors de l''accès direct à des pages WordPress), sans impact final sur les liens PDF identifiés.",
    "impact": "Erreurs ponctuelles d''accès",
    "context": "Accès aux pages WordPress",
    "severity": "low"
  }'::jsonb,
  now()
),
(
  '2915782d-1f64-4da2-9693-6c400db6d947',
  'warning',
  'Références externes non moissonnées',
  '{
    "obstacle": "De nombreuses références de publications renvoient vers des sites externes (Springer, RNTI, etc.) et ne sont donc pas des PDF hébergés sur zighed.com.",
    "impact": "Publications externes non incluses",
    "context": "Limitation du périmètre de moissonnage",
    "external_sites": ["Springer", "RNTI"]
  }'::jsonb,
  now()
);

-- 3. Insertion de la guidance humaine dans harvest_logs (niveau info)
INSERT INTO harvest_logs (
  data_source_id,
  level,
  message,
  details,
  created_at
) VALUES (
  '2915782d-1f64-4da2-9693-6c400db6d947',
  'info',
  'Guidance pour améliorer le moissonnage',
  '{
    "guidance": "Pour compléter: 1) Lancer une recherche externe « site:zighed.com filetype:pdf » pour détecter d''éventuels PDF non liés depuis le menu. 2) Tester manuellement quelques chemins probables WordPress par année/mois (ex.: /wp-content/uploads/2023/07/, /2016/06/) afin de repérer des fichiers supplémentaires éventuellement accessibles. 3) Vérifier périodiquement la page d''accueil FR (mise à jour du 6 août 2023) au cas où un nouveau CV ou rapport soit publié.",
    "recommendations": [
      "Recherche externe avec Google: site:zighed.com filetype:pdf",
      "Test manuel des chemins WordPress par année/mois",
      "Vérification périodique de la page d''accueil FR"
    ],
    "last_update_detected": "2023-08-06",
    "type": "human_guidance"
  }'::jsonb,
  now()
);