-- Migration 40: Seed legal_policies with 6 policies in 4 languages (en, fr, pt, ss)
-- Idempotent: only inserts if the slug does not already exist.

INSERT INTO legal_policies (id, policy_id, slug, title_en, title_fr, title_pt, title_ss, content_en, content_fr, content_pt, content_ss, version, created_at, updated_at)
SELECT
    gen_random_uuid(), gen_random_uuid(), v.slug, v.title_en, v.title_fr, v.title_pt, v.title_ss,
    v.content_en, v.content_fr, v.content_pt, v.content_ss, 1, now(), now()
FROM (VALUES
    ('terms', 'Terms of Service', 'Conditions d''utilisation', 'Termos de Serviço', 'Imigomo Yekusebentisa', '# Terms of Service

**Effective Date:** 1 January 2026
**Version:** 1.0
**Applicable Law:** Cooperative Societies Act (Eswatini), Electronic Transactions Act

## 1. Introduction

Welcome to CoopData, the cooperative financial data management platform operated by the Ministry of Cooperatives of the Kingdom of Eswatini. These Terms of Service ("Terms") govern your access to and use of the CoopData platform, its website, mobile applications, and associated services (collectively, the "Service").

By registering an account, accessing, or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use the Service.

## 2. Definitions

- **"Cooperative"** means a registered cooperative society under the Cooperative Societies Act of Eswatini.
- **"User"** means any individual who registers an account or accesses the Service.
- **"Personal Data"** means any information relating to an identified or identifiable natural person.
- **"Financial Data"** means data relating to the financial statements, transactions, and records of a cooperative.
- **"Content"** means all data, text, files, information, and materials submitted to or stored on the Service.

## 3. Eligibility and Account Registration

3.1 You must be at least 18 years of age to register an account.
3.2 You must provide accurate, current, and complete information during registration.
3.3 You are responsible for maintaining the confidentiality of your login credentials.
3.4 You are responsible for all activities that occur under your account.
3.5 You must notify CoopData immediately of any unauthorized use of your account.

## 4. Acceptable Use

4.1 You agree not to misuse the Service, including but not limited to:
- Attempting to access, tamper with, or use non-public areas of the Service;
- Uploading malicious code, viruses, or harmful content;
- Interfering with the operation of the Service or other users'' access;
- Using the Service for any unlawful purpose;
- Submitting false, misleading, or fraudulent information;
- Attempting to probe, scan, or test the vulnerability of the Service.

## 5. User Content and Data

5.1 You retain ownership of the Content you submit to the Service.
5.2 You grant CoopData a limited license to store, process, and display your Content solely to provide the Service.
5.3 You represent that you have the right to submit all Content and that it does not violate any law or third-party rights.
5.4 CoopData may aggregate anonymized data for statistical and benchmarking purposes.

## 6. Intellectual Property

6.1 The Service, including its software, design, text, graphics, and logos, is owned by CoopData or its licensors.
6.2 You may not copy, modify, distribute, sell, or lease any part of the Service without prior written consent.
6.3 You may not reverse engineer or attempt to extract the source code of the Service.

## 7. Privacy and Data Protection

7.1 Your use of the Service is subject to our Privacy Policy, which is incorporated into these Terms by reference.
7.2 CoopData processes Personal Data in accordance with applicable data protection laws, including the Data Protection Act of Eswatini.
7.3 You consent to the collection, processing, and storage of your Personal Data as described in the Privacy Policy.

## 8. Service Availability and Modifications

8.1 CoopData may modify, suspend, or discontinue any part of the Service at any time.
8.2 CoopData may update these Terms from time to time. Material changes will be communicated to you, and continued use of the Service constitutes acceptance of the revised Terms.
8.3 We will provide reasonable notice of scheduled maintenance that may affect the Service.

## 9. Termination

9.1 You may terminate your account at any time by contacting support.
9.2 CoopData may suspend or terminate your access if you violate these Terms or applicable law.
9.3 Upon termination, your right to use the Service ceases immediately.
9.4 Statutory financial records may be retained in accordance with applicable retention requirements.

## 10. Disclaimer of Warranties

10.1 The Service is provided "as is" and "as available" without warranties of any kind, whether express or implied.
10.2 CoopData does not warrant that the Service will be uninterrupted, error-free, or secure.
10.3 CoopData does not provide legal, financial, or accounting advice.

## 11. Limitation of Liability

11.1 To the maximum extent permitted by law, CoopData shall not be liable for any indirect, incidental, special, consequential, or punitive damages.
11.2 CoopData''s total liability shall not exceed the amount paid by you for the Service in the twelve (12) months preceding the claim.

## 12. Indemnification

You agree to indemnify and hold harmless CoopData and its officers, employees, and agents from any claims, damages, or expenses arising from your use of the Service or violation of these Terms.

## 13. Governing Law and Dispute Resolution

13.1 These Terms are governed by the laws of the Kingdom of Eswatini.
13.2 Any disputes shall be resolved through negotiation, then mediation, and finally through the courts of Eswatini.
13.3 You agree to submit to the exclusive jurisdiction of the courts of Eswatini.

## 14. Contact Information

For questions about these Terms, contact:
- **Email:** legal@coopdata.gov.sz
- **Address:** Ministry of Cooperatives, Mbabane, Kingdom of Eswatini', '# Conditions d''utilisation

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0
**Droit applicable :** Loi sur les sociétés coopératives (Eswatini), Loi sur les transactions électroniques

## 1. Introduction

Bienvenue sur CoopData, la plateforme de gestion des données financières coopératives exploitée par le Ministère des Coopératives du Royaume d''Eswatini. Les présentes Conditions d''utilisation (« Conditions ») régissent votre accès et votre utilisation de la plateforme CoopData, de son site web, de ses applications mobiles et de ses services associés (collectivement, le « Service »).

En créant un compte, en accédant ou en utilisant le Service, vous acceptez d''être lié par les présentes Conditions. Si vous n''acceptez pas ces Conditions, vous ne devez pas accéder au Service ni l''utiliser.

## 2. Définitions

- **« Coopérative »** désigne une société coopérative enregistrée en vertu de la Loi sur les sociétés coopératives d''Eswatini.
- **« Utilisateur »** désigne toute personne qui crée un compte ou accède au Service.
- **« Données personnelles »** désigne toute information relative à une personne physique identifiée ou identifiable.
- **« Données financières »** désigne les données relatives aux états financiers, aux transactions et aux registres d''une coopérative.
- **« Contenu »** désigne toutes les données, textes, fichiers, informations et matériels soumis ou stockés sur le Service.

## 3. Éligibilité et création de compte

3.1 Vous devez avoir au moins 18 ans pour créer un compte.
3.2 Vous devez fournir des informations exactes, à jour et complètes lors de l''inscription.
3.3 Vous êtes responsable du maintien de la confidentialité de vos identifiants de connexion.
3.4 Vous êtes responsable de toutes les activités effectuées sous votre compte.
3.5 Vous devez informer immédiatement CoopData de toute utilisation non autorisée de votre compte.

## 4. Utilisation acceptable

4.1 Vous acceptez de ne pas faire un mauvais usage du Service, notamment :
- Tenter d''accéder, de modifier ou d''utiliser des zones non publiques du Service ;
- Téléverser des codes malveillants, des virus ou du contenu nuisible ;
- Interférer avec le fonctionnement du Service ou l''accès des autres utilisateurs ;
- Utiliser le Service à des fins illégales ;
- Soumettre des informations fausses, trompeuses ou frauduleuses ;
- Tenter de sonder, analyser ou tester la vulnérabilité du Service.

## 5. Contenu et données de l''utilisateur

5.1 Vous conservez la propriété du Contenu que vous soumettez au Service.
5.2 Vous accordez à CoopData une licence limitée pour stocker, traiter et afficher votre Contenu uniquement pour fournir le Service.
5.3 Vous déclarez avoir le droit de soumettre tout Contenu et qu''il ne viole aucune loi ni aucun droit de tiers.
5.4 CoopData peut agréger des données anonymisées à des fins statistiques et d''analyse comparative.

## 6. Propriété intellectuelle

6.1 Le Service, y compris son logiciel, sa conception, ses textes, ses graphiques et ses logos, appartient à CoopData ou à ses concédants.
6.2 Vous ne pouvez pas copier, modifier, distribuer, vendre ou louer une partie du Service sans consentement écrit préalable.
6.3 Vous ne pouvez pas faire de rétro-ingénierie ni tenter d''extraire le code source du Service.

## 7. Confidentialité et protection des données

7.1 Votre utilisation du Service est soumise à notre Politique de confidentialité, incorporée aux présentes Conditions par référence.
7.2 CoopData traite les Données personnelles conformément aux lois applicables sur la protection des données, y compris la Loi sur la protection des données d''Eswatini.
7.3 Vous consentez à la collecte, au traitement et au stockage de vos Données personnelles comme décrit dans la Politique de confidentialité.

## 8. Disponibilité et modifications du service

8.1 CoopData peut modifier, suspendre ou interrompre toute partie du Service à tout moment.
8.2 CoopData peut mettre à jour les présentes Conditions de temps à autre. Les modifications importantes vous seront communiquées, et la poursuite de l''utilisation du Service constitue une acceptation des Conditions révisées.
8.3 Nous fournirons un préavis raisonnable de toute maintenance planifiée pouvant affecter le Service.

## 9. Résiliation

9.1 Vous pouvez résilier votre compte à tout moment en contactant le support.
9.2 CoopData peut suspendre ou résilier votre accès si vous violez les présentes Conditions ou la loi applicable.
9.3 À la résiliation, votre droit d''utiliser le Service cesse immédiatement.
9.4 Les registres financiers statutaires peuvent être conservés conformément aux exigences de conservation applicables.

## 10. Exclusion de garanties

10.1 Le Service est fourni « en l''état » et « selon disponibilité » sans garanties d''aucune sorte, expresses ou implicites.
10.2 CoopData ne garantit pas que le Service sera ininterrompu, sans erreur ou sécurisé.
10.3 CoopData ne fournit pas de conseils juridiques, financiers ou comptables.

## 11. Limitation de responsabilité

11.1 Dans toute la mesure permise par la loi, CoopData ne sera pas responsable des dommages indirects, accessoires, spéciaux, consécutifs ou punitifs.
11.2 La responsabilité totale de CoopData ne dépassera pas le montant payé par vous pour le Service au cours des douze (12) mois précédant la réclamation.

## 12. Indemnisation

Vous acceptez d''indemniser et de dégager CoopData et ses dirigeants, employés et agents de toute réclamation, dommage ou dépense découlant de votre utilisation du Service ou de la violation des présentes Conditions.

## 13. Droit applicable et règlement des litiges

13.1 Les présentes Conditions sont régies par les lois du Royaume d''Eswatini.
13.2 Tout litige sera résolu par la négociation, puis la médiation, et enfin par les tribunaux d''Eswatini.
13.3 Vous acceptez de vous soumettre à la juridiction exclusive des tribunaux d''Eswatini.

## 14. Coordonnées

Pour toute question sur les présentes Conditions, contactez :
- **Courriel :** legal@coopdata.gov.sz
- **Adresse :** Ministère des Coopératives, Mbabane, Royaume d''Eswatini', '# Termos de Serviço

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0
**Lei aplicável:** Lei das Sociedades Cooperativas (Essuatíni), Lei das Transações Eletrónicas

## 1. Introdução

Bem-vindo ao CoopData, a plataforma de gestão de dados financeiros cooperativos operada pelo Ministério das Cooperativas do Reino de Essuatíni. Estes Termos de Serviço ("Termos") regem o seu acesso e utilização da plataforma CoopData, do seu site, aplicações móveis e serviços associados (coletivamente, o "Serviço").

Ao registar uma conta, aceder ou utilizar o Serviço, concorda em ficar vinculado por estes Termos. Se não concordar com estes Termos, não deve aceder nem utilizar o Serviço.

## 2. Definições

- **"Cooperativa"** significa uma sociedade cooperativa registada ao abrigo da Lei das Sociedades Cooperativas de Essuatíni.
- **"Utilizador"** significa qualquer pessoa que registe uma conta ou aceda ao Serviço.
- **"Dados Pessoais"** significa qualquer informação relativa a uma pessoa natural identificada ou identificável.
- **"Dados Financeiros"** significa dados relativos às demonstrações financeiras, transações e registos de uma cooperativa.
- **"Conteúdo"** significa todos os dados, textos, ficheiros, informações e materiais submetidos ou armazenados no Serviço.

## 3. Elegibilidade e registo de conta

3.1 Deve ter pelo menos 18 anos de idade para registar uma conta.
3.2 Deve fornecer informações precisas, atuais e completas durante o registo.
3.3 É responsável por manter a confidencialidade das suas credenciais de acesso.
3.4 É responsável por todas as atividades que ocorram na sua conta.
3.5 Deve notificar imediatamente o CoopData de qualquer utilização não autorizada da sua conta.

## 4. Utilização Aceitável

4.1 Concorda em não utilizar indevidamente o Serviço, incluindo, mas não se limitando a:
- Tentar aceder, adulterar ou utilizar áreas não públicas do Serviço;
- Carregar código malicioso, vírus ou conteúdo prejudicial;
- Interferir com o funcionamento do Serviço ou o acesso de outros utilizadores;
- Utilizar o Serviço para qualquer fim ilegal;
- Submeter informações falsas, enganosas ou fraudulentas;
- Tentar sondar, analisar ou testar a vulnerabilidade do Serviço.

## 5. Conteúdo e Dados do Utilizador

5.1 Mantém a propriedade do Conteúdo que submete ao Serviço.
5.2 Concede ao CoopData uma licença limitada para armazenar, processar e exibir o seu Conteúdo apenas para fornecer o Serviço.
5.3 Declara que tem o direito de submeter todo o Conteúdo e que este não viola qualquer lei ou direitos de terceiros.
5.4 O CoopData pode agregar dados anonimizados para fins estatísticos e de benchmarking.

## 6. Propriedade Intelectual

6.1 O Serviço, incluindo o seu software, design, textos, gráficos e logótipos, é propriedade do CoopData ou dos seus licenciantes.
6.2 Não pode copiar, modificar, distribuir, vender ou alugar qualquer parte do Serviço sem consentimento escrito prévio.
6.3 Não pode fazer engenharia reversa nem tentar extrair o código-fonte do Serviço.

## 7. Privacidade e Proteção de Dados

7.1 A sua utilização do Serviço está sujeita à nossa Política de Privacidade, incorporada nestes Termos por referência.
7.2 O CoopData processa Dados Pessoais em conformidade com as leis de proteção de dados aplicáveis, incluindo a Lei de Proteção de Dados de Essuatíni.
7.3 Consente na recolha, processamento e armazenamento dos seus Dados Pessoais conforme descrito na Política de Privacidade.

## 8. Disponibilidade e Modificações do Serviço

8.1 O CoopData pode modificar, suspender ou descontinuar qualquer parte do Serviço a qualquer momento.
8.2 O CoopData pode atualizar estes Termos periodicamente. Alterações materiais serão comunicadas, e a continuação da utilização do Serviço constitui aceitação dos Termos revistos.
8.3 Forneceremos aviso razoável de manutenção programada que possa afetar o Serviço.

## 9. Rescisão

9.1 Pode rescindir a sua conta a qualquer momento contactando o suporte.
9.2 O CoopData pode suspender ou rescindir o seu acesso se violar estes Termos ou a lei aplicável.
9.3 Após a rescisão, o seu direito de utilizar o Serviço cessa imediatamente.
9.4 Os registos financeiros estatutários podem ser retidos em conformidade com os requisitos de retenção aplicáveis.

## 10. Exclusão de Garantias

10.1 O Serviço é fornecido "como está" e "conforme disponível" sem garantias de qualquer tipo, expressas ou implícitas.
10.2 O CoopData não garante que o Serviço será ininterrupto, sem erros ou seguro.
10.3 O CoopData não fornece aconselhamento jurídico, financeiro ou contabilístico.

## 11. Limitação de Responsabilidade

11.1 Na máxima extensão permitida por lei, o CoopData não será responsável por quaisquer danos indiretos, incidentais, especiais, consequentes ou punitivos.
11.2 A responsabilidade total do CoopData não excederá o valor pago por si pelo Serviço nos doze (12) meses anteriores à reclamação.

## 12. Indemnização

Concorda em indemnizar e isentar o CoopData e os seus diretores, funcionários e agentes de quaisquer reclamações, danos ou despesas decorrentes da sua utilização do Serviço ou violação destes Termos.

## 13. Lei Aplicável e Resolução de Litígios

13.1 Estes Termos são regidos pelas leis do Reino de Essuatíni.
13.2 Quaisquer litígios serão resolvidos por negociação, depois mediação e, finalmente, pelos tribunais de Essuatíni.
13.3 Concorda em submeter-se à jurisdição exclusiva dos tribunais de Essuatíni.

## 14. Informações de Contacto

Para questões sobre estes Termos, contacte:
- **Email:** legal@coopdata.gov.sz
- **Endereço:** Ministério das Cooperativas, Mbabane, Reino de Essuatíni', '# Imigomo Yekusebentisa

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0
**Umtsetfo Locondzile:** Umtsetfo Wetimphakatsi Tekusebentisana (eSwatini), Umtsetfo Wetekuthengiselana Ngekucocisana

## 1. Singeniso

Siyakwemukela ku-CoopData, ipulatifomu yekuphatfwa kwedatha yetimali tekuphatsa lephethwe nguMnyango Wetimphakatsi Tekusebentisana weMbuso weSwatini. LemiGomo Yekusebentisa ("Imigomo") ilawula kufinyelela kwakho nekutisebentisa kwakho ipulatifomu ye-CoopData, iwebhusayithi yayo, tinhlelo temakhukhwini, netinsita letihambisana nayo (ngokuhlanganyela, "Insita").

Ngekubhalisa i-akhawunti, kufinyelela, noma kusebentisa Insita, uyavuma kuboshwa nguleMiGomo. Uma ungavumi nalemiGomo, akukafanele ufinyelele noma usebentise Insita.

## 2. Tincazelo

- **"Inhlangano Yekusebentisana"** kusho umphakatsi losebentisanako lobhalisiwe ngaphansi kweMtsetfo Wetimphakatsi Tekusebentisana waseSwatini.
- **"Umsebentisi"** kusho noma ngubani lobhalisa i-akhawunti noma afinyelele Insita.
- **"Datha Yomuntfu"** kusho noma nguluphi lwati lolumayelana nemuntfu lomuntfu lokhonjiwe noma lokhonjwayo.
- **"Datha Yetimali"** kusho datha lemayelana netitatimende tetimali, tekutengiselana, nemarekhodi enhlangano yekusebentisana.
- **"Lokuqukethwe"** kusho yonke datha, imibhalo, emafayili, lwati, netintfo letifakwa noma letigcinwa eNsitweni.

## 3. Kufaneleka nekubhalisa i-akhawunti

3.1 Kufanele ube neminyaka lengu-18 noma ngaphezulu kute ubhalise i-akhawunti.
3.2 Kufanele unike lwati lolunembile, lwakhatsi, noluphelele ngesikhatsi sekubhalisa.
3.3 Unesibopho sekugcina imininingwane yakho yekungena iyimfihlo.
3.4 Unesibopho sayo yonkhe imisebenti leyenteka ngaphansi kwe-akhawunti yakho.
3.5 Kufanele wazise i-CoopData ngokushesha ngalokusetjentiswa lokungagunyatiwe kwe-akhawunti yakho.

## 4. Kusetjentiswa Lokwemukelekako

4.1 Uyavuma ungayisebentisi kabi Insita, kufaka phakatsi kodvwa kungagcini lapho:
- Kutfuna kufinyelela, kutfinta, noma kusebentisa tindzawo letingekho emphakatsini weNsita;
- Kufaka likhodi lelimbi, emagciwane, noma lokuqukethwe lokulimako;
- Kuphazamisa kusebenta kweNsita noma kufinyelela kwabanye basebentisi;
- Kusebentisa Insita nganoma yini lengemtsetfweni;
- Kufaka lwati lolungemanga, loludukisako, noma lobucili;
- Kutfuna kuhlola, kuskena, noma kuhlola buthakathaka beNsita.

## 5. Lokuqukethwe Nekudatha Kwemsebentisi

5.1 Ugcina bumnikazi belokuqukethwe lokufaka eNsitweni.
5.2 Unika i-CoopData ilayisensi lencane yekugcina, kucubungula, nekubonisa Lokuqukethwe kwakho kute nje unike Insita.
5.3 Uyamemezela kutsi unelilungelo lekufaka konkhe Lokuqukethwe nokutsi akwephuli nawuphi umtsetfo noma emalungelo emuntfu wesitsatfu.
5.4 I-CoopData ingahlanganisa datha lengakhonjwanga ngebumfihlo ngekutfutfukisa tinhloso tekubala nekubamba ngekucatsanisa.

## 6. Emalungelo Ebunikazi Bekuhlakanipha

6.1 Insita, kufaka phakatsi i-software yayo, umklamo, imibhalo, imidwebo, nemalogo, ingeyaka-CoopData noma labo labayinikile.
6.2 Awukwati kukopisha, kushintja, kusabalalisa, kuthengisa, noma kushicilela noma yiphi ingxenye yeNsita ngaphandle kwemvume lebhaliwe.
6.3 Awukwati kuhlehlisa ubunjiniyela noma kutfuna kukhipha ikhodi yomthombo weNsita.

## 7. Bumfihlo Nekuvikelwa Kwedatha

7.1 Kusetjentiswa kwakho Insita kuncike eNqubomgomeni Yetfu Yebumfihlo, lefakwe kuleMiGomo ngekubhekisela.
7.2 I-CoopData icubungula Datha Yomuntfu ngemtsetfo wekuvikela datha losebentako, kufaka phakatsi uMtsetfo Wekuvikela Datha waseSwatini.
7.3 Uyavuma ekubutseni, ekucubunguleni, nekugcinweni kweDatha Yakho Yomuntfu njengoba kuchazwe eNqubomgomeni Yebumfihlo.

## 8. Kutholakala Nekushintjwa Kwensita

8.1 I-CoopData ingashintja, kumisa, noma kuyekela noma yiphi ingxenye yeNsita nganoma sini.
8.2 I-CoopData ingabuyekeza leMiGomo ngezikhathi. Tintfo letibalulekile letishintjako titokwaziswa, nekuchubeka kusebentisa Insita kusho kuvuma leMiGomo lelishintjiwe.
8.3 Sitokunika saziso lesifanele ngekulungiswa lokuhleliwe lokungaphazamisa Insita.

## 9. Kuyekela

9.1 Ungayekela i-akhawunti yakho nganoma sini ngekuthinta lusito.
9.2 I-CoopData ingamisa noma iyekele kufinyelela kwakho uma wephula leMiGomo noma umtsetfo losebentako.
9.3 Ngekuphela, lilungelo lakho lekusebentisa Insita liyaphela ngokushesha.
9.4 Emarekhodi etimali asemtsetfweni angagcinwa ngemigomo yekugcina lefanele.

## 10. Kucalwa Kwetivumelwano

10.1 Insita iniketwa "njengoba injalo" nangalokutholakalako ngaphandle kwetivumelwano tanoma yiluphi luhlobo, letivele noma letisho.
10.2 I-CoopData ayitsembisi kutsi Insita itokuba ngeke iphazamiseke, ingabi nebugebengu, noma ivikeleke.
10.3 I-CoopData ayiniki seluleko semtsetfo, setimali, noma sekubalwa kwetimali.

## 11. Kukhawulelwa Kwesibopho

11.1 Ngelingeni lelikhulu lelivunyelwa ngumtsetfo, i-CoopData ngeke ibe nesibopho sanoma yimuphi umonakalo longakacondziswa, losebentako, lokhetsekile, lolandzelako, noma wekujezisa.
11.2 Sibopho sesikhatsi sonkhe se-CoopData ngeke sidlule emalini lobhadale Insita etinyangeni letiyishumi nambili (12) letingaphambi kwesicelo.

## 12. Kuvikela

Uyavuma kuvikela nekukhulula i-CoopData netikhulu tayo, basebenti, nebameleli bayo kuto tonkhe ticelo, umonakalo, noma tindleko letivela ekusebentiseni kwakho Insita noma kwephula leMiGomo.

## 13. Umtsetfo Lokubusako Nekucatululwa Kwetingcongo

13.1 LeMiGomo ibuswa yimitSetfo yeMbuso weSwatini.
13.2 Noma yiphi tingcongo titocatululwa ngekucoca, bese kuba nekulamula, bese ekugcineni ngetinkantolo taseSwatini.
13.3 Uyavuma kuzinikela elawulweni lokukhetsekile lwetinkantolo taseSwatini.

## 14. Lwati Lwekuthintana

Ngemibuto ngalemiGomo, thintana:
- **I-imeyili:** legal@coopdata.gov.sz
- **Likheli:** UMnyango Wetimphakatsi Tekusebentisana, eMbabane, eMbusweni weSwatini'),
    ('privacy', 'Privacy Policy', 'Politique de confidentialité', 'Política de Privacidade', 'Inqubomgomo Yebumfihlo', '# Privacy Policy

**Effective Date:** 1 January 2026
**Version:** 1.0
**Applicable Law:** Data Protection Act (Eswatini), GDPR (where applicable), NDPR

## 1. Introduction

CoopData ("we", "us", "our") is committed to protecting the privacy and personal data of cooperative members, administrators, and users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the CoopData platform.

## 2. Information We Collect

### 2.1 Information You Provide
- Account registration details (name, email, username, role);
- Cooperative and organizational information;
- Financial statements and submission data;
- Profile and preference information;
- Communications with support.

### 2.2 Information Collected Automatically
- IP address, browser type, and device information;
- Usage data and access logs;
- Cookies and similar technologies (see our Cookie Policy);
- Consent records including timestamps.

## 3. Legal Basis for Processing

We process personal data based on the following legal bases:
- **Consent:** Where you have given explicit consent (e.g., marketing communications);
- **Contract:** Where processing is necessary to provide the Service;
- **Legal obligation:** Where processing is required by law;
- **Legitimate interest:** Where processing is necessary for our legitimate interests.

## 4. How We Use Your Information

We use your information to:
- Provide, operate, and maintain the Service;
- Process and validate financial submissions;
- Generate reports and analytics;
- Ensure security and prevent fraud;
- Comply with legal and regulatory obligations;
- Communicate with you about the Service.

## 5. Data Sharing and Disclosure

We do not sell your personal data. We may share data with:
- **Service providers** who assist in operating the Service;
- **Regulatory authorities** where required by law;
- **Cooperatives and apex bodies** for legitimate reporting purposes;
- **Legal advisors** in connection with legal proceedings.

## 6. Data Retention

6.1 We retain personal data only as long as necessary for the purposes described in this Policy.
6.2 Financial statements and regulatory records are retained for the statutory retention period (10 years) as required by law.
6.3 Consent records are retained for audit and compliance purposes.

## 7. Your Rights

You have the right to:
- **Access** your personal data;
- **Rectify** inaccurate or incomplete data;
- **Erase** your personal data (subject to legal retention requirements);
- **Restrict** or **object** to processing;
- **Data portability** — receive your data in a structured format;
- **Withdraw consent** at any time.

To exercise these rights, use the Privacy & Data Request feature in your account settings or contact us.

## 8. Data Security

8.1 We implement appropriate technical and organizational measures to protect your data.
8.2 Data is encrypted in transit and at rest.
8.3 Access to personal data is restricted to authorized personnel.
8.4 We conduct regular security assessments and audits.

## 9. International Data Transfers

Where data is transferred outside the Kingdom of Eswatini, we ensure appropriate safeguards are in place.

## 10. Children''s Privacy

The Service is not directed to individuals under 18 years of age, and we do not knowingly collect their personal data.

## 11. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be communicated to you, and continued use of the Service constitutes acceptance of the revised Policy.

## 12. Contact Information

For privacy inquiries or to exercise your rights, contact:
- **Email:** privacy@coopdata.gov.sz
- **Data Protection Officer:** dpo@coopdata.gov.sz
- **Address:** Ministry of Cooperatives, Mbabane, Kingdom of Eswatini', '# Politique de confidentialité

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0
**Droit applicable :** Loi sur la protection des données (Eswatini), RGPD (le cas échéant), NDPR

## 1. Introduction

CoopData (« nous », « notre ») s''engage à protéger la confidentialité et les données personnelles des membres, administrateurs et utilisateurs des coopératives. La présente Politique de confidentialité explique comment nous collectons, utilisons, divulguons et protégeons vos informations lorsque vous utilisez la plateforme CoopData.

## 2. Informations que nous collectons

### 2.1 Informations que vous fournissez
- Détails d''inscription au compte (nom, courriel, nom d''utilisateur, rôle) ;
- Informations coopératives et organisationnelles ;
- États financiers et données de soumission ;
- Informations de profil et de préférences ;
- Communications avec le support.

### 2.2 Informations collectées automatiquement
- Adresse IP, type de navigateur et informations sur l''appareil ;
- Données d''utilisation et journaux d''accès ;
- Cookies et technologies similaires (voir notre Politique relative aux cookies) ;
- Registres de consentement, y compris les horodatages.

## 3. Base légale du traitement

Nous traitons les données personnelles sur la base des fondements juridiques suivants :
- **Consentement :** lorsque vous avez donné un consentement explicite (par exemple, communications marketing) ;
- **Contrat :** lorsque le traitement est nécessaire pour fournir le Service ;
- **Obligation légale :** lorsque le traitement est requis par la loi ;
- **Intérêt légitime :** lorsque le traitement est nécessaire à nos intérêts légitimes.

## 4. Comment nous utilisons vos informations

Nous utilisons vos informations pour :
- Fournir, exploiter et maintenir le Service ;
- Traiter et valider les soumissions financières ;
- Générer des rapports et des analyses ;
- Assurer la sécurité et prévenir la fraude ;
- Respecter les obligations légales et réglementaires ;
- Communiquer avec vous au sujet du Service.

## 5. Partage et divulgation des données

Nous ne vendons pas vos données personnelles. Nous pouvons partager des données avec :
- **Les prestataires de services** qui aident à exploiter le Service ;
- **Les autorités réglementaires** lorsque la loi l''exige ;
- **Les coopératives et organismes faîtiers** à des fins de reporting légitime ;
- **Les conseillers juridiques** dans le cadre de procédures judiciaires.

## 6. Conservation des données

6.1 Nous conservons les données personnelles uniquement aussi longtemps que nécessaire aux fins décrites dans la présente Politique.
6.2 Les états financiers et les registres réglementaires sont conservés pendant la période de conservation légale (10 ans) comme l''exige la loi.
6.3 Les registres de consentement sont conservés à des fins d''audit et de conformité.

## 7. Vos droits

Vous avez le droit de :
- **Accéder** à vos données personnelles ;
- **Rectifier** les données inexactes ou incomplètes ;
- **Effacer** vos données personnelles (sous réserve des exigences légales de conservation) ;
- **Restreindre** ou **vous opposer** au traitement ;
- **Portabilité des données** — recevoir vos données dans un format structuré ;
- **Retirer votre consentement** à tout moment.

Pour exercer ces droits, utilisez la fonctionnalité Demande de confidentialité et de données dans les paramètres de votre compte ou contactez-nous.

## 8. Sécurité des données

8.1 Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données.
8.2 Les données sont chiffrées en transit et au repos.
8.3 L''accès aux données personnelles est limité au personnel autorisé.
8.4 Nous effectuons des évaluations et des audits de sécurité réguliers.

## 9. Transferts internationaux de données

Lorsque des données sont transférées hors du Royaume d''Eswatini, nous veillons à ce que des garanties appropriées soient en place.

## 10. Confidentialité des enfants

Le Service n''est pas destiné aux personnes de moins de 18 ans, et nous ne collectons pas sciemment leurs données personnelles.

## 11. Modifications de la présente politique

Nous pouvons mettre à jour la présente Politique de confidentialité de temps à autre. Les modifications importantes vous seront communiquées, et la poursuite de l''utilisation du Service constitue une acceptation de la Politique révisée.

## 12. Coordonnées

Pour toute demande de confidentialité ou pour exercer vos droits, contactez :
- **Courriel :** privacy@coopdata.gov.sz
- **Délégué à la protection des données :** dpo@coopdata.gov.sz
- **Adresse :** Ministère des Coopératives, Mbabane, Royaume d''Eswatini', '# Política de Privacidade

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0
**Lei aplicável:** Lei de Proteção de Dados (Essuatíni), RGPD (quando aplicável), NDPR

## 1. Introdução

O CoopData ("nós", "nosso") está empenhado em proteger a privacidade e os dados pessoais dos membros, administradores e utilizadores das cooperativas. Esta Política de Privacidade explica como recolhemos, utilizamos, divulgamos e protegemos as suas informações quando utiliza a plataforma CoopData.

## 2. Informações que Recolhemos

### 2.1 Informações que Fornece
- Detalhes de registo de conta (nome, email, nome de utilizador, função);
- Informações cooperativas e organizacionais;
- Demonstrações financeiras e dados de submissão;
- Informações de perfil e preferências;
- Comunicações com o suporte.

### 2.2 Informações Recolhidas Automaticamente
- Endereço IP, tipo de navegador e informações do dispositivo;
- Dados de utilização e registos de acesso;
- Cookies e tecnologias semelhantes (ver a nossa Política de Cookies);
- Registos de consentimento, incluindo carimbos de data/hora.

## 3. Base Legal para o Processamento

Processamos dados pessoais com base nos seguintes fundamentos legais:
- **Consentimento:** quando deu consentimento explícito (por exemplo, comunicações de marketing);
- **Contrato:** quando o processamento é necessário para fornecer o Serviço;
- **Obrigação legal:** quando o processamento é exigido por lei;
- **Interesse legítimo:** quando o processamento é necessário para os nossos interesses legítimos.

## 4. Como Utilizamos as Suas Informações

Utilizamos as suas informações para:
- Fornecer, operar e manter o Serviço;
- Processar e validar submissões financeiras;
- Gerar relatórios e análises;
- Garantir segurança e prevenir fraude;
- Cumprir obrigações legais e regulamentares;
- Comunicar consigo sobre o Serviço.

## 5. Partilha e Divulgação de Dados

Não vendemos os seus dados pessoais. Podemos partilhar dados com:
- **Prestadores de serviços** que ajudam a operar o Serviço;
- **Autoridades reguladoras** quando exigido por lei;
- **Cooperativas e organismos de topo** para fins legítimos de relatórios;
- **Consultores jurídicos** em conexão com processos judiciais.

## 6. Retenção de Dados

6.1 Retemos dados pessoais apenas enquanto necessário para os fins descritos nesta Política.
6.2 As demonstrações financeiras e registos regulamentares são retidos pelo período de retenção legal (10 anos) conforme exigido por lei.
6.3 Os registos de consentimento são retidos para fins de auditoria e conformidade.

## 7. Os Seus Direitos

Tem o direito de:
- **Aceder** aos seus dados pessoais;
- **Retificar** dados imprecisos ou incompletos;
- **Apagar** os seus dados pessoais (sujeito a requisitos legais de retenção);
- **Restringir** ou **opor-se** ao processamento;
- **Portabilidade de dados** — receber os seus dados num formato estruturado;
- **Retirar o consentimento** a qualquer momento.

Para exercer estes direitos, utilize a funcionalidade Pedido de Privacidade e Dados nas definições da sua conta ou contacte-nos.

## 8. Segurança de Dados

8.1 Implementamos medidas técnicas e organizacionais adequadas para proteger os seus dados.
8.2 Os dados são encriptados em trânsito e em repouso.
8.3 O acesso aos dados pessoais é restrito a pessoal autorizado.
8.4 Realizamos avaliações e auditorias de segurança regulares.

## 9. Transferências Internacionais de Dados

Quando os dados são transferidos para fora do Reino de Essuatíni, garantimos que existem salvaguardas adequadas.

## 10. Privacidade das Crianças

O Serviço não se destina a pessoas com menos de 18 anos e não recolhemos conscientemente os seus dados pessoais.

## 11. Alterações a Esta Política

Podemos atualizar esta Política de Privacidade periodicamente. Alterações materiais serão comunicadas, e a continuação da utilização do Serviço constitui aceitação da Política revista.

## 12. Informações de Contacto

Para consultas de privacidade ou para exercer os seus direitos, contacte:
- **Email:** privacy@coopdata.gov.sz
- **Encarregado de Proteção de Dados:** dpo@coopdata.gov.sz
- **Endereço:** Ministério das Cooperativas, Mbabane, Reino de Essuatíni', '# Inqubomgomo Yebumfihlo

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0
**Umtsetfo Locondzile:** Umtsetfo Wekuvikela Datha (eSwatini), GDPR (lapho kusebenta khona), NDPR

## 1. Singeniso

I-CoopData ("tsine", "yetfu") ibopheleke ekuvikeleni bumfihlo nedatha yomuntfu yemalunga, baphathi, nebabasebentisi betimphakatsi tekusebentisana. LeNqubomgomo Yebumfihlo ichaza kutsi sibutsa, sisebentise, sidlulisele, nekubamba njani lwati lwakho ngesikhatsi usebentisa ipulatifomu ye-CoopData.

## 2. Lwati Lesilubutsako

### 2.1 Lwati Lolunikako
- Imininingwane yekubhalisa i-akhawunti (libito, i-imeyili, libito lemsebentisi, indzima);
- Lwati lwenhlangano yekusebentisana netinhlangano;
- Titatimende tetimali nedatha yekufaka;
- Lwati lwephrofayili netintfo letikhetsiwe;
- Kukhulumisana nelusito.

### 2.2 Lwati Lolubutswe Ngokuzenzakalelako
- Likheli le-IP, luhlobo lwesiphequluli, nelwati lwedivayisi;
- Datha yekusetjentiswa nemarekhodi ekufinyelela;
- Emakhukhi neteknoloji letifananako (bona iNqubomgomo Yetfu Yemakhukhi);
- Emarekhodi emvume kufaka phakatsi tinkhombandzaba tesikhatsi.

## 3. Sisekelo Semtsetfo Sekucubungula

Sicubungula datha yomuntfu ngesisekelo salezizatfu letisemtsetfweni:
- **Imvume:** lapho unike imvume lecacile (isibonelo, kukhulumisana kwezentengiselwano);
- **Sivumelwano:** lapho kucubungula kudzingeka kute kunikwe Insita;
- **Sibopho semtsetfo:** lapho kucubungula kudzingwa ngumtsetfo;
- **Intfalo lefanele:** lapho kucubungula kudzingeka ngezintfalo zetfu letifanele.

## 4. Kutsi Silusebentisa Njani Lwati Lwakho

Silusebentisa lwati lwakho kute:
- Sinike, sisebentise, sigcine Insita;
- Sicubungule sicinisekise kufakwa kwetimali;
- Sikhicite emarekhodi nekuhlaziya;
- Sicinisekise kuvikeleka nekucina kubucili;
- Sihambisane netibopho temtsetfo nelawulo;
- Sikhulumisane nawe ngensita.

## 5. Kwabelana Nekudluliselwa Kwedatha

Asiyithengisi datha yakho yomuntfu. Singabelana datha na:
- **Baphakeli bensita** labasita ekusebentiseni Insita;
- **Tiphathimandla telawulo** lapho kudzingwa ngumtsetfo;
- **Timphakatsi tekusebentisana netinhlangano letikhulu** ngetinhloso letifanele tekubika;
- **Beluleki bemtsetfo** mayelana netinqubo tetinkantolo.

## 6. Kugcinwa Kwedatha

6.1 Sigcina datha yomuntfu kuphela ngesikhatsi lesidzingekako ngetinhloso letichazwe kuleNqubomgomo.
6.2 Titatimende tetimali nemarekhodi elawulo agcinwa esikhatsini sekugcina lesisemtsetfweni (iminyaka lelishumi) njengoba kudzingwa ngumtsetfo.
6.3 Emarekhodi emvume agcinwa ngetinhloso tekuhlola nekuhambisana.

## 7. Emalungelo Akho

Unelilungelo leku:
- **Finyelela** datha yakho yomuntfu;
- **Lungisa** datha lenganembile noma lengaphelele;
- **Cisha** datha yakho yomuntfu (ngaphansi kwemigomo yekugcina lesemtsetfweni);
- **Khawulela** noma **uphikise** kucubungula;
- **Kuthwala datha** — kutfola datha yakho ngekutfoma lokuhlelekile;
- **Hoxisa imvume** nganoma sini.

Kusebentisa lamalungelo, sebenzisa sici seSicelo Sebumfihlo Nekudatha kusethingi ye-akhawunti yakho noma thintana natsi.

## 8. Kuvikeleka Kwedatha

8.1 Sisungula tindlela letifanele tebuchwepheshe netenhlangano kuvikela datha yakho.
8.2 Datha ibhalwa ngekhodi ekuhambeni nasekuphumuleni.
8.3 Kufinyelela datha yomuntfu kukhawulelwe kubasebenti labagunyatiwe.
8.4 Senta tihlolo tekuphepha nekuhlola ngekujwayelekile.

## 9. Kudluliselwa Kwedatha Kwemhlaba Wonkhe

Lapho datha idluliselwa ngaphandle kweMbuso weSwatini, sicinisekisa kutsi kukhona tivikelo letifanele.

## 10. Bumfihlo Bebantfwana

Insita ayikacondziswa kubantfu labangaphansi kweminyaka lengu-18, futhi asiyibutsi ngekwati datha yabo yomuntfu.

## 11. Tintfo Letishintjako KuleNqubomgomo

Singabuyekeza leNqubomgomo Yebumfihlo ngezikhathi. Tintfo letibalulekile letishintjako titokwaziswa, nekuchubeka kusebentisa Insita kusho kuvuma iNqubomgomo lelishintjiwe.

## 12. Lwati Lwekuthintana

Ngemibuto yebumfihlo noma kusebentisa emalungelo akho, thintana:
- **I-imeyili:** privacy@coopdata.gov.sz
- **Sikhulu Sekuvikela Datha:** dpo@coopdata.gov.sz
- **Likheli:** UMnyango Wetimphakatsi Tekusebentisana, eMbabane, eMbusweni weSwatini'),
    ('cookies', 'Cookie & Storage Policy', 'Politique relative aux cookies', 'Política de Cookies', 'Inqubomgomo Yemakhukhi Nekugcinwa', '# Cookie & Storage Policy

**Effective Date:** 1 January 2026
**Version:** 1.0

## 1. Introduction

This Cookie & Storage Policy explains how CoopData uses cookies, local storage, and similar technologies to recognize you when you visit our platform. It explains what these technologies are, why we use them, and your rights to control their use.

## 2. What Are Cookies?

Cookies are small data files placed on your device when you visit a website. They are widely used to make websites work efficiently and to provide reporting information.

## 3. Types of Cookies We Use

### 3.1 Strictly Necessary Cookies
These cookies are essential for the Service to function and cannot be switched off. They include:
- Authentication and session cookies;
- Security cookies;
- Load-balancing cookies.

### 3.2 Functional Cookies
These cookies enable enhanced functionality and personalization, such as remembering your language preferences and settings.

### 3.3 Analytics Cookies
These cookies help us understand how visitors interact with the Service by collecting and reporting information anonymously. We use this data to improve the Service.

### 3.4 Preference Cookies
These cookies remember your choices, such as language and region, to provide a more personalized experience.

## 4. Local Storage and IndexedDB

CoopData uses browser local storage and IndexedDB to enable offline-first functionality. This allows you to:
- Access the Service when offline;
- Cache application data locally;
- Queue submissions for synchronization when connectivity is restored.

Data stored locally is used solely to provide the Service and is synchronized with our servers when you are online.

## 5. Cookies We Use

| Cookie Type | Purpose | Duration |
|---|---|---|
| Session cookie | Maintain your authenticated session | Session |
| Language preference | Remember your selected language | 1 year |
| Consent status | Track your consent choices | 1 year |
| Analytics | Understand usage patterns | 13 months |

## 6. Managing Cookies

You can control and manage cookies through your browser settings. You may:
- Block or delete cookies;
- Set your browser to notify you before accepting cookies;
- Disable local storage.

Please note that disabling essential cookies may affect the functionality of the Service.

## 7. Third-Party Cookies

Some cookies may be set by third-party services we use, such as analytics providers. These third parties have their own privacy policies.

## 8. Changes to This Policy

We may update this Cookie Policy from time to time. Any changes will be posted on this page with an updated effective date.

## 9. Contact Information

For questions about this Cookie Policy, contact:
- **Email:** privacy@coopdata.gov.sz
- **Address:** Ministry of Cooperatives, Mbabane, Kingdom of Eswatini', '# Politique relative aux cookies et au stockage

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0

## 1. Introduction

La présente Politique relative aux cookies et au stockage explique comment CoopData utilise les cookies, le stockage local et les technologies similaires pour vous reconnaître lorsque vous visitez notre plateforme. Elle explique ce que sont ces technologies, pourquoi nous les utilisons et vos droits de contrôler leur utilisation.

## 2. Que sont les cookies ?

Les cookies sont de petits fichiers de données placés sur votre appareil lorsque vous visitez un site web. Ils sont largement utilisés pour faire fonctionner efficacement les sites web et fournir des informations de rapport.

## 3. Types de cookies que nous utilisons

### 3.1 Cookies strictement nécessaires
Ces cookies sont essentiels au fonctionnement du Service et ne peuvent pas être désactivés. Ils comprennent :
- Les cookies d''authentification et de session ;
- Les cookies de sécurité ;
- Les cookies d''équilibrage de charge.

### 3.2 Cookies fonctionnels
Ces cookies permettent des fonctionnalités et une personnalisation améliorées, comme la mémorisation de vos préférences linguistiques et de vos paramètres.

### 3.3 Cookies analytiques
Ces cookies nous aident à comprendre comment les visiteurs interagissent avec le Service en collectant et en rapportant des informations de manière anonyme. Nous utilisons ces données pour améliorer le Service.

### 3.4 Cookies de préférence
Ces cookies mémorisent vos choix, comme la langue et la région, pour offrir une expérience plus personnalisée.

## 4. Stockage local et IndexedDB

CoopData utilise le stockage local du navigateur et IndexedDB pour permettre une fonctionnalité hors ligne d''abord. Cela vous permet de :
- Accéder au Service hors ligne ;
- Mettre en cache les données de l''application localement ;
- Mettre en file d''attente les soumissions pour synchronisation lorsque la connectivité est rétablie.

Les données stockées localement sont utilisées uniquement pour fournir le Service et sont synchronisées avec nos serveurs lorsque vous êtes en ligne.

## 5. Cookies que nous utilisons

| Type de cookie | Objectif | Durée |
|---|---|---|
| Cookie de session | Maintenir votre session authentifiée | Session |
| Préférence de langue | Mémoriser votre langue sélectionnée | 1 an |
| Statut de consentement | Suivre vos choix de consentement | 1 an |
| Analytique | Comprendre les modèles d''utilisation | 13 mois |

## 6. Gestion des cookies

Vous pouvez contrôler et gérer les cookies via les paramètres de votre navigateur. Vous pouvez :
- Bloquer ou supprimer les cookies ;
- Configurer votre navigateur pour vous avertir avant d''accepter les cookies ;
- Désactiver le stockage local.

Veuillez noter que la désactivation des cookies essentiels peut affecter le fonctionnement du Service.

## 7. Cookies tiers

Certains cookies peuvent être définis par des services tiers que nous utilisons, comme les fournisseurs d''analyse. Ces tiers ont leurs propres politiques de confidentialité.

## 8. Modifications de la présente politique

Nous pouvons mettre à jour la présente Politique relative aux cookies de temps à autre. Toute modification sera publiée sur cette page avec une date d''entrée en vigueur mise à jour.

## 9. Coordonnées

Pour toute question sur la présente Politique relative aux cookies, contactez :
- **Courriel :** privacy@coopdata.gov.sz
- **Adresse :** Ministère des Coopératives, Mbabane, Royaume d''Eswatini', '# Política de Cookies e Armazenamento

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0

## 1. Introdução

Esta Política de Cookies e Armazenamento explica como o CoopData utiliza cookies, armazenamento local e tecnologias semelhantes para o reconhecer quando visita a nossa plataforma. Explica o que são estas tecnologias, porque as utilizamos e os seus direitos de controlar a sua utilização.

## 2. O que São Cookies?

Os cookies são pequenos ficheiros de dados colocados no seu dispositivo quando visita um site. São amplamente utilizados para fazer os sites funcionarem eficientemente e fornecer informações de relatórios.

## 3. Tipos de Cookies que Utilizamos

### 3.1 Cookies Estritamente Necessários
Estes cookies são essenciais para o funcionamento do Serviço e não podem ser desativados. Incluem:
- Cookies de autenticação e sessão;
- Cookies de segurança;
- Cookies de balanceamento de carga.

### 3.2 Cookies Funcionais
Estes cookies permitem funcionalidade e personalização melhoradas, como lembrar as suas preferências de idioma e definições.

### 3.3 Cookies Analíticos
Estes cookies ajudam-nos a compreender como os visitantes interagem com o Serviço, recolhendo e reportando informações anonimamente. Utilizamos estes dados para melhorar o Serviço.

### 3.4 Cookies de Preferência
Estes cookies lembram as suas escolhas, como idioma e região, para proporcionar uma experiência mais personalizada.

## 4. Armazenamento Local e IndexedDB

O CoopData utiliza armazenamento local do navegador e IndexedDB para permitir funcionalidade offline-first. Isto permite-lhe:
- Aceder ao Serviço quando offline;
- Armazenar dados da aplicação localmente em cache;
- Colocar submissões em fila para sincronização quando a conectividade for restaurada.

Os dados armazenados localmente são utilizados apenas para fornecer o Serviço e são sincronizados com os nossos servidores quando está online.

## 5. Cookies que Utilizamos

| Tipo de Cookie | Objetivo | Duração |
|---|---|---|
| Cookie de sessão | Manter a sua sessão autenticada | Sessão |
| Preferência de idioma | Lembrar o seu idioma selecionado | 1 ano |
| Estado de consentimento | Acompanhar as suas escolhas de consentimento | 1 ano |
| Analítico | Compreender padrões de utilização | 13 meses |

## 6. Gestão de Cookies

Pode controlar e gerir cookies através das definições do seu navegador. Pode:
- Bloquear ou eliminar cookies;
- Configurar o seu navegador para o notificar antes de aceitar cookies;
- Desativar o armazenamento local.

Tenha em atenção que desativar cookies essenciais pode afetar o funcionamento do Serviço.

## 7. Cookies de Terceiros

Alguns cookies podem ser definidos por serviços de terceiros que utilizamos, como fornecedores de análise. Estes terceiros têm as suas próprias políticas de privacidade.

## 8. Alterações a Esta Política

Podemos atualizar esta Política de Cookies periodicamente. Quaisquer alterações serão publicadas nesta página com uma data de vigência atualizada.

## 9. Informações de Contacto

Para questões sobre esta Política de Cookies, contacte:
- **Email:** privacy@coopdata.gov.sz
- **Endereço:** Ministério das Cooperativas, Mbabane, Reino de Essuatíni', '# Inqubomgomo Yemakhukhi Nekugcinwa

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0

## 1. Singeniso

LeNqubomgomo Yemakhukhi Nekugcinwa ichaza kutsi i-CoopData isebentisa njani emakhukhi, kugcinwa kwendzawo, neteknoloji letifananako kukubona ngesikhatsi uvakashela ipulatifomu yetfu. Ichaza kutsi tiyini leti teknoloji, kutsi siyisebentiseleni, nemalungelo akho ekulawula kusetjentiswa kwato.

## 2. Ayini Emakhukhi?

Emakhukhi ngemafayili lamancane edatha labekwa edivayisini yakho ngesikhatsi uvakashela iwebhusayithi. Asetjentiswa kakhulu kute iwebhusayithi isebente kahle nekuhlinzeka lwati lwekubika.

## 3. Tinhlelo Temakhukhi Lesiwasebentisako

### 3.1 Emakhukhi Ladingekako Kakhulu
Lamakhukhi abalulekile ekusebenteni kweNsita futhi angeke acinywe. Afaka phakatsi:
- Emakhukhi ekufakazela nekusesheni;
- Emakhukhi ekuphepha;
- Emakhukhi ekulinganisa umtfwalo.

### 3.2 Emakhukhi Esebentako
Lamakhukhi avumela kusebenta nekwenziwa kube ngawakho lokutfutfukile, njengekukhumbula tintfo letikhetsiwe telulwimi nesethingi yakho.

### 3.3 Emakhukhi Ekuhlaziya
Lamakhukhi asisita kucondza kutsi bavakashi basebentisana njani neNsita ngekubutsa nekubika lwati ngaphandle kwekukhonjwa. Sisebentisa ledatha kutfutfukisa Insita.

### 3.4 Emakhukhi Etintfo Letikhetsiwe
Lamakhukhi akhumbula tikhetselo takho, njengelulwimi nesifundza, kukunika lwati lolwenziwe lube ngelwakho.

## 4. Kugcinwa Kwendzawo ne-IndexedDB

I-CoopData isebentisa kugcinwa kwendzawo yesiphequluli ne-IndexedDB kute inikete kusebenta kwe-offline kuqala. Loku kukuvumela kute:
- Ufinyelele Insita ngesikhatsi ungaxhunyiwe;
- Ugcine datha yekhukhumuzi yendzawo;
- Ufake emafayela ekufaka elayinini kute avumelaniswe ngesikhatsi kuxhumana kubuyile.

Datha legcinwe endzaweni isetjentiswa kute nje kunikwe Insita futhi iyavumelaniswa nemaseva etfu ngesikhatsi uxhunyiwe.

## 5. Emakhukhi Lawasebentisako

| Luhlobo Lwekhukhi | Injongo | Sikhatsi |
|---|---|---|
| Ikhukhi lesesheni | Kugcina sesheni yakho lefakazeliwe | Sesheni |
| Intfalo yelulwimi | Kukhumbula lulwimi olukhetsiwe | Umnyaka |
| Simo semvume | Kulandzelela tikhetselo takho temvume | Umnyaka |
| Ekuhlaziya | Kucondza tindlela tekusetjentiswa | Tinyanga lelishumi nantfu |

## 6. Kuphatfwa Kwemakhukhi

Ungalawula nekup hatha emakhukhi ngesethingi yesiphequluli sakho. Ungakwati:
- Kuvimba noma kucisha emakhukhi;
- Kumisa siphequluli sakho kukwazise ngaphambi kwekutsi wemukele emakhukhi;
- Kucisha kugcinwa kwendzawo.

Uyacelwa kutsi ukhumbule kutsi kucisha emakhukhi labalulekile kungaphazamisa kusebenta kweNsita.

## 7. Emakhukhi Emuntfu Wesitsatfu

Lamanye emakhukhi angabekwa yinsita temuntfu wesitsatfu lesitisebentisako, njengabaphakeli bekuhlaziya. Laba bantfu besitsatfu banetinqubomgomo tabo tebumfihlo.

## 8. Tintfo Letishintjako KuleNqubomgomo

Singabuyekeza leNqubomgomo Yemakhukhi ngezikhathi. Noma yiphi tintfo letishintjako titokutfumyelwa kulelikhasi nelusuku lwekucala lolubuyekeziwe.

## 9. Lwati Lwekuthintana

Ngemibuto ngalemiNqubomgomo Yemakhukhi, thintana:
- **I-imeyili:** privacy@coopdata.gov.sz
- **Likheli:** UMnyango Wetimphakatsi Tekusebentisana, eMbabane, eMbusweni weSwatini'),
    ('acceptable-use', 'Acceptable Use & Code of Conduct', 'Utilisation acceptable et code de conduite', 'Uso Aceitável e Código de Conduta', 'Kusetjentiswa Lokwemukelekako Nekhodi Yekutiphatsa', '# Acceptable Use & Code of Conduct

**Effective Date:** 1 January 2026
**Version:** 1.0

## 1. Purpose

This Acceptable Use Policy and Code of Conduct ("Policy") establishes the standards of behavior expected of all users of the CoopData platform. It is designed to ensure a secure, respectful, and productive environment for all cooperative stakeholders.

## 2. Scope

This Policy applies to all users, including cooperative members, administrators, ministry officials, federation and apex staff, and any individual accessing the Service.

## 3. Prohibited Conduct

You must not:

### 3.1 Security Violations
- Attempt to gain unauthorized access to any part of the Service;
- Probe, scan, or test the vulnerability of systems without authorization;
- Intercept or interfere with network communications;
- Introduce malware, viruses, or harmful code;
- Circumvent security measures or authentication controls.

### 3.2 Data Integrity
- Submit false, inaccurate, or fraudulent financial data;
- Alter, delete, or tamper with records without authorization;
- Misrepresent your identity, role, or affiliation;
- Access data outside your authorized scope.

### 3.3 Respectful Conduct
- Harass, threaten, or discriminate against other users;
- Post offensive, defamatory, or inappropriate content;
- Impersonate another person or entity;
- Engage in any conduct that disrupts the Service.

### 3.4 Legal Compliance
- Use the Service for any unlawful purpose;
- Violate applicable laws or regulations;
- Infringe on the intellectual property rights of others.

## 4. Data Confidentiality

4.1 Users must maintain the confidentiality of sensitive financial and personal data.
4.2 Data must only be accessed and used for legitimate business purposes.
4.3 Users must not disclose confidential information to unauthorized parties.

## 5. Account Security

5.1 Users are responsible for safeguarding their login credentials.
5.2 Credentials must not be shared with others.
5.3 Users must report suspected security incidents immediately.

## 6. Reporting Violations

If you become aware of a violation of this Policy, report it to:
- **Email:** security@coopdata.gov.sz
- **In-app:** Use the support or reporting feature

## 7. Consequences of Violations

Violations of this Policy may result in:
- Suspension or termination of access;
- Revocation of privileges;
- Reporting to relevant authorities;
- Legal action where applicable.

## 8. Contact Information

For questions about this Policy, contact:
- **Email:** legal@coopdata.gov.sz
- **Address:** Ministry of Cooperatives, Mbabane, Kingdom of Eswatini', '# Utilisation acceptable et code de conduite

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0

## 1. Objet

La présente Politique d''utilisation acceptable et Code de conduite (« Politique ») établit les normes de comportement attendues de tous les utilisateurs de la plateforme CoopData. Elle est conçue pour garantir un environnement sûr, respectueux et productif pour toutes les parties prenantes des coopératives.

## 2. Portée

La présente Politique s''applique à tous les utilisateurs, y compris les membres des coopératives, les administrateurs, les responsables ministériels, le personnel des fédérations et des organismes faîtiers, et toute personne accédant au Service.

## 3. Conduite interdite

Vous ne devez pas :

### 3.1 Violations de sécurité
- Tenter d''obtenir un accès non autorisé à toute partie du Service ;
- Sonder, analyser ou tester la vulnérabilité des systèmes sans autorisation ;
- Intercepter ou interférer avec les communications réseau ;
- Introduire des logiciels malveillants, des virus ou du code nuisible ;
- Contourner les mesures de sécurité ou les contrôles d''authentification.

### 3.2 Intégrité des données
- Soumettre des données financières fausses, inexactes ou frauduleuses ;
- Modifier, supprimer ou falsifier des registres sans autorisation ;
- Falsifier votre identité, votre rôle ou votre affiliation ;
- Accéder à des données en dehors de votre périmètre autorisé.

### 3.3 Conduite respectueuse
- Harceler, menacer ou discriminer d''autres utilisateurs ;
- Publier du contenu offensant, diffamatoire ou inapproprié ;
- Usurper l''identité d''une autre personne ou entité ;
- Adopter tout comportement perturbant le Service.

### 3.4 Conformité légale
- Utiliser le Service à des fins illégales ;
- Violer les lois ou règlements applicables ;
- Porter atteinte aux droits de propriété intellectuelle d''autrui.

## 4. Confidentialité des données

4.1 Les utilisateurs doivent maintenir la confidentialité des données financières et personnelles sensibles.
4.2 Les données ne doivent être consultées et utilisées qu''à des fins commerciales légitimes.
4.3 Les utilisateurs ne doivent pas divulguer d''informations confidentielles à des parties non autorisées.

## 5. Sécurité du compte

5.1 Les utilisateurs sont responsables de la protection de leurs identifiants de connexion.
5.2 Les identifiants ne doivent pas être partagés avec d''autres.
5.3 Les utilisateurs doivent signaler immédiatement les incidents de sécurité présumés.

## 6. Signalement des violations

Si vous avez connaissance d''une violation de la présente Politique, signalez-la à :
- **Courriel :** security@coopdata.gov.sz
- **Dans l''application :** utilisez la fonctionnalité de support ou de signalement

## 7. Conséquences des violations

Les violations de la présente Politique peuvent entraîner :
- La suspension ou la résiliation de l''accès ;
- La révocation des privilèges ;
- Le signalement aux autorités compétentes ;
- Des poursuites judiciaires le cas échéant.

## 8. Coordonnées

Pour toute question sur la présente Politique, contactez :
- **Courriel :** legal@coopdata.gov.sz
- **Adresse :** Ministère des Coopératives, Mbabane, Royaume d''Eswatini', '# Uso Aceitável e Código de Conduta

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0

## 1. Objetivo

Esta Política de Uso Aceitável e Código de Conduta ("Política") estabelece os padrões de comportamento esperados de todos os utilizadores da plataforma CoopData. Foi concebida para garantir um ambiente seguro, respeitoso e produtivo para todas as partes interessadas das cooperativas.

## 2. Âmbito

Esta Política aplica-se a todos os utilizadores, incluindo membros de cooperativas, administradores, funcionários ministeriais, pessoal de federações e organismos de topo, e qualquer pessoa que aceda ao Serviço.

## 3. Conduta Proibida

Não deve:

### 3.1 Violações de Segurança
- Tentar obter acesso não autorizado a qualquer parte do Serviço;
- Sondar, analisar ou testar a vulnerabilidade dos sistemas sem autorização;
- Intercetar ou interferir com comunicações de rede;
- Introduzir malware, vírus ou código prejudicial;
- Contornar medidas de segurança ou controlos de autenticação.

### 3.2 Integridade dos Dados
- Submeter dados financeiros falsos, imprecisos ou fraudulentos;
- Alterar, eliminar ou adulterar registos sem autorização;
- Deturpar a sua identidade, função ou afiliação;
- Aceder a dados fora do seu âmbito autorizado.

### 3.3 Conduta Respeitosa
- Assediar, ameaçar ou discriminar outros utilizadores;
- Publicar conteúdo ofensivo, difamatório ou inadequado;
- Fazer-se passar por outra pessoa ou entidade;
- Envolver-se em qualquer conduta que perturbe o Serviço.

### 3.4 Conformidade Legal
- Utilizar o Serviço para qualquer fim ilegal;
- Violar leis ou regulamentos aplicáveis;
- Infringir os direitos de propriedade intelectual de terceiros.

## 4. Confidencialidade dos Dados

4.1 Os utilizadores devem manter a confidencialidade dos dados financeiros e pessoais sensíveis.
4.2 Os dados só devem ser acedidos e utilizados para fins comerciais legítimos.
4.3 Os utilizadores não devem divulgar informações confidenciais a partes não autorizadas.

## 5. Segurança da Conta

5.1 Os utilizadores são responsáveis por proteger as suas credenciais de acesso.
5.2 As credenciais não devem ser partilhadas com terceiros.
5.3 Os utilizadores devem reportar imediatamente incidentes de segurança suspeitos.

## 6. Reportar Violações

Se tiver conhecimento de uma violação desta Política, reporte-a a:
- **Email:** security@coopdata.gov.sz
- **Na aplicação:** utilize a funcionalidade de suporte ou reporte

## 7. Consequências das Violações

As violações desta Política podem resultar em:
- Suspensão ou rescisão do acesso;
- Revogação de privilégios;
- Reporte às autoridades competentes;
- Ação legal quando aplicável.

## 8. Informações de Contacto

Para questões sobre esta Política, contacte:
- **Email:** legal@coopdata.gov.sz
- **Endereço:** Ministério das Cooperativas, Mbabane, Reino de Essuatíni', '# Kusetjentiswa Lokwemukelekako Nekhodi Yekutiphatsa

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0

## 1. Injongo

LeNqubomgomo Yekusetjentiswa Lokwemukelekako neKhodI Yekutiphatsa ("Nqubomgomo") isungula emazinga ekutiphatsa lokulindzelwe kubo bonkhe basebentisi bepulatifomu ye-CoopData. Yakhelwe kucinisekisa indzawo lephephile, lehloniphako, nelekhiqizo kubo bonkhe bantfu labatsintsekako betimphakatsi tekusebentisana.

## 2. Umkhawulo

LeNqubomgomo isebenta kubo bonkhe basebentisi, kufaka phakatsi emalunga etimphakatsi tekusebentisana, baphathi, tikhulu temnyango, basebenti betimfelandvunye netinhlangano letikhulu, nanoma ngubani lofinyelela Insita.

## 3. Kutiphatsa Lokungavunyelwe

Akukafanele:

### 3.1 Kwephula Kuvikeleka
- Ufune kufinyelela lokungagunyatiwe kunoma yiphi ingxenye yeNsita;
- Uhlole, uskeni, noma uhlole buthakathaka betinhlelo ngaphandle kwemvume;
- Ubambe noma uphazamise kukhulumisana kwenethiwekhi;
- Ufake i-malware, emagciwane, noma likhodi lelimbi;
- Uphambukise tindlela tekuphepha noma kulawula kufakazela.

### 3.2 Bufakazi Bedatha
- Ufake datha yetimali lengemanga, lengacondzile, noma yebucili;
- Ushintje, ucise, noma ulimaze emarekhodi ngaphandle kwemvume;
- Ufihle buminandzaba bakho, indzima, noma kuhlangana kwakho;
- Ufinyelele datha ngaphandle kwemkhawulo wakho logunyatiwe.

### 3.3 Kutiphatsa Lokuhloniphako
- Uhlukumeze, usongele, noma ubhandluze abanye basebentisi;
- Ufake lokuqukethwe lokulimako, lokudicilela phansi, noma lokungafanele;
- Ulingise omunye umuntfu noma inhlangano;
- Uhlanganyele kunoma yikuphi kutiphatsa lokuphazamisa Insita.

### 3.4 Kuhambisana Nemtsetfo
- Usebentise Insita nganoma yini lengemtsetfweni;
- Wephule imitsetfo noma imigomo lesebentako;
- Wephule emalungelo ebunikazi bekuhlakanipha ebantfu.

## 4. Bumfihlo Bedatha

4.1 Basebentisi kufanele bagcine bumfihlo bedatha yetimali neyomuntfu lebucayi.
4.2 Datha kufanele ifinyelelwe futhi isetjentiswe kuphela ngetinhloso lebhizinisi lefanele.
4.3 Basebentisi akukafanele badlulisele lwati luyimfihlo kubantfu labangagunyatiwe.

## 5. Kuvikeleka Kwe-Akhawunti

5.1 Basebentisi banesibopho sekugcina imininingwane yabo yekungena.
5.2 Imininingwane yekungena akukafanele yabelwane nabanye.
5.3 Basebentisi kufanele babike ngokushesha tigameko tekuphepha letisoliswa.

## 6. Kubika Kwephula

Uma wati ngekwephula leNqubomgomo, kubike ku:
- **I-imeyili:** security@coopdata.gov.sz
- **E-aphu:** sebenzisa sici selusito noma sekubika

## 7. Imiphumela Yekwephula

Kwephula leNqubomgomo kungaholela ku:
- Kumiswa noma kuphela kwekusebentisa;
- Kuhoxiswa kwemalungelo;
- Kubikwa etiphathimandla letifanele;
- Kutsatsa emtsetfweni lapho kusebenta khona.

## 8. Lwati Lwekuthintana

Ngemibuto ngalemiGomo, thintana:
- **I-imeyili:** legal@coopdata.gov.sz
- **Likheli:** UMnyango Wetimphakatsi Tekusebentisana, eMbabane, eMbusweni weSwatini'),
    ('security', 'Security & Protection Policy', 'Politique de sécurité et de protection', 'Política de Segurança e Proteção', 'Inqubomgomo Yekuvikeleka Nekuvikelwa', '# Security & Protection Policy

**Effective Date:** 1 January 2026
**Version:** 1.0

## 1. Purpose

This Security & Protection Policy describes the technical and organizational measures CoopData implements to protect the confidentiality, integrity, and availability of the Service and the data it processes.

## 2. Information Security Objectives

CoopData is committed to:
- Protecting data from unauthorized access, disclosure, alteration, and destruction;
- Ensuring the availability and reliability of the Service;
- Complying with applicable security and data protection regulations;
- Continuously improving our security posture.

## 3. Technical Security Measures

### 3.1 Access Control
- Role-based access control (RBAC) enforcing the four-level IAM hierarchy;
- Strong authentication, including multi-factor authentication (MFA);
- Principle of least privilege for all user accounts;
- Session management and automatic timeout.

### 3.2 Data Protection
- Encryption of data in transit (TLS 1.2+);
- Encryption of sensitive data at rest;
- Secure key management and regular key rotation;
- Data isolation between organizations (multi-tenancy).

### 3.3 Application Security
- Input validation and sanitization to prevent injection attacks;
- Protection against OWASP Top 10 vulnerabilities;
- Rate limiting to prevent abuse and brute-force attacks;
- Regular security testing and code review.

### 3.4 Infrastructure Security
- Network segmentation and firewalls;
- Regular security patching and updates;
- Monitoring and intrusion detection;
- Secure backups and disaster recovery.

## 4. Organizational Measures

- Security awareness training for personnel;
- Clear roles and responsibilities;
- Incident response procedures;
- Vendor and third-party security assessments.

## 5. Incident Management

5.1 Security incidents are detected, analyzed, and responded to promptly.
5.2 Affected users and authorities are notified in accordance with legal requirements.
5.3 Incidents are documented and used to improve security measures.

## 6. User Responsibilities

Users are expected to:
- Use strong, unique passwords;
- Enable multi-factor authentication where available;
- Report suspected security incidents;
- Follow acceptable use guidelines;
- Protect their login credentials.

## 7. Data Breach Notification

In the event of a data breach, CoopData will notify affected individuals and relevant authorities within the timeframe required by applicable law.

## 8. Contact Information

To report a security concern, contact:
- **Email:** security@coopdata.gov.sz
- **Address:** Ministry of Cooperatives, Mbabane, Kingdom of Eswatini', '# Politique de sécurité et de protection

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0

## 1. Objet

La présente Politique de sécurité et de protection décrit les mesures techniques et organisationnelles que CoopData met en œuvre pour protéger la confidentialité, l''intégrité et la disponibilité du Service et des données qu''il traite.

## 2. Objectifs de sécurité de l''information

CoopData s''engage à :
- Protéger les données contre tout accès, divulgation, altération et destruction non autorisés ;
- Assurer la disponibilité et la fiabilité du Service ;
- Respecter les réglementations applicables en matière de sécurité et de protection des données ;
- Améliorer continuellement notre posture de sécurité.

## 3. Mesures techniques de sécurité

### 3.1 Contrôle d''accès
- Contrôle d''accès basé sur les rôles (RBAC) appliquant la hiérarchie IAM à quatre niveaux ;
- Authentification forte, y compris l''authentification multifacteur (MFA) ;
- Principe du moindre privilège pour tous les comptes utilisateurs ;
- Gestion des sessions et délai d''expiration automatique.

### 3.2 Protection des données
- Chiffrement des données en transit (TLS 1.2+) ;
- Chiffrement des données sensibles au repos ;
- Gestion sécurisée des clés et rotation régulière des clés ;
- Isolation des données entre les organisations (multi-location).

### 3.3 Sécurité des applications
- Validation et assainissement des entrées pour prévenir les attaques par injection ;
- Protection contre les vulnérabilités OWASP Top 10 ;
- Limitation du débit pour prévenir les abus et les attaques par force brute ;
- Tests de sécurité et revue de code réguliers.

### 3.4 Sécurité de l''infrastructure
- Segmentation du réseau et pare-feu ;
- Correctifs et mises à jour de sécurité réguliers ;
- Surveillance et détection des intrusions ;
- Sauvegardes sécurisées et reprise après sinistre.

## 4. Mesures organisationnelles

- Formation de sensibilisation à la sécurité du personnel ;
- Rôles et responsabilités clairs ;
- Procédures de réponse aux incidents ;
- Évaluations de sécurité des fournisseurs et des tiers.

## 5. Gestion des incidents

5.1 Les incidents de sécurité sont détectés, analysés et traités rapidement.
5.2 Les utilisateurs et autorités concernés sont notifiés conformément aux exigences légales.
5.3 Les incidents sont documentés et utilisés pour améliorer les mesures de sécurité.

## 6. Responsabilités des utilisateurs

Les utilisateurs sont tenus de :
- Utiliser des mots de passe forts et uniques ;
- Activer l''authentification multifacteur lorsque disponible ;
- Signaler les incidents de sécurité présumés ;
- Suivre les directives d''utilisation acceptable ;
- Protéger leurs identifiants de connexion.

## 7. Notification de violation de données

En cas de violation de données, CoopData notifiera les personnes concernées et les autorités compétentes dans le délai requis par la loi applicable.

## 8. Coordonnées

Pour signaler un problème de sécurité, contactez :
- **Courriel :** security@coopdata.gov.sz
- **Adresse :** Ministère des Coopératives, Mbabane, Royaume d''Eswatini', '# Política de Segurança e Proteção

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0

## 1. Objetivo

Esta Política de Segurança e Proteção descreve as medidas técnicas e organizacionais que o CoopData implementa para proteger a confidencialidade, integridade e disponibilidade do Serviço e dos dados que processa.

## 2. Objetivos de Segurança da Informação

O CoopData está empenhado em:
- Proteger os dados contra acesso, divulgação, alteração e destruição não autorizados;
- Garantir a disponibilidade e fiabilidade do Serviço;
- Cumprir os regulamentos de segurança e proteção de dados aplicáveis;
- Melhorar continuamente a nossa postura de segurança.

## 3. Medidas Técnicas de Segurança

### 3.1 Controlo de Acesso
- Controlo de acesso baseado em funções (RBAC) que aplica a hierarquia IAM de quatro níveis;
- Autenticação forte, incluindo autenticação multifator (MFA);
- Princípio do menor privilégio para todas as contas de utilizador;
- Gestão de sessões e tempo limite automático.

### 3.2 Proteção de Dados
- Encriptação de dados em trânsito (TLS 1.2+);
- Encriptação de dados sensíveis em repouso;
- Gestão segura de chaves e rotação regular de chaves;
- Isolamento de dados entre organizações (multi-inquilino).

### 3.3 Segurança da Aplicação
- Validação e saneamento de entradas para prevenir ataques de injeção;
- Proteção contra vulnerabilidades OWASP Top 10;
- Limitação de taxa para prevenir abuso e ataques de força bruta;
- Testes de segurança e revisão de código regulares.

### 3.4 Segurança da Infraestrutura
- Segmentação de rede e firewalls;
- Correções e atualizações de segurança regulares;
- Monitorização e deteção de intrusões;
- Cópias de segurança seguras e recuperação de desastres.

## 4. Medidas Organizacionais

- Formação de sensibilização para a segurança do pessoal;
- Funções e responsabilidades claras;
- Procedimentos de resposta a incidentes;
- Avaliações de segurança de fornecedores e terceiros.

## 5. Gestão de Incidentes

5.1 Os incidentes de segurança são detetados, analisados e respondidos prontamente.
5.2 Os utilizadores e autoridades afetados são notificados em conformidade com os requisitos legais.
5.3 Os incidentes são documentados e utilizados para melhorar as medidas de segurança.

## 6. Responsabilidades do Utilizador

Espera-se que os utilizadores:
- Utilizem palavras-passe fortes e únicas;
- Ativem a autenticação multifator quando disponível;
- Reportem incidentes de segurança suspeitos;
- Sigam as diretrizes de uso aceitável;
- Protejam as suas credenciais de acesso.

## 7. Notificação de Violação de Dados

Em caso de violação de dados, o CoopData notificará os indivíduos afetados e as autoridades relevantes dentro do prazo exigido pela lei aplicável.

## 8. Informações de Contacto

Para reportar uma preocupação de segurança, contacte:
- **Email:** security@coopdata.gov.sz
- **Endereço:** Ministério das Cooperativas, Mbabane, Reino de Essuatíni', '# Inqubomgomo Yekuvikeleka Nekuvikelwa

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0

## 1. Injongo

LeNqubomgomo Yekuvikeleka Nekuvikelwa ichaza tindlela tebuchwepheshe netenhlangano letisetjive yi-CoopData kuvikela bumfihlo, buqiniso, nekutholakala kweNsita nedatha leyicubungulako.

## 2. Tinhloso Tekuvikeleka Lwati

I-CoopData ibopheleke ku:
- Vikela datha ekufinyeleleni, ekudluliselweni, ekushintjweni, nekubhujisweni lokungagunyatiwe;
- Cinisekisa kutholakala nekuthembeka kweNsita;
- Hlanganisa nemigomo lesebentako yekuvikeleka nekuvikela datha;
- Chubeka ngekutfutfukisa simo setfu sekuphepha.

## 3. Tindlela Tekuvikeleka Tebuchwepheshe

### 3.1 Kulawula Kufinyelela
- Kulawula kufinyelela lokusekelwe endzimeni (RBAC) lokusebentisa sigaba se-IAM lesine;
- Kufakazela lokunamandla, kufaka phakatsi kufakazela kwemicimbi leminyenti (MFA);
- Simiso selilungelo lelincane kuto tonkhe tikhawunti tabasebentisi;
- Kuphatfwa kwetisesheni nekuphela kwesikhatsi ngekuzenzakalelako.

### 3.2 Kuvikelwa Kwedatha
- Kubhalwa kwekhodi kwedatha ekuhambeni (TLS 1.2+);
- Kubhalwa kwekhodi kwedatha lebucayi ekuphumuleni;
- Kuphatfwa kwemakhodi lokuphephile nekushintjwa kwemakhodi ngekujwayelekile;
- Kwehlukaniswa kwedatha emkhatsini wetinhlangano (multi-tenancy).

### 3.3 Kuvikeleka Kwe-Application
- Kucinisekiswa nekuhlanzwa kwekulokufakwayo kuvikela kuhlasela kwe-injection;
- Kuvikelwa ebuthakathakeni be-OWASP Top 10;
- Kukhawulelwa kwesilinganiso kuvikela kusetjentiswa kabi nekuhlasela kwe-brute-force;
- Kuhlolwa kwekuvikela nekubuyekezwa kwekhodi ngekujwayelekile.

### 3.4 Kuvikeleka Kwengqalasizinda
- Kwehlukaniswa kwenethiwekhi nemindvilingo yomlilo;
- Kulungiswa kwekuvikela nekubuyekeza ngekujwayelekile;
- Kulandzelela nekutfola kungena lokungagunyatiwe;
- Emabhakufesi laphephile nekubuyiselwa kwesimo sekwenteka kwelinye.

## 4. Tindlela Tenhlangano

- Kutfutfukiswa kwati kwekuvikela kubasebenti;
- Tindzima netibopho letibonakalako;
- Tinqubo tekuphendvula tigameko;
- Tihlolo tekuphepha tebaphakeli nebantfu besitsatfu.

## 5. Kuphatfwa Kwetigameko

5.1 Tigameko tekuphepha tiyatholwa, tihlaziywe, futsi tiphendvulwe ngokushesha.
5.2 Basebentisi netiphathimandla letitsintsekako bayaziswa ngemigomo yemtsetfo.
5.3 Tigameko tiyabhalwa futsi tisetjentiswe kutfutfukisa tindlela tekuphepha.

## 6. Emabopho Emsebentisi

Kulindzelwe kutsi basebentisi:
- Basebentise emaphasiwedi lanamandla, lahlukile;
- Bavule kufakazela kwemicimbi leminyenti lapho kutholakala khona;
- Babike tigameko tekuphepha letisoliswa;
- Balandzele imihlahlandlela yekusetjentiswa lokwemukelekako;
- Bavikele imininingwane yabo yekungena.

## 7. Kwaziswa Kwekuphuka Kwedatha

Esigamekweni sekuphuka kwedatha, i-CoopData itokwazisa bantfu labatsintsekako netiphathimandla letifanele ngesikhatsi lesidzingwa ngumtsetfo losebentako.

## 8. Lwati Lwekuthintana

Kubika kukhathala kwekuvikela, thintana:
- **I-imeyili:** security@coopdata.gov.sz
- **Likheli:** UMnyango Wetimphakatsi Tekusebentisana, eMbabane, eMbusweni weSwatini'),
    ('data-retention', 'Data Retention & Processing Policy', 'Politique de conservation des données', 'Política de Retenção de Dados', 'Inqubomgomo Yekugcina Nekucubungula Datha', '# Data Retention & Processing Policy

**Effective Date:** 1 January 2026
**Version:** 1.0
**Applicable Law:** Cooperative Societies Act (Eswatini), Data Protection Act

## 1. Purpose

This Data Retention & Processing Policy ("Policy") establishes the rules and procedures for the retention, processing, archiving, and deletion of data collected and processed by the CoopData platform.

## 2. Scope

This Policy applies to all data processed by CoopData, including:
- Personal data of users, members, and administrators;
- Financial statements and submission records;
- Operational and audit logs;
- Consent and compliance records;
- Backup and archival data.

## 3. Data Retention Principles

3.1 Data is retained only as long as necessary for the purposes for which it was collected.
3.2 Retention periods are determined by legal, regulatory, and operational requirements.
3.3 Data is securely stored and protected throughout its lifecycle.
3.4 Data is deleted or anonymized when no longer required.

## 4. Retention Periods

| Data Category | Retention Period | Basis |
|---|---|---|
| Financial statements | 10 years | Statutory requirement |
| Submission records | 10 years | Regulatory compliance |
| User account data | Duration of account + 5 years | Operational |
| Consent records | Duration + 10 years | Audit & compliance |
| Audit logs | 7 years | Security & compliance |
| Session data | 30 days | Operational |
| Backup data | 30 days | Operational |

## 5. Data Processing

5.1 Data is processed lawfully, fairly, and transparently.
5.2 Processing is limited to the purposes for which data was collected.
5.3 Data is accurate, complete, and kept up to date.
5.4 Data is processed with appropriate security measures.

## 6. Data Archiving

6.1 Data that is no longer actively used but must be retained is moved to secure archival storage.
6.2 Archived data is protected with the same security measures as active data.
6.3 Access to archived data is restricted and logged.

## 7. Data Deletion and Anonymization

7.1 Data that has reached the end of its retention period is securely deleted.
7.2 Where deletion is not possible (e.g., legal holds), data is anonymized.
7.3 Deletion is performed in a manner that prevents recovery.
7.4 Deletion and anonymization activities are logged and documented.

## 8. User Rights

Users may request:
- Access to their personal data;
- Correction of inaccurate data;
- Deletion of personal data (subject to legal retention);
- Restriction of processing;
- Data portability.

Requests are processed through the Privacy & Data Request feature or by contacting our Data Protection Officer.

## 9. Compliance and Monitoring

9.1 Compliance with this Policy is monitored and reviewed regularly.
9.2 Retention schedules are reviewed and updated as required.
9.3 Violations of this Policy are reported and addressed.

## 10. Contact Information

For questions about this Policy, contact:
- **Email:** privacy@coopdata.gov.sz
- **Data Protection Officer:** dpo@coopdata.gov.sz', '# Politique de conservation et de traitement des données

**Date d''entrée en vigueur :** 1er janvier 2026
**Version :** 1.0
**Droit applicable :** Loi sur les sociétés coopératives (Eswatini), Loi sur la protection des données

## 1. Objet

La présente Politique de conservation et de traitement des données (« Politique ») établit les règles et procédures de conservation, de traitement, d''archivage et de suppression des données collectées et traitées par la plateforme CoopData.

## 2. Portée

La présente Politique s''applique à toutes les données traitées par CoopData, y compris :
- Les données personnelles des utilisateurs, membres et administrateurs ;
- Les états financiers et les registres de soumission ;
- Les journaux opérationnels et d''audit ;
- Les registres de consentement et de conformité ;
- Les données de sauvegarde et d''archivage.

## 3. Principes de conservation des données

3.1 Les données sont conservées uniquement aussi longtemps que nécessaire aux fins pour lesquelles elles ont été collectées.
3.2 Les périodes de conservation sont déterminées par les exigences légales, réglementaires et opérationnelles.
3.3 Les données sont stockées et protégées de manière sécurisée tout au long de leur cycle de vie.
3.4 Les données sont supprimées ou anonymisées lorsqu''elles ne sont plus nécessaires.

## 4. Périodes de conservation

| Catégorie de données | Période de conservation | Base |
|---|---|---|
| États financiers | 10 ans | Exigence légale |
| Registres de soumission | 10 ans | Conformité réglementaire |
| Données de compte utilisateur | Durée du compte + 5 ans | Opérationnelle |
| Registres de consentement | Durée + 10 ans | Audit et conformité |
| Journaux d''audit | 7 ans | Sécurité et conformité |
| Données de session | 30 jours | Opérationnelle |
| Données de sauvegarde | 30 jours | Opérationnelle |

## 5. Traitement des données

5.1 Les données sont traitées de manière licite, loyale et transparente.
5.2 Le traitement est limité aux fins pour lesquelles les données ont été collectées.
5.3 Les données sont exactes, complètes et tenues à jour.
5.4 Les données sont traitées avec des mesures de sécurité appropriées.

## 6. Archivage des données

6.1 Les données qui ne sont plus activement utilisées mais doivent être conservées sont déplacées vers un stockage d''archivage sécurisé.
6.2 Les données archivées sont protégées avec les mêmes mesures de sécurité que les données actives.
6.3 L''accès aux données archivées est restreint et journalisé.

## 7. Suppression et anonymisation des données

7.1 Les données ayant atteint la fin de leur période de conservation sont supprimées de manière sécurisée.
7.2 Lorsque la suppression n''est pas possible (par exemple, retenues légales), les données sont anonymisées.
7.3 La suppression est effectuée de manière à empêcher toute récupération.
7.4 Les activités de suppression et d''anonymisation sont journalisées et documentées.

## 8. Droits des utilisateurs

Les utilisateurs peuvent demander :
- L''accès à leurs données personnelles ;
- La correction des données inexactes ;
- La suppression des données personnelles (sous réserve de la conservation légale) ;
- La restriction du traitement ;
- La portabilité des données.

Les demandes sont traitées via la fonctionnalité Demande de confidentialité et de données ou en contactant notre Délégué à la protection des données.

## 9. Conformité et surveillance

9.1 La conformité à la présente Politique est surveillée et examinée régulièrement.
9.2 Les calendriers de conservation sont examinés et mis à jour si nécessaire.
9.3 Les violations de la présente Politique sont signalées et traitées.

## 10. Coordonnées

Pour toute question sur la présente Politique, contactez :
- **Courriel :** privacy@coopdata.gov.sz
- **Délégué à la protection des données :** dpo@coopdata.gov.sz', '# Política de Retenção e Processamento de Dados

**Data de vigência:** 1 de janeiro de 2026
**Versão:** 1.0
**Lei aplicável:** Lei das Sociedades Cooperativas (Essuatíni), Lei de Proteção de Dados

## 1. Objetivo

Esta Política de Retenção e Processamento de Dados ("Política") estabelece as regras e procedimentos para a retenção, processamento, arquivamento e eliminação de dados recolhidos e processados pela plataforma CoopData.

## 2. Âmbito

Esta Política aplica-se a todos os dados processados pelo CoopData, incluindo:
- Dados pessoais de utilizadores, membros e administradores;
- Demonstrações financeiras e registos de submissão;
- Registos operacionais e de auditoria;
- Registos de consentimento e conformidade;
- Dados de cópias de segurança e arquivo.

## 3. Princípios de Retenção de Dados

3.1 Os dados são retidos apenas enquanto necessário para os fins para os quais foram recolhidos.
3.2 Os períodos de retenção são determinados por requisitos legais, regulamentares e operacionais.
3.3 Os dados são armazenados e protegidos de forma segura ao longo do seu ciclo de vida.
3.4 Os dados são eliminados ou anonimizados quando já não são necessários.

## 4. Períodos de Retenção

| Categoria de Dados | Período de Retenção | Base |
|---|---|---|
| Demonstrações financeiras | 10 anos | Requisito legal |
| Registos de submissão | 10 anos | Conformidade regulamentar |
| Dados de conta de utilizador | Duração da conta + 5 anos | Operacional |
| Registos de consentimento | Duração + 10 anos | Auditoria e conformidade |
| Registos de auditoria | 7 anos | Segurança e conformidade |
| Dados de sessão | 30 dias | Operacional |
| Dados de cópias de segurança | 30 dias | Operacional |

## 5. Processamento de Dados

5.1 Os dados são processados de forma lícita, justa e transparente.
5.2 O processamento é limitado aos fins para os quais os dados foram recolhidos.
5.3 Os dados são precisos, completos e mantidos atualizados.
5.4 Os dados são processados com medidas de segurança adequadas.

## 6. Arquivamento de Dados

6.1 Os dados que já não são utilizados ativamente mas devem ser retidos são movidos para armazenamento de arquivo seguro.
6.2 Os dados arquivados são protegidos com as mesmas medidas de segurança que os dados ativos.
6.3 O acesso aos dados arquivados é restrito e registado.

## 7. Eliminação e Anonimização de Dados

7.1 Os dados que atingiram o fim do seu período de retenção são eliminados de forma segura.
7.2 Quando a eliminação não é possível (por exemplo, retenções legais), os dados são anonimizados.
7.3 A eliminação é realizada de forma a impedir a recuperação.
7.4 As atividades de eliminação e anonimização são registadas e documentadas.

## 8. Direitos do Utilizador

Os utilizadores podem solicitar:
- Acesso aos seus dados pessoais;
- Correção de dados imprecisos;
- Eliminação de dados pessoais (sujeito a retenção legal);
- Restrição do processamento;
- Portabilidade de dados.

Os pedidos são processados através da funcionalidade Pedido de Privacidade e Dados ou contactando o nosso Encarregado de Proteção de Dados.

## 9. Conformidade e Monitorização

9.1 A conformidade com esta Política é monitorizada e revista regularmente.
9.2 Os calendários de retenção são revistos e atualizados conforme necessário.
9.3 As violações desta Política são reportadas e tratadas.

## 10. Informações de Contacto

Para questões sobre esta Política, contacte:
- **Email:** privacy@coopdata.gov.sz
- **Encarregado de Proteção de Dados:** dpo@coopdata.gov.sz', '# Inqubomgomo Yekugcina Nekucubungula Datha

**Lusuku Lwekucala:** 1 Bhimbidvwane 2026
**Inhlobo:** 1.0
**Umtsetfo Locondzile:** Umtsetfo Wetimphakatsi Tekusebentisana (eSwatini), Umtsetfo Wekuvikela Datha

## 1. Injongo

LeNqubomgomo Yekugcina Nekucubungula Datha ("Nqubomgomo") isungula imitsetfo netinqubo tekugcina, kucubungula, kugcina emakhothamo, nekucisha datha lebutswe futhi yacubungulwa yipulatifomu ye-CoopData.

## 2. Umkhawulo

LeNqubomgomo isebenta kuyo yonkhe datha leyacubungulwa yi-CoopData, kufaka phakatsi:
- Datha yomuntfu yabasebentisi, emalunga, nebaphathi;
- Titatimende tetimali nemarekhodi ekufaka;
- Emarekhodi ekusebenta nekuhlola;
- Emarekhodi emvume nekuhambisana;
- Datha yemabhakufesi nekugcina emakhothamo.

## 3. Imigomo Yekugcina Datha

3.1 Datha igcinwa kuphela ngesikhatsi lesidzingekako ngetinhloso lebeyibutswe ngato.
3.2 Tikhatsi tekugcina tincunywa yimigomo yemtsetfo, yelawulo, nekusebenta.
3.3 Datha igcinwa futhi ivikelwe ngekuphepha kuyo yonkhe impilo yayo.
3.4 Datha iyacishwa noma ibhalwe ngaphandle kwekukhonjwa ngesikhatsi singasadingeki.

## 4. Tikhatsi Tekugcina

| Sigaba Sedatha | Sikhatsi Sekugcina | Sisekelo |
|---|---|---|
| Titatimende tetimali | Iminyaka lelishumi | Umtsetfo |
| Emarekhodi ekufaka | Iminyaka lelishumi | Kuhambisana nelawulo |
| Datha ye-akhawunti yemsebentisi | Sikhatsi se-akhawunti + iminyaka le-5 | Kusebenta |
| Emarekhodi emvume | Sikhatsi + iminyaka lelishumi | Kuhlola nekuhambisana |
| Emarekhodi ekuhlola | Iminyaka le-7 | Kuvikeleka nekuhambisana |
| Datha yesesheni | Tinsuku letingu-30 | Kusebenta |
| Datha yemabhakufesi | Tinsuku letingu-30 | Kusebenta |

## 5. Kucubungula Datha

5.1 Datha icubungulwa ngemtsetfo, ngekufanele, nangekubonakala.
5.2 Kucubungula kukhawulelwe etinhlosweni lebeyibutswe ngato datha.
5.3 Datha inembile, iphelele, futsi igcinwa isesikhatsini.
5.4 Datha icubungulwa ngetindlela tekuphepha letifanele.

## 6. Kugcina Emakhothamo

6.1 Datha lengasasetsetjentiswa kakhulu kodvwa okufanele igcinwe iyiswa ekugcineni kwemakhothamo lokuphephile.
6.2 Datha yemakhothamo ivikelwa ngetindlela tekuphepha letifanako nedatha lesebentako.
6.3 Kufinyelela datha yemakhothamo kukhawulelwe futsi kubhalwe phansi.

## 7. Kucisha Nekubhala Ngaphandle Kwekukhonjwa Kwedatha

7.1 Datha lefike ekupheleni kwesikhatsi sayo sekugcina iyacishwa ngekuphepha.
7.2 Lapho kucisha kungenteki khona (isibonelo, kugcinwa ngumtsetfo), datha ibhalwa ngaphandle kwekukhonjwa.
7.3 Kucisha kwenteka ngendlela levinjela kubuyiselwa.
7.4 Imisebenti yekucisha nekubhala ngaphandle kwekukhonjwa iyabhalwa futsi ibhalwe phansi.

## 8. Emalungelo Emsebentisi

Basebentisi bangacela:
- Kufinyelela datha yabo yomuntfu;
- Kulungiswa kwedatha lenganembile;
- Kucishwa kwedatha yomuntfu (ngaphansi kwekugcinwa ngumtsetfo);
- Kukhawulelwa kwekucubungula;
- Kuthwala datha.

Ticelo ticubungulwa ngesici seSicelo Sebumfihlo Nekudatha noma ngekuthintana neSikhulu Setfu Sekuvikela Datha.

## 9. Kuhambisana Nekulandzelela

9.1 Kuhambisana naleNqubomgomo kuyalandzelelwa futsi kubuyekezwe ngekujwayelekile.
9.2 Tinhlelo tekugcina tiyabuyekezwa futsi tibuyekezwe njengoba kudzingeka.
9.3 Kwephula leNqubomgomo kuyabikwa futsi kubukwe.

## 10. Lwati Lwekuthintana

Ngemibuto ngalemiGomo, thintana:
- **I-imeyili:** privacy@coopdata.gov.sz
- **Sikhulu Sekuvikela Datha:** dpo@coopdata.gov.sz')
) AS v(slug, title_en, title_fr, title_pt, title_ss, content_en, content_fr, content_pt, content_ss)
WHERE NOT EXISTS (SELECT 1 FROM legal_policies lp WHERE lp.slug = v.slug);
