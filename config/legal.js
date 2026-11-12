// MarsL Configuration: Legal
// Extracted from server.js during Phase 1 modularization

const LEGAL_FIELDS = [
  // key, label, placeholder, group, needed
  ["name", "Name or company", "Jane Doe", "imprint", true],
  ["street", "Street and number", "Example Street 1", "imprint", true],
  ["city", "ZIP and city", "12345 Example City", "imprint", true],
  ["country", "Country", "Germany", "imprint", false],
  ["email", "Email", "contact@example.com", "imprint", true],
  ["phone", "Phone (optional)", "", "imprint", false],
  ["responsible", "Responsible for the content, if not you (optional)", "", "imprint", false],
  ["vat", "VAT ID (optional)", "", "imprint", false],
  ["extraImprint", "More for the legal notice (optional)", "", "imprint", false, true],
  ["privacyEmail", "Email for data requests (empty = the email above)", "", "privacy", false],
  ["hostName", "Hosting provider", "alwaysdata", "privacy", false],
  ["hostAddress", "Hosting provider address", "", "privacy", false],
  ["mailAddress", "Mail provider address (Brevo)", "", "privacy", false],
  ["authority", "Data protection authority of your state (optional)", "", "privacy", false],
  ["extraPrivacy", "More for the privacy policy (optional)", "", "privacy", false, true],
];

const LEGALT = {
  "en": {legal: "Legal notice", privacy: "Privacy policy", back: "Back to the game", incomplete: "This page is not complete yet.", imprint: "Legal notice (Impressum)", vat: "VAT ID", resp: "Responsible for the content", free: "MarsL is a free browser game. It is not related to any other game or company.", whoResp: "Who is responsible", store: "What we store and why", cookies: "Cookies and similar", whoGets: "Who gets your data", processor: "which hosts the game (processor).", noSell: "We do not sell data and do not pass it on otherwise.", howLong: "How long", rights: "Your rights", complain: "You can also complain to a data protection authority", questions: "Questions", seeContact: "see the contact above", email: "Email", phone: "Phone", legalBasis: "Legal bases (Art. 6 GDPR)"},
  "de": {legal: "Impressum", privacy: "Datenschutzerklärung", back: "Zurück zum Spiel", incomplete: "Diese Seite ist noch nicht vollständig.", imprint: "Impressum", vat: "USt-IdNr.", resp: "Verantwortlich für den Inhalt", free: "MarsL ist ein kostenloses Browserspiel. Es steht in keinem Zusammenhang mit anderen Spielen oder Firmen.", whoResp: "Verantwortlich", store: "Was wir speichern und warum", cookies: "Cookies und ähnliche Technologien", whoGets: "Wer deine Daten erhält", processor: "der das Spiel hostet (Auftragsverarbeiter).", noSell: "Wir verkaufen keine Daten und geben sie auch sonst nicht weiter.", howLong: "Wie lange", rights: "Deine Rechte", complain: "Du kannst dich außerdem bei einer Datenschutzbehörde beschweren", questions: "Fragen", seeContact: "siehe Kontakt oben", email: "E-Mail", phone: "Telefon", legalBasis: "Rechtsgrundlagen (Art. 6 DSGVO)"},
  "it": {legal: "Note legali", privacy: "Informativa sulla privacy", back: "Torna al gioco", incomplete: "Questa pagina non è ancora completa.", imprint: "Note legali (Impressum)", vat: "Partita IVA", resp: "Responsabile del contenuto", free: "MarsL è un gioco gratuito nel browser. Non è collegato ad alcun altro gioco o azienda.", whoResp: "Responsabile", store: "Cosa conserviamo e perché", cookies: "Cookie e tecnologie simili", whoGets: "Chi riceve i tuoi dati", processor: "che ospita il gioco (responsabile del trattamento).", noSell: "Non vendiamo dati e non li cediamo in altro modo.", howLong: "Per quanto tempo", rights: "I tuoi diritti", complain: "Puoi anche presentare un reclamo a un'autorità per la protezione dei dati", questions: "Domande", seeContact: "vedi il contatto sopra", email: "Email", phone: "Telefono", legalBasis: "Basi giuridiche (art. 6 GDPR)"},
  "fr": {legal: "Mentions légales", privacy: "Politique de confidentialité", back: "Retour au jeu", incomplete: "Cette page n’est pas encore complète.", imprint: "Mentions légales (Impressum)", vat: "N° de TVA", resp: "Responsable du contenu", free: "MarsL est un jeu gratuit dans le navigateur. Il n’est lié à aucun autre jeu ni entreprise.", whoResp: "Responsable", store: "Ce que nous stockons et pourquoi", cookies: "Cookies et technologies similaires", whoGets: "Qui reçoit tes données", processor: "qui héberge le jeu (sous-traitant).", noSell: "Nous ne vendons pas de données et ne les transmettons pas autrement.", howLong: "Durée de conservation", rights: "Tes droits", complain: "Tu peux aussi déposer une plainte auprès d’une autorité de protection des données", questions: "Questions", seeContact: "voir le contact ci-dessus", email: "E-mail", phone: "Téléphone", legalBasis: "Bases juridiques (art. 6 RGPD)"},
  "tr": {legal: "Yasal bildirim", privacy: "Gizlilik politikası", back: "Oyuna dön", incomplete: "Bu sayfa henüz tamamlanmadı.", imprint: "Yasal bildirim (Impressum)", vat: "Vergi kimlik no", resp: "İçerikten sorumlu", free: "MarsL ücretsiz bir tarayıcı oyunudur. Başka hiçbir oyun veya şirketle ilgisi yoktur.", whoResp: "Sorumlu", store: "Neleri neden saklıyoruz", cookies: "Çerezler ve benzeri teknolojiler", whoGets: "Verilerini kimler alır", processor: "oyunu barındıran (veri işleyen).", noSell: "Verileri satmıyoruz ve başka şekilde de paylaşmıyoruz.", howLong: "Ne kadar süre", rights: "Hakların", complain: "Ayrıca bir veri koruma otoritesine şikayette bulunabilirsin", questions: "Sorular", seeContact: "yukarıdaki iletişim bilgisine bak", email: "E-posta", phone: "Telefon", legalBasis: "Hukuki dayanaklar (GDPR md. 6)"},
  "es": {legal: "Aviso legal", privacy: "Política de privacidad", back: "Volver al juego", incomplete: "Esta página aún no está completa.", imprint: "Aviso legal (Impressum)", vat: "NIF/IVA", resp: "Responsable del contenido", free: "MarsL es un juego gratuito para navegador. No está relacionado con ningún otro juego ni empresa.", whoResp: "Responsable", store: "Qué guardamos y por qué", cookies: "Cookies y tecnologías similares", whoGets: "Quién recibe tus datos", processor: "que aloja el juego (encargado del tratamiento).", noSell: "No vendemos datos ni los cedemos de otra forma.", howLong: "Cuánto tiempo", rights: "Tus derechos", complain: "También puedes presentar una reclamación ante una autoridad de protección de datos", questions: "Preguntas", seeContact: "ver el contacto arriba", email: "Correo", phone: "Teléfono", legalBasis: "Bases jurídicas (art. 6 RGPD)"},
  "ru": {legal: "Правовая информация", privacy: "Политика конфиденциальности", back: "Вернуться в игру", incomplete: "Эта страница ещё не заполнена.", imprint: "Правовая информация (Impressum)", vat: "ИНН / НДС", resp: "Ответственный за содержание", free: "MarsL — бесплатная браузерная игра. Она не связана с другими играми или компаниями.", whoResp: "Ответственный", store: "Что мы храним и зачем", cookies: "Cookie и похожие технологии", whoGets: "Кто получает твои данные", processor: "который размещает игру (обработчик).", noSell: "Мы не продаём данные и не передаём их иначе.", howLong: "Как долго", rights: "Твои права", complain: "Также можно подать жалобу в орган по защите данных", questions: "Вопросы", seeContact: "см. контакты выше", email: "Эл. почта", phone: "Телефон", legalBasis: "Правовые основания (ст. 6 GDPR)"},
  "vi": {legal: "Thông báo pháp lý", privacy: "Chính sách bảo mật", back: "Quay lại trò chơi", incomplete: "Trang này chưa hoàn tất.", imprint: "Thông báo pháp lý (Impressum)", vat: "Mã số thuế", resp: "Chịu trách nhiệm nội dung", free: "MarsL là trò chơi trình duyệt miễn phí. Không liên quan đến trò chơi hay công ty nào khác.", whoResp: "Chịu trách nhiệm", store: "Chúng tôi lưu gì và vì sao", cookies: "Cookie và công nghệ tương tự", whoGets: "Ai nhận dữ liệu của bạn", processor: "đơn vị lưu trữ trò chơi (bên xử lý).", noSell: "Chúng tôi không bán dữ liệu và không chia sẻ theo cách khác.", howLong: "Lưu trong bao lâu", rights: "Quyền của bạn", complain: "Bạn cũng có thể khiếu nại lên cơ quan bảo vệ dữ liệu", questions: "Câu hỏi", seeContact: "xem thông tin liên hệ ở trên", email: "Email", phone: "Điện thoại", legalBasis: "Cơ sở pháp lý (Điều 6 GDPR)"},
  "pt": {legal: "Aviso legal", privacy: "Política de privacidade", back: "Voltar ao jogo", incomplete: "Esta página ainda não está completa.", imprint: "Aviso legal (Impressum)", vat: "NIF/IVA", resp: "Responsável pelo conteúdo", free: "MarsL é um jogo de navegador gratuito. Não tem relação com outros jogos ou empresas.", whoResp: "Responsável", store: "O que guardamos e por quê", cookies: "Cookies e tecnologias semelhantes", whoGets: "Quem recebe seus dados", processor: "que hospeda o jogo (operador).", noSell: "Não vendemos dados nem os repassamos de outra forma.", howLong: "Por quanto tempo", rights: "Seus direitos", complain: "Você também pode reclamar a uma autoridade de proteção de dados", questions: "Perguntas", seeContact: "veja o contato acima", email: "E-mail", phone: "Telefone", legalBasis: "Bases legais (art. 6 RGPD)"},
  "id": {legal: "Informasi hukum", privacy: "Kebijakan privasi", back: "Kembali ke game", incomplete: "Halaman ini belum lengkap.", imprint: "Informasi hukum (Impressum)", vat: "NPWP / VAT ID", resp: "Penanggung jawab konten", free: "MarsL adalah game browser gratis. Tidak berhubungan dengan game atau perusahaan lain mana pun.", whoResp: "Penanggung jawab", store: "Apa yang kami simpan dan alasannya", cookies: "Cookie dan teknologi serupa", whoGets: "Siapa yang menerima datamu", processor: "yang menjadi host game (pemroses).", noSell: "Kami tidak menjual data dan tidak membagikannya dengan cara lain.", howLong: "Berapa lama", rights: "Hakmu", complain: "Kamu juga dapat mengajukan keluhan ke otoritas perlindungan data", questions: "Pertanyaan", seeContact: "lihat kontak di atas", email: "Email", phone: "Telepon", legalBasis: "Dasar hukum (Pasal 6 GDPR)"},
  "pl": {legal: "Informacja prawna", privacy: "Polityka prywatności", back: "Wróć do gry", incomplete: "Ta strona nie jest jeszcze kompletna.", imprint: "Informacja prawna (Impressum)", vat: "NIP / VAT ID", resp: "Odpowiedzialny za treść", free: "MarsL to darmowa gra przeglądarkowa. Nie jest powiązana z żadną inną grą ani firmą.", whoResp: "Odpowiedzialny", store: "Co przechowujemy i dlaczego", cookies: "Pliki cookie i podobne technologie", whoGets: "Kto otrzymuje twoje dane", processor: "który hostuje grę (podmiot przetwarzający).", noSell: "Nie sprzedajemy danych i nie przekazujemy ich w inny sposób.", howLong: "Jak długo", rights: "Twoje prawa", complain: "Możesz też złożyć skargę do organu ochrony danych", questions: "Pytania", seeContact: "zobacz kontakt powyżej", email: "E-mail", phone: "Telefon", legalBasis: "Podstawy prawne (art. 6 RODO)"},
  "cs": {legal: "Právní upozornění", privacy: "Zásady ochrany osobních údajů", back: "Zpět do hry", incomplete: "Tato stránka ještě není kompletní.", imprint: "Právní upozornění (Impressum)", vat: "DIČ", resp: "Odpovědný za obsah", free: "MarsL je bezplatná prohlížečová hra. Nesouvisí s žádnou jinou hrou ani firmou.", whoResp: "Odpovědný", store: "Co ukládáme a proč", cookies: "Cookies a podobné technologie", whoGets: "Kdo dostává vaše údaje", processor: "který hostuje hru (zpracovatel).", noSell: "Údaje neprodáváme ani jinak nepředáváme.", howLong: "Jak dlouho", rights: "Vaše práva", complain: "Můžete také podat stížnost u úřadu pro ochranu osobních údajů", questions: "Dotazy", seeContact: "viz kontakt výše", email: "E-mail", phone: "Telefon", legalBasis: "Právní základy (čl. 6 GDPR)"},
  "sk": {legal: "Právne upozornenie", privacy: "Zásady ochrany osobných údajov", back: "Späť do hry", incomplete: "Táto stránka ešte nie je kompletná.", imprint: "Právne upozornenie (Impressum)", vat: "IČ DPH", resp: "Zodpovedný za obsah", free: "MarsL je bezplatná prehliadačová hra. Nesúvisí so žiadnou inou hrou ani firmou.", whoResp: "Zodpovedný", store: "Čo ukladáme a prečo", cookies: "Cookies a podobné technológie", whoGets: "Kto dostáva vaše údaje", processor: "ktorý hostuje hru (spracovateľ).", noSell: "Údaje nepredávame ani inak neposkytujeme.", howLong: "Ako dlho", rights: "Vaše práva", complain: "Môžete tiež podať sťažnosť na úrad na ochranu údajov", questions: "Otázky", seeContact: "pozrite kontakt vyššie", email: "E-mail", phone: "Telefón", legalBasis: "Právny základ (čl. 6 GDPR)"}
};

