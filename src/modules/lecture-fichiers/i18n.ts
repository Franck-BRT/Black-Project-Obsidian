// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les textes du module Lecture de fichiers. Toutes les clés commencent par `lecture-fichiers.`. */
export const lectureFr: Record<string, string> = {
  'lecture-fichiers.name': 'Lecture de fichiers',
  'lecture-fichiers.description':
    'Lit le texte des documents — PDF, Word, Excel, PowerPoint, RTF, HTML, Markdown, texte — pour les autres modules. Sans dépendance externe, sans réseau.',
  'lecture-fichiers.details.title': 'Formats de fichiers',
  'lecture-fichiers.details.intro':
    'Ce que Black Projects lit aujourd’hui, et ce qui arrive. Un bloc par format ; l’étape indiquée renvoie au plan d’intégration.',
  'lecture-fichiers.status.available': 'Lecture intégrée',
  'lecture-fichiers.status.in-progress': 'En développement',
  'lecture-fichiers.status.planned': 'Prévu',

  'lecture-fichiers.format.section.pdf': 'PDF',
  'lecture-fichiers.format.pdf-text': 'PDF avec texte natif',
  'lecture-fichiers.format.pdf-text.note': 'Paragraphes, titres et tableaux reconstitués d’après la page.',
  'lecture-fichiers.format.pdf-protected': 'PDF protégé contre la modification',
  'lecture-fichiers.format.pdf-protected.note': 'Ouvert sans mot de passe, comme tout lecteur PDF (RC4, AES 128 et 256).',
  'lecture-fichiers.format.pdf-scan': 'PDF sans texte (scan)',
  'lecture-fichiers.format.pdf-scan.note': 'Lu par le modèle de vision de Sidonie, page par page.',
  'lecture-fichiers.format.pdf-password': 'PDF protégé par mot de passe',
  'lecture-fichiers.format.pdf-password.note': 'Mot de passe d’ouverture demandé à la lecture.',

  'lecture-fichiers.format.section.word': 'Traitement de texte',
  'lecture-fichiers.format.docx': 'Word 2007 et suivants',
  'lecture-fichiers.format.docx.note': 'Titres selon les styles, listes, tableaux.',
  'lecture-fichiers.format.doc': 'Word 97-2003',
  'lecture-fichiers.format.doc.note': 'Texte et tableaux ; reconnu à son contenu, même renommé.',
  'lecture-fichiers.format.rtf': 'RTF',
  'lecture-fichiers.format.rtf.note': 'Texte et accents selon la page de code.',
  'lecture-fichiers.format.odt': 'OpenDocument Texte',
  'lecture-fichiers.format.odt.note': 'LibreOffice Writer.',

  'lecture-fichiers.format.section.sheets': 'Tableurs',
  'lecture-fichiers.format.xlsx': 'Excel 2007 et suivants',
  'lecture-fichiers.format.xlsx.note': 'Feuille par feuille ; dates en dates.',
  'lecture-fichiers.format.xls': 'Excel 97-2003',
  'lecture-fichiers.format.xls.note': 'Y compris les classeurs protégés contre la modification.',
  'lecture-fichiers.format.ods': 'OpenDocument Classeur',
  'lecture-fichiers.format.ods.note': 'LibreOffice Calc.',

  'lecture-fichiers.format.section.slides': 'Présentations',
  'lecture-fichiers.format.pptx': 'PowerPoint 2007 et suivants',
  'lecture-fichiers.format.pptx.note': 'Diapositive par diapositive, tableaux compris.',
  'lecture-fichiers.format.ppt': 'PowerPoint 97-2003',
  'lecture-fichiers.format.ppt.note': 'Ancien format binaire.',
  'lecture-fichiers.format.odp': 'OpenDocument Présentation',
  'lecture-fichiers.format.odp.note': 'LibreOffice Impress.',

  'lecture-fichiers.format.section.text': 'Web, texte et données',
  'lecture-fichiers.format.html': 'Pages web',
  'lecture-fichiers.format.html.note': 'Sans scripts ni styles.',
  'lecture-fichiers.format.markdown': 'Markdown',
  'lecture-fichiers.format.markdown.note': 'En-tête YAML, titres, listes, tableaux.',
  'lecture-fichiers.format.plain': 'Texte et données',
  'lecture-fichiers.format.plain.note': 'Lus tels quels, en UTF-8 ou en page de code Windows.',
  'lecture-fichiers.format.bench': 'Journaux et sorties de bancs d’essai',
  'lecture-fichiers.format.bench.note': 'Lus tels quels.',

  'lecture-fichiers.format.section.mail': 'Messagerie',
  'lecture-fichiers.format.eml': 'E-mail (.eml)',
  'lecture-fichiers.format.eml.note': 'Lu comme texte brut, en-têtes compris ; pièces jointes non lues.',
  'lecture-fichiers.format.msg': 'E-mail Outlook (.msg)',
  'lecture-fichiers.format.msg.note': 'Message et pièces jointes.',

  'lecture-fichiers.format.section.images': 'Images',
  'lecture-fichiers.format.images': 'Images et photos de documents',
  'lecture-fichiers.format.images.note': 'Lues par le modèle de vision de Sidonie.',

  'lecture-fichiers.format.section.exchange': 'Archives et échanges',
  'lecture-fichiers.format.zip': 'Archive ZIP du dossier de consultation',
  'lecture-fichiers.format.zip.note': 'Chaque pièce de l’archive lue avec son lecteur.',
  'lecture-fichiers.format.reqif': 'ReqIF (DOORS et outils d’exigences)',
  'lecture-fichiers.format.reqif.note': 'Exigences importées avec leurs attributs.',

  'lecture-fichiers.command.read': 'Lire un fichier du coffre (provisoire)',
  'lecture-fichiers.pick.placeholder': 'Choisis un fichier à lire…',
  'lecture-fichiers.reading': 'Lecture de « {name} »…',
  'lecture-fichiers.result.subtitle': '{format} · {characters} caractères · {lines} lignes · lu en {ms} ms',
  'lecture-fichiers.problem.unsupported': '« {name} » : le format {format} n’est pas lu.',
  'lecture-fichiers.problem.empty': '« {name} » ne contient aucun texte à lire : un scan, ou un document vide.',
  'lecture-fichiers.problem.unreadable':
    '« {name} » n’a pas pu être lu : fichier abîmé, ou protégé par un mot de passe.'
}

