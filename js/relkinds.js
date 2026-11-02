// Every kind of relationship the app knows, in the five languages.
// One line per kind:  key | what the other person is called (kind key) | the general kind (for specific ones: "mother" is a "parent") | en | pt | de | fr | es
// Each language is a list of words separated by ";". The first word is how it is shown in that language; the others are
// other ways to write it (all of them are understood, in any language, and suggested while typing).
// If the other person's gender is not known, the other side is shown in its general form: a "mother" has a "child", and a
// "son-in-law" has a "parent-in-law".

const TABLE = `
partner|partner|-|Partner;Life partner;Domestic partner;Significant other|Parceiro(a);Parceiro;Parceira;Companheiro(a) de vida|Partner(in);Partner;Partnerin;Lebenspartner;Lebenspartnerin;Lebensgefährte;Lebensgefährtin|Partenaire;Conjoint;Conjointe;Compagnon;Compagne|Pareja;Pareja sentimental;Compañero sentimental;Compañera sentimental
spouse|spouse|-|Spouse;Married partner|Cônjuge;Conjuge;Esposo(a)|Ehepartner(in);Ehepartner;Ehepartnerin;Gatte;Gattin|Époux/épouse;Epoux;Conjoint marié|Cónyuge;Conyuge;Esposo/a
husband|spouse|spouse|Husband;Hubby|Marido;Esposo|Ehemann;Mann;Gatte|Mari;Époux|Marido;Esposo
wife|spouse|spouse|Wife;Wifey|Esposa;Mulher|Ehefrau;Frau;Gattin|Épouse;Femme|Esposa;Mujer
fiance|fiance|-|Fiancé(e);Fiancé;Fiancée;Fiance;Fiancee;Betrothed|Noivo(a);Noivo;Noiva|Verlobte(r);Verlobter;Verlobte|Fiancé(e);Fiancé;Fiancée|Prometido/a;Prometido;Prometida
boyfriend|partner|partner|Boyfriend;BF|Namorado|Fester Freund;Freund (Partner);Liebster|Petit ami;Copain;Petit copain|Novio
girlfriend|partner|partner|Girlfriend;GF|Namorada|Feste Freundin;Freundin (Partnerin);Liebste|Petite amie;Copine;Petite copine|Novia
ex|ex|-|Ex;Former partner;Ex-partner|Ex;Ex-parceiro(a)|Ex;Ex-Partner(in)|Ex;Ex-conjoint(e)|Ex;Expareja
exSpouse|ex|ex|Ex-spouse|Ex-cônjuge|Ex-Ehepartner(in);Ex-Ehepartner|Ex-conjoint marié|Excónyuge;Ex cónyuge
exHusband|ex|ex|Ex-husband|Ex-marido|Ex-Mann;Exmann;Ex-Ehemann|Ex-mari|Exmarido;Ex marido;Ex esposo
exWife|ex|ex|Ex-wife|Ex-mulher;Ex-esposa|Ex-Frau;Exfrau;Ex-Ehefrau|Ex-femme;Ex-épouse|Exmujer;Ex mujer;Ex esposa
exBoyfriend|ex|ex|Ex-boyfriend|Ex-namorado|Ex-Freund|Ex-petit ami;Ex-copain|Exnovio;Ex novio
exGirlfriend|ex|ex|Ex-girlfriend|Ex-namorada|Ex-Freundin|Ex-petite amie;Ex-copine|Exnovia;Ex novia

parent|child|-|Parent|Pai/mãe;Progenitor(a)|Elternteil;Eltern|Parent|Padre/madre;Progenitor
mother|child|parent|Mother;Mom;Mum;Mommy;Mummy;Mama;Mum|Mãe;Mamãe;Mae;Mainha|Mutter;Mama;Mami;Mutti|Mère;Maman|Madre;Mamá;Mama;Mami
father|child|parent|Father;Dad;Daddy;Papa|Pai;Papai;Painho|Vater;Papa;Vati;Papi|Père;Papa|Padre;Papá;Papa;Papi
child|parent|-|Child;Kid|Filho(a);Filho ou filha|Kind|Enfant|Hijo/a;Hijo o hija
son|parent|child|Son|Filho|Sohn|Fils|Hijo
daughter|parent|child|Daughter|Filha|Tochter|Fille|Hija
sibling|sibling|-|Sibling|Irmão/irmã;Irmãos|Geschwister;Geschwisterteil|Frère/sœur;Frere/soeur|Hermano/a;Hermano o hermana
brother|sibling|sibling|Brother;Bro|Irmão;Mano|Bruder|Frère|Hermano
sister|sibling|sibling|Sister;Sis|Irmã;Mana|Schwester|Sœur;Soeur|Hermana
twin|twin|-|Twin;Twin brother;Twin sister|Gêmeo(a);Gêmeo;Gêmea;Gemeo|Zwilling;Zwillingsbruder;Zwillingsschwester|Jumeau/jumelle;Jumeau;Jumelle|Gemelo/a;Gemelo;Gemela;Mellizo;Melliza
halfSibling|halfSibling|sibling|Half-sibling|Meio-irmão/irmã|Halbgeschwister|Demi-frère/sœur|Medio hermano/a
halfBrother|halfSibling|halfSibling|Half-brother;Half brother|Meio-irmão;Meio irmão|Halbbruder|Demi-frère|Medio hermano
halfSister|halfSibling|halfSibling|Half-sister;Half sister|Meia-irmã;Meia irmã|Halbschwester|Demi-sœur;Demi-soeur|Media hermana
grandparent|grandchild|-|Grandparent|Avô/avó;Avos;Avo|Großelternteil;Grosselternteil;Großeltern|Grand-parent;Grands-parents|Abuelo/a;Abuelos
grandmother|grandchild|grandparent|Grandmother;Grandma;Granny;Nan;Nana;Nanna;Gran|Avó;Vovó;Vó|Großmutter;Oma;Omi;Grossmutter|Grand-mère;Mamie;Mémé;Grand mere|Abuela;Abuelita;Yaya;Abu
grandfather|grandchild|grandparent|Grandfather;Grandpa;Granddad;Grandad;Gramps|Avô;Vovô;Vô|Großvater;Opa;Opi;Grossvater|Grand-père;Papy;Pépé;Grand pere|Abuelo;Abuelito;Yayo
grandchild|grandparent|-|Grandchild;Grandkid|Neto(a);Netos|Enkelkind;Enkel(in)|Petit-enfant;Petits-enfants|Nieto/a;Nietos
grandson|grandparent|grandchild|Grandson|Neto|Enkel;Enkelsohn|Petit-fils|Nieto
granddaughter|grandparent|grandchild|Granddaughter|Neta|Enkelin;Enkeltochter|Petite-fille|Nieta
greatGrandparent|greatGrandchild|-|Great-grandparent|Bisavô/bisavó;Bisavos;Bisavo|Urgroßelternteil;Urgroßeltern;Urgrosseltern|Arrière-grand-parent|Bisabuelo/a
greatGrandmother|greatGrandchild|greatGrandparent|Great-grandmother;Great-grandma|Bisavó|Urgroßmutter;Uroma|Arrière-grand-mère|Bisabuela
greatGrandfather|greatGrandchild|greatGrandparent|Great-grandfather;Great-grandpa|Bisavô|Urgroßvater;Uropa|Arrière-grand-père|Bisabuelo
greatGrandchild|greatGrandparent|-|Great-grandchild|Bisneto(a)|Urenkelkind;Urenkel(in)|Arrière-petit-enfant|Bisnieto/a
greatGrandson|greatGrandparent|greatGrandchild|Great-grandson|Bisneto|Urenkel|Arrière-petit-fils|Bisnieto
greatGranddaughter|greatGrandparent|greatGrandchild|Great-granddaughter|Bisneta|Urenkelin|Arrière-petite-fille|Bisnieta
ancestor|descendant|-|Ancestor;Forefather|Antepassado(a);Antepassado|Vorfahr(in);Vorfahre;Vorfahrin;Ahne|Ancêtre|Antepasado/a;Antepasado
descendant|ancestor|-|Descendant|Descendente|Nachkomme|Descendant(e)|Descendiente
pibling|nibling|-|Uncle/aunt;Uncle or aunt;Pibling|Tio(a);Tio ou tia|Onkel/Tante;Onkel oder Tante|Oncle/tante;Oncle ou tante|Tío/a;Tio o tia
uncle|nibling|pibling|Uncle|Tio|Onkel|Oncle|Tío
aunt|nibling|pibling|Aunt;Auntie;Aunty|Tia|Tante|Tante|Tía
nibling|pibling|-|Nephew/niece;Nephew or niece;Nibling|Sobrinho(a)|Neffe/Nichte|Neveu/nièce;Neveu ou nièce|Sobrino/a
nephew|pibling|nibling|Nephew|Sobrinho|Neffe|Neveu|Sobrino
niece|pibling|nibling|Niece|Sobrinha|Nichte|Nièce;Niece|Sobrina
greatPibling|greatNibling|-|Great-uncle/aunt;Great-uncle or great-aunt|Tio(a)-avô(ó)|Großonkel/Großtante|Grand-oncle/grand-tante|Tío/a abuelo/a
greatUncle|greatNibling|greatPibling|Great-uncle;Grand-uncle|Tio-avô;Tio avô|Großonkel;Grossonkel|Grand-oncle|Tío abuelo
greatAunt|greatNibling|greatPibling|Great-aunt;Grand-aunt|Tia-avó;Tia avó|Großtante;Grosstante|Grand-tante|Tía abuela
greatNibling|greatPibling|-|Great-nephew/niece|Sobrinho(a)-neto(a)|Großneffe/Großnichte|Petit-neveu/petite-nièce|Sobrino/a nieto/a
greatNephew|greatPibling|greatNibling|Great-nephew;Grandnephew|Sobrinho-neto|Großneffe|Petit-neveu|Sobrino nieto
greatNiece|greatPibling|greatNibling|Great-niece;Grandniece|Sobrinha-neta|Großnichte|Petite-nièce|Sobrina nieta
cousin|cousin|-|Cousin|Primo(a);Primo;Prima|Cousin(e);Cousin;Cousine;Vetter;Base|Cousin(e);Cousin;Cousine|Primo/a;Primo;Prima
secondCousin|secondCousin|-|Second cousin|Primo(a) de segundo grau;Primo de segundo grau|Cousin(e) zweiten Grades;Cousin zweiten Grades;Cousine zweiten Grades|Cousin(e) issu(e) de germain;Petit-cousin;Petite-cousine|Primo/a segundo/a;Primo segundo;Prima segunda;Primo de segundo grado
relative|relative|-|Relative;Family member|Parente;Familiar|Verwandte(r);Verwandter;Verwandte;Familienmitglied|Membre de la famille;Proche|Pariente;Familiar

parentInLaw|childInLaw|-|Parent-in-law|Sogro(a);Sogros|Schwiegerelternteil;Schwiegereltern|Beau-parent;Beaux-parents|Suegro/a;Suegros
motherInLaw|childInLaw|parentInLaw|Mother-in-law;MIL|Sogra|Schwiegermutter|Belle-mère|Suegra
fatherInLaw|childInLaw|parentInLaw|Father-in-law;FIL|Sogro|Schwiegervater|Beau-père|Suegro
childInLaw|parentInLaw|-|Child-in-law|Genro/nora|Schwiegerkind|Gendre/belle-fille|Yerno/nuera
sonInLaw|parentInLaw|childInLaw|Son-in-law|Genro|Schwiegersohn|Gendre|Yerno
daughterInLaw|parentInLaw|childInLaw|Daughter-in-law|Nora|Schwiegertochter|Belle-fille;Bru|Nuera
siblingInLaw|siblingInLaw|-|Sibling-in-law|Cunhado(a)|Schwager/Schwägerin|Beau-frère/belle-sœur|Cuñado/a
brotherInLaw|siblingInLaw|siblingInLaw|Brother-in-law|Cunhado|Schwager|Beau-frère|Cuñado
sisterInLaw|siblingInLaw|siblingInLaw|Sister-in-law|Cunhada|Schwägerin;Schwagerin|Belle-sœur;Belle-soeur|Cuñada
coParentInLaw|coParentInLaw|-|Co-parent-in-law|Consogro(a)|Schwiegereltern des Kindes|Co-beau-parent|Consuegro/a
inLaw|inLaw|-|In-law|Parente por afinidade;Familiar por afinidade|Angeheiratete(r);Angeheiratet|Belle-famille|Pariente político;Familiar político;Familia política

stepParent|stepChild|-|Stepparent;Step-parent|Padrasto/madrasta|Stiefelternteil|Parâtre/marâtre|Padrastro/madrastra
stepmother|stepChild|stepParent|Stepmother;Stepmom|Madrasta|Stiefmutter|Belle-mère (remariage);Marâtre|Madrastra
stepfather|stepChild|stepParent|Stepfather;Stepdad|Padrasto|Stiefvater|Beau-père (remariage);Parâtre|Padrastro
stepChild|stepParent|-|Stepchild|Enteado(a)|Stiefkind|Beau-enfant;Enfant du conjoint|Hijastro/a
stepson|stepParent|stepChild|Stepson|Enteado|Stiefsohn|Beau-fils (remariage)|Hijastro
stepdaughter|stepParent|stepChild|Stepdaughter|Enteada|Stieftochter|Belle-fille (remariage)|Hijastra
stepSibling|stepSibling|-|Stepsibling;Step-sibling|Irmão/irmã postiço(a)|Stiefgeschwister|Quasi-frère/sœur|Hermanastro/a
stepBrother|stepSibling|stepSibling|Stepbrother;Step-brother|Irmão postiço|Stiefbruder|Quasi-frère|Hermanastro
stepSister|stepSibling|stepSibling|Stepsister;Step-sister|Irmã postiça|Stiefschwester|Quasi-sœur;Quasi-soeur|Hermanastra
adoptiveParent|adoptedChild|-|Adoptive parent|Pai/mãe adotivo(a)|Adoptivelternteil|Parent adoptif|Padre/madre adoptivo/a
adoptiveMother|adoptedChild|adoptiveParent|Adoptive mother|Mãe adotiva|Adoptivmutter|Mère adoptive|Madre adoptiva
adoptiveFather|adoptedChild|adoptiveParent|Adoptive father|Pai adotivo|Adoptivvater|Père adoptif|Padre adoptivo
adoptedChild|adoptiveParent|-|Adopted child|Filho(a) adotivo(a)|Adoptivkind|Enfant adopté|Hijo/a adoptivo/a
adoptedSon|adoptiveParent|adoptedChild|Adopted son|Filho adotivo|Adoptivsohn|Fils adoptif|Hijo adoptivo
adoptedDaughter|adoptiveParent|adoptedChild|Adopted daughter|Filha adotiva|Adoptivtochter|Fille adoptive|Hija adoptiva
fosterParent|fosterChild|-|Foster parent|Pai/mãe de acolhimento;Família de acolhimento|Pflegeelternteil;Pflegeeltern|Parent d'accueil;Famille d'accueil|Padre/madre de acogida;Familia de acogida
fosterMother|fosterChild|fosterParent|Foster mother|Mãe de acolhimento|Pflegemutter|Mère d'accueil|Madre de acogida
fosterFather|fosterChild|fosterParent|Foster father|Pai de acolhimento|Pflegevater|Père d'accueil|Padre de acogida
fosterChild|fosterParent|-|Foster child|Filho(a) de acolhimento|Pflegekind|Enfant accueilli|Hijo/a de acogida
fosterSon|fosterParent|fosterChild|Foster son|Filho de acolhimento|Pflegesohn|Fils accueilli|Hijo de acogida
fosterDaughter|fosterParent|fosterChild|Foster daughter|Filha de acolhimento|Pflegetochter|Fille accueillie|Hija de acogida
godparent|godchild|-|Godparent|Padrinho/madrinha;Padrinhos|Pate/Patin|Parrain/marraine|Padrino/madrina
godmother|godchild|godparent|Godmother|Madrinha|Patin;Taufpatin;Patentante|Marraine|Madrina
godfather|godchild|godparent|Godfather|Padrinho|Pate;Taufpate;Patenonkel|Parrain|Padrino
godchild|godparent|-|Godchild|Afilhado(a)|Patenkind|Filleul(e)|Ahijado/a
godson|godparent|godchild|Godson|Afilhado|Patensohn|Filleul|Ahijado
goddaughter|godparent|godchild|Goddaughter|Afilhada|Patentochter|Filleule|Ahijada
coGodparent|coGodparent|-|Co-godparent;Compadre;Comadre|Compadre/comadre;Compadre;Comadre|Compadre/Comadre|Compère/commère;Compère;Commère|Compadre/comadre;Compadre;Comadre
guardian|ward|-|Guardian;Legal guardian|Tutor(a) legal;Guardião;Responsável legal|Vormund;Erziehungsberechtigte(r)|Tuteur/tutrice;Tuteur;Tutrice|Tutor(a) legal;Tutor legal
ward|guardian|-|Ward|Tutelado(a);Pupilo(a)|Mündel|Pupille|Tutelado/a;Pupilo/a

friend|friend|-|Friend;Mate;Buddy;Pal|Amigo(a);Amigo;Amiga;Amigos|Freund(in);Freund;Freundin;Kumpel|Ami·e;Ami;Amie;Pote|Amigo/a;Amigo;Amiga
bestFriend|bestFriend|-|Best friend;BFF;Bestie|Melhor amigo(a);Melhor amigo;Melhor amiga|Beste(r) Freund(in);Bester Freund;Beste Freundin;Bestie|Meilleur·e ami·e;Meilleur ami;Meilleure amie|Mejor amigo/a;Mejor amigo;Mejor amiga
closeFriend|closeFriend|-|Close friend|Amigo(a) próximo(a);Amigo próximo;Amigo íntimo;Amigo chegado|Enge(r) Freund(in);Enger Freund;Enge Freundin|Ami·e proche;Ami proche;Amie proche|Amigo/a cercano/a;Amigo cercano;Amiga cercana;Amigo íntimo
childhoodFriend|childhoodFriend|-|Childhood friend|Amigo(a) de infância;Amigo de infância|Jugendfreund(in);Kindheitsfreund;Jugendfreund;Jugendfreundin|Ami·e d'enfance;Ami d'enfance|Amigo/a de la infancia;Amigo de la infancia;Amigo de toda la vida
oldFriend|oldFriend|-|Old friend|Amigo(a) antigo(a);Amigo antigo;Amigo de longa data|Alte(r) Freund(in);Alter Freund;Alte Freundin;Langjähriger Freund|Vieil(le) ami(e);Vieil ami;Vieille amie;Ami de longue date|Viejo/a amigo/a;Viejo amigo;Vieja amiga;Amigo de hace años
schoolFriend|schoolFriend|-|School friend|Amigo(a) da escola;Amigo da escola|Schulfreund(in);Schulfreund;Schulfreundin|Ami·e d'école;Camarade d'école|Amigo/a del colegio;Amigo del cole;Amigo de la escuela
universityFriend|universityFriend|-|College friend;University friend;Uni friend|Amigo(a) da faculdade;Amigo da faculdade;Amigo da universidade|Studienfreund(in);Studienfreund;Studienfreundin;Unifreund|Ami·e de fac;Ami de fac;Ami d'université|Amigo/a de la universidad;Amigo de la uni;Amigo de la facultad
familyFriend|familyFriend|-|Family friend|Amigo(a) da família;Amigo da família|Familienfreund(in);Familienfreund;Freund der Familie|Ami·e de la famille;Ami de la famille|Amigo/a de la familia;Amigo de la familia
friendOfFriend|friendOfFriend|-|Friend of a friend|Amigo(a) de um amigo;Amigo de um amigo|Freund(in) eines Freundes;Freund eines Freundes|Ami·e d'un ami;Ami d'un ami|Amigo/a de un amigo;Amigo de un amigo
penPal|penPal|-|Pen pal;Penfriend|Correspondente;Amigo por correspondência|Brieffreund(in);Brieffreund;Brieffreundin|Correspondant(e);Correspondant;Correspondante|Amigo/a por correspondencia;Amigo por correspondencia
acquaintance|acquaintance|-|Acquaintance|Conhecido(a);Conhecido;Conhecida|Bekannte(r);Bekannter;Bekannte|Connaissance|Conocido/a;Conocido;Conocida
neighbor|neighbor|-|Neighbor;Neighbour|Vizinho(a);Vizinho;Vizinha|Nachbar(in);Nachbar;Nachbarin|Voisin(e);Voisin;Voisine|Vecino/a;Vecino;Vecina
roommate|roommate|-|Roommate;Flatmate;Housemate|Colega de quarto;Colega de casa;Colega de apartamento|Mitbewohner(in);Mitbewohner;Mitbewohnerin;WG-Mitbewohner|Colocataire;Coloc|Compañero/a de piso;Compañero de piso;Compañera de piso;Compañero de cuarto;Compañero de casa
landlord|tenant|-|Landlord;Landlady;Lessor|Senhorio(a);Senhorio;Proprietário(a);Proprietário;Locador|Vermieter(in);Vermieter;Vermieterin|Propriétaire;Bailleur|Casero/a;Casero;Arrendador;Propietario/a
tenant|landlord|-|Tenant;Renter;Lessee|Inquilino(a);Inquilino;Inquilina;Locatário|Mieter(in);Mieter;Mieterin|Locataire|Inquilino/a;Inquilino;Arrendatario
classmate|classmate|-|Classmate;Schoolmate|Colega de turma;Colega de classe;Colega de sala|Klassenkamerad(in);Klassenkamerad;Klassenkameradin;Mitschüler(in);Mitschüler|Camarade de classe;Camarade|Compañero/a de clase;Compañero de clase;Compañera de clase;Compañero de colegio
teammate|teammate|-|Teammate;Team member|Colega de equipe;Colega de equipa;Companheiro de equipe|Teamkollege/-kollegin;Teamkollege;Teamkollegin;Mannschaftskamerad;Mitspieler(in);Mitspieler|Coéquipier/coéquipière;Coequipier;Coéquipier;Coéquipière|Compañero/a de equipo;Compañero de equipo
bandmate|bandmate|-|Bandmate|Colega de banda|Bandkollege/-kollegin;Bandkollege;Bandkollegin;Bandmitglied|Membre du groupe;Camarade de groupe|Compañero/a de banda;Compañero de banda

colleague|colleague|-|Colleague;Coworker;Co-worker;Workmate|Colega;Colega de trabalho;Colegas|Kolleg(in);Kollege;Kollegin;Arbeitskollege;Arbeitskollegin|Collègue;Collegue;Collègue de travail|Colega;Compañero de trabajo;Compañera de trabajo;Colega de trabajo
formerColleague|formerColleague|-|Former colleague;Ex-colleague|Ex-colega;Ex-colega de trabalho|Ehemalige(r) Kolleg(in);Ehemaliger Kollege;Ehemalige Kollegin;Ex-Kollege;Ex-Kollegin|Ancien collègue;Ancienne collègue;Ex-collègue|Excolega;Ex colega;Antiguo compañero de trabajo;Excompañero
boss|subordinate|-|Boss;Manager;Supervisor;Line manager|Chefe;Gerente;Gestor(a);Supervisor(a);Superior|Chef(in);Chef;Chefin;Vorgesetzte(r);Vorgesetzter;Vorgesetzte;Teamleiter(in)|Chef(fe);Chef;Cheffe;Supérieur;Responsable;Patron;Patronne|Jefe/a;Jefe;Jefa;Supervisor(a);Gerente;Superior;Responsable
subordinate|boss|-|Subordinate;Direct report;Report|Subordinado(a);Subordinado;Subordinada|Untergebene(r);Untergebener;Untergebene|Subordonné(e);Subordonné;Subordonnée|Subordinado/a;Subordinado;Subordinada
employer|employee|-|Employer|Empregador(a);Empregador;Empregadora|Arbeitgeber(in);Arbeitgeber;Arbeitgeberin|Employeur/employeuse;Employeur;Employeuse|Empleador(a);Empleador;Empleadora
employee|employer|-|Employee;Staff member|Funcionário(a);Funcionário;Funcionária;Empregado(a);Empregado;Empregada;Colaborador(a)|Mitarbeiter(in);Mitarbeiter;Mitarbeiterin;Angestellte(r);Angestellter;Angestellte|Employé(e);Employé;Employée;Salarié(e)|Empleado/a;Empleado;Empleada;Trabajador(a)
businessPartner|businessPartner|-|Business partner|Sócio(a);Sócio;Sócia;Parceiro(a) de negócios;Parceiro de negócios|Geschäftspartner(in);Geschäftspartner;Geschäftspartnerin;Teilhaber(in);Teilhaber|Associé(e);Associé;Associée;Partenaire d'affaires;Partenaire commercial|Socio/a;Socio;Socia;Socio comercial
cofounder|cofounder|-|Co-founder;Cofounder|Cofundador(a);Cofundador;Cofundadora|Mitgründer(in);Mitgründer;Mitgründerin;Mitbegründer(in);Mitbegründer|Cofondateur/cofondatrice;Cofondateur;Cofondatrice|Cofundador(a);Cofundador;Cofundadora
client|serviceProvider|-|Client;Customer|Cliente;Clientes|Kunde/Kundin;Kunde;Kundin;Klient(in);Klient|Client(e);Client;Cliente|Cliente;Clientes
serviceProvider|client|-|Service provider;Vendor;Supplier;Contractor|Prestador(a) de serviços;Prestador de serviços;Fornecedor(a);Fornecedor|Dienstleister(in);Dienstleister;Lieferant(in);Lieferant|Prestataire;Fournisseur|Proveedor(a);Proveedor;Proveedora;Prestador de servicios
mentor|mentee|-|Mentor|Mentor(a);Mentor;Mentora|Mentor(in);Mentor;Mentorin|Mentor|Mentor(a);Mentor;Mentora
mentee|mentor|-|Mentee;Protégé|Mentorado(a);Mentorado;Mentorada|Mentee;Schützling|Mentoré(e);Mentoré;Mentorée;Protégé(e)|Mentorizado/a;Mentee;Mentorado;Protegido
teacher|student|-|Teacher;Instructor;Tutor;Lecturer;Professor|Professor(a);Professor;Professora;Docente;Instrutor(a);Mestre|Lehrer(in);Lehrer;Lehrerin;Dozent(in);Dozent;Dozentin;Professor(in);Professorin;Ausbilder(in)|Enseignant(e);Professeur;Prof;Instituteur;Institutrice;Maître;Maîtresse;Enseignant;Enseignante|Profesor(a);Profesor;Profesora;Maestro/a;Maestro;Maestra;Docente;Instructor(a)
student|teacher|-|Student;Pupil|Aluno(a);Aluno;Aluna;Estudante;Discípulo|Schüler(in);Schüler;Schülerin;Student(in);Student;Studentin|Élève;Eleve;Étudiant(e);Étudiant;Étudiante|Alumno/a;Alumno;Alumna;Estudiante;Discípulo
advisor|advisee|-|Advisor;Adviser;Academic advisor;PhD supervisor;Thesis supervisor;Doctoral advisor|Orientador(a);Orientador;Orientadora|Betreuer(in);Doktorvater;Doktormutter;Betreuer;Betreuerin|Directeur/directrice de thèse;Directeur de thèse;Directrice de thèse;Encadrant(e)|Director(a) de tesis;Tutor de tesis;Director de tesis;Directora de tesis;Orientador
advisee|advisor|-|Advisee;PhD student;Doctoral student;Thesis student|Orientando(a);Orientando;Orientanda|Doktorand(in);Doktorand;Doktorandin;Betreute(r)|Doctorant(e);Doctorant;Doctorante;Thésard(e)|Doctorando/a;Doctorando;Doctoranda;Tesista
coach|athlete|-|Coach;Trainer|Treinador(a);Treinador;Treinadora;Coach;Técnico(a)|Trainer(in);Trainer;Trainerin;Coach|Entraîneur/entraîneuse;Entraineur;Entraîneur;Entraîneuse;Coach|Entrenador(a);Entrenador;Entrenadora;Coach
athlete|coach|-|Athlete;Player;Trainee|Atleta;Jogador(a);Jogador;Jogadora;Treinando(a)|Sportler(in);Sportler;Sportlerin;Spieler(in);Spieler;Spielerin|Athlète;Athlete;Joueur;Joueuse;Sportif(ve)|Atleta;Jugador(a);Jugador;Jugadora;Deportista
doctor|patient|-|Doctor;GP;Physician;Dr|Médico(a);Médico;Médica;Doutor(a);Doutor;Doutora|Arzt/Ärztin;Arzt;Ärztin;Hausarzt;Hausärztin;Doktor|Médecin;Medecin;Docteur;Médecin traitant|Médico/a;Médico;Médica;Doctor(a);Doctor;Doctora
dentist|patient|-|Dentist|Dentista|Zahnarzt/Zahnärztin;Zahnarzt;Zahnärztin|Dentiste|Dentista;Odontólogo/a
nurse|patient|-|Nurse|Enfermeiro(a);Enfermeiro;Enfermeira|Krankenpfleger(in);Krankenpfleger;Krankenschwester;Pfleger(in);Pfleger|Infirmier/infirmière;Infirmier;Infirmière|Enfermero/a;Enfermero;Enfermera
physiotherapist|patient|-|Physiotherapist;Physio|Fisioterapeuta|Physiotherapeut(in);Physiotherapeut;Physiotherapeutin;Physio|Kinésithérapeute;Kiné;Kinesitherapeute|Fisioterapeuta;Fisio
therapist|patient|-|Therapist;Counselor;Psychologist;Psychotherapist|Terapeuta;Psicólogo(a);Psicólogo;Psicóloga;Psicoterapeuta|Therapeut(in);Therapeut;Therapeutin;Psychologe;Psychologin;Psychotherapeut(in)|Thérapeute;Therapeute;Psychologue;Psychothérapeute|Terapeuta;Psicólogo/a;Psicólogo;Psicóloga;Psicoterapeuta
healthProvider|patient|-|Healthcare provider;Health professional;Specialist|Profissional de saúde;Especialista|Gesundheitsdienstleister(in);Facharzt;Fachärztin;Spezialist(in)|Professionnel de santé;Spécialiste|Profesional sanitario;Especialista
patient|healthProvider|-|Patient|Paciente;Pacientes|Patient(in);Patient;Patientin|Patient(e);Patient;Patiente|Paciente;Pacientes
lawyer|client|-|Lawyer;Attorney;Solicitor;Barrister|Advogado(a);Advogado;Advogada|Anwalt/Anwältin;Anwalt;Anwältin;Rechtsanwalt;Rechtsanwältin|Avocat(e);Avocat;Avocate|Abogado/a;Abogado;Abogada
accountant|client|-|Accountant;Tax advisor;Bookkeeper|Contador(a);Contador;Contadora;Contabilista|Steuerberater(in);Steuerberater;Steuerberaterin;Buchhalter(in);Buchhalter;Buchhalterin|Comptable;Expert-comptable|Contable;Contador(a);Contador;Contadora;Asesor fiscal
caregiver|careRecipient|-|Caregiver;Carer;Care worker|Cuidador(a);Cuidador;Cuidadora|Pflegekraft;Pflegeperson;Betreuungsperson|Aidant(e);Aidant;Aidante;Auxiliaire de vie|Cuidador(a);Cuidador;Cuidadora
careRecipient|caregiver|-|Care recipient;Person in care|Pessoa cuidada;Assistido(a)|Pflegebedürftige(r);Pflegebedürftiger;Pflegebedürftige|Personne aidée;Bénéficiaire|Persona cuidada;Dependiente
`;

const clean = (text) => text.trim();

// kinds: [{ key, inverse, base, terms: { en: [...], pt: [...], de: [...], fr: [...], es: [...] } }], in the order above.
export const KINDS = TABLE.split('\n')
  .filter((line) => line.trim())
  .map((line) => {
    const [key, inverse, base, ...langs] = line.split('|');
    const terms = {};
    ['en', 'pt', 'de', 'fr', 'es'].forEach((lang, i) => {
      terms[lang] = langs[i].split(';').map(clean).filter(Boolean);
    });
    return { key, inverse, base: base === '-' ? null : base, terms };
  });
