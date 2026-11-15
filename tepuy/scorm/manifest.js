/**
 * @file Builds a strict SCORM 1.2 manifest with one SCO.
 *
 * @copyright 2026 David Herney - BambuCo
 * @license http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import { MASTERY_SCORE } from './progress.js';

/**
 * @param {string} value Raw text placed in XML.
 * @returns {string} Escaped text.
 */
function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/**
 * @param {{identifier: string, title: string, description?: string, language?: string}} options Manifest fields.
 * @returns {string} imsmanifest.xml for one SCO pointing at index.html.
 */
export function buildScorm12Manifest({ identifier, title, description = '', language = 'es' }) {
  const safeId = escapeXml(identifier);
  const safeTitle = escapeXml(title);
  const safeDescription = escapeXml(description);
  const safeLanguage = escapeXml(language);
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${safeId}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
    <lom xmlns="http://www.imsglobal.org/xsd/imsmd_rootv1p2p1">
      <general>
        <title><langstring xml:lang="${safeLanguage}">${safeTitle}</langstring></title>
        <language>${safeLanguage}</language>
        <description><langstring xml:lang="${safeLanguage}">${safeDescription}</langstring></description>
      </general>
    </lom>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${safeTitle}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${safeTitle}</title>
        <adlcp:masteryscore>${MASTERY_SCORE}</adlcp:masteryscore>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
    </resource>
  </resources>
</manifest>
`;
}