export const lectureEn: Record<string, string> = {
  'lecture-fichiers.name': 'File reading',
  'lecture-fichiers.description':
    'Reads the text of documents — PDF, Word, Excel, PowerPoint, RTF, HTML, Markdown, text — for the other modules. No external dependency, no network.',
  'lecture-fichiers.details.title': 'File formats',
  'lecture-fichiers.details.intro':
    'What Black Projects reads today, and what is coming. One block per format; the step refers to the integration plan.',
  'lecture-fichiers.status.available': 'Built-in reading',
  'lecture-fichiers.status.in-progress': 'In development',
  'lecture-fichiers.status.planned': 'Planned',

  'lecture-fichiers.format.section.pdf': 'PDF',
  'lecture-fichiers.format.pdf-text': 'PDF with native text',
  'lecture-fichiers.format.pdf-text.note': 'Paragraphs, headings and tables rebuilt from the page.',
  'lecture-fichiers.format.pdf-protected': 'PDF protected against editing',
  'lecture-fichiers.format.pdf-protected.note': 'Opened without a password, as any PDF reader does (RC4, AES 128 and 256).',
  'lecture-fichiers.format.pdf-scan': 'PDF without text (scan)',
  'lecture-fichiers.format.pdf-scan.note': 'Read by Sidonie’s vision model, page by page.',
  'lecture-fichiers.format.pdf-password': 'Password-protected PDF',
  'lecture-fichiers.format.pdf-password.note': 'Opening password asked when reading.',

  'lecture-fichiers.format.section.word': 'Word processing',
  'lecture-fichiers.format.docx': 'Word 2007 and later',
  'lecture-fichiers.format.docx.note': 'Headings from styles, lists, tables.',
  'lecture-fichiers.format.doc': 'Word 97-2003',
  'lecture-fichiers.format.doc.note': 'Text and tables; recognised by its content, even renamed.',
  'lecture-fichiers.format.rtf': 'RTF',
  'lecture-fichiers.format.rtf.note': 'Text and accents according to the code page.',
  'lecture-fichiers.format.odt': 'OpenDocument Text',
  'lecture-fichiers.format.odt.note': 'LibreOffice Writer.',

  'lecture-fichiers.format.section.sheets': 'Spreadsheets',
  'lecture-fichiers.format.xlsx': 'Excel 2007 and later',
  'lecture-fichiers.format.xlsx.note': 'Sheet by sheet; dates as dates.',
  'lecture-fichiers.format.xls': 'Excel 97-2003',
  'lecture-fichiers.format.xls.note': 'Including workbooks protected against editing.',
  'lecture-fichiers.format.ods': 'OpenDocument Spreadsheet',
  'lecture-fichiers.format.ods.note': 'LibreOffice Calc.',

  'lecture-fichiers.format.section.slides': 'Presentations',
  'lecture-fichiers.format.pptx': 'PowerPoint 2007 and later',
  'lecture-fichiers.format.pptx.note': 'Slide by slide, tables included.',
  'lecture-fichiers.format.ppt': 'PowerPoint 97-2003',
  'lecture-fichiers.format.ppt.note': 'Old binary format.',
  'lecture-fichiers.format.odp': 'OpenDocument Presentation',
  'lecture-fichiers.format.odp.note': 'LibreOffice Impress.',

  'lecture-fichiers.format.section.text': 'Web, text and data',
  'lecture-fichiers.format.html': 'Web pages',
  'lecture-fichiers.format.html.note': 'Without scripts or styles.',
  'lecture-fichiers.format.markdown': 'Markdown',
  'lecture-fichiers.format.markdown.note': 'YAML front matter, headings, lists, tables.',
  'lecture-fichiers.format.plain': 'Text and data',
  'lecture-fichiers.format.plain.note': 'Read as they are, in UTF-8 or the Windows code page.',
  'lecture-fichiers.format.bench': 'Logs and test bench outputs',
  'lecture-fichiers.format.bench.note': 'Read as they are.',

  'lecture-fichiers.format.section.mail': 'Mail',
  'lecture-fichiers.format.eml': 'E-mail (.eml)',
  'lecture-fichiers.format.eml.note': 'Read as raw text, headers included; attachments not read.',
  'lecture-fichiers.format.msg': 'Outlook e-mail (.msg)',
  'lecture-fichiers.format.msg.note': 'Message and attachments.',

  'lecture-fichiers.format.section.images': 'Images',
  'lecture-fichiers.format.images': 'Images and photos of documents',
  'lecture-fichiers.format.images.note': 'Read by Sidonie’s vision model.',

  'lecture-fichiers.format.section.exchange': 'Archives and exchange',
  'lecture-fichiers.format.zip': 'ZIP archive of the tender package',
  'lecture-fichiers.format.zip.note': 'Each document in the archive read with its reader.',
  'lecture-fichiers.format.reqif': 'ReqIF (DOORS and requirements tools)',
  'lecture-fichiers.format.reqif.note': 'Requirements imported with their attributes.',

  'lecture-fichiers.command.read': 'Read a file from the vault (preview)',
  'lecture-fichiers.pick.placeholder': 'Pick a file to read…',
  'lecture-fichiers.reading': 'Reading “{name}”…',
  'lecture-fichiers.result.subtitle': '{format} · {characters} characters · {lines} lines · read in {ms} ms',
  'lecture-fichiers.problem.unsupported': '“{name}”: the {format} format is not read.',
  'lecture-fichiers.problem.empty': '“{name}” holds no text to read: a scan, or an empty document.',
  'lecture-fichiers.problem.unreadable': '“{name}” could not be read: damaged, or protected by a password.'
}