const LEGALB = {
  "en": {"acct": "Your account:", "acctTxt": " colonist name, your password (never stored itself: only a salted, peppered one-way hash that can’t be turned back into the password), tribe, when you signed up and when you were last online.", "mailTxt": " If you give an email address: the address and whether it is confirmed.", "game": "Your game:", "gameTxt": " colonies, troops, build jobs, reports, messages to other players, alliance posts, rankings, badges, map marks and farm lists. Other players can see your name, points, alliance, colonies on the map, your profile text and badges.", "tech": "Technical data:", "techTxt": " when you connect, your IP address is processed to deliver the page and to stop abuse (for example too many requests or sign-ups). It is kept in memory only for a short time. To find several accounts on one device (the game does not allow them to trade with each other), we store a random device ID from a cookie and a salted, shortened hash of your IP address. The IP address itself is not stored with your account. {host} may keep server logs.", "basisTxt": " running the game for you (para. 1 b) and our interest in a secure and fair game (para. 1 f).", "cookiesTxt": "MarsL only uses what it needs to work: a login cookie, a device cookie (see above) and small settings in your browser (sound, alerts, sort order, farm lists). There is no tracking, no advertising and no analytics. Fonts are served from this server, nothing is loaded from other companies. The Discord button is a normal link: Discord's own privacy policy applies once you click it.", "brevoTxt": ", which sends confirmation and password reset emails (processor). Only your email address and the mail text go there.", "hostFallback": "our hosting provider", "howLongTxt": "Until you delete your account. A new round resets the game but keeps accounts. Results of finished rounds stay in the Hall of Fame with the player names, also after an account is deleted.", "rights1": "You can ask for access, correction, restriction, a copy of your data and object to the processing. ", "rightsBold": "You can delete your account yourself", "rights2": " at any time in the game: Settings → Delete account. Everything that belongs to it is removed. "},
  "de": {"acct": "Dein Konto:", "acctTxt": " Kolonistenname, dein Passwort (nie im Klartext gespeichert: nur ein gesalzener, gepfefferter Einweg-Hash, der sich nicht zurück in das Passwort verwandeln lässt), Stamm, Anmeldezeitpunkt und letzter Online-Zeitpunkt.", "mailTxt": " Wenn du eine E-Mail-Adresse angibst: die Adresse und ob sie bestätigt ist.", "game": "Dein Spiel:", "gameTxt": " Kolonien, Truppen, Bauaufträge, Berichte, Nachrichten an andere Spieler, Allianzbeiträge, Ranglisten, Abzeichen, Kartenmarkierungen und Farmlisten. Andere Spieler sehen deinen Namen, deine Punkte, deine Allianz, deine Kolonien auf der Karte, deinen Profiltext und deine Abzeichen.", "tech": "Technische Daten:", "techTxt": " Wenn du dich verbindest, wird deine IP-Adresse verarbeitet, um die Seite auszuliefern und Missbrauch zu verhindern (zum Beispiel zu viele Anfragen oder Registrierungen). Sie wird nur kurz im Arbeitsspeicher gehalten. Um mehrere Konten auf einem Gerät zu erkennen (das Spiel erlaubt ihnen keinen Handel untereinander), speichern wir eine zufällige Geräte-ID aus einem Cookie und einen gesalzenen, gekürzten Hash deiner IP-Adresse. Die IP-Adresse selbst wird nicht mit deinem Konto gespeichert. {host} kann Server-Logs führen.", "basisTxt": " dir das Spiel bereitstellen (Abs. 1 lit. b) und unser Interesse an einem sicheren und fairen Spiel (Abs. 1 lit. f).", "cookiesTxt": "MarsL nutzt nur, was zum Funktionieren nötig ist: ein Login-Cookie, ein Geräte-Cookie (siehe oben) und kleine Einstellungen in deinem Browser (Ton, Hinweise, Sortierung, Farmlisten). Es gibt kein Tracking, keine Werbung und keine Analysen. Schriftarten kommen von diesem Server, von anderen Firmen wird nichts geladen. Der Discord-Button ist ein normaler Link: Sobald du ihn anklickst, gilt die Datenschutzerklärung von Discord.", "brevoTxt": ", das Bestätigungs- und Passwort-Zurücksetzen-E-Mails versendet (Auftragsverarbeiter). Dorthin gehen nur deine E-Mail-Adresse und der Mailtext.", "hostFallback": "unser Hosting-Anbieter", "howLongTxt": "Bis du dein Konto löschst. Eine neue Runde setzt das Spiel zurück, behält aber die Konten. Ergebnisse beendeter Runden bleiben mit den Spielernamen in der Ruhmeshalle, auch nachdem ein Konto gelöscht wurde.", "rights1": "Du kannst Auskunft, Berichtigung, Einschränkung und eine Kopie deiner Daten verlangen und der Verarbeitung widersprechen. ", "rightsBold": "Du kannst dein Konto selbst löschen", "rights2": " jederzeit im Spiel: Einstellungen → Konto löschen. Alles, was dazugehört, wird entfernt. "},
  "it": {"acct": "Il tuo account:", "acctTxt": " nome da colono, la tua password (mai salvata in chiaro: solo un hash unidirezionale con salt e pepper che non può essere riconvertito nella password), tribù, quando ti sei registrato e quando sei stato online l’ultima volta.", "mailTxt": " Se indichi un indirizzo email: l’indirizzo e se è confermato.", "game": "La tua partita:", "gameTxt": " colonie, truppe, lavori di costruzione, rapporti, messaggi ad altri giocatori, messaggi dell’alleanza, classifiche, distintivi, segni sulla mappa ed elenchi farm. Gli altri giocatori vedono il tuo nome, i tuoi punti, la tua alleanza, le tue colonie sulla mappa, il testo del profilo e i tuoi distintivi.", "tech": "Dati tecnici:", "techTxt": " quando ti connetti, il tuo indirizzo IP viene trattato per consegnare la pagina e prevenire abusi (ad esempio troppe richieste o registrazioni). Viene conservato in memoria solo per breve tempo. Per riconoscere più account sullo stesso dispositivo (il gioco non permette loro di scambiare tra loro), salviamo un ID dispositivo casuale da un cookie e un hash abbreviato con salt del tuo indirizzo IP. L’indirizzo IP in sé non viene salvato con il tuo account. {host} può conservare log del server.", "basisTxt": " gestire il gioco per te (par. 1 lett. b) e il nostro interesse a un gioco sicuro ed equo (par. 1 lett. f).", "cookiesTxt": "MarsL usa solo ciò che serve per funzionare: un cookie di login, un cookie del dispositivo (vedi sopra) e piccole impostazioni nel tuo browser (audio, avvisi, ordinamento, elenchi farm). Non ci sono tracciamento, pubblicità né analisi. I caratteri sono forniti da questo server, nulla viene caricato da altre aziende. Il pulsante Discord è un normale link: dopo il clic vale l’informativa sulla privacy di Discord.", "brevoTxt": ", che invia le email di conferma e di reimpostazione della password (responsabile del trattamento). Lì vanno solo il tuo indirizzo email e il testo del messaggio.", "hostFallback": "il nostro provider di hosting", "howLongTxt": "Finché non elimini il tuo account. Un nuovo round azzera la partita ma mantiene gli account. I risultati dei round conclusi restano nell’Albo d’oro con i nomi dei giocatori, anche dopo l’eliminazione di un account.", "rights1": "Puoi chiedere accesso, rettifica, limitazione e una copia dei tuoi dati e opporti al trattamento. ", "rightsBold": "Puoi eliminare tu stesso il tuo account", "rights2": " in qualsiasi momento nel gioco: Impostazioni → Elimina account. Tutto ciò che gli appartiene viene rimosso. "},
  "fr": {"acct": "Ton compte :", "acctTxt": " nom de colon, ton mot de passe (jamais stocké en clair : seulement un hachage à sens unique salé et poivré qui ne peut pas être reconverti en mot de passe), tribu, date d’inscription et dernière connexion.", "mailTxt": " Si tu donnes une adresse e-mail : l’adresse et si elle est confirmée.", "game": "Ta partie :", "gameTxt": " colonies, troupes, travaux, rapports, messages aux autres joueurs, messages d’alliance, classements, badges, repères de carte et listes de farm. Les autres joueurs voient ton nom, tes points, ton alliance, tes colonies sur la carte, ton texte de profil et tes badges.", "tech": "Données techniques :", "techTxt": " quand tu te connectes, ton adresse IP est traitée pour fournir la page et empêcher les abus (par exemple trop de requêtes ou d’inscriptions). Elle n’est gardée en mémoire que brièvement. Pour repérer plusieurs comptes sur un même appareil (le jeu ne leur permet pas d’échanger entre eux), nous enregistrons un identifiant d’appareil aléatoire issu d’un cookie et un hachage salé et raccourci de ton adresse IP. L’adresse IP elle-même n’est pas stockée avec ton compte. {host} peut conserver des journaux de serveur.", "basisTxt": " faire fonctionner le jeu pour toi (par. 1 b) et notre intérêt à un jeu sûr et équitable (par. 1 f).", "cookiesTxt": "MarsL n’utilise que ce qui est nécessaire à son fonctionnement : un cookie de connexion, un cookie d’appareil (voir ci-dessus) et de petits réglages dans ton navigateur (son, alertes, ordre de tri, listes de farm). Il n’y a ni suivi, ni publicité, ni analyse. Les polices sont servies depuis ce serveur, rien n’est chargé depuis d’autres entreprises. Le bouton Discord est un simple lien : la politique de confidentialité de Discord s’applique dès que tu cliques.", "brevoTxt": ", qui envoie les e-mails de confirmation et de réinitialisation du mot de passe (sous-traitant). Seuls ton adresse e-mail et le texte du message y sont transmis.", "hostFallback": "notre hébergeur", "howLongTxt": "Jusqu’à ce que tu supprimes ton compte. Une nouvelle manche réinitialise le jeu mais conserve les comptes. Les résultats des manches terminées restent au Panthéon avec les noms des joueurs, même après la suppression d’un compte.", "rights1": "Tu peux demander l’accès, la rectification, la limitation et une copie de tes données, et t’opposer au traitement. ", "rightsBold": "Tu peux supprimer ton compte toi-même", "rights2": " à tout moment dans le jeu : Paramètres → Supprimer le compte. Tout ce qui s’y rattache est supprimé. "},
  "tr": {"acct": "Hesabın:", "acctTxt": " kolonist adı, şifren (düz metin olarak saklanmaz: yalnızca tuzlanmış ve biberlenmiş, şifreye geri çevrilemeyen tek yönlü bir özet), kabile, kayıt zamanı ve son çevrimiçi olduğun zaman.", "mailTxt": " E-posta adresi verirsen: adres ve onaylanıp onaylanmadığı.", "game": "Oyunun:", "gameTxt": " koloniler, birlikler, inşaat işleri, raporlar, diğer oyunculara mesajlar, ittifak gönderileri, sıralamalar, rozetler, harita işaretleri ve yağma listeleri. Diğer oyuncular adını, puanını, ittifakını, haritadaki kolonilerini, profil metnini ve rozetlerini görebilir.", "tech": "Teknik veriler:", "techTxt": " bağlandığında IP adresin, sayfayı iletmek ve kötüye kullanımı önlemek için (örneğin çok fazla istek veya kayıt) işlenir. Yalnızca kısa süre bellekte tutulur. Aynı cihazdaki birden çok hesabı bulmak için (oyun bunların birbirleriyle ticaret yapmasına izin vermez) bir çerezden rastgele bir cihaz kimliği ve IP adresinin tuzlanmış, kısaltılmış bir özetini saklarız. IP adresinin kendisi hesabınla birlikte saklanmaz. {host} sunucu günlükleri tutabilir.", "basisTxt": " oyunu senin için işletmek (md. 1 b) ve güvenli ve adil bir oyuna olan menfaatimiz (md. 1 f).", "cookiesTxt": "MarsL yalnızca çalışmak için gerekeni kullanır: bir giriş çerezi, bir cihaz çerezi (yukarıya bak) ve tarayıcındaki küçük ayarlar (ses, uyarılar, sıralama düzeni, yağma listeleri). İzleme, reklam ve analiz yoktur. Yazı tipleri bu sunucudan sunulur, başka şirketlerden hiçbir şey yüklenmez. Discord düğmesi normal bir bağlantıdır: tıkladığında Discord’un kendi gizlilik politikası geçerli olur.", "brevoTxt": ", onay ve şifre sıfırlama e-postalarını gönderir (veri işleyen). Oraya yalnızca e-posta adresin ve ileti metni gider.", "hostFallback": "barındırma sağlayıcımız", "howLongTxt": "Hesabını silene kadar. Yeni bir tur oyunu sıfırlar ama hesapları korur. Biten turların sonuçları, oyuncu adlarıyla birlikte Şeref salonunda kalır; bir hesap silindikten sonra da.", "rights1": "Verilerine erişim, düzeltme, kısıtlama ve bir kopya isteyebilir, işlemeye itiraz edebilirsin. ", "rightsBold": "Hesabını kendin silebilirsin", "rights2": " oyunda istediğin zaman: Ayarlar → Hesabı sil. Ona ait her şey kaldırılır. "},
  "es": {"acct": "Tu cuenta:", "acctTxt": " nombre de colono, tu contraseña (nunca se guarda tal cual: solo un hash unidireccional con sal y pimienta que no puede convertirse de nuevo en la contraseña), tribu, cuándo te registraste y cuándo estuviste en línea por última vez.", "mailTxt": " Si indicas un correo electrónico: la dirección y si está confirmada.", "game": "Tu partida:", "gameTxt": " colonias, tropas, trabajos de construcción, informes, mensajes a otros jugadores, publicaciones de alianza, clasificaciones, insignias, marcas del mapa y listas de farm. Otros jugadores pueden ver tu nombre, puntos, alianza, colonias en el mapa, el texto de tu perfil y tus insignias.", "tech": "Datos técnicos:", "techTxt": " cuando te conectas, tu dirección IP se procesa para entregar la página y evitar abusos (por ejemplo, demasiadas solicitudes o registros). Se guarda en memoria solo un breve tiempo. Para detectar varias cuentas en un mismo dispositivo (el juego no les permite comerciar entre sí), guardamos un ID de dispositivo aleatorio de una cookie y un hash abreviado con sal de tu dirección IP. La dirección IP en sí no se guarda con tu cuenta. {host} puede conservar registros del servidor.", "basisTxt": " ofrecerte el juego (apdo. 1 b) y nuestro interés en un juego seguro y justo (apdo. 1 f).", "cookiesTxt": "MarsL solo usa lo necesario para funcionar: una cookie de inicio de sesión, una cookie de dispositivo (véase arriba) y pequeños ajustes en tu navegador (sonido, avisos, orden, listas de farm). No hay seguimiento, publicidad ni analítica. Las fuentes se sirven desde este servidor, no se carga nada de otras empresas. El botón de Discord es un enlace normal: al hacer clic se aplica la política de privacidad de Discord.", "brevoTxt": ", que envía los correos de confirmación y de restablecimiento de contraseña (encargado del tratamiento). Solo van allí tu correo electrónico y el texto del mensaje.", "hostFallback": "nuestro proveedor de alojamiento", "howLongTxt": "Hasta que borres tu cuenta. Una nueva ronda reinicia el juego pero conserva las cuentas. Los resultados de las rondas terminadas quedan en el Salón de la fama con los nombres de los jugadores, también después de borrar una cuenta.", "rights1": "Puedes pedir acceso, rectificación, limitación y una copia de tus datos, y oponerte al tratamiento. ", "rightsBold": "Puedes borrar tu cuenta tú mismo", "rights2": " en cualquier momento en el juego: Ajustes → Eliminar cuenta. Todo lo que le pertenece se elimina. "},
  "ru": {"acct": "Твой аккаунт:", "acctTxt": " имя колониста, твой пароль (сам по себе не хранится: только односторонний хеш с солью и перцем, который нельзя превратить обратно в пароль), племя, когда ты зарегистрировался и когда был в сети в последний раз.", "mailTxt": " Если ты указываешь адрес электронной почты: сам адрес и подтверждён ли он.", "game": "Твоя игра:", "gameTxt": " колонии, войска, задания на строительство, отчёты, сообщения другим игрокам, записи альянса, рейтинги, значки, метки на карте и списки фарма. Другие игроки видят твоё имя, очки, альянс, колонии на карте, текст профиля и значки.", "tech": "Технические данные:", "techTxt": " при подключении твой IP-адрес обрабатывается, чтобы отдать страницу и пресечь злоупотребления (например, слишком много запросов или регистраций). В памяти он хранится лишь недолго. Чтобы найти несколько аккаунтов на одном устройстве (игра не позволяет им торговать друг с другом), мы сохраняем случайный идентификатор устройства из cookie и хеш твоего IP-адреса с солью, в сокращённом виде. Сам IP-адрес с твоим аккаунтом не сохраняется. {host} может вести журналы сервера.", "basisTxt": " обеспечение работы игры для тебя (п. 1 b) и наш интерес в безопасной и честной игре (п. 1 f).", "cookiesTxt": "MarsL использует только то, что нужно для работы: cookie входа, cookie устройства (см. выше) и небольшие настройки в твоём браузере (звук, уведомления, порядок сортировки, списки фарма). Нет ни отслеживания, ни рекламы, ни аналитики. Шрифты отдаются с этого сервера, ничего не загружается от других компаний. Кнопка Discord — обычная ссылка: после перехода действует собственная политика конфиденциальности Discord.", "brevoTxt": ", который отправляет письма с подтверждением и сбросом пароля (обработчик данных). Туда попадают только твой адрес электронной почты и текст письма.", "hostFallback": "наш хостинг-провайдер", "howLongTxt": "Пока ты не удалишь аккаунт. Новый раунд сбрасывает игру, но сохраняет аккаунты. Результаты завершённых раундов остаются в Зале славы с именами игроков, в том числе после удаления аккаунта.", "rights1": "Ты можешь запросить доступ, исправление, ограничение и копию своих данных, а также возразить против обработки. ", "rightsBold": "Ты можешь удалить аккаунт сам", "rights2": " в любой момент в игре: Настройки → Удалить аккаунт. Всё, что к нему относится, удаляется. "},
  "vi": {"acct": "Tài khoản của bạn:", "acctTxt": " tên người định cư, mật khẩu (không bao giờ lưu nguyên văn: chỉ một mã băm một chiều có muối và tiêu, không thể chuyển ngược lại thành mật khẩu), bộ tộc, thời điểm đăng ký và lần cuối trực tuyến.", "mailTxt": " Nếu bạn cung cấp địa chỉ email: địa chỉ đó và việc đã xác nhận hay chưa.", "game": "Ván chơi của bạn:", "gameTxt": " thuộc địa, quân, công việc xây dựng, báo cáo, tin nhắn gửi người chơi khác, bài đăng liên minh, bảng xếp hạng, huy hiệu, dấu trên bản đồ và danh sách farm. Người chơi khác thấy tên, điểm, liên minh, thuộc địa trên bản đồ, nội dung hồ sơ và huy hiệu của bạn.", "tech": "Dữ liệu kỹ thuật:", "techTxt": " khi bạn kết nối, địa chỉ IP của bạn được xử lý để cung cấp trang và ngăn lạm dụng (ví dụ quá nhiều yêu cầu hoặc lượt đăng ký). Nó chỉ được giữ trong bộ nhớ một thời gian ngắn. Để phát hiện nhiều tài khoản trên một thiết bị (trò chơi không cho chúng giao dịch với nhau), chúng tôi lưu một mã thiết bị ngẫu nhiên từ cookie và một mã băm rút gọn có muối của địa chỉ IP bạn. Bản thân địa chỉ IP không được lưu cùng tài khoản. {host} có thể lưu nhật ký máy chủ.", "basisTxt": " vận hành trò chơi cho bạn (khoản 1 b) và lợi ích của chúng tôi trong một trò chơi an toàn, công bằng (khoản 1 f).", "cookiesTxt": "MarsL chỉ dùng những gì cần để hoạt động: cookie đăng nhập, cookie thiết bị (xem ở trên) và các thiết lập nhỏ trong trình duyệt (âm thanh, cảnh báo, thứ tự sắp xếp, danh sách farm). Không theo dõi, không quảng cáo, không phân tích. Phông chữ được phục vụ từ máy chủ này, không tải gì từ công ty khác. Nút Discord là một liên kết bình thường: khi bạn bấm vào, chính sách quyền riêng tư của Discord sẽ áp dụng.", "brevoTxt": ", nơi gửi email xác nhận và đặt lại mật khẩu (bên xử lý dữ liệu). Chỉ có địa chỉ email của bạn và nội dung thư được gửi đến đó.", "hostFallback": "nhà cung cấp lưu trữ của chúng tôi", "howLongTxt": "Cho đến khi bạn xoá tài khoản. Ván mới đặt lại trò chơi nhưng giữ tài khoản. Kết quả các ván đã kết thúc ở lại Đại sảnh danh vọng cùng tên người chơi, kể cả sau khi tài khoản bị xoá.", "rights1": "Bạn có thể yêu cầu truy cập, chỉnh sửa, hạn chế và một bản sao dữ liệu của mình, cũng như phản đối việc xử lý. ", "rightsBold": "Bạn có thể tự xoá tài khoản", "rights2": " bất cứ lúc nào trong trò chơi: Cài đặt → Xoá tài khoản. Mọi thứ thuộc về nó đều bị gỡ bỏ. "},
  "pt": {"acct": "Sua conta:", "acctTxt": " nome de colono, sua senha (nunca guardada em si: apenas um hash unidirecional com sal e pimenta que não pode ser revertido para a senha), tribo, quando você se registrou e quando esteve online pela última vez.", "mailTxt": " Se você informar um e-mail: o endereço e se ele foi confirmado.", "game": "Seu jogo:", "gameTxt": " colônias, tropas, construções, relatórios, mensagens para outros jogadores, publicações da aliança, rankings, distintivos, marcas no mapa e listas de farm. Outros jogadores podem ver seu nome, pontos, aliança, colônias no mapa, o texto do seu perfil e seus distintivos.", "tech": "Dados técnicos:", "techTxt": " quando você se conecta, seu endereço IP é processado para entregar a página e impedir abusos (por exemplo, pedidos ou cadastros em excesso). Ele fica na memória só por pouco tempo. Para reconhecer várias contas em um mesmo dispositivo (o jogo não permite que negociem entre si), guardamos um ID de dispositivo aleatório de um cookie e um hash abreviado, com sal, do seu endereço IP. O endereço IP em si não é guardado com sua conta. {host} pode manter registros do servidor.", "basisTxt": " operar o jogo para você (par. 1 b) e nosso interesse em um jogo seguro e justo (par. 1 f).", "cookiesTxt": "O MarsL usa apenas o que precisa para funcionar: um cookie de login, um cookie de dispositivo (veja acima) e pequenas configurações no seu navegador (som, alertas, ordem de classificação, listas de farm). Não há rastreamento, publicidade nem análises. As fontes são servidas por este servidor, nada é carregado de outras empresas. O botão do Discord é um link comum: depois do clique vale a política de privacidade do próprio Discord.", "brevoTxt": ", que envia os e-mails de confirmação e de redefinição de senha (operador). Para lá vão apenas seu e-mail e o texto da mensagem.", "hostFallback": "nosso provedor de hospedagem", "howLongTxt": "Até você excluir sua conta. Uma nova rodada reinicia o jogo, mas mantém as contas. Os resultados das rodadas concluídas permanecem no Hall da fama com os nomes dos jogadores, mesmo depois de uma conta ser excluída.", "rights1": "Você pode pedir acesso, correção, restrição e uma cópia dos seus dados e se opor ao tratamento. ", "rightsBold": "Você mesmo pode excluir sua conta", "rights2": " a qualquer momento no jogo: Configurações → Excluir conta. Tudo o que pertence a ela é removido. "},
  "id": {"acct": "Akunmu:", "acctTxt": " nama kolonis, kata sandimu (tidak pernah disimpan apa adanya: hanya hash satu arah dengan salt dan pepper yang tidak bisa dikembalikan menjadi kata sandi), suku, kapan kamu mendaftar, dan kapan terakhir online.", "mailTxt": " Jika kamu memberikan alamat email: alamat itu dan apakah sudah dikonfirmasi.", "game": "Gamemu:", "gameTxt": " koloni, pasukan, pekerjaan bangunan, laporan, pesan ke pemain lain, kiriman aliansi, peringkat, lencana, tanda peta, dan daftar farm. Pemain lain bisa melihat namamu, poin, aliansi, koloni di peta, teks profil, dan lencanamu.", "tech": "Data teknis:", "techTxt": " saat kamu terhubung, alamat IP-mu diproses untuk mengirim halaman dan mencegah penyalahgunaan (misalnya terlalu banyak permintaan atau pendaftaran). IP hanya disimpan di memori sebentar. Untuk menemukan beberapa akun di satu perangkat (game tidak mengizinkan mereka berdagang satu sama lain), kami menyimpan ID perangkat acak dari cookie dan hash singkat ber-salt dari alamat IP-mu. Alamat IP itu sendiri tidak disimpan bersama akunmu. {host} dapat menyimpan log server.", "basisTxt": " menjalankan game untukmu (ayat 1 b) dan kepentingan kami atas game yang aman dan adil (ayat 1 f).", "cookiesTxt": "MarsL hanya memakai yang diperlukan agar berfungsi: cookie login, cookie perangkat (lihat di atas), dan pengaturan kecil di browsermu (suara, peringatan, urutan, daftar farm). Tidak ada pelacakan, iklan, maupun analitik. Font disajikan dari server ini, tidak ada yang dimuat dari perusahaan lain. Tombol Discord adalah tautan biasa: setelah kamu mengkliknya, berlaku kebijakan privasi Discord sendiri.", "brevoTxt": ", yang mengirim email konfirmasi dan reset kata sandi (pemroses). Hanya alamat emailmu dan isi pesan yang dikirim ke sana.", "hostFallback": "penyedia hosting kami", "howLongTxt": "Sampai kamu menghapus akunmu. Ronde baru mengatur ulang game tetapi mempertahankan akun. Hasil ronde yang selesai tetap ada di Hall of fame bersama nama pemain, juga setelah akun dihapus.", "rights1": "Kamu bisa meminta akses, koreksi, pembatasan, dan salinan datamu serta menolak pemrosesan. ", "rightsBold": "Kamu bisa menghapus akunmu sendiri", "rights2": " kapan saja di dalam game: Pengaturan → Hapus akun. Semua yang terkait akan dihapus. "},
  "pl": {"acct": "Twoje konto:", "acctTxt": " nazwa kolonisty, twoje hasło (nigdy zapisane wprost: tylko jednokierunkowy skrót z solą i pieprzem, którego nie da się zamienić z powrotem na hasło), plemię, kiedy się zarejestrowałeś i kiedy ostatnio byłeś online.", "mailTxt": " Jeśli podasz adres e-mail: sam adres i informację, czy został potwierdzony.", "game": "Twoja gra:", "gameTxt": " kolonie, wojska, zlecenia budowy, raporty, wiadomości do innych graczy, wpisy sojuszu, rankingi, odznaki, znaczniki na mapie i listy farm. Inni gracze widzą twoją nazwę, punkty, sojusz, kolonie na mapie, tekst profilu i odznaki.", "tech": "Dane techniczne:", "techTxt": " gdy się łączysz, twój adres IP jest przetwarzany, by dostarczyć stronę i zapobiegać nadużyciom (na przykład zbyt wielu żądaniom lub rejestracjom). Jest trzymany w pamięci tylko krótko. By wykryć kilka kont na jednym urządzeniu (gra nie pozwala im handlować ze sobą), zapisujemy losowy identyfikator urządzenia z pliku cookie i skrócony skrót twojego adresu IP z solą. Sam adres IP nie jest zapisywany przy koncie. {host} może prowadzić logi serwera.", "basisTxt": " prowadzenie gry dla ciebie (ust. 1 lit. b) oraz nasz interes w bezpiecznej i uczciwej grze (ust. 1 lit. f).", "cookiesTxt": "MarsL używa tylko tego, co potrzebne do działania: pliku cookie logowania, pliku cookie urządzenia (zob. wyżej) i małych ustawień w twojej przeglądarce (dźwięk, alerty, kolejność sortowania, listy farm). Nie ma śledzenia, reklam ani analityki. Czcionki serwuje ten serwer, nic nie jest ładowane od innych firm. Przycisk Discorda to zwykły link: po kliknięciu obowiązuje polityka prywatności Discorda.", "brevoTxt": ", który wysyła e-maile z potwierdzeniem i resetem hasła (podmiot przetwarzający). Trafiają tam tylko twój adres e-mail i treść wiadomości.", "hostFallback": "nasz dostawca hostingu", "howLongTxt": "Dopóki nie usuniesz konta. Nowa runda resetuje grę, ale zachowuje konta. Wyniki zakończonych rund zostają w Galerii sław wraz z nazwami graczy, także po usunięciu konta.", "rights1": "Możesz żądać dostępu, sprostowania, ograniczenia i kopii swoich danych oraz sprzeciwić się przetwarzaniu. ", "rightsBold": "Konto możesz usunąć samodzielnie", "rights2": " w każdej chwili w grze: Ustawienia → Usuń konto. Wszystko, co do niego należy, zostaje usunięte. "},
  "cs": {"acct": "Tvůj účet:", "acctTxt": " jméno kolonisty, tvé heslo (nikdy se neukládá samo: jen jednosměrný otisk se solí a pepřem, který nelze převést zpět na heslo), kmen, kdy ses zaregistroval a kdy jsi byl naposledy online.", "mailTxt": " Pokud uvedeš e-mailovou adresu: adresa a zda je potvrzená.", "game": "Tvá hra:", "gameTxt": " kolonie, jednotky, stavební zakázky, zprávy, vzkazy jiným hráčům, příspěvky aliance, žebříčky, odznaky, značky na mapě a farmovací seznamy. Ostatní hráči vidí tvé jméno, body, alianci, kolonie na mapě, text profilu a odznaky.", "tech": "Technické údaje:", "techTxt": " když se připojíš, tvá IP adresa se zpracuje, aby se doručila stránka a zabránilo zneužití (například příliš mnoho požadavků nebo registrací). V paměti se drží jen krátce. Abychom poznali více účtů na jednom zařízení (hra jim neumožňuje spolu obchodovat), ukládáme náhodné ID zařízení z cookie a zkrácený otisk tvé IP adresy se solí. Samotná IP adresa se k účtu neukládá. {host} může vést serverové logy.", "basisTxt": " provozování hry pro tebe (odst. 1 písm. b) a náš zájem na bezpečné a férové hře (odst. 1 písm. f).", "cookiesTxt": "MarsL používá jen to, co potřebuje k provozu: přihlašovací cookie, cookie zařízení (viz výše) a malá nastavení v tvém prohlížeči (zvuk, upozornění, řazení, farmovací seznamy). Žádné sledování, reklama ani analytika. Písma se servírují z tohoto serveru, nic se nenačítá od jiných firem. Tlačítko Discordu je obyčejný odkaz: po kliknutí platí vlastní zásady ochrany soukromí Discordu.", "brevoTxt": ", který posílá potvrzovací e-maily a e-maily k obnově hesla (zpracovatel). Tam jde jen tvá e-mailová adresa a text zprávy.", "hostFallback": "náš hostingový poskytovatel", "howLongTxt": "Dokud svůj účet nesmažeš. Nové kolo hru resetuje, ale účty zachová. Výsledky ukončených kol zůstávají v Síni slávy se jmény hráčů, i po smazání účtu.", "rights1": "Můžeš žádat o přístup, opravu, omezení a kopii svých údajů a vznést námitku proti zpracování. ", "rightsBold": "Účet si můžeš smazat sám", "rights2": " kdykoli ve hře: Nastavení → Smazat účet. Vše, co k němu patří, se odstraní. "},
  "sk": {"acct": "Tvoj účet:", "acctTxt": " meno kolonistu, tvoje heslo (nikdy sa neukladá samo: iba jednosmerný odtlačok so soľou a korením, ktorý sa nedá previesť späť na heslo), kmeň, kedy si sa zaregistroval a kedy si bol naposledy online.", "mailTxt": " Ak uvedieš e-mailovú adresu: adresa a či je potvrdená.", "game": "Tvoja hra:", "gameTxt": " kolónie, jednotky, stavebné zákazky, správy, odkazy iným hráčom, príspevky aliancie, rebríčky, odznaky, značky na mape a farmovacie zoznamy. Ostatní hráči vidia tvoje meno, body, alianciu, kolónie na mape, text profilu a odznaky.", "tech": "Technické údaje:", "techTxt": " keď sa pripojíš, tvoja IP adresa sa spracuje, aby sa doručila stránka a zabránilo zneužitiu (napríklad príliš veľa požiadaviek alebo registrácií). V pamäti sa drží len krátko. Aby sme spoznali viac účtov na jednom zariadení (hra im neumožňuje spolu obchodovať), ukladáme náhodné ID zariadenia z cookie a skrátený odtlačok tvojej IP adresy so soľou. Samotná IP adresa sa k účtu neukladá. {host} môže viesť serverové logy.", "basisTxt": " prevádzkovanie hry pre teba (ods. 1 písm. b) a náš záujem o bezpečnú a férovú hru (ods. 1 písm. f).", "cookiesTxt": "MarsL používa len to, čo potrebuje na chod: prihlasovacie cookie, cookie zariadenia (pozri vyššie) a malé nastavenia v tvojom prehliadači (zvuk, upozornenia, radenie, farmovacie zoznamy). Žiadne sledovanie, reklama ani analytika. Písma sa servírujú z tohto servera, nič sa nenačítava od iných firiem. Tlačidlo Discordu je obyčajný odkaz: po kliknutí platia vlastné zásady ochrany súkromia Discordu.", "brevoTxt": ", ktorý posiela potvrdzovacie e-maily a e-maily na obnovu hesla (spracovateľ). Tam ide len tvoja e-mailová adresa a text správy.", "hostFallback": "náš hostingový poskytovateľ", "howLongTxt": "Kým svoj účet nezmažeš. Nové kolo hru resetuje, ale účty zachová. Výsledky ukončených kôl zostávajú v Sieni slávy s menami hráčov, aj po zmazaní účtu.", "rights1": "Môžeš žiadať o prístup, opravu, obmedzenie a kópiu svojich údajov a namietať proti spracovaniu. ", "rightsBold": "Účet si môžeš zmazať sám", "rights2": " kedykoľvek v hre: Nastavenia → Zmazať účet. Všetko, čo k nemu patrí, sa odstráni. "},
};

