// German versions of the two legal pages (Datenschutzerklärung and Impressum).
// Same structure as pages.js: ['h', heading], ['p', paragraph], ['ul', [items]]. {name}, {email}, {updated} are filled in by views/pages.js.

export const PAGES_DE = {
  privacy: {
    title: 'Datenschutzerklärung',
    blocks: [
      ['p', 'Stand: {updated}. Dies ist ein privates Hobbyprojekt. Der Text wurde nach bestem Wissen verfasst und nicht von einem Anwalt geprüft.'],
      ['h', '1. Verantwortlicher'],
      ['p', 'Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO ist {name}. Kontakt: {email}. Die Postanschrift ist auf Anfrage per E-Mail erhältlich.'],
      ['h', '2. Worauf sich diese Erklärung bezieht'],
      ['p', 'Diese Erklärung gilt für die Website und App Folkhold. Mit Folkhold meldest du dich mit Benutzername und Passwort an und speicherst Informationen über Menschen, die du kennst. Eine allgemeinverständliche Erklärung des technischen Schutzes findest du unter „Data privacy explained“ (nur auf Englisch).'],
      ['h', '3. Welche Daten wir verarbeiten, warum und auf welcher Grundlage'],
      ['ul', [
        'Besuch der Website: Der Webhoster (GitHub Pages) verarbeitet deine IP-Adresse und Anfragedaten, um die Seiten auszuliefern und den Dienst abzusichern. Grundlage: berechtigtes Interesse an Bereitstellung und Sicherheit der Website (Art. 6 Abs. 1 lit. f DSGVO).',
        'Dein Konto: dein Benutzername, ein aus deinem Passwort abgeleiteter Wert (nicht das Passwort selbst) und Zeitstempel des Kontos. Grundlage: Erfüllung des von dir gewünschten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).',
        'Deine Inhalte: Kontakte, Notizen, Ereignisse, Tags und Einstellungen. Sie werden auf deinem Gerät verschlüsselt, bevor sie hochgeladen werden, sodass der Verantwortliche sie nicht lesen kann. Gespeichert werden die verschlüsselten Daten sowie ihre Größe und Änderungszeitpunkte. Grundlage: Art. 6 Abs. 1 lit. b DSGVO.',
        'Sicherheitsprotokolle: Der Datenbankanbieter protokolliert Verbindungen (zum Beispiel IP-Adresse und Uhrzeit) für Sicherheit und Betrieb. Grundlage: berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO).',
      ]],
      ['h', '4. Empfänger der Daten'],
      ['ul', [
        'Supabase (Datenbank und Anmeldung); das Projekt wird in einer Rechenzentrumsregion in der EU betrieben. Ein Auftragsverarbeitungsvertrag liegt vor.',
        'GitHub, Inc. (Website-Hosting über GitHub Pages) in den USA. Die Übermittlung stützt sich auf die in der Datenschutzerklärung von GitHub beschriebenen Garantien, etwa Standardvertragsklauseln oder das EU-US Data Privacy Framework.',
      ]],
      ['p', 'Deine Daten werden nicht verkauft oder für Werbung genutzt, und niemand sonst erhält sie.'],
      ['h', '5. Speicherung auf deinem Gerät'],
      ['p', 'Folkhold speichert einen Anmeldeschlüssel, verschlüsselte Entwürfe und kleine Einstellungen im lokalen Speicher deines Browsers. Das ist für den von dir gewünschten Dienst technisch erforderlich, daher ist kein Einwilligungsbanner nötig (§ 25 Abs. 2 TDDDG). Es gibt keine Tracking-Cookies und keine Analyse-Tools.'],
      ['h', '6. Speicherdauer'],
      ['p', 'Kontodaten und Inhalte werden gespeichert, bis du dein Konto löschst; dadurch werden sie vom Server entfernt. Sicherheitsprotokolle werden von den Anbietern für die dort üblichen kurzen Zeiträume aufbewahrt.'],
      ['h', '7. Deine Rechte'],
      ['p', 'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). In der App kannst du alle deine Daten herunterladen (Einstellungen → Download my data), alles bearbeiten und dein Konto löschen (Einstellungen → Delete my account). Du kannst dich auch an {email} wenden. Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, zum Beispiel der deines Bundeslandes oder deines Wohnsitzlandes.'],
      ['h', '8. Informationen über andere Personen'],
      ['p', 'Wenn du Informationen über andere Menschen ausschließlich für persönliche Zwecke speicherst, gilt die DSGVO für diese persönliche Nutzung nicht (Art. 2 Abs. 2 lit. c). Wenn du Folkhold beruflich oder geschäftlich nutzt, bist du für diese Daten selbst verantwortlich.'],
      ['h', '9. Weitere Hinweise'],
      ['ul', [
        'Du bist nicht verpflichtet, Daten anzugeben, aber ohne Konto kann der Dienst nicht funktionieren.',
        'Es gibt keine automatisierte Entscheidungsfindung und kein Profiling.',
        'Folkhold richtet sich nicht an Kinder unter 16 Jahren.',
        'Diese Erklärung kann aktualisiert werden; das Datum oben zeigt die neueste Fassung.',
      ]],
    ],
  },

  impressum: {
    title: 'Impressum',
    blocks: [
      ['h', 'Angaben gemäß § 5 DDG'],
      ['p', '{name}'],
      ['p', 'Anschrift: auf Anfrage per E-Mail.'],
      ['p', 'E-Mail: {email}'],
      ['h', 'Über diese Website'],
      ['p', 'Folkhold ist ein privates, nicht kommerzielles Projekt. Es ist kostenlos und enthält keine Werbung.'],
      ['h', 'Verantwortlich für den Inhalt'],
      ['p', '{name}, Kontakt wie oben.'],
      ['h', 'Haftung'],
      ['p', 'Folkhold wird bereitgestellt, wie es ist, ohne Gewähr. Trotz sorgfältiger Arbeit wird keine Haftung für Datenverlust oder Unterbrechungen übernommen. Bitte lade deine Daten regelmäßig herunter und bewahre deinen Wiederherstellungsschlüssel sicher auf.'],
    ],
  },
};