const PATCH_NOTES = [
  {v:"1.0.339",date:"2026-11-12",title:"Storage, marketplace and troop traffic",groups:[["Storage",["Warehouse, Granary and base storage capacities are reduced by one third."]],["Troop traffic",["The sidebar shows totals by movement type. Tap it to see all movements."]],["Marketplace",["Swap and Balance use a base rate of 46–55% as the marketplace levels up. Humans lose 5% less. Cover with market returns you to the build or upgrade after the swap."]]]},
  {v:"1.0.338",date:"2026-11-11",title:"Farm list selection and fixed troop upkeep",groups:[["Farm lists",["Select or clear all targets in an expanded list."]],["Food",["Troops consume their base upkeep per real hour at every game speed."]]]},
  {v:"1.0.337",date:"2026-11-11",title:"Start all farm lists",groups:[["Farm lists",["Start all sends raids from every farm list and lets you stop the remaining queue."]]]},
  {v:"1.0.336",date:"2026-11-11",title:"Restore Send troops",groups:[["Map",["Send troops opens the troop picker after refreshing available troops. Colony startup retries temporary connection failures."]]]},
  {v:"1.0.335",date:"2026-11-11",title:"Send partial farm list batches",groups:[["Farm lists",["Farm lists send raids in list order and skip targets when their preset cannot be filled."]]]},
  {v:"1.0.334",date:"2026-11-11",title:"Restore OpenTest login",groups:[["Game loading",["A server configured as its own hub now shows its login instead of redirecting to itself."]]]},
  {v:"1.0.333",date:"2026-11-11",title:"Restore game startup",groups:[["Game loading",["Fixed a browser script error that left the game on the loading screen."]]]},
  {v:"1.0.332",date:"2026-11-11",title:"Recover reliably when the game cannot load",groups:[["Game loading",["Startup retries temporary network and server errors automatically. If loading still fails, the screen identifies which step failed and offers a retry."]]]},
  {v:"1.0.330",date:"2026-11-11",title:"Hide translated suggestions",groups:[["Translations",["The default list skips translated versions of the same phrase. Search still includes them."]]]},
  {v:"1.0.329",date:"2026-11-11",title:"Remember skipped translations",groups:[["Translations",["Skipped phrases stay hidden in suggestions and remain available through search."]]]},
  {v:"1.0.328",date:"2026-11-11",title:"Game text only in translation suggestions",groups:[["Translations",["Translation suggestions use the built-in game text catalog so player-created names stay out of the list."]]]},
  {v:"1.0.327",date:"2026-11-11",title:"Switch languages in place",groups:[["Translations",["Changing language keeps your current game screen open. Translation updates are applied only to the language they belong to."]]]},
  {v:"1.0.326",date:"2026-11-11",title:"Correct shared hub status",groups:[["🌍 Translations",["The main translation hub is now identified correctly when it has HOP_SECRET and no HUB_URL. Approval confirms publication on the hub; connected servers collect it within seconds."]]]},
  {v:"1.0.325",date:"2026-11-11",title:"Shared translation hub setting accepted",groups:[["🌍 Translations",["The shared translation hub setting accepts HUB_URL and HUB_UR. Approval notices explain when a hub URL or shared secret is missing."]]]},
  {v:"1.0.324",date:"2026-11-11",title:"Stable translation window and faster approvals",groups:[["🌍 Translations",["The translation panel keeps a fixed position while suggestions load or change. With the shared server hub configured, approved translations propagate across servers within seconds and disappear from untranslated suggestions for that language; search can still find them."]]]},
  {v:"1.0.323",date:"2026-11-11",title:"Cleaner translation suggestions",groups:[["🌍 Translations",["Translation help now skips player names, emoji and icon characters, and phrases that already have a translation. Search can still find existing phrases. Skip a suggestion to move on; skipped phrases stay hidden for your account."]]]},
  {v:"1.0.317",date:"2026-11-11",title:"Clearer goals and event pacing",groups:[["Server goals",["New camp targets account for active players. Participants can claim rewards through the following period, and completing a shared goal pays twice the participation reward as a bonus.","The daily camp contract takes one occupied camp victory. Aurora waits for the Relic Hunt to have a full week and for any active hold attempt to resolve."]]]},
  {v:"1.0.316",date:"2026-11-11",title:"Resource amounts follow game-time rules",groups:[["⚖️ Speed balance",["Game speed still changes production and travel/build timing. Storage, cargo per merchant or troop, gifts, adventure resource amounts, camp loot, healing beds, Aurora pylon targets and resource costs now stay fixed per level, unit or action.","Food upkeep now follows production speed, preserving its balance against output. Camp rewards and defenders no longer gain a raw speed multiplier; camp regrowth still follows movement speed."]]]},
  {v:"1.0.315",date:"2026-11-11",title:"Gifts and caravans match storage pacing",groups:[["📦 Resources",["Quest, daily, newcomer and retention resource gifts no longer grow with game speed. Their amounts stay fixed while production and server days keep their existing speed rules.","Merchant capacity per level is fixed at every speed; merchants still travel faster on faster servers. Caravan trade amounts are fixed too. Troop loot carry and monster-camp rewards remain speed-scaled combat rewards."]]]},
  {v:"1.0.314",date:"2026-11-11",title:"Storage stays consistent across speeds",groups:[["📦 Storage",["Warehouse, granary, bunker, starting storage and greenhouse reserve capacity now depend on their levels, not game speed. Faster production can fill them sooner; the expanded resource bar shows fill times and offers one storage shortcut when the first resource will fill within three hours.","Existing resources above the new capacity are preserved. Spend them down and future production will resume below the normal limit."]]]},
  {"v": "1.0.313", "date": "2026-11-09", "title": "Battle reports back, gear translated", "groups": [["🐞 Fixes", ["Battle reports stopped loading. Fixed."]], ["⚡ Faster", ["The reports page asks less often and only rebuilds the list when something changed."]], ["🌍 Languages", ["Commander gear values and names are translated into all 12 languages."]]], "i18n": {"de": {"title": "Kampfberichte wieder da, Gegenstände übersetzt", "groups": [["🐞 Korrekturen", ["Kampfberichte luden nicht mehr. Behoben."]], ["⚡ Schneller", ["Die Berichtsseite fragt seltener ab und baut die Liste nur neu, wenn sich etwas geändert hat."]], ["🌍 Sprachen", ["Werte und Namen der Kommandanten-Ausrüstung sind in allen 12 Sprachen übersetzt."]]]}, "it": {"title": "Rapporti di battaglia di nuovo visibili, oggetti tradotti", "groups": [["🐞 Correzioni", ["I rapporti di battaglia non si caricavano più. Risolto."]], ["⚡ Più veloce", ["La pagina dei rapporti chiede meno spesso e ricostruisce l’elenco solo se qualcosa è cambiato."]], ["🌍 Lingue", ["Valori e nomi dell’equipaggiamento del comandante tradotti in tutte e 12 le lingue."]]]}, "fr": {"title": "Rapports de combat rétablis, objets traduits", "groups": [["🐞 Corrections", ["Les rapports de combat ne se chargeaient plus. Corrigé."]], ["⚡ Plus rapide", ["La page des rapports interroge moins souvent et ne reconstruit la liste que si quelque chose a changé."]], ["🌍 Langues", ["Valeurs et noms de l’équipement du commandant traduits dans les 12 langues."]]]}, "tr": {"title": "Savaş raporları yine açılıyor, eşyalar çevrildi", "groups": [["🐞 Düzeltmeler", ["Savaş raporları yüklenmiyordu. Düzeltildi."]], ["⚡ Daha hızlı", ["Rapor sayfası daha seyrek sorguluyor ve listeyi yalnızca bir şey değiştiğinde yeniden kuruyor."]], ["🌍 Diller", ["Komutan ekipmanının değerleri ve adları 12 dilde çevrildi."]]]}, "es": {"title": "Informes de batalla de nuevo disponibles, objetos traducidos", "groups": [["🐞 Correcciones", ["Los informes de batalla no cargaban. Corregido."]], ["⚡ Más rápido", ["La página de informes consulta con menos frecuencia y reconstruye la lista solo si algo cambió."]], ["🌍 Idiomas", ["Valores y nombres del equipo del comandante traducidos en los 12 idiomas."]]]}, "ru": {"title": "Отчёты о битвах снова работают, предметы переведены", "groups": [["🐞 Исправления", ["Отчёты о битвах перестали загружаться. Исправлено."]], ["⚡ Быстрее", ["Страница отчётов запрашивает данные реже и перестраивает список, только если что-то изменилось."]], ["🌍 Языки", ["Значения и названия снаряжения командира переведены на все 12 языков."]]]}, "vi": {"title": "Báo cáo chiến đấu đã hoạt động lại, vật phẩm được dịch", "groups": [["🐞 Sửa lỗi", ["Báo cáo chiến đấu không tải được nữa. Đã sửa."]], ["⚡ Nhanh hơn", ["Trang báo cáo hỏi dữ liệu ít hơn và chỉ dựng lại danh sách khi có thay đổi."]], ["🌍 Ngôn ngữ", ["Chỉ số và tên trang bị của chỉ huy đã được dịch sang 12 ngôn ngữ."]]]}, "pt": {"title": "Relatórios de batalha voltaram, itens traduzidos", "groups": [["🐞 Correções", ["Os relatórios de batalha não carregavam mais. Corrigido."]], ["⚡ Mais rápido", ["A página de relatórios consulta com menos frequência e só remonta a lista quando algo muda."]], ["🌍 Idiomas", ["Valores e nomes do equipamento do comandante traduzidos nos 12 idiomas."]]]}, "id": {"title": "Laporan pertempuran kembali muncul, item diterjemahkan", "groups": [["🐞 Perbaikan", ["Laporan pertempuran tidak lagi bisa dimuat. Sudah diperbaiki."]], ["⚡ Lebih cepat", ["Halaman laporan lebih jarang meminta data dan hanya menyusun ulang daftar jika ada perubahan."]], ["🌍 Bahasa", ["Nilai dan nama perlengkapan komandan diterjemahkan ke 12 bahasa."]]]}, "pl": {"title": "Raporty bitew znów działają, przedmioty przetłumaczone", "groups": [["🐞 Poprawki", ["Raporty bitew przestały się wczytywać. Naprawione."]], ["⚡ Szybciej", ["Strona raportów pyta rzadziej i przebudowuje listę tylko wtedy, gdy coś się zmieniło."]], ["🌍 Języki", ["Wartości i nazwy ekwipunku dowódcy przetłumaczone na 12 języków."]]]}, "cs": {"title": "Bojová hlášení zase fungují, předměty přeloženy", "groups": [["🐞 Opravy", ["Bojová hlášení se přestala načítat. Opraveno."]], ["⚡ Rychlejší", ["Stránka hlášení se dotazuje řidčeji a seznam přestavuje jen tehdy, když se něco změnilo."]], ["🌍 Jazyky", ["Hodnoty a názvy výbavy velitele přeloženy do 12 jazyků."]]]}, "sk": {"title": "Bojové hlásenia znova fungujú, predmety preložené", "groups": [["🐞 Opravy", ["Bojové hlásenia sa prestali načítavať. Opravené."]], ["⚡ Rýchlejšie", ["Stránka hlásení sa dopytuje redšie a zoznam prebuduje len vtedy, keď sa niečo zmenilo."]], ["🌍 Jazyky", ["Hodnoty a názvy výbavy veliteľa preložené do 12 jazykov."]]]}}},
  {v:"1.0.312",date:"2026-11-09",title:"Server page, legal page and patch notes translated",groups:[["🌍 Languages",["Server info page: now shows in all 12 languages.","Legal page: the privacy paragraphs are translated (draft, needs a legal review).","Patch notes page: title and the newest notes translated.","Event bar, storage warnings, welcome and tribe screens and the server picker: remaining English texts translated."]],["🐞 Fixes",["The server info page failed to load since 1.0.310; fixed."]]],i18n:{"de": {"title": "Serverseite, Rechtsseite und Patchnotizen übersetzt", "groups": [["🌍 Sprachen", ["Server-Infoseite: erscheint jetzt in allen 12 Sprachen.", "Rechtsseite: die Datenschutz-Absätze sind übersetzt (Entwurf, braucht eine rechtliche Prüfung).", "Patchnotizen-Seite: Titel und neueste Notizen übersetzt.", "Ereignisleiste, Lagerwarnungen, Willkommens- und Stammesbildschirme und die Serverauswahl: übrige englische Texte übersetzt."]], ["🐞 Korrekturen", ["Die Server-Infoseite ließ sich seit 1.0.310 nicht laden; behoben."]]]}, "it": {"title": "Pagina del server, pagina legale e note di versione tradotte", "groups": [["🌍 Lingue", ["Pagina info server: ora in tutte e 12 le lingue.", "Pagina legale: i paragrafi sulla privacy sono tradotti (bozza, serve una revisione legale).", "Pagina delle note di versione: titolo e note più recenti tradotti.", "Barra eventi, avvisi di magazzino, schermate di benvenuto e tribù e selezione del server: tradotti i testi inglesi rimasti."]], ["🐞 Correzioni", ["La pagina info server non si caricava dalla 1.0.310; risolto."]]]}, "fr": {"title": "Page du serveur, page légale et notes de mise à jour traduites", "groups": [["🌍 Langues", ["Page d’infos du serveur : maintenant dans les 12 langues.", "Page légale : les paragraphes sur la confidentialité sont traduits (brouillon, une relecture juridique est nécessaire).", "Page des notes de mise à jour : titre et notes récentes traduits.", "Bandeau d’événement, alertes de stockage, écrans d’accueil et de tribu et choix du serveur : textes anglais restants traduits."]], ["🐞 Corrections", ["La page d’infos du serveur ne se chargeait plus depuis la 1.0.310 ; corrigé."]]]}, "tr": {"title": "Sunucu sayfası, yasal sayfa ve yama notları çevrildi", "groups": [["🌍 Diller", ["Sunucu bilgi sayfası: artık 12 dilin hepsinde.", "Yasal sayfa: gizlilik paragrafları çevrildi (taslak, hukuki inceleme gerekir).", "Yama notları sayfası: başlık ve en yeni notlar çevrildi.", "Olay çubuğu, depo uyarıları, karşılama ve kabile ekranları ve sunucu seçimi: kalan İngilizce metinler çevrildi."]], ["🐞 Düzeltmeler", ["Sunucu bilgi sayfası 1.0.310’dan beri yüklenmiyordu; düzeltildi."]]]}, "es": {"title": "Página del servidor, página legal y notas de versión traducidas", "groups": [["🌍 Idiomas", ["Página de info del servidor: ahora en los 12 idiomas.", "Página legal: los párrafos de privacidad están traducidos (borrador, necesita revisión legal).", "Página de notas de versión: título y notas recientes traducidos.", "Barra de eventos, avisos de almacén, pantallas de bienvenida y de tribu y selector de servidor: traducidos los textos en inglés que quedaban."]], ["🐞 Correcciones", ["La página de info del servidor no cargaba desde la 1.0.310; corregido."]]]}, "ru": {"title": "Страница сервера, правовая страница и заметки об обновлениях переведены", "groups": [["🌍 Языки", ["Страница сведений о сервере: теперь на всех 12 языках.", "Правовая страница: абзацы о конфиденциальности переведены (черновик, нужна юридическая проверка).", "Страница заметок об обновлениях: заголовок и новейшие заметки переведены.", "Полоса событий, предупреждения о складе, экраны приветствия и племени и выбор сервера: переведены оставшиеся английские тексты."]], ["🐞 Исправления", ["Страница сведений о сервере не загружалась с версии 1.0.310; исправлено."]]]}, "vi": {"title": "Trang máy chủ, trang pháp lý và ghi chú bản cập nhật đã được dịch", "groups": [["🌍 Ngôn ngữ", ["Trang thông tin máy chủ: giờ hiển thị đủ 12 ngôn ngữ.", "Trang pháp lý: các đoạn về quyền riêng tư đã được dịch (bản nháp, cần pháp lý rà soát).", "Trang ghi chú bản cập nhật: tiêu đề và các ghi chú mới nhất đã được dịch.", "Thanh sự kiện, cảnh báo kho, màn hình chào mừng và bộ tộc, chọn máy chủ: các văn bản tiếng Anh còn lại đã được dịch."]], ["🐞 Sửa lỗi", ["Trang thông tin máy chủ không tải được từ bản 1.0.310; đã sửa."]]]}, "pt": {"title": "Página do servidor, página legal e notas de versão traduzidas", "groups": [["🌍 Idiomas", ["Página de info do servidor: agora nos 12 idiomas.", "Página legal: os parágrafos de privacidade foram traduzidos (rascunho, precisa de revisão jurídica).", "Página de notas de versão: título e notas recentes traduzidos.", "Barra de eventos, avisos de armazém, telas de boas-vindas e de tribo e seleção de servidor: textos em inglês restantes traduzidos."]], ["🐞 Correções", ["A página de info do servidor não carregava desde a 1.0.310; corrigido."]]]}, "id": {"title": "Halaman server, halaman hukum, dan catatan pembaruan diterjemahkan", "groups": [["🌍 Bahasa", ["Halaman info server: sekarang tampil dalam 12 bahasa.", "Halaman hukum: paragraf privasi sudah diterjemahkan (draf, perlu ditinjau secara hukum).", "Halaman catatan pembaruan: judul dan catatan terbaru diterjemahkan.", "Bilah acara, peringatan gudang, layar sambutan dan suku, serta pemilih server: sisa teks bahasa Inggris diterjemahkan."]], ["🐞 Perbaikan", ["Halaman info server gagal dimuat sejak 1.0.310; sudah diperbaiki."]]]}, "pl": {"title": "Strona serwera, strona prawna i notatki o zmianach przetłumaczone", "groups": [["🌍 Języki", ["Strona informacji o serwerze: teraz we wszystkich 12 językach.", "Strona prawna: akapity o prywatności przetłumaczone (wersja robocza, wymaga przeglądu prawnego).", "Strona notatek o zmianach: tytuł i najnowsze notatki przetłumaczone.", "Pasek wydarzeń, ostrzeżenia o magazynie, ekrany powitania i plemienia oraz wybór serwera: pozostałe angielskie teksty przetłumaczone."]], ["🐞 Poprawki", ["Strona informacji o serwerze nie ładowała się od wersji 1.0.310; naprawione."]]]}, "cs": {"title": "Stránka serveru, právní stránka a poznámky k verzím přeloženy", "groups": [["🌍 Jazyky", ["Stránka s informacemi o serveru: nyní ve všech 12 jazycích.", "Právní stránka: odstavce o soukromí jsou přeloženy (návrh, vyžaduje právní kontrolu).", "Stránka poznámek k verzím: nadpis a nejnovější poznámky přeloženy.", "Lišta událostí, upozornění na sklad, uvítací obrazovky a obrazovky kmenů a výběr serveru: zbývající anglické texty přeloženy."]], ["🐞 Opravy", ["Stránka s informacemi o serveru se od verze 1.0.310 nenačítala; opraveno."]]]}, "sk": {"title": "Stránka servera, právna stránka a poznámky k verziám preložené", "groups": [["🌍 Jazyky", ["Stránka s informáciami o serveri: teraz vo všetkých 12 jazykoch.", "Právna stránka: odseky o súkromí sú preložené (návrh, vyžaduje právnu kontrolu).", "Stránka poznámok k verziám: nadpis a najnovšie poznámky preložené.", "Lišta udalostí, upozornenia na sklad, uvítacie obrazovky a obrazovky kmeňov a výber servera: zostávajúce anglické texty preložené."]], ["🐞 Opravy", ["Stránka s informáciami o serveri sa od verzie 1.0.310 nenačítavala; opravené."]]]}}},
  {v:"1.0.311",date:"2026-11-09",title:"Guide labels translated",groups:[["🌍 Languages",["Guide: the title, subtitle, search box and tab names now show in all 12 languages."]]]},
  {v:"1.0.310",date:"2026-11-09",title:"Guide and legal page translated",groups:[["🌍 Languages",["Guide: units, buildings, gear, events, formulas and the long guide paragraphs now show in all 12 languages.","Legal page: headings and labels follow your game language. The privacy text itself is still in English."]]]},
  {v:"1.0.309",date:"2026-11-09",title:"Guide labels translated",groups:[["🌍 Languages",["Guide: card titles and table labels now show in all 12 languages."]]]},
  {v:"1.0.308",date:"2026-11-09",title:"Economy guide translated",groups:[["Build queue",["Guide: market, specialisations and resource fields text translated."]]]},
  {v:"1.0.307",date:"2026-11-09",title:"Terra rush removed",groups:[["Build queue",["🌱 Terra rush has been removed. Overtime, helping hands and alliance help work as before."]]]},
  {v:"1.0.306",date:"2026-11-09",title:"Guide: storage and terra text translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.305",date:"2026-11-09",title:"Guide: alliances and the rest of the guide translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.304",date:"2026-11-09",title:"Guide: the Ignite and Month 1 text fixed",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.303",date:"2026-11-09",title:"Guide: attacks, farming and growth translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.302",date:"2026-11-09",title:"Guide: rules and defense translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.301",date:"2026-11-09",title:"Guide: combat and travel translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.300",date:"2026-11-09",title:"Guide: even more sections translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.299",date:"2026-11-09",title:"Guide: more sections translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.298",date:"2026-11-09",title:"Guide: economy and more translated",groups:[["🌍 Languages",["Guide: more guide sections are now available in all 12 languages"]]]},
  {v:"1.0.297",date:"2026-11-09",title:"Guide: basics translated",groups:[["🌍 Languages",["Guide: the basics tab is now available in all 12 languages"]]]},
  {v:"1.0.296",date:"2026-11-09",title:"Battle report texts with numbers translated",groups:[["🌍 Languages",["Battle report sentences that include numbers or colony names are now translated in all 12 languages"]]]},
  {v:"1.0.295",date:"2026-11-09",title:"Translated report titles",groups:[["🌍 Languages",["Report titles that include colony or player names are now translated in all 12 languages"]]]},
  {v:"1.0.294",date:"2026-11-09",title:"Report titles translated",groups:[["🌍 Languages",["Report titles now shown in all 12 languages (where they are fixed text)"]]]},
  {v:"1.0.293",date:"2026-11-09",title:"Short report titles",groups:[["📜 Reports",["Report titles are short and name the colonies: \"Colony → Colony\". The line below says what happened (Raid, Attack, Spy) and who played.","Other report titles are shorter too."]]]},
  {v:"1.0.292",date:"2026-11-09",title:"New Colony",groups:[["🏘️ Colonies",["New colonies are called New Colony. Colonies with the old automatic names were renamed to New Colony."]]]},
  {v:"1.0.291",date:"2026-11-09",title:"Readable report titles",groups:[["📜 Reports",["Battle report titles name both colonies and always sit on one line, in one size. The owners are on the line below.","Colony names are at most 12 characters. Longer names were shortened automatically at a word boundary."]]]},
  {v:"1.0.290",date:"2026-11-09",title:"Compact battle reports",groups:[["📜 Reports",["Closed battle reports are more compact, and their titles shrink to fit on one line"]]]},
  {v:"1.0.289",date:"2026-11-09",title:"Full battle report titles",groups:[["📜 Reports",["Battle report titles now wrap onto several lines instead of being cut off with \u2026"]]]},
  {v:"1.0.288",date:"2026-11-09",title:"Battle report texts translated",groups:[["🌍 Languages",["Common battle report messages now available in all 12 languages"]]]},
  {v:"1.0.287",date:"2026-11-09",title:"Gazette headlines translated",groups:[["🌍 Languages",["News ticker headlines and jokes now available in all 12 languages"]]]},
  {v:"1.0.286",date:"2026-11-09",title:"Confirmation and reset mails in your language",groups:[["🌍 Languages",["The confirmation page, the password reset mail and the e-mail confirmation for a changed address now use the language you chose, in all twelve languages.","The legal and privacy page is still in English for now (legal wording needs a native check)."]]]},
  {v:"1.0.285",date:"2026-11-09",title:"Tribe names in your language",groups:[["🌍 Languages",["The tribe names Chickens and Aliens are translated as well."]]]},
  {v:"1.0.284",date:"2026-11-09",title:"Tribe and unit texts in your language",groups:[["🌍 Languages",["Tribe descriptions, unit names and their quips are translated in all twelve languages.","The guide, patch notes, legal texts and confirmation pages come next."]]]},
  {v:"1.0.283",date:"2026-11-09",title:"Hero texts in your language",groups:[["🌍 Languages",["Hero archetypes, skills, quirks, gear and perk texts are translated in all twelve languages.","Tribe and unit texts follow in the next version."]]]},
  {v:"1.0.282",date:"2026-11-09",title:"Quests in your language",groups:[["🌍 Languages",["The quest names and short descriptions (First Harvest, Room for Stuff, Monster Hunter and the rest) are now translated in all twelve languages.","The rest of the game, the guide, the patch notes and the legal texts are still being translated, step by step."]]]},
  {v:"1.0.281",date:"2026-11-09",title:"Polish, Czech and Slovak",groups:[["🌍 Languages",["Three more languages: Polski, Čeština and Slovenčina. Twelve languages plus English are in the game now.","The confirmation mail is sent in your chosen language too.","Translation help works in these languages as well."]]]},
  {v:"1.0.280",date:"2026-11-09",title:"More languages and community translations",groups:[["🌍 Languages",["Two more languages: Português (Brasil) and Bahasa Indonesia. Nine languages plus English are in the game now.","The language picker shows English, Deutsch, Español, Français and Português up front; the others are one tap away under “More languages”.","✏️ Help translate: in ⚙️ Settings, pick a language and tap Help translate. You see the phrases that are still missing, or search every phrase to improve a text, and send your suggestion. A moderator checks each one before it appears for everyone.","Server owners review suggestions in the new 🌍 Languages tab of the admin page, can fix a text before approving it, and can download or import a translation file per language (one JSON file with “English phrase”: “translation”) to work with Crowdin, Weblate or any text editor."]]]},
  {v:"1.0.279",date:"2026-11-09",title:"Русский and Tiếng Việt",groups:[["🌍 Languages",["Two more languages: Русский (Russian) and Tiếng Việt (Vietnamese). They are available on the start page, in the confirmation mail and in ⚙️ Settings, with the same screens translated as the other languages.","The “Gazette” is now simply called “News”."]]]},
  {v:"1.0.278",date:"2026-11-09",title:"The game in your language, part 1",groups:[["🌍 Languages",["Every screen can now be shown in Deutsch, Italiano, Français, Türkçe or Español: the tabs, resources, buildings, the map, rankings, reports, mail and the Settings sheet. Pick your language in ⚙️ Settings; the choice from the start page carries over.","Texts that are not translated yet stay in English for now. The guide and the patch notes follow in the next versions."]]]},
  {v:"1.0.277",date:"2026-11-09",title:"Confirmation mails in your language",groups:[["🌍 Languages",["The confirmation mail (subject, greeting, text and button) is sent in the language the player chose on the start page, in English, Deutsch, Italiano, Français, Türkçe or Español.","A new link (Resend) keeps the language of the sign-up."]]]},
  {v:"1.0.276",date:"2026-11-09",title:"Start page in six languages",groups:[["🌍 Languages",["Choose English, Deutsch, Italiano, Français, Türkçe or Español at the bottom of the start page and on the log-in and sign-up screens. The choice is remembered on this device.","The start page, the sign-up and log-in screens are translated. The game screens, the guide and the patch notes follow in the next steps."]]]},
  {v:"1.0.275",date:"2026-11-09",title:"Clear a stuck sign-up",groups:[["📧 Sign-up",["The owner's Sign-up panel lists everyone still waiting for their confirmation link, with their address and time. 🗑️ Clear removes one stuck sign-up so the player can register again with the same name and address."]]]},
  {v:"1.0.274",date:"2026-11-08",title:"Confirmation mail that really goes out",groups:[["📧 Sign-up",["A new player now sees a clear message if the confirmation mail can't be sent, instead of a \"check your inbox\" screen with no mail. The account is only waiting for confirmation once the mail service has accepted the mail.","The server owner's sign-up panel shows the last mail error and the reason the mail service gave."]]]},
  {v:"1.0.273",date:"2026-11-08",title:"Common passwords allowed",groups:[["🔐 Passwords",["Common passwords are allowed again. The other rules still apply: at least 6 characters, no part of your name, not only numbers and not one repeated character."]]]},
  {v:"1.0.272",date:"2026-11-08",title:"Password length and pace text",groups:[["🔐 Passwords",["New passwords need at least 6 characters (was 10). The other rules still apply: no part of your name, no very common passwords, not only numbers or one repeated character."]],["🏁 Pace",["The ×10 server now describes itself as faster than Classic, not as a normal-speed round. Blitz and Classic keep their texts."]]]},
  {v:"1.0.271",date:"2026-11-08",title:"Stronger password protection",groups:[["🔐 Security",["Passwords were never stored as text, only as a one-way fingerprint. That fingerprint is now much stronger: a secret key kept outside the database is mixed in, and every guess costs far more computing time and memory. A stolen copy of the database alone is no longer enough to start guessing.","Your existing password keeps working. It is upgraded to the stronger kind automatically the next time you log in.","The privacy page describes how passwords are stored."]]]},
  {v:"1.0.270",date:"2026-11-08",title:"Tidier settings, a fresh tour",groups:[["🧭 Tour",["The tour was reworked for the new look. Every step lights up the right place again (fields, colony, storage tiles, the act row, the Mission Board, the colony list and the 📖 Guide button) with a soft glowing ring instead of a dashed frame.","The first steps after landing use the same glowing ring."]],["⚙️ Settings",["The settings sheet is sorted into cards: Play, Attack alerts, Vacation and sitters, Account and devices, About, and a red Danger zone for deleting colonies and respawning.","The sheet title and the close button stay at the top while you scroll.","Sitters take a single line until you are in an alliance."]],["🔐 Logins",["Settings list every device you are logged in on (for example \"iPhone · Safari\") with when it was last used, and you can log out a single device.","Logging in again on the same browser replaces its old login instead of adding a new one.","A login nobody used for 14 days ends by itself."]],["🧹 Cleaner screens",["Mission Board rewards sit in one row with a slim Claim button next to them.","The colony name stays on one line on wide screens; the header buttons are a bit smaller.","Resource tiles show the number of fields and their average level as a small badge instead of an extra line.","The server list no longer opens with a paragraph; test servers carry a short tag instead.","Costs and rewards use the clay resource icons."]],["🔔 Notices",["When a training order finishes while the game is open, a short message tells you."]]]},
  {v:"1.0.269",date:"2026-11-08",title:"Tidier settings sheet",groups:[["🧹 Less repetition",["The links in the settings sheet (servers and password, admin, quest progression, patch notes, legal) now sit in even tiles of the same size, with no underlines and no broken lines on phones."]]]},
  {v:"1.0.268",date:"2026-11-08",title:"Slimmer specialisation",groups:[["🧹 Less repetition",["The specialisation panel is now one tidy row: icon, name and effect, with the rich-site bonus as a small gold badge. Tap it to see the other options as a short list; the switching cost is shown once above them. Before specialisations unlock, the row says when they open."]]]},
  {v:"1.0.267",date:"2026-11-08",title:"Guide errors are shown",groups:[["🔧 Fixes",["If the guide can't be loaded, you now see the reason instead of nothing happening."]],["🧹 Less repetition",["The \"Food is running out!\" panel is gone: the food tile already shows when it runs empty. The warning that troops are starving stays."]]]},
  {v:"1.0.266",date:"2026-11-08",title:"Guide fix",groups:[["🔧 Fixes",["The guide and every ? button open again: since 1.0.264 the guide could not load because of the new home powers.","The Tribe powers card shows the new Lockdown and Rally Cry."]]]},
  {v:"1.0.265",date:"2026-11-08",title:"Fixes and safer passwords",groups:[["🔧 Fixes",["Tapping the Act line no longer blanks the page: it opens Players, and any unknown screen now falls back to Fields.","The reward badge no longer covers the Mission Board title."]],["🚀 Server page",["The server page now sits on the clay backdrop.","The note about Classic and OpenTest no longer says \"New here?\"; it just explains the two."]],["🔐 Passwords",["New passwords need at least 10 characters, can't contain your name, can't be a very common password and can't be only numbers or one repeated character. Existing passwords keep working.","The register form shows a strength bar and the warning: never use an important password.","Logging in with an unknown name now takes as long as with a known one."]]]},
  {v:"1.0.264",date:"2026-11-08",title:"One scene, calmer screens",groups:[["⚔️ New home powers",["🧑‍🚀 Humans: 🚨 Lockdown replaces Supply Drop. For 6 hours the colony gets +15% defense, or its bunkers hide 50% more. You pick one.","🐔 Chickens: 📣 Rally Cry replaces Hatch Day. The next attack or raid from this colony that lands within 8 hours gets +12% attack for its ground or its air troops.","Both work once per server day in every colony, show in the slim row while active, and appear in the battle report when they worked. 🧠 Mind Link stays as it was."]],["📏 Compact screens",["The \"Storage full in…\" and \"Next build done in…\" lines are gone from Fields and Colony: the resource tiles and the build queue already show them. The empty Troop Traffic panel is a single line. Act, weather and home power fold into one tappable line, and spacing is tighter. On phones the field ring now starts on the first screen."]],["💡 Light and surfaces",["Panels, tiles and buttons share one warm light from above: a soft top highlight, warm shadows. At night they get a faint lantern glow.","The start page keeps its own sky; the clay backdrop is only inside the game."]],["🧘 Calmer Fields and Colony",["The resource bar comes first on Fields and Colony.","Act, weather and home power sit in one slim row below it. On phones that row is a single line you can tap to open all the text."]],["🏺 Clay icons and type",["The four resources and the six tabs now have clay pictures. 24 icons are ready for more places.","Numbers and titles use the rounded display face with larger steps, and numbers stay the same width so counters don't jump."]],["✨ Motion",["A finished building squashes and bounces, claimed rewards send coins to the resource bar, and the one reward that is ready pulses softly. Reduced motion turns all of it off."]],["🌦️ A living backdrop",["The weather of the day shows over the backdrop: dust haze, ice fog, trade-wind streaks, flare glow, ion flashes and marsquake tremors.","A small walker of your tribe strolls along the bottom edge."]]]},
  {v:"1.0.263",date:"2026-11-08",title:"A clay backdrop",groups:[["🏜️ Day and night backdrop",["The page now sits on a clay desert of Mars, with small silly details at the edges: a rover, an antenna, a flag at day, glowing lanterns and little huts at night.","It follows the clock of your device (night from 20:00 to 6:00). Phones in portrait get a taller picture.","The News and Mars pulse guide cards are gone: they described no game rules."]],["Fixes",["The News front page after time away names your colony in its quiet-days headline instead of showing \"undefined\"."]]]},
  {v:"1.0.262",date:"2026-11-08",title:"Coffee for the humans",groups:[["☕ Humans, Coffee break",["It replaces 📋 Red tape: every tribe keeps exactly one quirk. When a human colony beats an attack or raid, its crew is wide awake for 3 hours: +10% defense against everyone, not just the same player.","Battle reports, the Why line, spy reports and the Army tab show when the coffee was at work. The guide card Tribe quirks has the new row."]]]},
  {v:"1.0.261",date:"2026-11-08",title:"Mars News",groups:[["🎭 Tribe quirks",["📋 Humans, Red tape: after a successful raid on a human colony, the same raider gets 20% less loot there for 12 hours.","🐔 Chickens, Headless panic: 15% of the chickens that fall defending their home come back an hour later.","🛸 Aliens, Probed: a successful alien spy mission gives the same player's next attack on that colony +10% (within 6 hours).","Reports, spy reports and the Army tab show when a quirk was at work."]],["📰 Mars News",["The news ticker is now the Mars News, with real headlines from this server: the biggest raid of the day, the best defender, the busiest monster hunter, lost siege engines and the weather. Fewer jokes in between.","After time away, you get your own front page: a headline about you, what happened, and the news from elsewhere.","The ticker now scrolls at a steady, readable pace."]],["🎯 One number first",["Fields, Colony and Army now start with the one number that matters most: when storage is full, when the next build is done, and whether your defense holds a typical raid. All other numbers stay where they were."]],["🎲 Honest odds",["The send window now shows the win chance in percent, the expected losses and the expected loot, plus attack against defense before luck.","Battle reports start with a short Why: how attack and defense compared, luck, the air, morale, orders and the wall."]],["Guide",["New guide cards: Tribe quirks, Odds before you send."]]]},
  {v:"1.0.260",date:"2026-11-08",title:"Five acts, leagues and alerts",groups:[["🎭 Five acts",["Every round now runs in five acts, shown as a timeline at the top of your colony: 🛬 Landing, 🏗️ Expansion, 🗿 Discovery, 🏆 Relic Hunt and 🌌 Aurora. Each act changes one rule: specialisations open with Expansion, monster camps grow 25% stronger and richer with Discovery (50% with Aurora), and ⚡ Ion storms join the weather with the Relic Hunt."]],["🥔 Leagues",["Every week the players are split by points into four leagues: 🥔 Potato, 🪨 Boulder, 🌋 Volcano and 🌌 Star. Each week has one contest that rotates (loot, monster camps, defense, trade with other players), and every league has its own winner with a badge. Players shows your league."]],["🛬 Late landers",["Players who land after server day 7 get a production and build speed boost that fades over 7 server days: 2% per server day the server is old, at most 60%."]],["🎖️ Medals and titles",["When a round ends, its badges become medals on your profile for good, with the server they came from. Medals unlock titles for your name and commander (only for show)."]],["📲 Alerts with the game closed",["With attack alerts on, your phone or computer now also gets alerts when MarsL is closed: incoming attacks and raids, and finished construction while you are away."]],["🏛️ Hall of Fame",["Rounds show the server name and speed instead of a round number. Player names stay in the Hall of Fame for good."]],["Fixes and art",["Resource fields in other colonies no longer look fully grown at low levels.","New clay pictures for the nine special buildings of the specialisations.","The front page for visitors shows the current game, the Mission Board and the five acts."]],["Guide",["New guide cards: The five acts, Leagues, Medals and titles, Late landers."]]]},
  {v:"1.0.259",date:"2026-11-08",title:"Specialised colonies, weather and rich land",groups:[["🏷️ Colony specialisations",["At HQ level 10 a colony picks a specialisation: 🌾 Breadbasket (+10% food, troops here eat 15% less), 🏭 Industrial Town (+15% wood, stone and metal) or 🛡️ Garrison (+15% defense, training 15% faster).","Each opens a building of its own with 10 levels (with its own clay picture for every tribe): Breadbasket −1% upkeep, Industrial +1% wood, stone and metal, Garrison +1% defense per level. Every tribe names them its own way.","Changing later costs resources and tears the old special building down. The Army tab shows the Garrison bonus in the defense breakdown."]],["☁️ Sol forecast",["Every server day has weather, known a day ahead and shown at the top of your colony: dust storms, ice fog, marsquakes, trade winds, solar flares or a calm sol. They change production of single resources, market swap losses or merchant speed."]],["✨ Rich sites",["Eight rich sites per map quarter give a colony founded there +20% production for good. They open in waves on server days 2, 5 and 9; closed ones show a grey ✨. Only settlers can take them, new players never land on one, and the news bar reports every one that is taken."]],["Guide",["New guide cards: Colony specialisations, Sol forecast, Rich sites."]]]},
  {v:"1.0.258",date:"2026-11-08",title:"Air, ground, siege",groups:[["✈️ Three phases",["Battles against colonies now run air, then ground, then siege. The side that wins the air (attack air of at least 10% against their air units and a quarter of their ground anti-air) gets +15% in the ground phase. Bring no air force against a defender with air units and they win the sky.","Rams still hit the wall after a won attack, and now also at half strength after a close loss (80% of the defense or more). Envoys need ground troops alongside them, so an air-only army can't take a colony.","Monster camps, the Landing Zone and landmarks fight as before."]],["🏷️ Unit traits",["Every unit has one small rule, shown as a chip and a line on its card and in the guide: 🤝 Drilled (infantry), 🧱 Bulwark (defenders), 🎒 Quick hands (raiders), 🐾 Trample (heavies), 🛡️ Escort (fighters), 💣 Bombs away (bombers), 🔨 Wallbreaker (siege), plus the existing jobs of scouts, bombards, envoys and settlers."]],["🙅 Morale",["Attacking a player with fewer than a quarter of your points costs up to 30% attack and loot, scaled by the gap. Inactive colonies and monster camps never cost morale."]],["🧮 Verdict on the send screen",["The send window now shows the simulator's verdict for your selection: sure win, likely win, risky or likely loss, with the expected losses. Monster camps are always known; colonies need a spy report. The simulator, reports and verdict show who won the air, which traits worked and morale."]],["Commander",["Explorer 50 now holds two more adventures on the board (6 instead of 4) instead of revealing armies in spy reports."]],["Guide",["New guide cards: Air, ground, siege; Unit traits; Morale. Units show their trait in the troop table."]]]},
  {v:"1.0.257",date:"2026-11-08",title:"Commanders with character",groups:[["📯 Battle orders and stances",["When the commander goes along on an attack or raid, pick one order: ⚔️ Charge (+15% attack, +10% own losses), 💰 Pillage (+30% carry, −10% attack) or 🎯 Precision (+25% bombard power, attacks on colonies with bombards only).","At home the commander holds a stance: 🏰 Fortify (+15% defense against Charge), 🌵 Ambush (+20% defense against Pillage) or 🏃 Evacuate (bunkers hide 30% more, −10% defense, bombards lose their aim). Every order beats one stance and loses to another.","Battle reports show the order and the stance it met. Small ? buttons explain the rules."]],["🎭 Archetypes",["At level 10 the commander picks Warlord, Quartermaster or Explorer. Each opens three skills, and the points in them unlock rules at 25, 50, 75 and 100 (for example Explorer 50: two more adventures on the board).","🎒 Logistics and ⛏️ Foreman are now Quartermaster skills. Commanders from before keep them until they choose; another archetype gives the points back. 🔄 Reset skills lets you choose again."]],["🎲 Quirks",["From level 5 every commander has one quirk with an upside and a downside: 🍗 Glutton, 🎺 Show-off or 🐔 Coward. Reroll it once per round."]],["🐐 Adventure events",["Every adventure ends with a little event on the way home: two choices, with their cost and odds shown before you pick."]],["Guide",["New guide cards: Battle orders and stances, Archetypes, Quirks. The commander and adventure cards are updated."]]]},
  {v:"1.0.256",date:"2026-11-08",title:"A better first three days",groups:[["📋 Mission Board",["Quests, journey chapters, the daily supply, milestones and the shared server goal now live on one board on the left. It shows three missions at a time: one to build, one for the army and one out in the world. A finished mission is replaced right away, and a mission that is already done moves to the front of its row.","On top: the current chapter (with its reward), the daily supply with its streak, and the reward storage. At the bottom: today's server goal and progress to your next badge.","New badges for finished missions: 📋 10, 🗂️ 30 and 🏅 60 missions. Joining or founding an alliance pays a one-time reward on the world card.","When the army or world missions run out, those rows turn into daily tasks (train 50 troops, clear nearby camps, the weekly camp hunt).","All opens the full mission list of the colony in order, with Skip, plus the tasks and server goals. Milestones (second colony, first landmark) are celebrated on the board instead of a pop-up.","On phones the slim line shows the most useful mission; Board opens all three."]],["🦂 First defense",["During the landing tour, right after the wrecked lander, a pack of four Dust Scorpions attacks the new colony about 90 seconds later. They show up in Troop Traffic and the attack alert like any raid, always lose, and leave your first defense report."]],["🎓 Graduation and insurance",["In the last 24 hours of beginner protection the protection bar shows a graduation check: resources raiders could take, what the bunkers hide, and your defense against a typical raid. Graduate early to end protection and collect a reward plus the 🎓 badge.","Mars Mutual Insurance: after protection, the first two heavy losses (at least a quarter of your stock) are partly covered. 30% of what was stolen comes back the next morning into your reward storage, with a claim letter in your reports."]],["📋 Plan queue",["Two free plan slots behind the build queue. When an upgrade can't start because the queue is full or resources are missing, tap 📋 Plan it: the job starts by itself as soon as it can, even while you are offline.","The Construction panel lists planned jobs with their cost, a rough time until affordable and what they wait for. Their cost is held back from trade routes."]],["Fixes",["After opening the report of the lander raid, the tour no longer jumps away from the report.","Journey chapter titles no longer repeat their number."]],["Guide",["New guide cards: Mission Board, Graduation and insurance, The plan queue. The landing, daily supply, milestones and first hours cards are updated. Small ? buttons open the right card."]]]},
  {v:"1.0.255",date:"2026-11-08",title:"Faster loading",groups:[["Speed",["The game page and big answers from the server are sent compressed: the page download shrinks from about 1 MB to about 270 KB.","Pictures are only downloaded again when they really change, not after every game update, so updates load much faster for returning players."]]]},
  {v:"1.0.254",date:"2026-11-08",title:"Map events in clay",groups:[["Map",["Meteor crates, wrecked landers, wandering traders and supply caravans are clay pieces on the map. Meteors still glow gold, landers blue, and used traders are faded.","Boulder Fields show clay boulder piles, so they are easy to spot."]]]},
  {v:"1.0.253",date:"2026-11-08",title:"Every landmark in clay",groups:[["Map",["The Golden Egg and the Abandoned Guitar are clay pieces on the map too, like all other landmarks."]]]},
  {v:"1.0.252",date:"2026-11-08",title:"Wilder monster camps",groups:[["Map",["Monster camps are spread more randomly: more lone camps, and groups are loose clusters with gaps and diagonals instead of tight blocks. Camps never form a 2x2 square any more.","Every quarter of the map still gets the same number and strength of camps, so no start is luckier than another.","Running worlds keep their current camps; the new layout arrives with the next new round or map reset."]]]},
  {v:"1.0.251",date:"2026-11-08",title:"Better canyons",groups:[["Map",["Giant Canyons are drawn as one continuous gorge: a single cliff wall follows the whole outline with rounded outer corners and curved inner corners, and a soft shadow falls from the wall onto the canyon floor.","The canyon floor and the plains around it no longer show tile lines.","Narrow canyons one tile wide keep a visible floor between their two walls."]]]},
  {v:"1.0.250",date:"2026-11-08",title:"Pylons, Landing Zone, canyons and the end of a round",groups:[["Map",["The four Aurora pylons and the Landing Zone are clay pieces. A pylon’s lamp glows blue once it is fully charged.","Mountains have new top-down rock shapes.","Giant Canyons have a real cliff rim: every side that borders other land shows the canyon wall, with curved corners, so a canyon reads as one connected gorge."]],["Server won",["When an alliance lights the Aurora, the round is over: all builds, training, research, healing, terraforming and troop movements stop at once (troops on the road are home again), and new actions are no longer accepted.","A window shows the winning alliance, its members and when the next round starts. Close it to look around."]],["Changes",["Potato Paradise colonies now have 1 wood, 1 stone, 1 metal and 9 food fields (new colonies).","The commander’s Foreman production is rounded instead of showing long decimals.","The “Reading the screen” page was removed from the wiki."]]]},
  {v:"1.0.249",date:"2026-11-08",title:"Clay ground for the whole map",groups:[["Map",["The map ground is now hand-made clay: one seamless texture runs under every tile, so there are no squares or seams any more.","Sand Dunes, Boulder Fields, Giant Canyons and the Edge of the Map each have their own clay ground.","Mountains, Craters, Volcanoes and Polar Ice are now clay pieces; neighbouring tiles pick different mountain and ice shapes so ranges look natural.","Nothing changed in what you can see or click: names, markers, movement signs, field mixes and the Landing Zone are all still shown."]]]},
 {v:"1.0.248",date:"2026-11-08",title:"A calmer map",groups:[["Map",["The map ground is one calm clay colour family without grid lines. Mountains and rocks are drawn in the same clay style instead of emoji, canyons are softer, and the small field-mix symbols sit quietly in the corner of their tile.","Colonies, monster camps and landmarks are a bit larger than their tile, so they stand out at a glance."]],["Army",["On the unit cards the name has its own line and the role tag (Infantry, Defender, Scout...) never breaks in two."]]]},
 {v:"1.0.247",date:"2026-11-08",title:"Clay troops",groups:[["Army",["Every unit of every tribe now has its own clay figure: from the Crater Grunt and the Rover Tank to the Peckling, the Turkey Tank, the Goo Blob and the Overmind in its jar. They appear in the training lists, research, upgrades and in the troops-at-home row.","The map is clay now as well: colonies show their tribe\u2019s little town, which grows in three sizes with the colony\u2019s points, monster camps show their lair (a scorpion mound, a troll cave, a kraken crater...) and landmarks show what they are, from the Lost Rover to the Single Sock. Your own colonies glow yellow, allies mint, enemies at war red. Every marker, timer and label on the map is unchanged.","Your commander has a clay figure too: an astronaut captain, a rooster general or an alien leader with a glowing crown, on the commander button, the sidebar chip and the commander sheet.","All numbers, costs, timers and buttons are unchanged. Battle reports keep their small icons so they stay compact and fit on one screen."]]]},
 {v:"1.0.246",date:"2026-11-08",title:"Fonts found automatically",groups:[["Behind the scenes",["The game now finds its font files in the fonts folder by itself, whatever they are called, so fonts downloaded from fonts.google.com work without renaming."]]]},
 {v:"1.0.245",date:"2026-11-08",title:"A new start page",groups:[["Start page",["The start page for new players opens with a big clay picture of a Mars colony, next to a real screenshot of the Fields tab.","The three tribes are shown with their mascots: the astronaut, the chicken and the alien.","All screenshots further down are new and show the game as it looks today."]]]},
 {v:"1.0.244",date:"2026-11-08",title:"No missing fonts",groups:[["Fixes",["The page only asks for font files that are really on the server, so the browser no longer reports missing fonts."]]]},
 {v:"1.0.243",date:"2026-11-08",title:"Safer connection",groups:[["Behind the scenes",["On https the game now tells the browser to load every part of the page over the secure connection only, and to remember for a year that MarsL always uses https."]]]},
 {v:"1.0.242",date:"2026-11-08",title:"Tribe fields",groups:[["Fields",["Chickens and Aliens now have their own clay fields. Chickens grow Twig Groves, dig Pebble Pits, sort Shiny Scrap Heaps and keep Worm Farms. Aliens grow Fungus Forests, mine Crystal Quarries, pull in meteors with Meteor Magnets and brew Goo Vats. Each field still has a small, a medium and a large stage."]]]},
 {v:"1.0.241",date:"2026-11-08",title:"Lighter game file",groups:[["Behind the scenes",["The clay pictures for fields, mascots and buildings now load from their own folder instead of being packed into the game file, so the game starts faster. Nothing changes in how the game looks or plays."]]]},
 {v:"1.0.240",date:"2026-11-08",title:"Readable legend",groups:[["Look",["The small colour legend under the Fields and Colony plateaus (can upgrade, max level, building, free lot) now sits on its own white pill below the plateau, so the plateau art never covers it."]]]},
 {v:"1.0.239",date:"2026-11-08",title:"Every Alien building in clay",groups:[["Colony",["All 21 Alien buildings now have their own clay model on the Colony tab, from the Mothership Core and the Clone Lab to the Barter Portal, the Saucer Dock and the Crusher Forge. Every tribe now has its full building set."]]]},
 {v:"1.0.238",date:"2026-11-08",title:"Every Chicken building in clay",groups:[["Colony",["All 21 Chicken buildings now have their own clay model on the Colony tab, from the Royal Coop and the Corn Silo to the Seed Market, the Flight School and the Mud Fortress. Alien colonies keep the plain clay discs with icons until their set is ready.","On computers the colony plateau can now grow bigger (up to 760 px wide), so the buildings have more room. Phones are unchanged."]]]},
 {v:"1.0.237",date:"2026-11-08",title:"A calmer colony",groups:[["Colony",["The colony slab is bigger and the buildings a little smaller, so every building stands fully on the plateau with clear space around it."]]]},
 {v:"1.0.236",date:"2026-11-08",title:"Every Human building in clay",groups:[["Colony",["All 21 Human buildings now have their own clay model on the Colony tab: the expansion office, hidden bunker, expedition base, trade post, sawmill, brick kiln, iron foundry, space bakery, hydroponic dome, sky hangar, med bay, trap field and bastion join the ones from before. Chicken and Alien colonies keep the plain clay discs with icons until their own sets are ready."]]]},
 {v:"1.0.235",date:"2026-11-08",title:"More clay buildings",groups:[["Colony",["New clay slab for the Colony tab: a smooth raised plateau with a small border of pebbles and sprouts, so the lots have more room.","Human colonies get three more clay buildings: science lab, armory and siege workshop."]]]},
 {v:"1.0.234",date:"2026-11-08",title:"The clay colony",groups:[["Colony",["The Colony tab is now a wavy clay slab like the fields: the headquarters in the middle, 8 lots around it and 12 on the rim. Free lots show a dashed circle with a plus.","Human colonies get the first clay buildings: headquarters, barracks, storage dome, food silo and defense wall. All other buildings (and the other tribes for now) show their icon on a plain clay disc until their own pictures arrive.","Buildings now show the same small level tags as the fields: a mint arrow when you can upgrade now, sunflower at max level, dashed while it is being built. The grouped list underneath is unchanged."]]]},
 {v:"1.0.233",date:"2026-11-08",title:"Bigger fields",groups:[["Fields",["The fields on the plateau are about a quarter bigger and the oval uses the whole width, so every field is easier to see and tap. They still keep a small gap to each other."]]]},
 {v:"1.0.232",date:"2026-11-08",title:"Room to breathe",groups:[["Fields",["The 12 fields on the oval plateau are now spaced evenly all the way round, so the fields on the sides no longer touch."]]]},
 {v:"1.0.231",date:"2026-11-08",title:"A bigger fields plateau",groups:[["Fields",["The Fields plateau is now a large oval clay slab that fills the screen width. The 12 fields stand on a ring around it, and your mascot stands bigger in the middle, where no field ever covers it. Tags, timers and the list below are unchanged."]]]},
 {v:"1.0.230",date:"2026-11-08",title:"Tidy level tags",groups:[["Fields",["The level numbers on the Fields plateau are now small white tags that always sit in the same place: on the front rim of their own field. A mint arrow in the tag means you can upgrade that field now, a sunflower tag means max level, a dashed tag means it is being built.","The mascot stands a little further forward, so no tag is ever hidden behind it.","New picture for the medium farm stage: rows of potatoes and lettuce."]]]},
 {v:"1.0.229",date:"2026-11-08",title:"Clay fields",groups:[["Fields",["Every resource field on the Fields tab is now a little clay model that grows with its level: bare ground at level 0, then a small, a medium and a large stage. Trees fill the groves, the quarries dig deeper, the mines get cranes and conveyor belts, the farms move into hydroponic frames. In the main colony the stages change at levels 7 and 15, in other colonies at 4 and 8.","Your tribe’s mascot (astronaut, chicken or alien) stands in the middle of the plateau on its own clay base. Tap it to enter the colony.","Nothing else changed: each field still has its level coin (mint = can upgrade now, sunflower = max level, a dashed yellow ring while it is being built), and the list below still shows every field with its level, production per hour and build timer."]]]},
 {v:"1.0.228",date:"2026-11-08",title:"A mint L",groups:[["Look",["The L in the MarsL logo is now mint green with its own thick edge, so the name has a little accent that matches the Go buttons. It shows in the game header, the start page and the emails."]]]},
 {v:"1.0.227",date:"2026-11-08",title:"Mail in the new look",groups:[["Look",["Confirmation and password emails use the new MarsL look: a white card on the warm Mars sky, the MarsL logo and a big mint button. The pages those links open (email confirmed, new password, link expired) match it too."]]]},
 {v:"1.0.226",date:"2026-11-08",title:"Every icon drawn",groups:[["Look",["All three tribes now have their own drawn units, buildings and fields: Pecklings, Turkey Tanks and the Royal Coop, Crater Grunts, Rover Tanks and the Command Center, Grey Troopers, Flying Saucers and the Mothership Core, and all the rest. The monsters, the tab bar and around 80 interface icons (targets, quests, mail, maps, timers, flags, alliances and more) are drawn too.","The colony plateau shows each building’s drawn icon on its block.","Icons look the same on every phone and computer. Every number, label and tooltip next to them is unchanged; tooltips, menus and messages that can only show text keep the plain emoji."]]]},
 {v:"1.0.225",date:"2026-11-08",title:"Our own icons",groups:[["Look",["The first set of MarsL’s own icons replaces the phone emoji everywhere in the game: wood, stone, metal, food, attack, defense, health, experience, rewards, the storage-full hourglass, speed-ups and trophies. They look the same on every phone and computer and match the new style. Every number and label next to them is unchanged."]]]},
 {v:"1.0.224",date:"2026-11-08",title:"The colony playset",groups:[["Colony",["The round colony plan is now an isometric plateau like the fields: the HQ in the middle, eight lots around it and twelve on the rim. Every building is a block that grows taller with its level; purple blocks are core buildings, yellow ones economy, red ones military. Free lots show a dashed outline with a plus, buildings under construction a dashed yellow outline. Tap a lot to open it.","No numbers clutter the plateau: a small mint dot marks buildings you can upgrade now, a yellow dot maxed ones. Every level is in the grouped list underneath, coloured the same way."]],["Commander",["⛏️ Foreman production no longer stops while the commander is away, travelling, on an adventure or recovering. It always produces in its home colony.","📦 The bounty stash can be collected into any of your colonies: it goes into the colony you are looking at, and the 📦 chips on missing build costs work in every colony."]],["Fixes",["The quest panel on the left never scrolls sideways.","On the fields plateau the level coins sit on the outer rim, so none of them covers your tribe’s mascot in the dome."]]]},
 {v:"1.0.223",date:"2026-11-08",title:"A calmer field view",groups:[["Fields",["The ring of field buttons is replaced by a small isometric plateau: your twelve fields sit around the dome with your tribe\u2019s mascot inside. Each field shows what it makes (trees, potatoes, rocks, crates) and one level coin: mint when you can upgrade it now, sunflower when it is maxed, a dashed yellow outline while it is being built. Tap a field or its coin to open it, tap the dome to enter the colony.","Below it, one tidy list groups the fields by resource: production per hour for each resource, and every field with its level, production and build timer (or \u201cqueued\u201d)."]]]},
 {v:"1.0.222",date:"2026-11-08",title:"Toybox Mars",groups:[["New look",["MarsL has a new art direction: a sunny Martian afternoon sky, white rounded panels, squishy buttons that press down, and one colour per meaning everywhere. Mint means go (build, train, confirm), tomato means fight or danger, sunflower means rewards, grape marks you and the active tab.","The bottom tab bar is a white dock; the active tab rises in grape. Tabs inside panels are a tray with a white sliding thumb. Values and inputs sit in soft recessed wells, timers and the news bar in dark capsules.","New fonts: Fredoka for titles, buttons and numbers, Figtree for everything you read.","The homepage for visitors uses the new look."]],["Battle reports",["Reports are one compact card that never scrolls sideways. All unit columns of a tribe share the width, so a whole report fits on a phone screen and can be shared as one screenshot.","Victory is a mint strip, Defeat a tomato strip, both with attack and defense. The attacker block is tinted yellow, the defender block lilac."]],["Nothing removed",["Every number, timer and helper stays where it was: storage full times, production per hour, queue and troop timers, costs and missing resources, tooltips and stats."]]]},
 {v:"1.0.221",date:"2026-11-07",title:"A front door for Mars",groups:[["Homepage",["Visitors who are not logged in now land on a homepage first: what MarsL is, the three tribes, real screenshots of a colony, the army and the map, how a round is won and which servers there are. Play for free and Log in lead to the usual forms, and the forms have a link back."]],["Fixes",["Milestone pop-ups (like your second colony) and the “While you were away” summary were never stored as seen, so they came back after every reload. They now show once, whichever button you use to close them.","The Project Aurora ignition countdown no longer stands still and jumps every 30 seconds. It now counts down smoothly to the real ignition time."]]]},
 {v:"1.0.220",date:"2026-11-07",title:"Calmer screens",groups:[["Interface",["Milestone pop-ups (like your second colony) show once: closing them with the X no longer brings them back. The quest hint is a normal card at the top of the Fields page instead of a banner floating over your colony. The build hint no longer sends you to the page you are already on, and only suggests things you can actually build or upgrade."],["Commander",["Adventure cards are rebuilt: a clear title, one line of details and two buttons side by side (Safe, Risky). Skill levels show as a slim bar instead of up to 100 dots, so the commander panel fits your screen again."]]]]},
 {v:"1.0.219",date:"2026-11-06",title:"Clearer progress",groups:[["Interface",["Removed Progress and Share from the colony title. Progress is reached from quests and settings; sharing is under Invite friends. Separate Journey, My tasks and Server goals tabs replace the nested rewards panel. Goals explain what counts, whose progress is shown and when each reward is available."]]]},
 {v:"1.0.218",date:"2026-11-06",title:"Camp rewards and report status",groups:[["Camp economy",["Treasure now scales with defender numbers on every speed. Per-kill trophies no longer shrink as movement speed rises. Treasure refills over 24 movement-speed hours, while monsters keep their existing regrowth. Speed configurations where production outruns movement receive a bounded reward adjustment. Existing depleted camps refill naturally; no defenders or treasure are reset.","Opening a report immediately removes only its own NEW tag; other reports stay unread."]]]},
 {v:"1.0.217",date:"2026-11-06",title:"Correct recruitment guidance",groups:[["Guidance",["Expansion instructions name the tribe’s actual settler and training building. The expansion office is described as a prerequisite, not the recruitment location. Chapter titles, scout prompts and training tutorials use tribe-specific names."]]]},
 {v:"1.0.216",date:"2026-11-06",title:"Plan your next move",groups:[["Planning",["Saved army templates load counts for review. Building advice prioritizes food and quest prerequisites. Chapter transitions are recorded for owner analysis. Public aggregate activity is available at /activity. Mobile controls and keyboard focus indicators are refined."]]]},
 {v:"1.0.215",date:"2026-11-06",title:"Farm troop presets",groups:[["Farm lists",["Each list stores a troop preset for new targets. Adding a target previews editable troop counts before confirmation. Apply the preset to multiple checked targets together."]]]},
 {v:"1.0.214",date:"2026-11-06",title:"Commander progression",groups:[["Commander",["Level cap 100, four points per level and expanded skill caps. Foreman produces locally only while idle at home. Inventory gear can gain five upgrade ranks with resource investment or discounted duplicate consumption.","Shorter adventures replenish every two server hours. Safe and dangerous routes trade health for rewards; rewards scale with commander level. Deep journeys can find a cosmetic title, dangerous trips can find rare Star Metal. Fallen recovery and XP penalties are reduced."]]]},
 {v:"1.0.213",date:"2026-11-06",title:"Your tribe’s journey",groups:[["Quests",["Journey chapters and Next Step buttons use the active colony tribe’s building, scout and settler names."]]]},
 {v:"1.0.212",date:"2026-11-06",title:"A calmer colony page",groups:[["Management",["Progress, rewards and server events now have a dedicated Progress panel. Settings supports cancellable deletion of all colonies on this server after 48 hours; the account and other worlds remain."]]]},
 {v:"1.0.211",date:"2026-11-06",title:"Share your Mars",groups:[["Community",["Share battle summaries, colony introductions and landmark claims through your device or clipboard."]],["Progress",["Daily camp contracts earn modest consecutive-day bonuses. A personal weekly hunt rewards seven camp victories. Server selection explains each world."]]]},
 {v:"1.0.210",date:"2026-11-06",title:"Faster colony management",groups:[["Farm lists",["Review troop demand before sending, select ready targets in bulk, copy troop presets, and stop pending raids. Duplicate destinations and targets already en route are skipped."]],["Overview & mobile",["Filter colonies needing attention and review all travelling armies in arrival order. Compact farm rows expand for editing, with larger mobile controls."]]]},
 {v:"1.0.209",date:"2026-11-05",title:"A busier Mars and a clearer next step",groups:[["Settlements",["Five persistent personalities use a target mix of 40% farmers, 25% builders, 20% raiders, 10% landmark hunters and 5% sleepers. Each has distinct paid construction, research, recruitment and activity priorities. Existing accounts migrate without being replaced.","Default population targets 22 NPCs, with 18–25 according to the population setting. Above 30 recently active human accounts, targets taper and attacks become less frequent. Arrivals and retirements are staggered.","Farmers revisit one or two non-exclusive camp routes. Raiders may attack weak NPC colonies, never human colonies. Camps near protected players and targets with human armies approaching are left alone.","Hunters can contest neutral or NPC-held landmarks and the Landing Zone using real armies. At most two objective locations may be occupied or reserved by NPCs; they eventually withdraw. Human-held objectives are never attacked and NPCs cannot win the Relic Hunt. A few mature farmers and builders can fund one second colony through normal settler and terra requirements; at most three NPC accounts expand. Own-colony troop transfers use normal support and recall movements."]],["Quests",["A compact Next Step tracker stays on the left on desktop and above navigation on mobile. It links to the required building, training, research or practice target, and chapter claims celebrate completion.","Protected players see recommended practice camps on the map. Recommendations use current troops and estimated losses; colony targets require scouting and are suggested only outside protection.","Returning after more than 48 hours credits a small Welcome Back package to the reward reserve and highlights the current quest, at most once per week. After the main journey, daily camp and 50-troop training tasks remain available."]]]},
 {v:"1.0.208",date:"2026-11-05",title:"Flag rendering and settlement growth",groups:[["Profiles",["Country flags now use bundled SVG artwork, including live previews in the selector, so they display on Windows and mobile without emoji support or external image requests."]],["World",["Repaired stacked settlement visit delays. Existing accounts resume at staggered times; young settlements visit more frequently, establish fields and barracks, then settle into individual slower schedules. Construction and training still use paid resources and normal queues."]]]},
 {v:"1.0.207",date:"2026-11-05",title:"Compact progress panel",groups:[["Interface",["Removed the recruitment action button, compacted journey and reserved-supply rows, and shortened goal controls. Rewards appear as action buttons only when ready. Mobile controls wrap and retain comfortable tap targets."]]]},
 {v:"1.0.206",date:"2026-11-05",title:"Clear objectives for Mars",groups:[["Community",["Secure the outskirts: a daily shared monster-camp hunt. Clear the frontier: a weekly camp-clearing campaign. Only victories over occupied camps count; resource donations and quest claims no longer advance these goals. Targets scale to human activity, with personal participation rewards and a shared completion bonus. The new campaigns start with fresh progress."]]]},
 {v:"1.0.205",date:"2026-11-05",title:"Allies, expeditions and a foothold on Mars",groups:[["Progression",["Seven persistent account chapters lead from production to a 50-unit army and a second colony. A recovery package is offered after 48 hours away, at most once per week."]],["Community",["Recruitment board promoted to the home page with the existing looking-for-alliance toggle. Daily and weekly shared objectives scale to recent human activity; any participation earns a reward and completion earns a bonus."]],["Expeditions",["Daily rotating camp contracts reward one to three camp victories. Relic Hunt and Aurora progress now appears on the home page."]]]},
 {v:"1.0.204",date:"2026-11-05",title:"More active settlements",groups:[["World",["All NPC personalities now occasionally raid nearby monster camps. Explorers go most often, builders less often and farmers rarely; raids keep most troops home and skip camps already targeted by another army."]]]},
 {v:"1.0.203",date:"2026-11-05",title:"Expanded NPC name pool",groups:[["World",["Added unique player handles from the requested Portal 2 No SLA leaderboard page. Existing names are kept once, case-insensitively."]]]},
 {v:"1.0.202",date:"2026-11-05",title:"Expanded NPC name pool",groups:[["World",["Added additional unique player handles from Pokémon FireRed/LeafGreen, Pokémon Crystal, Mystery Dungeon Red/Blue, Dark Souls and Dark Souls III leaderboards. Duplicate handles are skipped."]]]},
 {v:"1.0.201",date:"2026-11-05",title:"Fresh NPC registrations",groups:[["World",["Existing NPC accounts are replaced once on startup. New NPCs use the shared registration spawn algorithm: settlement ring, nearby space, neighbour spacing and strong-player avoidance, with quadrant population balancing. Incoming troops return home when an old NPC colony is removed. Human accounts are preserved."]]]},
 {v:"1.0.200",date:"2026-11-05",title:"Settlement name pool",groups:[["World",["New NPC accounts use the owner-selected leaderboard name pool with duplicate prevention. Existing accounts retain their names."]]]},
 {v:"1.0.199",date:"2026-11-05",title:"Varied settlement growth",groups:[["World",["NPC settlements have individual growth speeds, broader size variation, small gradual growth goals and occasional long idle periods. Construction and training continue to consume real resources. Missed sessions never cause catch-up bursts."]]]},
 {v:"1.0.198",date:"2026-11-05",title:"Natural camp variety",groups:[["Map",["Camp groups favour singles (50%), pairs (27%), trios (15%) and groups of four (8%), using shuffled size mixes and varied gaps. Quadrants retain identical camp counts, difficulty and rewards. Existing colonies remain protected."]]]},
 {v:"1.0.197",date:"2026-11-05",title:"Living settlements",groups:[["World",["NPC settlements build small markets and send occasional real resource caravans to nearby NPC neighbours with storage space. Shipments use paid resources and available merchants, retain 75% reserves and carry at most one merchant-load. Profiles display agricultural, industrial or expedition roles."]]]},
 {v:"1.0.196",date:"2026-11-05",title:"Consistent colony combat rules",groups:[["Combat",["Hostile missions against NPC colonies now end beginner protection and respect the target’s protection. Colony raids use the same minimum troop count, and commanders require troop escorts against all colonies."]]]},
 {v:"1.0.195",date:"2026-11-05",title:"Quadrant population",groups:[["World",["Automatic NPC population targets 15 inactive accounts plus NPCs per quadrant. Inactive means no activity for seven days. Counts refresh each population tick; busy or young NPCs retire safely later. NPC profiles are identified. Manual population settings remain available.","Camps now form irregular groups of one to four, separated from other groups. Rotated layouts keep quadrant counts and strength equal."]]]},
 {v:"1.0.194",date:"2026-11-05",title:"Scattered monster camps",groups:[["Map",["Camps now occupy separate 5×5 districts with at least three tiles between camp centers. Balanced rotational placement spreads camps across terrain types instead of clustering on rocky terrain. Existing colonies and objective clearances are protected."]]]},
 {v:"1.0.193",date:"2026-11-05",title:"Expanded world",groups:[["World",["Map expanded to coordinates −100 through 100. Camps target 10% tile coverage, with equal tier counts and camp-kind mixes across quadrants, protected objective clearances and no edge-adjacent camps. Camp difficulty bands extend to 35/65/90 tiles; treasure capacity is halved, treasure refills over 48 game hours, and monsters regrow over 8 game hours to moderate farming."]]]},
 {v:"1.0.192",date:"2026-11-05",title:"Profile country flags",groups:[["Profiles",["Players can select up to three optional country flags on their own profile. Flags appear publicly; each slot can be cleared."]]]},
 {v:"1.0.191",date:"2026-11-05",title:"Mid-tier upkeep",groups:[["Balance",["Turkey Tank, Rover Tank and Tentacle Titan upkeep is 3/4/4. All bombers cost 4 upkeep. Siege remains 3/3/4. Human and Alien infantry, defender, raider and heavy stat adjustments are included."]]]},
 {v:"1.0.190",date:"2026-11-05",title:"Troop role balance",groups:[["Balance",["Updated infantry, defenders, raiders, fighters, bombers and siege across all tribes. Heavy attack is reduced; Turkey/Rover/Titan upkeep is 3/4/5. Raider carry is 85/125/145. Combined Arms remains 7%."]]]},
 {v:"1.0.189",date:"2026-11-05",title:"Distinct troop roles",groups:[["Balance",["Peckling: attack 22, ground defense 16, air defense 9; carry remains 35. Rooster Guard: attack 9, ground defense 48, air defense 38, upkeep 2; speed 7 and carry 15 unchanged. Dust Dasher carry rises to 85.","Combined Arms now grants 7% attack when ground and air each supply at least 20% of attack strength. Existing role-based upkeep and tribe perks are preserved."]],["Simulator",["Expandable attack contribution table shows combat strength and percentage by unit type, including the commander and combat bonuses."]]]},
 {v:"1.0.188",date:"2026-11-05",title:"Unit upkeep roles",groups:[["Balance",["Upkeep now follows the requested role bands. Defender upkeep is 2, heavy units are capped at 3, and siege units cost at least 3 upkeep. Scouts remain at 1; infantry and raiders at 1–2; bombers, bombard units and envoys remain within 3–6."]]]},
 {v:"1.0.187",date:"2026-11-05",title:"Uniform compact inbox rows",groups:[["Inbox",["All collapsed reports now share a compact row height on desktop and mobile. Long battle titles truncate within their column, while status badges stay inline and no longer push battle reports taller than other rows."]]]},
 {v:"1.0.186",date:"2026-11-05",title:"Clear inbox battle titles",groups:[["Inbox",["Attack, raid and scout previews show both players and their colonies using the identities recorded in the report. Titles wrap to remain readable. Existing reports gain these titles wherever their stored data includes both sides."]]]},
 {v:"1.0.185",date:"2026-11-05",title:"Uniform army columns",groups:[["Reports",["Removed the Unit label column. Each known army shows its full tribe roster in a fixed order, with zeros for absent units; monster armies show every monster type. Icons have unit-name tooltips. Unknown enemy armies remain unknown."]]]},
 {v:"1.0.184",date:"2026-11-04",title:"Traffic grouped by destination",groups:[["Troop Traffic",["Helping-out groups at the same target show combined unit totals and expandable individual detachments. Expanded entries retain their own recall and redirect details. Other traffic groups now also respect destination, keeping separate targets distinct."]]]},
 {v:"1.0.183",date:"2026-11-04",title:"Choose hospital healing",groups:[["Hospital",["Choose how many troops of each type to heal, with per-type Max, Select all and Clear. The selected batch shows its cost and healing time before starting."]]]},
  {v:"1.0.182",date:"2026-11-04",title:"Battle report refinement",groups:[["Reports",["Softer paper colors, subtle separators, aligned numbers, compact resource chips and reduced row spacing. The existing report order and layout are preserved."]]]},
  {v:"1.0.181",date:"2026-11-04",title:"Map action fix",groups:[["Fixes",["Fixed an undefined-variable error that prevented the troop dialog from opening for map raids, attacks, scouting, reinforcements and settlement. Failed troop refreshes now display an error."]]]},
  {v:"1.0.180",date:"2026-11-04",title:"Compact battle reports",groups:[["Reports",["Reduced army header, unit cell, cargo and statistics spacing. Resource icons and amounts share a compact row; colony owners sit beside army names. The stacked report layout is preserved."]]]},
  {v:"1.0.179",date:"2026-11-04",title:"Screenshot-style battle reports",groups:[["Reports",["Stacked attacker and defender sections with horizontal unit icons, troop counts and red casualty rows. Loot and commander bounty sit between armies; a compact comparison table follows. Secondary events are folded below the main report."]]]},
  { v: "1.0.178", date: "2026-11-04", title: "Reliable colony and alliance controls",
    groups: [["🛠️ Interface", [
      "Delayed colony refreshes can no longer replace a newer colony screen, trigger an outdated respawn screen or clear the busy flag of a newer refresh.",
      "Failed server refreshes preserve your current game screen instead of rendering an error as colony data.",
      "Repeated alliance and profile submissions are blocked while pending. Connection failures show an actionable message.",
      "Delayed report responses cannot overwrite newer reports or changes made while the request was in flight."
    ]]]
  },
  {
    v: "1.0.177", date: "2026-11-04", title: "Clear battles and a fairer Aurora",
    groups: [
      ["📬 Battle reports", [
        "Result, your casualties and survivors, named unit tables, visible loot resources and cargo capacity. Commander bounty is shown separately.",
        "Reinforcement owners see their own casualties in new reports; older reports explicitly mark unavailable personal losses. Recruitment value is not labelled as battle profit.",
        "Unread and Aurora filters, responsive report layouts and clearer combat modifiers."
      ]],
      ["🌌 Aurora", [
        "Every alliance has the same pylon goal, fixed when Aurora starts from active main-colony production. Goals are bounded at 30,000–60,000 times storage scaling. Existing completed pylons stay completed.",
        "25%, 50% and 75% checkpoints protect contributed resources. Raids drain only unprotected charge, at most 10% of the goal.",
        "Incoming deliveries count against remaining needs. Surplus or invalid-round cargo returns with its merchants. The contribution panel separates delivered, incoming, protected and outstanding resources.",
        "Ley links reach 9 tiles. Ignition defaults to 24 hours at normal speed and 3 hours on SpeedTest. Interrupted ignition pauses, then decays at half speed after a recovery window. A rival starting ignition replaces the previous attempt.",
        "Fresh Classic schedules use server days 7 / 21 / 60 for landmarks / relics / Aurora. Owner-saved schedules are preserved."
      ]],
      ["🛠️ Usability and verification", [
        "Duplicate pending actions are blocked; stale polling responses cannot overwrite completed actions. Polling backs off while actions are pending.",
        "A visible version badge and /api/build identify the running build. The main game page is served without browser caching.",
        "Includes the commander, tribe-power and active-bot changes from 1.0.176."
      ]]
    ]
  },
  {
    v: "1.0.176", date: "2026-11-03", title: "Commanders, tribe balance and active colonies",
    groups: [
      ["🎖️ Commanders", [
        "Strength gives 12 attack and defense per point, up to 10 points. Logistics gives 4% carry per point. Foreman gives 8/h of each resource and 1.5% production per point.",
        "Each tribe path gives 1.5% per point. Army attack and defense bonuses cap at 30%, carry at 60%, production at 25%, and health protection at 40%. Gear bonuses also have limits.",
        "Alien mending helps surviving armies but cannot turn a complete defeat into survivors. The combat simulator now includes tribe-path bonuses and mending when loading your commander.",
        "Fallen commanders recover in half a server day and lose 10% of current XP progress. Everyone gets one free skill reset; points above the new skill limits are returned automatically. Levels and equipment are kept.",
      ]],
      ["✨ Tribe powers", [
        "Supply Drop gives two hours of one resource, limited to 20% of its storage. Its preview shows what fits; a full store does not waste the power.",
        "Hatch Day completes up to 20% of a queue within two base-speed hours of training. The preview shows exactly how many units hatch; huge queues no longer give unlimited instant troops.",
        "Mind Link cuts up to 25% of remaining work with a shared two-base-speed-hour budget and respects the 50% free-help limit. Stampede adds 35% cargo capacity. Recon and Cloak keep their distinct information roles.",
      ]],
      ["🤖 Active colonies and fixes", [
        "Fake players have persistent farmer, builder and explorer routines, specialize in a resource, and spend resources on normal construction and training queues. Their sessions adapt to server speed.",
        "Explorers occasionally raid nearby low-risk camps, keeping at least 60% of guards home and avoiding targets with incoming armies. They never attack players. Bots do not count as real players online.",
        "Automatic population now keeps 3-40 bots when real players are active; the owner's exact-count control is unchanged. Natural departures wait for all movements to clear. No missed-session action bursts after downtime.",
        "Automatic resource routes keep their scheduled cadence through delayed checks. Training duration cannot round to zero at extreme server speeds.",
      ]],
    ],
  },
  {
    v: "1.0.175", date: "2026-11-03", title: "Once is enough",
    groups: [
      ["🐛 Fixes", [
        "The 🌙 While you were away summary came back at every login if you closed it with ✖. It is now shown once, however you close it.",
      ]],
    ],
  },
  {
    v: "1.0.174", date: "2026-11-03", title: "Buttons that work",
    groups: [
      ["🐛 Fixes", [
        "The Read buttons and Welcome back in the 🌙 While you were away summary did nothing. They now open the report (or close the summary).",
        "The 📦 Build and Train buttons of the overflow tip were dead too, and work now.",
        "The same fight many times over (seven failed attacks on one camp) is now one line with ×7.",
      ]],
    ],
  },
  {
    v: "1.0.173", date: "2026-11-03", title: "Never miss a thing",
    groups: [
      ["🌙 While you were away", [
        "After at least 30 minutes offline, the next visit opens a summary: attacks on you held off or lost (and what was stolen), your own attacks (won or failed, loot), landmark events, new colonies and spy reports.",
        "The most important reports (lost fights and destroyed colonies first) are listed under 'Worth a look', each with a Read button.",
      ]],
      ["📦 Overflow tips", [
        "When a resource is 90% full or more, a strip on the Fields and Colony tabs suggests the best sink: the affordable build that uses the most of it (one tap), else training troops, else the market.",
      ]],
      ["🚨 Incoming attacks", [
        "The alarm now lists the next four arrivals, soonest first: ⚔️ attack, 💰 raid or ❓ for a cloaked army, countdown, sender, target colony and time.",
      ]],
      ["🪖 Army overview", [
        "Under your troops at home, a line shows how many troops are home, away and in training.",
      ]],
      ["📰 News ticker", [
        "25 new jokes.",
      ]],
      ["📖 Guide", [
        "New card: Staying on top of things.",
      ]],
    ],
  },
  {
    v: "1.0.172", date: "2026-11-03", title: "Better together",
    groups: [
      ["🛰️ Orbital Recon replaces Orbital Spotter", [
        "The Earthlings' war power no longer weakens the wall (it only ever counted for that one fight, but it was still too strong).",
        "🛰️ Orbital Recon: satellites watch the fight. Right after it you get a full spy report of the target colony: troops, reinforcements, buildings, resources, wall and bunker. It arrives even if your whole army falls.",
        "It still works once per server day (twice with a level-15 commander), only against other colonies.",
      ]],
      ["📣 Alliance markers", [
        "Tap any place on the map, then 📣 Mark for my alliance. Pick 🎯 Target, ⚠️ Danger, 🛡️ Needs help or 🌾 Farm and add a short note.",
        "Every member sees the sign on the map and the note on the tile card. Whoever set it, an officer or the leader can change or remove it. Up to 40 per alliance.",
        "⏱️ Planned joint attacks now show up on the map for every member, with their landing time and how many are in.",
      ]],
      ["💬 Joint attack notes", [
        "Once you're in on a joint attack, you can add a short note about what you bring. It shows next to your name in the plan.",
      ]],
      ["🙋 Looking for an alliance", [
        "Players without an alliance can show up as looking (🏆 Players → Discover), with a few words about themselves.",
        "Leaders and officers see them in their Discover list with an 📨 Invite button. Profiles show the status too. It switches off by itself after joining an alliance.",
      ]],
      ["👤 Profiles", [
        "Profiles now show the commander's name, level and tribe path, and whether the player is looking for an alliance.",
      ]],
      ["🏳️ Who holds what", [
        "A new 🏳️ button on the map lists the Landing Zone and every landmark with its bonus and current holder (with alliance tag), and jumps to it on the map.",
        "On the map, held landmarks now show the holder's name under them, and the Landing Zone shows the holder's alliance tag.",
      ]],
      ["📖 Guide", [
        "New cards: Alliance markers, Looking for an alliance, Who holds what. Tribe powers now explains Orbital Recon.",
      ]],
    ],
  },
  {
    v: "1.0.171", date: "2026-11-03", title: "The war room",
    groups: [
      ["🗂️ The simulator is now a planner", [
        "The fight simulator has three tabs: 🧮 This fight, 📂 Plans and 📊 Compare.",
        "📂 Plans: save a fight with a name (attacker, defender, target and mission) and open it again any time. You can keep up to 12 plans, and 🗑️ deletes one.",
        "📊 Compare: your attacking army against the current target, your saved plans, the nearest monster camps and the nearest inactive colonies, all in one list. Each row shows win or lose, your losses and what the survivors can carry. ⚠️ marks a win that needs good luck.",
        "From the compare list, 🧮 opens a target in the simulator and ⚔️ / 💰 sends exactly this army there in one tap.",
      ]],
      ["🎯 Just enough", [
        "A new button under every simulation finds the fewest of your troops, in the same mix, that still win even with the worst luck.",
        "It never goes above what you have at home when you simulate your own tribe, and tells you if even that isn't sure to win.",
      ]],
      ["📖 Guide", [
        "New card: Planning with the simulator.",
      ]],
    ],
  },
  {
    v: "1.0.170", date: "2026-11-03", title: "Tribes with teeth",
    groups: [
      ["✨ Two powers per tribe", [
        "Every tribe now has a home power and a war power. The power button next to the daily supply opens both.",
        "⚙️ Home powers (once per server day in every colony) now let you choose what they work on:",
        "📦 Supply Drop (Earthlings): pick one resource and get three hours of this colony's production of it.",
        "🐣 Hatch Day (Chickens): pick the barracks, hangar or workshop. A fifth of the troops waiting there hatch at once.",
        "🧠 Mind Link (Martians): pick the research and upgrade, or the construction. It finishes 30% sooner, and the jobs queued after a construction move up too.",
        "⚔️ War powers (once per server day for you): tick one in the send window for a single attack or raid.",
        "🛰️ Orbital Spotter (Earthlings): the target colony's wall counts only half in that fight.",
        "🐔 Stampede (Chickens): that army carries 50% more loot home, from colonies and monster camps.",
        "🌀 Cloak (Martians): the defender sees an attack coming but can't read its pace, and can't tell a raid from an attack.",
        "Orbital Spotter and Cloak only work against other colonies. War powers aren't available in waves or farm lists.",
        "Fight reports say when a war power was used.",
      ]],
      ["🧭 Tribe paths for the commander", [
        "A new skill of its own for every tribe's commander. It opens at level 5 with room for 5 points, and goes up to 10 points at level 10.",
        "🎖️ Drill Master (Earthlings): +2% army defense per point for the colony it guards.",
        "🐓 War Cry (Chickens): +2% army attack per point for the army it leads.",
        "🧬 Bio-Mender (Martians): 2% fewer losses per point for the army it leads.",
        "🔄 Reset skills gives these points back too.",
      ]],
      ["🛤️ Commander road", [
        "The commander panel shows a road of what the next levels bring, highlighting the next step.",
        "Level 5 and 10 open the tribe path, level 15 lets you use the war power twice per server day, and level 20 earns the 🌟 Legendary Commander badge.",
      ]],
      ["💤 Wording", [
        "The computer-run colonies are now simply called inactive colonies everywhere.",
        "The Targets list now shows your colony's name at the top (it said \"undefined\").",
      ]],
      ["📖 Guide", [
        "Tribe powers is rewritten for home and war powers. New cards: Tribe paths and Commander road.",
      ]],
    ],
  },
  {
    v: "1.0.169", date: "2026-11-03", title: "More life on Mars",
    groups: [
      ["🐫 Wandering traders", [
        "Caravans now roam the map and stop near colonies of active players for a few hours.",
        "Tap one: it swaps one resource for another one to one, with no fee and no market building needed. A slider picks the amount.",
        "Your colony has to be within 12 tiles, and every player can trade once per caravan. Each caravan names what it wants, what it gives and how much it carries.",
      ]],
      ["🎯 Targets near you", [
        "A new list of the monster camps around your colony and the nearest inactive colonies, closest winnable first.",
        "Each camp shows its monsters and treasure, plus a quick guess: ✅ your army at home would win (and roughly what share you'd lose), or ❌ it's too strong.",
        "One tap to 🧮 simulate, 🔍 spy, ⚔️ attack or 💰 raid, without hunting for the tile on the map.",
        "Open it from the beginner-protection bar, the 🪖 Army tab or the 🎯 button on the map.",
        "Attacking, raiding or scouting another colony ends your beginner protection.",
      ]],
      ["🎓 Combat training", [
        "Four new quests right after A Tiny Army walk you through a whole fight: simulate a camp, spy on it, beat it, then send two waves at once with the wave builder.",
        "The old Nosy Neighbour quest is now step two of the training. If you already claimed it, it stays claimed.",
        "The Targets list shows which step you're on and lets you claim its reward right there.",
        "The quest buttons for spying and hunting now open the Targets list instead of the bare map.",
      ]],
      ["🎉 Milestones", [
        "Your second colony comes with a moving-in gift of every resource in its storage, commander experience, a news line and a celebration.",
        "Your first landmark pays a bigger treasure into the claiming colony, plus commander experience and a celebration with a button to show it on the map.",
        "Both happen once per player and are listed in the guide.",
      ]],
      ["📖 Guide", [
        "New cards: Wandering traders, Targets near you, Combat training and Milestones.",
      ]],
    ],
  },
  {
    v: "1.0.168", date: "2026-11-03", title: "A stronger commander",
    groups: [
      ["Commander skills", [
        "💪 Leadership and Guard became one skill: Strength. Every point adds to the commander's attack AND defense (up to 15 points), so a fighter no longer has to choose. Your old Leadership and Guard points were moved into Strength; anything above 15 is free to spend again.",
        "❤️ New skill Vitality: +6 health per server day and 0.4% less health lost in fights per point.",
        "🔄 Reset skills: get every point back and spend them anew, for some resources (more at a higher level). Each skill now shows its points as ●●●○○.",
      ]],
      ["Bounty stash", [
        "📦 Take what you want with a slider (or type it), or tap 📦 What fits, ½ Half or 0 None. It shows how much still fits into the storage.",
        "Short of a resource for a building or field? If your commander is stationed in that colony and its stash has some, tap the red cost chip with 📦 on it: the missing amount comes straight from the stash.",
      ]],
      ["Hospital", [
        "🏥 Hospital beds grow with server speed (× the square root of speed), because armies are bigger on fast servers. A ×100 server has 10× the beds.",
      ]],
    ],
  },
  {
    v: "1.0.167", date: "2026-11-03", title: "Attack your own colonies",
    groups: [
      ["Attacks", [
        "⚔️ You can now attack or raid your own colonies (and send waves at them). Troops fight as usual against whoever defends there, loot really moves, rams and 💥 bombards really hit (bombing one down to 0 wipes it off the map).",
        "Such fights never count for stats, rankings, badges or commander xp, chickens don't scavenge from them, and envoys do nothing there: it's already yours. Spying on your own colony isn't needed.",
        "🧮 The simulator fills in your own colony's real troops, wall and HQ, no spy report needed.",
      ]],
    ],
  },
  {
    v: "1.0.166", date: "2026-11-03", title: "Fit your resources to a troop",
    groups: [
      ["Training", [
        "⚖️ New on every troop card (with a market): Fit resources for N. It fills the market's Balance tab so your stock matches that unit's cost ratio, for as many of them as one swap allows, and puts that number into the training box. Review it, tap Redistribute, then Train.",
        "It only shows when it really gets you more troops than you can train right now.",
      ]],
    ],
  },
  {
    v: "1.0.165", date: "2026-11-03", title: "Merchants keep up with fast servers",
    groups: [
      ["Market", [
        "🐪 What a merchant carries now grows with server speed, like the loot your troops carry (× the square root of speed). On a normal server nothing changes; on a ×100 server a merchant carries 10× as much.",
        "That way a merchant always moves the same share of a full warehouse, on every server. Tribe differences stay (Humans carry more, Aliens less). Market offers, trade routes and pylon charging all use the new numbers.",
      ]],
    ],
  },
  {
    v: "1.0.164", date: "2026-11-02", title: "A living Mars",
    groups: [
      ["A world that feels alive", [
        "🌍 The news bar now opens with the pulse of Mars: colonists online, fights in the last hour, new colonies today.",
        "🔥 Fights leave smoke on the map for an hour (🔥 fresh, then 💨), at colonies, camps, landmarks and the Landing Zone, so you can see where the action is.",
      ]],
      ["A clearer first hour", [
        "🎁 Every step of the landing now shows what it pays, and how much is still waiting until the gift at the end.",
        "The 'next goals' at the end of the landing now come from your colony: what it still lacks, not a fixed list.",
      ]],
      ["Tribe identity", [
        "✨ Every tribe got its own power, once per server day in every colony: 🧑‍🚀 Humans 📦 Supply Drop (one hour of production at once), 🐔 Chickens 🐣 Hatch Day (a fifth of the troops in the barracks hatch at once), 👽 Aliens 🧠 Mind Link (research and armory upgrade 30% sooner).",
      ]],
      ["Finding people", [
        "🧭 New Discover tab under 🏆 Players: your 12 nearest neighbours (with who was active today), and alliances that are looking for members.",
        "✋ Ask to join sends your request to that alliance's leaders and officers. They switch 📣 recruiting on or off right there.",
      ]],
      ["Coming back every day", [
        "🎁 Daily supply: a free crate every server day, bigger every day in a row (up to day 7); miss a day and it starts over.",
      ]],
    ],
  },
  {
    v: "1.0.163", date: "2026-11-02", title: "Every landmark can be attacked",
    groups: [
      ["Landmarks", [
        "🗿 Any colony can now attack a landmark, held or free, even without an Expedition Base, out of its range, or while it already holds another one. The troops fight as usual.",
        "Only a colony that could claim it keeps it after a win. Any other winner's troops walk home, and if they beat every guard of a held landmark, it is free again.",
        "On the map the button says ⚔️ Claim when this colony can keep the landmark, otherwise ⚔️ Attack.",
      ]],
    ],
  },
  {
    v: "1.0.162", date: "2026-11-02", title: "The commander claims landmarks",
    groups: [
      ["Commander", [
        "🎖️ The commander can now lead the army that claims a 🗿 landmark: it adds its attack, earns xp and can get hurt, like in any fight.",
        "If the claim is won and the troops stay as guards, the commander walks home by itself instead of staying there.",
        "Alone (no troops), the commander still only takes on monster camps and inactive colonies; that rule is now checked properly.",
      ]],
    ],
  },
  {
    v: "1.0.161", date: "2026-11-02", title: "Simulate any target, a tidier resource bar",
    groups: [
      ["Fight simulator", [
        "🗿 Landmarks are now a target in the simulator. Opened from a landmark, it fills in the guardians that are there right now (weaker if your Expedition Base is level 15), or, if a player holds it, their tribe and the garrison from your latest spy report, with the landmark's defense bonus.",
        "🚩 A held Landing Zone also fills in the garrison from your latest spy report, like colonies already did.",
        "Landmarks have a 🧮 Simulate button on the map now. Monster camps of every kind were already filled in.",
        "🔍 Every spy report now has 🧮 Simulate with these troops: it opens the simulator with exactly the troops, monsters, guardians or garrison from that report (plus wall, HQ and hospital levels if your spies saw them).",
      ]],
      ["Resource bar", [
        "Big numbers are shortened (1.4M, +699k/h), with the exact values on hover.",
        "🛟 The greenhouse reserve has its own line under food, so the full in / empty in time is never cut off.",
      ]],
    ],
  },
  {
    v: "1.0.159", date: "2026-11-02", title: "Pick your helping hands, a calmer greenhouse",
    groups: [
      ["Faster construction", [
        "🏘️ Helping hands no longer grabs every free colony: tap the colonies you want to help (their build queue is shown), then Lend. Only those give up a build slot. Colonies that are full or already helping are greyed out, and you can't pick more than the job can still use.",
      ]],
      ["Greenhouse (Hydroponic Dome · Seed Sprouter · Fungus Farm)", [
        "🛟 The drought reserve no longer swallows everything a full granary can't hold; that filled it almost at once. Now only a tenth of the real food surplus trickles in.",
        "The reserve is half as big: 1,000 food per level (scaled with storage on faster servers).",
        "Its food bonus now really counts (before, only the bakery's did), at a smaller +3% per level, so up to +15% on top of the bakery.",
      ]],
    ],
  },
  {
    v: "1.0.158", date: "2026-11-02", title: "Pick your helping hands",
    groups: [
      ["Faster construction", [
        "🏘️ Helping hands no longer grabs every free colony: tap the colonies you want to help (their build queue is shown), then Lend. Only those give up a build slot. Colonies that are full or already helping are greyed out, and you can't pick more than the job can still use.",
      ]],
    ],
  },
  {
    v: "1.0.157", date: "2026-11-02", title: "Countdowns stay in view",
    groups: [
      ["Server goal", [
        "While the 🏆 Relic Hunt runs (and while its winner is shown), the bar now keeps a compact line with what is still coming, e.g. 🌌 Aurora in 3d 8h (day 10). Before, the other countdowns disappeared once the Relic Hunt started.",
      ]],
    ],
  },
  {
    v: "1.0.156", date: "2026-11-02", title: "Drag your colonies, keep your reports new",
    groups: [
      ["Colonies", [
        "⠿ Drag a colony by its handle in 🏠 My Colonies to put it where you want; drop it under a group's header to move it into that group. The sort options are gone; the 📊 Overview follows your order.",
      ]],
      ["Reports", [
        "Every report now shows whether it was read: NEW or ✓ read.",
        "A report you open keeps its NEW tag until you leave the Reports tab, so it no longer vanishes the moment you tap it.",
        "✉️ Mark as unread in an open report puts it back to unread.",
      ]],
      ["Overview", [
        "📊 The Overview (with the troop breakdown) is now there from your very first colony, not only once you have two.",
      ]],
    ],
  },
  {
    v: "1.0.155", date: "2026-11-02", title: "Your colony list, your way",
    groups: [
      ["Colonies", [
        "🗂️ Groups became Organize: sort your colony list by your own order (arrange with ▲▼), name, points, oldest or newest.",
        "Groups can be put in order too (▲▼). The sidebar list and the 📊 Overview follow your choice, and it's saved on all your devices.",
      ]],
    ],
  },
  {
    v: "1.0.154", date: "2026-11-02", title: "Nothing is safe: HQs and main colonies can fall",
    groups: [
      ["Bombards", [
        "🏛️ The HQ can now be bombed down like any other building. Without an HQ nothing can be built or upgraded, fields included, until it is rebuilt on a free lot.",
        "⭐ Main colonies can be bombed down to 0 and wiped off the map too. Your oldest remaining colony then becomes your main colony.",
        "💥 Lose your last colony and you start over: the game takes you straight to the respawn screen to pick a tribe again.",
      ]],
    ],
  },
  {
    v: "1.0.153", date: "2026-11-02", title: "Waves leave together, a Bastion for the capital",
    groups: [
      ["Waves", [
        "All waves now leave at the same moment, no waiting at home. Each walks at the pace of its slowest unit, so slower waves land later.",
        "Waves with the same pace land together: the first two in the same second, any more only with luck (otherwise 1 to 2 seconds behind). Want it all at once? Give every wave the same slowest unit, e.g. a bombard each.",
        "The gap and landing-time options are gone from the wave builder.",
      ]],
      ["Bastion", [
        "🏰 The Bastion now only guards your ⭐ main colony itself, not your other colonies.",
        "Moving your main colony tears the Bastion down at once (no refund), including one still being built.",
      ]],
      ["Read the pace", [
        "New Left at field: it starts with your 📌 spotted time, and you can change it. Left at and travel time fill each other in; ↺ brings back the spotted time.",
        "The 🚨 attack alert no longer covers a window you have open.",
      ]],
    ],
  },
  {
    v: "1.0.152", date: "2026-11-02", title: "Honest marching pace, the Bastion, and spotting attacks",
    groups: [
      ["Waves", [
        "Armies are never held back on the road anymore: every wave walks at the pace of its slowest unit. A wave that would land too early now waits at home and leaves later, so it still lands on time. That way nobody can make cheap fast units look like slow siege.",
        "Landing together still works as before: the first two waves land in the same second, later ones with luck, or 1 to 2 seconds behind. A siege wave in front is no problem.",
        "A wave waiting at home can't be seen by the target until it leaves. You can still call it back while it waits; it's home at once.",
      ]],
      ["Bastion", [
        "🏰 New building, only in your ⭐ main colony (HQ 10, wall 5, max level 5): every level makes the buildings and fields of all your colonies 20% tougher against bombards, up to +100%, where bombards need twice as many per level. It only works while that colony is your main colony.",
        "Battle reports show when a bastion was in play.",
      ]],
      ["Incoming attacks", [
        "📌 Spotted now: in an attack's details you can note the moment you noticed it. It's only ever the time you press it, shows on all your devices, and helps with 🔎 Read the pace.",
        "Read the pace no longer suggests armies were held back: if no unit fits, it left earlier than you think.",
      ]],
    ],
  },
  {
    v: "1.0.151", date: "2026-11-02", title: "Reading an incoming attack",
    groups: [
      ["Incoming attacks", [
        "Attacks and raids on the way to you no longer show when they left: no progress bar, no departure time. You see who sends them and when they land.",
        "🔎 New in an attack's details in 🧭 Troop Traffic: Read the pace. Type in how long it has been on the way and it tells you which kind of unit fits, since an army walks at the pace of its slowest unit. You have to know when it left yourself: easy if you were online when it showed up, guesswork if you were away.",
        "Slower than any unit can walk means it was held back, for example sent in waves. Help, merchants and stationed troops still show their full timeline.",
      ]],
    ],
  },
  {
    v: "1.0.150", date: "2026-11-02", title: "Unlimited attacks, razing colonies, an earlier bakery",
    groups: [
      ["Attacks", [
        "Attack slots are gone: a colony can have as many attacks under way at once as you like, of any size. Raids on players still need a handful of units.",
      ]],
      ["Bombards", [
        "💥 Bombards now hit resource fields too, not just buildings. The 💥 Aim list has both, buildings and fields.",
        "Bombards left over after flattening their target no longer go to waste: they move on to the next one of the aimed kind, then to random targets. A big stack of bombards can level a lot in one attack.",
        "The HQ falls last: it keeps level 1 as long as anything else in the colony is still standing.",
        "🏚️ A colony bombed down to 0 points is wiped off the map for good, and the land is free again. Its own armies are lost, guests and anyone still on the way turn back, prisoners there walk free. Both sides get a report and the news ticker shows it. A ⭐ main colony can never be wiped out.",
      ]],
      ["Economy", [
        "The bakery now opens with a food field at level 5 (was 10). Food is what caps an army, so relief comes earlier; its steep cost per level keeps the higher levels a later goal. The other boosters still need a field at level 10.",
      ]],
    ],
  },
  {
    v: "1.0.149", date: "2026-11-02", title: "Wave builder: copy and aim, and no more minimum attack size",
    groups: [
      ["Wave builder", [
        "⧉ Each wave can now be copied - mission, troops and aim land in a new wave, ready to tweak.",
        "💥 An attack wave with bombards gets its own 💥 Aim dropdown now, just like a single attack, so every wave in a plan can target a different building.",
      ]],
      ["Attacks", [
        "The minimum size for an attack on a player is gone. Only raids still need a handful of units; attacks are limited by the colony's attack slots instead (3, +1 for every 5 barracks levels) - a flood of fake attacks still runs out of slots fast.",
      ]],
    ],
  },
  {
    v: "1.0.148", date: "2026-11-02", title: "A cleaner colonies overview",
    groups: [
      ["Colonies overview", [
        "The 📊 All colonies screen has been tidied up: each colony is now its own clearly separated card, the duplicate troop counts in the status row are gone, and 🏠 Home / 🤝 Support / 🚶 Away each show their count right next to the label instead of being spelled out separately. A colony with no troops anywhere now just says so, instead of showing empty rows.",
      ]],
    ],
  },
  {
    v: "1.0.147", date: "2026-11-02", title: "A detailed army overview, and sharing the reins",
    groups: [
      ["Colonies overview", [
        "The 📊 All colonies screen now breaks troops down by unit, not just a total: 🏠 what's home, 🤝 support hosted there, 🚶 what's away and moving, and at the top, your whole account's total army (home or away - only drops once a troop has settled in as support somewhere else). Built for quickly planning an attack or defense across colonies.",
      ]],
      ["Reinforcements", [
        "Whoever is hosting support troops can now redirect or send them home too, not just whoever sent them - their own troops stationed there from another of their colonies, or an ally's troops, as long as it's actually stationed with them.",
      ]],
    ],
  },
  {
    v: "1.0.146", date: "2026-11-02", title: "Redirect once they've arrived",
    groups: [
      ["Reinforcements", [
        "🧭 Redirect is now only offered once troops have actually arrived and settled in at a colony. While they're still walking there, let them arrive first, or call them back with 🏡 Call home.",
      ]],
    ],
  },
  {
    v: "1.0.145", date: "2026-11-02", title: "Redirecting support, and the colonies overview",
    groups: [
      ["Reinforcements", [
        "🧭 Troops sent to reinforce a colony can now be redirected straight to a different one - still walking there, or already stationed - from their entry in 🧭 Troop Traffic. No need to call them home first.",
      ]],
      ["Commander", [
        "The 🚶 Restation button on the send screen now asks for confirmation first, so it's harder to tap by accident. Restationing also shows up as a proper movement in 🧭 Troop Traffic while it's underway.",
      ]],
      ["Colonies overview", [
        "The 📊 All colonies screen now shows each colony's total troops: 🪖 stationed (its own troops plus any support from others currently there) and ⚔️ army (home plus everything still out and moving - attacking, raiding, walking to reinforce). Troops only drop out of a colony's army once they've arrived and settled in elsewhere; they still count while underway. The top of the screen adds your empire-wide total army too.",
      ]],
    ],
  },
  {
    v: "1.0.144", date: "2026-11-02", title: "Who pays the troops, and a way back for the commander",
    groups: [
      ["Reinforcements", [
        "Troops sent to reinforce another colony now eat from that colony's storage once they've arrived and settled in, not from the colony that sent them. A colony hosting a lot of borrowed defenders will feel it in its own food upkeep; the colony that sent them gets that upkeep back.",
      ]],
      ["Commander", [
        "💉 A fallen commander can now be revived early: pay a resource cost (scaled to its level and the server's speed) from its home colony to cut the recovery time to a quarter of the usual wait, instead of sitting out the rest of the server day. It's offered right on the commander panel once it's fallen.",
      ]],
      ["Training", [
        "The training queue has no length limit: queue as many orders as you can afford, one building at a time, same as before.",
      ]],
    ],
  },
  {
    v: "1.0.143", date: "2026-11-02", title: "Traps that scale, a commander that moves",
    groups: [
      ["Traps", [
        "Trap capacity now scales with the server's speed, like carry capacity: a trap building used to catch a flat 10 attackers per level on every server, which was trivial against the much bigger armies on a fast server. It now catches its usual share of an attacking army everywhere.",
      ]],
      ["Commander", [
        "The send window now offers a 🚶 Restation button whenever the target is one of your own colonies the commander isn't already at: one tap sends it there and makes that its new home, without first switching your active colony and digging through the commander panel.",
      ]],
    ],
  },
  {
    v: "1.0.142", date: "2026-11-02", title: "Bounty, shown in full",
    groups: [
      ["Battle reports", [
        "When a commander leads a raid, the camp's bounty goes into its stash instead of home - but the report only said \"Bounty kept\" with no numbers. It now shows the exact amounts, same as a normal raid's bounty row, and counts toward the report's profit total either way.",
      ]],
    ],
  },
  {
    v: "1.0.141", date: "2026-11-02", title: "Scheduled trade routes",
    groups: [
      ["Marketplace", [
        "New automatic trade routes can now get a 🕐 first-run time (your local time, converted to the server clock) instead of always leaving right away. Leave it empty for the old behavior - first batch goes out immediately.",
        "Only the first run is scheduled; after that the route keeps to its normal \"every\" interval as before.",
      ]],
    ],
  },
  {
    v: "1.0.140", date: "2026-11-02", title: "Cover with market",
    groups: [
      ["Marketplace", [
        "When a build or upgrade is short on resources and the marketplace has enough spare elsewhere to make up the gap, a new 💱 Cover with market button appears under it. It opens the market's Balance tab with the exact swap already filled in - short resources raised to exactly what's needed, the rest drawn from whatever you have spare - so you only need to confirm.",
        "Works for new buildings, building upgrades, and resource-field upgrades. It only ever shows up when the trader can actually cover the shortfall; otherwise the usual wait-time still shows.",
      ]],
    ],
  },
  {
    v: "1.0.139", date: "2026-11-01", title: "Monster camps, rebalanced for real",
    groups: [
      ["Monster camps", [
        "The extra treasure and trophy boost on fast servers was overshooting: a 10× server made raiding worth about 3× too much relative to production, and the 500×/30× speed server about 5× too much. The formula now keeps camp income, per real hour, in exactly the same proportion to your production as on a normal server - whatever the speed.",
        "What changes: camp treasure follows production speed ÷ walking speed (1× on a server where both match, such as ×10; bigger where production outruns walking, such as the speed server). The trophy per kill follows the same gap, scaled down by how many more monsters a camp now holds, since a bigger camp already pays out more per raid on its own.",
        "Camp difficulty (the number of monsters) is unchanged - it still grows with the square root of production speed, matching how fast your own armies grow.",
        "The wiki camp table explains the three numbers (monsters, treasure, trophy) separately.",
      ]],
    ],
  },
  {
    v: "1.0.138", date: "2026-11-01", title: "The landing party",
    groups: [
      ["Landing", [
        "The guide now hands over a small landing party instead of asking for the HQ and the barracks first: 5 troops on a normal server, more on faster ones (about 16 on ×10, about 112 on ×500), so the first raid on the wrecked lander needs no barracks at all.",
        "The HQ to level 3, the barracks and the first training are the last three steps of the landing, after the map, the raid and everything the guide explains. Queueing them counts, so the landing never waits for a build; only the training needs a finished barracks, and it can be left for later like the alliance step.",
        "The free instant-finish of the landing is gone with them. Jobs still finish for free in their last minutes, everywhere in the game, as they always did.",
      ]],
    ],
  },
  {
    v: "1.0.137", date: "2026-11-01", title: "A quicker start",
    groups: [
      ["Build times", [
        "The first levels of every field and building are much shorter (about a third of what they were on level 1), and the curve rises faster to meet level 10 exactly where it was. So the early game moves, and everything from level 10 on is unchanged. On a ×1 server the barracks of the landing now takes about 8 minutes instead of 27.",
      ]],
      ["Landing", [
        "Every job the guide waits for can now be finished for free, whatever is left of it. The gap was the barracks: once it was queued the step counted as done, and the next step offered no free finish, so a ×1 colonist sat through the whole build with nothing to do.",
        "The guide also follows a job the commander's crew is building, not only the colony queue.",
      ]],
    ],
  },
  {
    v: "1.0.136", date: "2026-11-01", title: "Game speed at first sight",
    groups: [
      ["Server selection", [
        "Every server shows its game speed as a big colored badge on the left (green ×1 normal, yellow quick, orange fast, magenta blitz), so the servers can be told apart at a glance.",
      ]],
    ],
  },
  {
    v: "1.0.135", date: "2026-11-01", title: "Every server shows its version and players",
    groups: [
      ["Server selection", [
        "Every server in the list shows its game version, its speed and how many players it has, not only the one you are on. A server that does not answer simply shows less.",
        "“🏠 you play here” now marks every server where you already have a colony (before, only the main server said “your colony”).",
      ]],
    ],
  },
  {
    v: "1.0.134", date: "2026-11-01", title: "The Classic server",
    groups: [
      ["Servers", [
        "A new server in the list: Classic (normal speed, ×1). A long round with the usual clock. Pick it after you log in, like any other server. It has its own world, its own commander and its own admin page.",
      ]],
    ],
  },
  {
    v: "1.0.133", date: "2026-11-01", title: "Troops carry more on fast servers",
    groups: [
      ["Raids", [
        "Troops carry more as well (the same factor as the storage: about 3× on a 10× server, 22× on a 500× server). The stores and the stocks of the players you raid grow like that, and a fixed carry capacity would have made every raid on a fast server tiny. The unit cards and the wiki show the real number.",
      ]],
    ],
  },
  {
    v: "1.0.132", date: "2026-11-01", title: "Raids pay on every game speed",
    groups: [
      ["Monster camps", [
        "Camp treasure and trophies get an extra boost where the colonies produce much faster than the troops walk (the square root of production speed divided by walking speed). The camps refill at walking speed, so on a 500× server with 30× walking a raid had shrunk to a rounding error next to your income. On servers where both are equal (and on normal servers) nothing changes beyond the earlier scaling.",
        "The wiki and the map tooltips show the numbers of the server you are on.",
      ]],
      ["Quests", [
        "Resource gifts of quests and of the landing guide now grow with the storage (about 3× on a 10× server, 22× on a 500× server), so they stay a real share of what your stores hold. The commander xp of a quest stays the same, it follows the level curve.",
      ]],
    ],
  },
  {
    v: "1.0.131", date: "2026-11-01", title: "Send it straight from the simulator",
    groups: [
      ["Fight simulator", [
        "When the simulation has a real target (opened from the map or a report) and you simulate with your own tribe, a button under the result sends these troops there: the send window opens with exactly those numbers (and the commander, if it is in the simulation). If you have fewer troops at home than simulated, it sends what you have.",
      ]],
    ],
  },
  {
    v: "1.0.130", date: "2026-11-01", title: "Commander bonus in every resource panel",
    groups: [
      ["Resources", [
        "The commander’s production bonus (🎖️ per hour and %) now sits in each resource panel in every view, not only on the Resources tab, while the commander is stationed in this colony.",
      ]],
    ],
  },
  {
    v: "1.0.129", date: "2026-11-01", title: "Commander in the simulator",
    groups: [
      ["Fight simulator", [
        "Both sides can have a commander: tap its name to load your commander with its level, skill points and gear, or type any values. The commander adds its attack (attacker) or defense (defender) the same way as in a real fight, and can also fight alone.",
      ]],
    ],
  },
  {
    v: "1.0.128", date: "2026-11-01", title: "Joint attacks are back",
    groups: [
      ["Alliances", [
        "Planning a joint attack in the alliance works again. Only the landing time for waves stays locked.",
      ]],
    ],
  },
  {
    v: "1.0.127", date: "2026-11-01", title: "The commander goes alone",
    groups: [
      ["Commander", [
        "The commander can go out alone: tick it in the send window without any troops. It attacks or raids monster camps and inactive colonies, walks 8 tiles/h and fights with its own attack. Not possible in waves, and not against other players.",
        "Leadership and Guard now raise its own attack and defense by 12 per point (before: 1% for the army). Base points and the gain per level are lower (40 + 8 per level), so a fully trained commander is about as strong as before, but you choose where it grows.",
        "On faster servers its points and the xp it needs per fight scale with the game speed, like the armies, so it stays relevant and does not level up in seconds.",
      ]],
      ["Waves", [
        "Choosing a landing time for waves is locked for now: “coming soon”.",
      ]],
    ],
  },
  {
    v: "1.0.126", date: "2026-11-01", title: "Camps keep up with the game speed",
    groups: [
      ["Monster camps", [
        "On faster servers the monster camps are bigger and richer in the same way as the storage: about 3× monsters and treasure on a 10× server, 22× on a 500× server (the trophies grow with the number of monsters). On a normal server nothing changes.",
        "The Landing Zone robots and the landmark guardians grow the same way.",
        "Regrowth and refill still run at the walking speed of the server, so the rhythm of farming a camp stays comfortable.",
        "The wiki camp table shows the numbers of the server you are on.",
      ]],
    ],
  },
  {
    v: "1.0.125", date: "2026-11-01", title: "Storage grows with the game speed",
    groups: [
      ["Storage", [
        "Warehouses, granaries, the space without a store, bunkers and the drought reserve now grow with the square root of the production speed: about 3× on a 10× server and 22× on a 500× server. On a normal server nothing changes. Before, fast servers filled every store within seconds.",
        "The wiki shows the factor of the server you are on.",
      ]],
    ],
  },
  {
    v: "1.0.124", date: "2026-11-01", title: "Commander bonus on show",
    groups: [
      ["Resources", [
        "The resource panels show the commander’s production bonus (🎖️ per hour and %) next to the fields, in the colony where it is stationed.",
      ]],
    ],
  },
  {
    v: "1.0.123", date: "2026-11-01", title: "A shorter landing",
    groups: [
      ["Landing", [
        "The HQ upgrades and the barracks the guide asks for can be finished for free at any time (they were the longest waits of the whole landing). Other steps keep the usual free-finish limit.",
      ]],
      ["Quests", [
        "Quests that are not ready yet are no longer greyed out: every quest is open, so every quest looks the same.",
      ]],
    ],
  },
  {
    v: "1.0.122", date: "2026-11-01", title: "Hunger bites",
    groups: [
      ["Food", [
        "When the granary is empty, the missing food is now paid with the troops themselves: every unit that dies is worth one hour of its own food (before: three hours, which hardly mattered).",
        "On faster servers the worth stays one real hour, so the speed server gives you time to react, but every hour about two thirds of the troops the colony cannot feed are lost, until the rest can be fed.",
        "Replaces the 20 minute grace of the last version.",
      ]],
    ],
  },
  {
    v: "1.0.121", date: "2026-11-01", title: "A speed server you can play",
    groups: [
      ["SpeedTest server (×500)", [
        "Troops and merchants travel ×30 instead of ×500: a 20 tile trip takes minutes instead of seconds. Production and building stay at ×500. The adventure trips, the commander’s walk and camp and landmark timers follow the new travel speed.",
        "Starving is slower on fast servers: a hungry unit now holds out at least 20 real minutes before it dies (3 game hours before, which was seconds at ×500). Nothing changes on slow servers.",
        "A speed server that was already running with ×500 everywhere moves to the new travel speed once. The owner can still change every speed on the admin page.",
      ]],
    ],
  },
  {
    v: "1.0.120", date: "2026-11-01", title: "Repeat attack, unique icons",
    groups: [
      ["Reports", [
        "New 🔁 Repeat attack in every open attack or raid report: the send window opens with the same target and the same troops (and the commander, if it led), ready to send.",
      ]],
      ["Map", [
        "Opening the map no longer pops up the info card of your own colony. Jumping to a place from elsewhere still selects it.",
      ]],
      ["Icons", [
        "The Humans’ Barracks no longer shares the commander’s 🎖️ (now 🏟️) and the Expedition Base no longer shares the adventure compass (now 🛖).",
        "Chickens: the Secret Burrow is 🕳️ (the Egg Catapult keeps 🥚). Aliens: the Mothership Core is 🛕, the Spawning Pool 🪸, the Fungus Farm 🪴 and the Spore Cannon 🎆, so every building and unit of a tribe has its own icon.",
      ]],
    ],
  },
  {
    v: "1.0.119", date: "2026-11-01", title: "Respawn fix",
    groups: [
      ["Respawn", [
        "Fixed: the tribe choice of a respawn was swept away by the game refreshing in the background, so nothing could be picked. It stays open until you land.",
      ]],
    ],
  },
  {
    v: "1.0.118", date: "2026-11-01", title: "The first squad is on the house",
    groups: [
      ["Commander", [
        "The number on the commander card now only counts the adventures waiting on the board, and is gone when there are none (items in the bag and skill points no longer show it).",
      ]],
      ["Landing", [
        "Finishing the very first squad for free now also pays back its cost (up to 5 units), so the tutorial squad costs nothing.",
      ]],
      ["Respawn", [
        "A respawn lets you pick your tribe again and always lands you at a new place; the old colony at the old place is deleted.",
      ]],
    ],
  },
  {
    v: "1.0.117", date: "2026-11-01", title: "Respawn and account deletion",
    groups: [
      ["Accounts", [
        "New ♻️ Respawn in ⚙️ Settings: your colonies, troops, hero, quests and alliance place on that server are deleted and you land again with a new colony and a tribe of your choice. Account and other servers stay untouched.",
        "Deleting your account now works from the server selection (password needed) and removes the account and your players on every server.",
        "The old in-game delete button is gone: with one main account the password is kept on the main server.",
        "Safety: a database now remembers which server it belongs to. A server that is started on another server\u2019s database (two sites sharing one folder) stops with a clear message in its log instead of mixing the two worlds.",
        "Server owners: deleting a player in the admin page asks whether the main account (and the players on all servers) should go too, or only the player on this server.",
      ]],
    ],
  },
  {
    v: "1.0.116", date: "2026-11-01", title: "Play several servers at once",
    groups: [
      ["Accounts", [
        "Reloading the page while playing keeps you in your game on every server. A new tab or a new login still starts at the server selection, so you can keep one tab per server.",
      ]],
    ],
  },
  {
    v: "1.0.115", date: "2026-11-01", title: "Selection first",
    groups: [
      ["Accounts", [
        "Logging in always leads to the server selection first, also when you came from another server or still had a game open.",
        "Opening the main site shows the server selection; you enter a game only by choosing its server.",
      ]],
    ],
  },
  {
    v: "1.0.114", date: "2026-11-01", title: "Back to the selection",
    groups: [
      ["Accounts", [
        "Logging out on any server takes you straight back to the server selection on the main server.",
        "Opening another server while logged out goes to the main server's login and, after logging in, straight back to that server.",
      ]],
    ],
  },
  {
    v: "1.0.113", date: "2026-11-01", title: "Choose your server",
    groups: [
      ["Accounts", [
        "Logging in or making an account now happens on the main server and leads to the server selection, not straight into a game.",
        "Your player on a server is only made when you choose that server: you pick your tribe there and land.",
        "Making an account no longer asks for a tribe. The email is confirmed once, for every server.",
        "Password and email belong to the main account. Change them on the server selection (⚙️ Settings → 🌍 Account takes you there).",
        "Log out in the game takes you back to the server selection; log out there ends the main account session.",
        "Players from before keep their name, password, email and colony: their game account became their main account.",
        "Every server keeps its own speed, rounds and admin page.",
      ]],
    ],
  },
  {
    v: "1.0.112", date: "2026-11-01", title: "One main account",
    groups: [
      ["Accounts", [
        "You make your account once, on the main server, and confirm your email there. Choosing another server under ⚙️ Settings → 🌍 Servers logs you in over there with no second password and no second mail.",
        "On a server you have not played yet, you only pick your tribe. Colonies, heroes and rounds stay separate on every server.",
        "The hand-over link is signed, works once and expires after ten minutes.",
        "Other servers send people to the main server to log in (and straight back afterwards).",
        "Server owners: set the same HOP_SECRET on every server, and HUB_URL (the main server's address) on all the others.",
      ]],
    ],
  },
  {
    v: "1.0.111", date: "2026-11-01", title: "New home address",
    groups: [
      ["Servers", [
        "The server list on the login screen now opens marsl-game.com and speed.marsl-game.com.",
      ]],
    ],
  },
  {
    v: "1.0.110", date: "2026-11-01", title: "Crew on free lots",
    groups: [
      ["Fixes", [
        "The 🎖️ crew button in the window of a free lot (the + on the colony ring) now works. It showed up, but did nothing.",
      ]],
    ],
  },
  {
    v: "1.0.109", date: "2026-11-01", title: "Tidier traffic and quests",
    groups: [
      ["Interface", [
        "Troop Traffic: the adventure and commander icons are no longer shown twice in a row.",
        "The quest panel is open by default, so every quest is visible right away (the arrow still folds it).",
      ]],
    ],
  },
  {
    v: "1.0.108", date: "2026-11-01", title: "Balance pass",
    groups: [
      ["Commander", [
        "Foreman production lowered from +20 to +14 per hour of each resource per point (the +1% of colony production per point stays).",
        "Adventure experience lowered: scouting trip 8, expedition 24, deep journey 60 (the bonus per commander level is now +12% instead of +15%).",
        "Quest experience lowered by a third (at least 8 per quest).",
      ]],
    ],
  },
  {
    v: "1.0.107", date: "2026-11-01", title: "The long way back",
    groups: [
      ["🔧 Changed", [
        "🧭 Adventures now have real travel: your commander walks out to the adventure (5 / 12 / 30 minutes for a Scouting trip / Expedition / Deep journey), spends the trip’s time on site and walks back the same way. The listed time is the whole round trip. Rewards come when it is home again.",
        "🚶 It shows in Troop Traffic like any other movement (“Commander on an adventure”, then “Coming home”), also in the movement list. Calling it back makes it turn around and walk home; it no longer pops up at home at once.",
      ]],
    ],
  },
  {
    v: "1.0.106", date: "2026-11-01", title: "Adventures turn up over time",
    groups: [
      ["🔧 Changed", [
        "🧭 Adventures are no longer there all the time. Your commander starts with 2 on its board, and a new one turns up every 6 server hours: a Scouting trip about half of the time, an Expedition about a third, a Deep journey rarely. The board holds 4; while it is full no new one spawns. The old limit of 4 trips per server day is gone. The commander window shows what is on the board and when the next one comes.",
      ]],
    ],
  },
  {
    v: "1.0.105", date: "2026-11-01", title: "The crew stays at work",
    groups: [
      ["🔧 Changed", [
        "🎖️ The commander’s crew keeps building in the colony where the commander is stationed, even while it is on an adventure, out with an army or recovering. It is only unavailable in the other colonies (and while the commander is moving to a new one).",
      ]],
    ],
  },
  {
    v: "1.0.104", date: "2026-11-01", title: "The crew is always in sight",
    groups: [
      ["🔧 Changed", [
        "📜 The quest header no longer shows a cut-off “this colony” label.",
        "⚡ The free-finish button in the build queue now says <b>Finish</b>. It appears by itself as soon as a job (in the queue or by the commander’s crew) reaches its free last minutes.",
      ]],
      ["🐞 Fixed", [
        "🎖️ The commander’s crew line vanished from the build queue whenever the commander was away (on an adventure, recovering, on the road, out with an army or stationed in another colony). It now always shows why the crew can’t build right now and when it is back.",
      ]],
    ],
  },
  {
    v: "1.0.103", date: "2026-11-01", title: "A slimmer quest panel",
    groups: [
      ["🔧 Changed", [
        "📜 The folded quest panel is much more compact: it shows only the quests with a reward waiting plus the next goal, each as one slim row (title, progress, claim). “More ▾” still opens the full list with descriptions, rewards and skip.",
      ]],
    ],
  },
  {
    v: "1.0.102", date: "2026-11-01", title: "Heavy defeats are deadly again",
    groups: [
      ["🔧 Changed", [
        "💀 A heavily outmatched commander falls again, attacking or defending: if its side loses the fight and loses 70% or more of its troops it falls, in raids too (before, only a wiped-out army or a lost attack did it). A defending commander also falls whenever its colony loses an attack.",
        "💎 The inventory now names the slot of every item (Epic helmet, Rare boots …). Each of the five gear types has its own equip slot; a new item replaces only what sits in its own slot.",
      ]],
    ],
  },
  {
    v: "1.0.101", date: "2026-11-01", title: "Loyalty at a glance",
    groups: [
      ["✨ New", [
        "🎩 Every colony in the colony list and in the All colonies overview now shows its loyalty (orange below 100, red below 40). Your ⭐ main colony can’t be taken, so it shows none.",
      ]],
    ],
  },
  {
    v: "1.0.100", date: "2026-11-01", title: "Commander gear and a Foreman worth the point",
    groups: [
      ["✨ New", [
        "💎 A whole gear system for the commander: five slots (🗡️ weapon, 🦺 armor, ⛑️ helmet, 👢 boots, 🍀 trinket), each in Common, Rare, Epic and Legendary. Every slot has its own main stats: weapons attack, armor defense, helmets protect its health, boots make it walk faster and shorten adventures, trinkets grow health back faster and give more experience.",
        "✦ Rare, Epic and Legendary items also roll 1, 2 or 3 random bonus stats (army attack, colony defense, less health lost, health per day, experience, army carry, bounty, colony production or shorter adventures), stronger with rarity. Less health lost stops at 50% and shorter adventures at 40%.",
        "🎖️ The commander window shows all five slots and what the gear adds up to. Weapons and armor you already have keep their rarity and get their bonus stats now.",
      ]],
      ["🔧 Changed", [
        "❤️ Health grows back by 20 per server day (was 60); trinkets and bonus stats add more. To match, fights cost less health (up to 40 when it leads, 35 when it defends) and so do adventures (3–6, 8–14, 15–25).",
        "⛏️ Foreman gives more: every point now adds 20 of each resource per hour (was 4, times the server speed) and +1% of the colony’s own production, where the commander is stationed. At 10 points that is +200/h of each resource and +10% on a ×1 server (+2,000/h and +10% on ×10), so it still counts in a big colony.",
      ]],
      ["🐞 Fixed", [
        "⛏️ On servers faster than ×1 the Foreman production was multiplied by the server speed twice, so it did not match what the commander window showed. What you see is now exactly what you get.",
      ]],
    ],
  },
  {
    v: "1.0.99", date: "2026-11-01", title: "Health, gear rarities and a fair adventure curve",
    groups: [
      ["✨ New", [
        "❤️ The commander has health (100). Fights cost some (the more its side loses, the more), adventures cost a little, and it grows back by 60 per server day. At 0 it falls. After recovering it comes back with 30.",
        "⚔️ The commander now fights itself: 50 attack and 50 defense, +15 each per level, plus its gear. Leading an army it adds its attack; at home it adds its defense. The skill percentages still apply on top.",
        "💎 Gear comes in four rarities: Common, Rare, Epic and Legendary. Each gives flat points plus a bonus in percent (Common +15 / +2% up to Legendary +120 / +10%). Outer camps and long adventures find rarer gear. New: 🔱 Sunforge Lance and 🪽 Phoenix Mantle. Gear you already own was updated to the new values.",
        "⚡ Free finish: any job that is being built (in the queue or by the commander’s crew) can be finished for free in its last 5 minutes on a ×1 server, 1 minute on ×10 (shorter on faster servers). A <b>Free</b> button appears right in the build queue.",
      ]],
      ["🔧 Changed", [
        "🧭 Adventures gave far too much experience (up to 2.4 levels a day at any level). They now give a fixed amount that grows by 15% per level (Scouting trip ≈12 xp, Expedition ≈35, Deep journey ≈90 at level 1): early levels still go quickly, later battles count most. Each trip costs some health.",
        "🎖️ The commander window shows health and experience bars and its attack and defense points instead of fight counts.",
        "♻️ Scrapping gear gives 30 / 70 / 160 / 350 xp by rarity.",
        "🏘️ Helping hands now have a price: every colony that lends a hand gives up one of its own build queue slots until the helped job is finished or cancelled. Only colonies with a free slot can help; the once-a-day limit is gone.",
        "🌱 Terra rush was far too cheap (skipping an hour cost only 3 hours of the colony’s terra). It now works in the last 30 minutes (was 60), costs 30 hours of the colony’s terra per hour skipped (the free last minutes don’t count), at least 2 hours of it, and every further rush in the same colony on the same server day costs double.",
      ]],
      ["🐞 Fixed", [
        "📜 The 🎁 badge for claimable quest rewards no longer breaks onto two lines in the quest header on desktop browsers.",
      ]],
    ],
  },
  {
    v: "1.0.98", date: "2026-11-01", title: "The first squad finishes for free",
    groups: [
      ["🔧 Changed", [
        "⚡ During the landing, the very first squad (the 5 units the guide asks for) can be finished for free right away, once per account. Ordered more than 5? Then 5 of them come at once and the rest train normally. Everything else keeps the speed rule (5 minutes left on ×1, 1 minute on ×10).",
      ]],
    ],
  },
  {
    v: "1.0.97", date: "2026-11-01", title: "Free finishing follows the server speed",
    groups: [
      ["🔧 Changed", [
        "⚡ During the landing, free finishing now depends on the server speed: it appears once at most 5 minutes are left on a ×1 server, 1 minute on ×10, and less on faster servers (in between it scales smoothly). It works the same way for buildings and for training; the first squad no longer has its own exception.",
      ]],
    ],
  },
  {
    v: "1.0.96", date: "2026-11-01", title: "The Landing: a new start for new colonists",
    groups: [
      ["✨ New", [
        "🛬 The Landing: new colonists learn by doing, one step at a time (about 12 to 15 minutes): upgrade a field, name the colony, build storage, two more fields, the HQ, the barracks, train a first squad, open the map, raid a wrecked lander, join or found an alliance, then protection, how Mars is won and terra. One thing is highlighted at a time, 👉 Show me takes you there, and every action pays a small reward.",
        "🛸 The wrecked lander: a one-time target right next to every new colony. No defenders, a sure win with 250 of every resource and an exciting report. Only you can see it.",
        "⚡ During the landing, a job the next step waits for can be finished for free when at most 3 minutes are left on ×1 (scaled by game speed); the first squad (up to 5 units) always can.",
        "🎖️ The end of the landing sums up what you achieved, shows three next goals and lets you pick a parting gift: resources or troops.",
        "💤 After 45 seconds without a tap during the landing, the guide shows the way again.",
        "🛸 Crash-landing moment with dust and a little shake when a new colony first opens (off when your device asks for reduced motion).",
        "✍️ Sign-up: the name field says right away whether the name is free, and choosing a tribe shows its motto.",
        "🎖️ Every quest now also gives the commander a little experience (shown next to the reward).",
      ]],
      ["🔧 Changed", [
        "📖 The old slide tour no longer starts by itself for new players (the landing replaces it). It is still in Settings → ❓ Tour.",
        "The first-day card is replaced by the landing for new players.",
        "With a sheet open or on the map, the guide sits at the top so it never covers the button you need.",
      ]],
      ["🛠️ Fixed", [
        "🪤 Traps (new in 1.0.95) could not be built: they were missing from the list of buildings. Now they are there.",
        "The send window showed “This ends your own beginner protection” and the simulator for meteor crates. Both are gone there now.",
      ]],
    ],
  },
  {
    v: "1.0.95", date: "2026-11-01", title: "Takeovers, traps, bombards, vacation, sitters, market offers, adventures",
    groups: [
      ["✨ New", [
        "🎩 Taking over colonies: every colony has loyalty (100). Envoys (a new unit for every tribe: Governor, Mother Hen, Overmind) that survive a won attack lower it by 20 to 30 each. At 0 the colony changes hands, if the attacker has enough terra for one more colony. ⭐ Main colonies can never be taken. Buildings and fields stay; the old owner's troops, jobs and armies from there are gone. Loyalty starts at 25 and grows back by about 40 per server day. The HQ shows it when it isn't full.",
        "💥 Bombards (a new siege unit for every tribe: Crater Mortar, Egg Catapult, Spore Cannon; workshop 10, lab 10): survivors of a won attack knock levels off one building. Aim at a building type in the send window or hit a random one. A level L needs 2 × L bombards; the HQ keeps level 1.",
        "🪤 Traps: a new building for every tribe (Trap Field, Snare Patch, Goo Pit). Each level catches 10 attacking ground troops before the fight. Prisoners stay until you let them go, or until their owner wins an attack on that colony.",
        "🏖️ Vacation mode (Settings): 1 to 14 server days. Nobody can attack, raid or spy on you; you can't send troops or goods or take market offers. Your colonies keep growing. All troops must be home and no enemy on the way to start it. Ending it (after at least 1 day) or running out gives a short shield and a 7-day pause before the next one.",
        "🪑 Account sitting (Settings): name up to 2 alliance mates as sitters. They can build, train, research, heal, speed up and call troops home for you, but never send anything, trade, read messages or change the account. You see what they did. Leaving the alliance ends it.",
        "📋 Market offers: post “give X, want Y” (0.5× to 2×) in the market's new Offers tab. Goods and merchants wait at the market for up to one server day. Whoever takes it sends their merchants; both loads travel at once. Up to 3 open offers, optionally only for your alliance.",
        "⭐ Alliance officers: the leader can name up to 4. They can invite, remove plain members, edit the description, pay from the bank and remove plans and shared reports. Diplomacy and roles stay with the leader. A leader who hands over the lead becomes an officer; officers take over first if the leader leaves.",
        "📑 Shared reports: share any report with your alliance (with a short note). The newest 30 show on the alliance page.",
        "🧭 Commander adventures: short, normal or long trips (up to 4 per server day) for experience, resources for the bounty stash and a chance of gear. No risk of falling. While away it doesn't defend, lead or produce.",
        "📊 The commander window shows its stats: fights, wins, win rate, xp earned and adventures.",
        "🔎 Player name fields (alliance invites, sitters, messages) suggest matching players after the first letters.",
      ]],
      ["🔧 Changed", [
        "📈 Commander leveling follows a smoother curve: 100 xp for level 2, then 240, 420, 640 … up to 8,740 for level 20. One fight gives at most one level.",
        "⏳ With a full build queue (or a busy crew) the build button still shows when you'll have enough resources.",
        "🎁 The quest header always shows how many rewards are ready to claim, also while the list is open.",
        "🏖️ Vacation shows on the map, in profiles and in the alliance member list.",
      ]],
      ["🛠️ Fixed", [
        "The database now waits a moment instead of failing when another program briefly holds the file (for example a backup).",
      ]],
    ],
  },
  {
    v: "1.0.94", date: "2026-11-01", title: "Fairer cancelling, luckier waves, patch notes",
    groups: [
      ["✨ New", [
        "📜 This patch notes page. The version number in the footer and a link in Settings open it.",
      ]],
      ["🔧 Changed", [
        "🌊 Wave builder: the chance that later waves land in the same second as the first two is a bit higher. Wave 3: 60%, wave 4: 30%, wave 5: 14%, wave 6: 7%, wave 7: 3%, wave 8: 1.5%.",
        "↩️ Cancelling troop training, research, unit upgrades, healing and terraforming now works like cancelling a build job: the whole cost comes back in the first 30 seconds, as long as no attack or raid is on its way to the colony. Later, or while one is incoming, only 75% come back. The ✖ button shows the percentage when it is 75%. Units that were already trained stay.",
      ]],
    ],
  },
  {
    v: "1.0.93", date: "2026-11-01", title: "Legal page, account deletion, same-second waves",
    groups: [
      ["✨ New", [
        "⚖️ Legal page at /legal with the legal notice (Impressum) and a privacy policy, linked in the footer and in Settings. The owner fills in name, address, email and providers on the admin page (Server tab); the texts are built from that.",
        "🗑️ Delete account in Settings: password plus a second tap. Colonies, troops, messages, reports, badges, alliance posts and stored device data are removed; an empty alliance disappears, leadership passes on; results in the Hall of Fame keep your name.",
        "🌊 Waves: new default “Together”. The first two waves always land in the same second. Every wave after that only lands with them with a chance (shown in the sheet); a wave without luck lands 1 to 2 seconds after the one before.",
      ]],
      ["🔧 Changed", [
        "🎖️ The commander’s crew is one for your whole account: while it builds in one colony it can’t start a job in another, even if the commander walks there.",
        "↩️ Cancelling the last build job: full refund only in the first 30 seconds and only if no attack or raid is incoming; otherwise 75%.",
        "🤝 Build help: you can help every ally, 2 times each per server day (once per job). The old limit of 5 helps per day is gone.",
      ]],
    ],
  },
  {
    v: "1.0.92", date: "2026-11-01", title: "Faster construction and the commander’s crew",
    groups: [
      ["✨ New", [
        "⚡ Speed-ups for build jobs (tap ⚡ next to a job): 🕐 Overtime (once per server day and colony, −20% of a job, at most 60 min), 🏘️ Helping hands (each other colony of yours, once per server day, −10%), 🤝 Alliance help (ask your alliance, −4% per ally up to 20%), 🌱 Terra rush (finish the last 60 minutes of the running job for terra). Free help skips at most half of a job.",
        "🔨 Build help list on the alliance page, with a dot on the tab when allies ask for help.",
        "🎖️ Commander’s crew: where the commander is stationed, its crew builds one extra job next to the queue. Fields and buildings up to level 5, same cost and time, no skill points.",
        "📖 Guide cards for the commander, attack rules, wave builder, diplomacy, badges, speed-ups and the crew.",
      ]],
      ["🔧 Changed", [
        "🔤 Fonts are served by the game itself from a “fonts” folder next to server.js, nothing is loaded from other companies. Without the files the device’s own fonts are used.",
        "🔤 Cleaned up names and comments in the code.",
      ]],
    ],
  },
  {
    v: "1.0.91", date: "2026-11-01", title: "Commander button and settling",
    groups: [
      ["🔧 Changed", [
        "🎖️ The commander button sits alone at the bottom left, level with the compass.",
        "🚶 Settling in after a move takes 1 minute (6 seconds on a 10× server). The walk itself already stops the commander from defending two colonies at once.",
      ]],
    ],
  },
  {
    v: "1.0.90", date: "2026-11-01", title: "Wave builder",
    groups: [
      ["✨ New", [
        "🌊 Wave builder: open it with “Send in waves” in the send window (colonies and monster camps). 2 to 8 waves, each an attack or a raid with its own troops, a Rest button for what is left, the commander on one wave, a gap of 1, 2, 5, 10 or 30 seconds and an optional landing time. All waves leave at once; faster waves march slower so they land in order. Normal rules apply.",
      ]],
      ["🔧 Changed", [
        "🚶 Commander settling time: 30 minutes, shorter on faster servers.",
        "⛏️ The Foreman’s production grows with the game speed, like the fields.",
        "🏅 Round-only badges are marked “this round” on profiles.",
        "✏️ “1 point” instead of “1 points” everywhere.",
        "🎖️ The commander button moved next to the compass on phones.",
      ]],
      ["🐞 Fixed", [
        "The commander toggle in the send window could do nothing on some fresh page loads.",
      ]],
    ],
  },
  {
    v: "1.0.89", title: "Foreman, stash, war marks, higher levels",
    groups: [
      ["✨ New", [
        "🪧 War is a mark only: a leader declares war on another alliance by tag and its members get a red ring on the map for both sides. Either leader can end it. No score, no timer.",
        "📈 Higher maximum levels for smaller steps: HQ and Barracks 20; Warehouse, Granary, Lab, Workshop, Hangar and Hub 15. Costs and times grow a bit faster above level 10, effects a bit slower.",
      ]],
      ["🔧 Changed", [
        "⛏️ Foreman now is the commander’s own production: +4 of each resource per game hour per point (up to 10 points), only in the colony it is stationed in, not while it walks or has fallen. It no longer depends on the size of the colony.",
        "💰 Bounty stash: choose how much of each resource to collect, or take all.",
        "🚶 Moving the commander is slower and has a settling lock.",
      ]],
    ],
  },
  {
    v: "1.0.88", title: "Commander overhaul and attack rules",
    groups: [
      ["✨ New", [
        "🎖️ Commander sheet (Skills and Inventory) from a sidebar chip, a floating button on phones and a card in the Army view.",
        "🎒 24-slot inventory for gear. Camp bounty goes into a Bounty stash.",
        "⛏️ Foreman skill.",
        "🏅 Weekly ranks and achievements are round-only badges and are removed at each round reset. Champion badges stay.",
        "📏 Attack rules: raids on players need at least 5 units; attacks need at least 10 units or 5% of your army, whichever is more; attack slots are 3 plus 1 for every 5 barracks levels (raids don’t use one). Inactive colonies and monster camps are exempt.",
      ]],
      ["🔧 Changed", [
        "💀 The commander can fall: it recovers for a full server day and loses 25% of its progress to the next level. Moving it to another colony is slow and has a lock.",
        "🗡️ Gear gives +1, +2 or +3%; Logistics +2% carry per point.",
        "🪧 Wars were removed (they came back as simple marks in 1.0.89).",
      ]],
    ],
  },
  {
    v: "earlier", title: "Before 1.0.88",
    groups: [
      ["📦 The base game", [
        "Resource fields, colony buildings, build queue, troops of three tribes, barracks, hangar, workshop, lab and upgrades, hospital, spies and siege.",
        "Map with monster camps, landmarks, the Landing Zone, meteors, terrain and colonies founded with settlers and terra.",
        "Marketplace, trade routes and merchants.",
        "Alliances with bank, projects, joint attacks, board and pacts.",
        "Quests, events, rankings, Hall of Fame, badges, reports and messages.",
        "The Relic Hunt and Project Aurora as server goals, beginner protection, farm lists, the guide and the admin page.",
      ]],
    ],
  },
];

const REPORT_REASONS = {
  multi: "More than one account / cheating",
  abuse: "Insults or harassment",
  name: "Offensive name",
  bug: "Using a bug",
  other: "Something else",
};

const OFFENSIVE_NAME_TERMS = ["anal", "asshole", "bastard", "bitch", "bullshit", "cunt", "damn", "dick", "fuck", "kurwa", "motherfucker", "nazi", "nigger", "piss", "porn", "shit", "slut", "whore"];

const SIT_POST_OK = [
  /^\/api\/field\//, /^\/api\/building\//, /^\/api\/construct$/, /^\/api\/cancel$/, /^\/api\/cancel-job$/, /^\/api\/cancel-training$/,
  /^\/api\/train$/, /^\/api\/research$/, /^\/api\/upgrade-unit$/, /^\/api\/heal$/, /^\/api\/boost$/, /^\/api\/switch$/,
  /^\/api\/recall$/, /^\/api\/cancel-move$/, /^\/api\/reports\/seen$/, /^\/api\/sit\/(start|stop)$/, /^\/api\/logout$/,
];

const SIT_GET_NO = [/^\/api\/account/, /^\/api\/messages/, /^\/api\/dev\//, /^\/api\/admin\//];

const VAC_POST_NO = [/^\/api\/send$/, /^\/api\/waves$/, /^\/api\/trade$/, /^\/api\/market\/accept$/];

const SIT_LOG_NAMES = {
  field: "upgraded a field", building: "upgraded a building", construct: "built something", cancel: "cancelled a build", "cancel-job": "cancelled a job",
  "cancel-training": "cancelled training", train: "trained troops", research: "started research", "upgrade-unit": "upgraded a unit", heal: "healed troops",
  boost: "sped something up", recall: "recalled troops", "cancel-move": "cancelled a movement",
};

const PACT_NAMES = { nap: "Non-aggression pact", confed: "Confederation" };

const LEGAL_SHELL = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ · MarsL</title>
<link href="/fonts.css" rel="stylesheet">
<style>
  :root { --ink: #2a1630; --paper: #fff6ea; --line: rgba(42,22,48,0.18); }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; font-family: "Barlow", sans-serif; color: var(--ink); background: linear-gradient(#2a1630, #5b2333 60%, #a8452a); min-height: 100vh; line-height: 1.5; }
  main { max-width: 720px; margin: 0 auto; padding: 22px; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; box-shadow: 0 4px 0 var(--ink); }
  h1 { font-family: "Chakra Petch", sans-serif; margin: 0; font-size: 30px; }
  h2 { font-family: "Chakra Petch", sans-serif; margin: 26px 0 8px; font-size: 22px; padding-top: 14px; border-top: 1px solid var(--line); }
  h3 { margin: 18px 0 4px; font-size: 16px; }
  p, li { margin: 6px 0; }
  ul { padding-left: 20px; }
  .sub { margin-top: 2px; opacity: 0.8; }
  .warn { padding: 8px 12px; background: #ffe3e3; border-radius: 10px; font-weight: 700; }
  a { color: #a8452a; font-weight: 700; }
  details.patch { margin: 10px 0; padding: 10px 14px; border: 1px solid var(--line); border-radius: 12px; background: #fffaf2; }
  details.patch summary { cursor: pointer; font-weight: 800; font-size: 17px; }
  details.patch .ver { display: inline-block; padding: 0 8px; margin-right: 4px; border-radius: 9px; background: #ffd23f; font-family: "Chakra Petch", sans-serif; }
  details.patch .dt { font-weight: 500; opacity: 0.65; margin-left: 4px; }
  details.patch h3 { margin-top: 12px; }
</style>
</head>
<body><main>__BODY__</main></body>
</html>`;

module.exports = { LEGAL_FIELDS, LEGALT, LEGALB, PATCH_NOTES, REPORT_REASONS, OFFENSIVE_NAME_TERMS, SIT_POST_OK, SIT_GET_NO, VAC_POST_NO, SIT_LOG_NAMES, PACT_NAMES, LEGAL_SHELL };