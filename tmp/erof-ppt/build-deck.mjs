import fs from 'node:fs/promises';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const OUT = 'C:/PROJETS/erof-coges/Presentation_EROF_resultats_collecte.pptx';
const PREVIEW = 'C:/PROJETS/erof-coges/tmp/erof-ppt/rendered';
const FORM_PAGE = 'C:/PROJETS/erof-coges/tmp/erof-ppt/pdf-pages/page-07.png';
const W = 1280, H = 720;
const C = { navy:'#11233F', blue:'#155E9A', cyan:'#19A7AE', gold:'#E8A317', orange:'#E56B3F', red:'#C43D3D', green:'#2E8B67', ink:'#172033', muted:'#607086', pale:'#F3F6F9', white:'#FFFFFF', line:'#D4DEE8' };

const deck = Presentation.create({ slideSize:{ width:W, height:H } });

function box(slide, name, x, y, w, h, fill='none', radius='rect', line='none') {
  return slide.shapes.add({ name, geometry:radius, position:{left:x,top:y,width:w,height:h}, fill, line:{style:'solid',fill:line,width:line==='none'?0:1} });
}
function txt(slide, name, text, x, y, w, h, size=24, color=C.ink, bold=false, align='left', valign='top') {
  const s=slide.shapes.add({name,geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{style:'solid',fill:'none',width:0}});
  s.text=text; s.text.style={fontSize:size,typeface:'Aptos',color,bold,alignment:align,verticalAlignment:valign,autoFit:'shrinkText'}; return s;
}
function base(title, kicker, n) {
  const s=deck.slides.add(); s.background.fill=C.white;
  txt(s,'kicker',kicker.toUpperCase(),56,34,900,24,15,C.blue,true);
  txt(s,'title',' '+title,56,65,1160,82,34,C.navy,true);
  box(s,'title-rule',56,154,1168,3,C.gold);
  txt(s,'page',String(n).padStart(2,'0'),1175,674,48,22,13,C.muted,true,'right');
  return s;
}
function notes(slide, lines, sources) {
  slide.speakerNotes.textFrame.setText([...lines,'','[Sources]',...sources.map(x=>'- '+x)]); slide.speakerNotes.setVisible(true);
}
function stat(slide,x,y,w,h,value,label,color=C.blue) {
  box(slide,'stat-bg-'+label,x,y,w,h,C.pale,'roundRect');
  box(slide,'stat-accent-'+label,x,y,8,h,color,'rect');
  txt(slide,'stat-value-'+label,value,x+28,y+28,w-45,72,48,color,true);
  txt(slide,'stat-label-'+label,label,x+28,y+105,w-45,h-120,18,C.ink,false);
}
function chart(slide,type,pos,categories,values,color,max=5,labels=true) {
  return slide.charts.add(type,{position:pos,categories,series:[{name:'Valeur',categories,values,fill:color}],hasLegend:false,dataLabels:{showValue:labels},chartFill:C.white,chartLine:{style:'solid',width:0,fill:C.white},plotAreaFill:{type:'none'},plotAreaLine:{style:'solid',width:0,fill:C.white},xAxis:{visible:type!=='bar',min:0,max,majorUnit:max>10?20:1,line:{style:'solid',width:1,fill:C.line},majorGridlines:{style:'solid',width:1,fill:'#E8EEF3'},textStyle:{typeface:'Aptos',fontSize:'12px',color:C.muted}},yAxis:{visible:true,line:{style:'solid',width:0,fill:C.white},textStyle:{typeface:'Aptos',fontSize:'13px',color:C.ink}},barOptions:{direction:type==='bar'?'bar':'column',grouping:'clustered',gapWidth:65}});
}

// 1 — title
{
 const s=deck.slides.add(); s.background.fill=C.navy;
 box(s,'gold-band',0,0,18,H,C.gold);
 txt(s,'eyebrow','COMMUNICATION DES RÉSULTATS · COLLECTE EROF 2026',62,58,1080,32,18,C.gold,true);
 txt(s,'main-title','Évaluation du fonctionnement des COGES',62,190,1080,190,62,C.white,true);
 txt(s,'subtitle','Présentation du formulaire et premiers enseignements de la collecte',62,408,850,72,28,'#D6E3F0');
 txt(s,'scope','204 COGES · 12 DRENA · Base arrêtée au 27 juillet 2026',62,594,980,34,19,C.white,true);
 txt(s,'page','01',1175,674,48,22,13,'#B8C7D8',true,'right');
 notes(s,['Présenter l’objectif : expliquer l’outil, partager les résultats consolidés et ouvrir la discussion sur les priorités d’appui.'],['Base brute EROF du 27/07/2026','Formulaire EROF, version fournie par l’utilisateur']);
}

// 2 — form
{
 const s=base('Un formulaire structuré pour relier gouvernance, pratiques et preuves','1 · L’OUTIL D’ÉVALUATION',2);
 const bytes=await fs.readFile(FORM_PAGE); s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:'image/png',alt:'Page du formulaire EROF montrant les rubriques de gouvernance',fit:'contain',position:{left:60,top:170,width:390,height:475}});
 txt(s,'form-count','20',500,178,155,80,58,C.blue,true); txt(s,'form-count-label','sections thématiques',500,255,220,40,21,C.ink,true);
 txt(s,'form-pages','25',500,330,155,80,58,C.cyan,true); txt(s,'form-pages-label','pages de collecte',500,407,220,40,21,C.ink,true);
 txt(s,'form-scale','1 → 5',500,480,190,80,48,C.gold,true); txt(s,'form-scale-label','échelle commune de notation',500,557,255,48,21,C.ink,true);
 txt(s,'form-logic','Le dispositif combine identification, fonctionnement des organes, gestion financière, planification, partenariats, inclusion et contrôle des pièces justificatives.',790,195,390,220,23,C.ink,false);
 box(s,'logic-line',790,445,330,4,C.gold);
 txt(s,'form-message','La force de l’outil : confronter la perception déclarée aux preuves effectivement disponibles.',790,472,390,120,26,C.navy,true);
 notes(s,['Ne pas parcourir les 20 sections une à une. Insister sur la logique : informations générales, notation des pratiques, puis vérification documentaire.','Expliquer que l’échelle de 1 à 5 rend les dimensions comparables.'],['Formulaire EROF PDF fourni par l’utilisateur (25 pages)']);
}

// 3 scope
{
 const s=base('Une collecte large, équilibrée entre milieu urbain et rural','2 · PÉRIMÈTRE ET QUALITÉ',3);
 stat(s,56,180,350,210,'204','évaluations enregistrées',C.blue);
 stat(s,465,180,350,210,'185','évaluations validées',C.green);
 stat(s,874,180,350,210,'12','DRENA couvertes',C.gold);
 txt(s,'coverage','Répartition du milieu de collecte',56,455,480,36,24,C.navy,true);
 const vals=[96,95,2,11]; const labs=['Urbain','Rural','Périurbain','Non renseigné'];
 chart(s,'bar',{left:55,top:495,width:650,height:165},labs,vals,C.cyan,100,true);
 txt(s,'valid-rate','91 %',835,470,260,80,58,C.green,true,'center');
 txt(s,'valid-copy','des évaluations sont validées\n19 brouillons restent à finaliser',790,555,350,70,22,C.ink,true,'center');
 notes(s,['Souligner la couverture géographique : les 12 DRENA comptent chacune 15 à 20 saisies.','Préciser que les analyses de score portent sur les 185 dossiers validés.'],['Base brute EROF du 27/07/2026, onglet « Base brute »']);
}

// 4 overall
{
 const s=base('Le niveau moyen est fonctionnel, mais la maturité reste hétérogène','3 · RÉSULTAT GLOBAL',4);
 txt(s,'mean','3,52 / 5',65,185,405,100,64,C.blue,true);
 txt(s,'median','Médiane : 3,62 · Étendue : 1,93 à 4,78',70,292,430,42,21,C.muted);
 const cats=['Critique','Faible','Moyen','Fonctionnel','Avancé']; const vals=[2,33,40,96,14];
 chart(s,'bar',{left:510,top:170,width:670,height:385},cats,vals,C.blue,100,true);
 box(s,'takeaway',65,405,375,160,'#EEF5FA','roundRect');
 txt(s,'takeaway-text','59 %',92,430,150,62,46,C.green,true);
 txt(s,'takeaway-copy','des COGES validés sont classés « fonctionnels » ou « avancés ».',92,500,310,50,20,C.ink,true);
 txt(s,'foot','Base de calcul : 185 évaluations validées',510,575,670,30,15,C.muted,false,'right');
 notes(s,['Présenter d’abord le score moyen, puis la distribution : le résultat central est encourageant mais 75 COGES restent sous le niveau fonctionnel.','Les 19 brouillons sans score ne sont pas inclus.'],['Base brute EROF du 27/07/2026, colonnes « Score global » et « Classification »']);
}

// 5 DRENA
{
 const s=base('Les écarts territoriaux atteignent près d’un point sur cinq','3 · RÉSULTAT GLOBAL',5);
 const cats=['Danané','Daloa','Agboville','Man','Touba','Tiassalé','Duékoué','Issia','Minignan','Ferké','Guiglo','Odienné'];
 const vals=[3.79,3.78,3.77,3.69,3.67,3.64,3.51,3.49,3.45,3.33,3.32,2.81];
 chart(s,'bar',{left:55,top:170,width:780,height:460},cats,vals,C.blue,5,true);
 txt(s,'gap','0,98 point',900,215,260,65,44,C.orange,true,'center');
 txt(s,'gap-label','sépare la moyenne la plus haute de la plus basse',890,285,280,70,20,C.ink,true,'center');
 box(s,'caution',880,420,310,125,'#FFF5E8','roundRect');
 txt(s,'caution-text','À approfondir',908,443,250,30,22,C.orange,true);
 txt(s,'caution-copy','Comparer les contextes et les appuis disponibles avant d’en tirer des conclusions causales.',908,482,250,52,17,C.ink);
 notes(s,['Lire ce graphique comme un signal de ciblage, non comme un classement définitif.','Danané, Daloa et Agboville se situent autour de 3,8 ; Odienné est à 2,81.'],['Base brute EROF du 27/07/2026 ; moyennes calculées sur les évaluations validées par DRENA']);
}

// 6 axes
{
 const s=base('La documentation est solide ; la résilience demeure le principal angle mort','4 · LECTURE PAR DIMENSION',6);
 const cats=['Documents','Apprentissages','Gestion financière','Fonctionnement','Partenariats','Planification','Gouvernance','Participation','Inclusion','Protection','Résilience'];
 const vals=[4.19,3.85,3.80,3.65,3.65,3.49,3.44,3.31,3.11,2.99,1.45];
 chart(s,'bar',{left:55,top:170,width:800,height:465},cats,vals,C.cyan,5,true);
 txt(s,'axis-high','4,19',920,195,210,65,48,C.green,true,'center'); txt(s,'axis-high-l','Documentation\net classement',920,260,210,60,20,C.ink,true,'center');
 txt(s,'axis-low','1,45',920,405,210,65,48,C.red,true,'center'); txt(s,'axis-low-l','Préparation\naux crises',920,470,210,60,20,C.ink,true,'center');
 notes(s,['Mettre en évidence le contraste : les documents sont souvent présents et classés, mais peu de COGES disposent d’un mécanisme financier de réponse aux crises.','Les dimensions sont des moyennes des questions notées de leur section.'],['Base brute EROF du 27/07/2026, questions des sections 4 à 15']);
}

// 7 strengths
{
 const s=base('Les acquis reposent sur l’ancrage institutionnel et les outils de base','4 · POINTS FORTS',7);
 const items=[['4,98','Participation du directeur aux AG'],['4,81',"Carnet d’activités et de retrait"],['4,67','Plan d’action communautaire'],['4,59','Respect des mandats'],['4,47','Élection démocratique du bureau']];
 items.forEach((it,i)=>{const y=175+i*88; txt(s,'rank'+i,String(i+1).padStart(2,'0'),60,y,55,45,24,C.gold,true); txt(s,'item'+i,it[1],125,y,760,45,23,C.ink,true); txt(s,'score'+i,it[0]+' / 5',930,y,190,45,27,C.green,true,'right'); box(s,'line'+i,125,y+56,995,1,C.line);});
 txt(s,'meaning','Ces acquis constituent un socle à préserver : légitimité du bureau, implication de la direction et outils de planification.',770,605,350,46,18,C.navy,true,'right');
 notes(s,['Donner deux exemples concrets : participation quasi systématique du directeur et forte présence du PACC.','Rappeler qu’un bon score déclaré doit être rapproché de la disponibilité des pièces justificatives.'],['Base brute EROF du 27/07/2026 ; moyennes des questions notées']);
}

// 8 weaknesses
{
 const s=base('Cinq fragilités concentrent l’essentiel du risque opérationnel','4 · POINTS DE VIGILANCE',8);
 const items=[['1,20','Activités génératrices de revenus'],['1,45',"Fonds d’urgence et réponse aux crises"],['1,98','Participation des élèves au bureau'],['2,11','Disponibilité du règlement intérieur'],['2,59','Collaboration avec collectivités et ONG']];
 items.forEach((it,i)=>{const x=i<3?55:435+(i-3)*390; const y=i<3?175+i*125:545; const w=i<3?1120:350; const h=i<3?92:90; box(s,'weak-bg'+i,x,y,w,h,i<3?'#FFF1EE':'#FFF7E8','roundRect'); txt(s,'weak-score'+i,it[0],x+24,y+15,120,50,32,C.red,true); txt(s,'weak-label'+i,it[1],x+165,y+20,w-190,52,20,C.ink,true);});
 notes(s,['Ces scores donnent une base simple pour prioriser les appuis.','Insister sur la combinaison financement, résilience et ouverture aux partenaires.'],['Base brute EROF du 27/07/2026 ; cinq plus faibles moyennes de questions']);
}

// 9 proof
{
 const s=base('La preuve documentaire confirme les forces… et révèle les écarts','5 · CONTRÔLE DOCUMENTAIRE',9);
 const cats=['PACC','Liste du BE','RIB','Carnet retrait','PV AG élective','Textes réglementaires','Budget']; const vals=[82.4,81.4,81.4,80.4,70.1,67.2,60.8];
 chart(s,'bar',{left:55,top:175,width:700,height:420},cats,vals,C.green,100,true);
 txt(s,'proof-rate','48,5 %',850,190,290,70,50,C.blue,true,'center');
 txt(s,'proof-label','des 4 080 pièces attendues sont disponibles',825,265,340,70,21,C.ink,true,'center');
 box(s,'proof-alert',820,405,360,155,'#FFF1EE','roundRect');
 txt(s,'proof-alert-title','Pièces les plus rares',850,428,300,30,22,C.red,true);
 txt(s,'proof-alert-copy','Documents AGR : 1 %\nProtection / santé : 12 %\nRèglement intérieur : 26 %',850,470,300,75,19,C.ink);
 notes(s,['Expliquer que « disponible » regroupe les pièces consultées et non consultées.','La disponibilité globale est de 1 977 pièces sur 4 080 attendues.'],['Base brute EROF du 27/07/2026, onglet « Preuves documentaires »']);
}

// 10 people
{
 const s=base('Les bureaux sont presque paritaires, mais la professionnalisation reste à renforcer','5 · CAPACITÉS DES BUREAUX',10);
 stat(s,55,180,340,205,'46 %','de femmes parmi 2 244 membres',C.cyan);
 stat(s,470,180,340,205,'33 %','déclarent une formation COGES',C.gold);
 stat(s,885,180,340,205,'15 %','ont une bonne maîtrise du rôle',C.green);
 txt(s,'mastery-title','Maîtrise du rôle déclarée',55,455,440,35,24,C.navy,true);
 chart(s,'bar',{left:55,top:495,width:650,height:160},['Faible','Moyenne','Bonne'],[217,1698,329],C.blue,1800,true);
 txt(s,'capacity-msg','Le renouvellement des bureaux doit s’accompagner d’un parcours de formation ciblé sur les responsabilités et les outils de gestion.',790,478,380,140,25,C.navy,true);
 notes(s,['Nuancer : la parité numérique ne garantit pas la présence des femmes aux postes de décision.','La variable de formation est non renseignée pour une large part des membres ; présenter 33 % comme un minimum observé, pas comme une mesure exhaustive.'],['Base brute EROF du 27/07/2026, onglet « Membres BE »']);
}

// 11 priorities
{
 const s=base('Trois priorités transforment les constats en plan d’action','6 · RECOMMANDATIONS',11);
 const items=[['01','Sécuriser la gouvernance','Mettre à disposition le règlement intérieur, actualiser les listes et systématiser les PV avec présence.'],['02','Renforcer l’autonomie financière','Accompagner les AGR, les journaux comptables et la constitution progressive d’un fonds d’urgence.'],['03','Professionnaliser et ouvrir','Former les membres sur leurs rôles et renforcer les liens avec collectivités, ONG et autres COGES.']];
 items.forEach((it,i)=>{const y=175+i*150; txt(s,'prio-num'+i,it[0],58,y,75,55,35,C.gold,true); txt(s,'prio-title'+i,it[1],145,y,430,45,27,C.navy,true); txt(s,'prio-body'+i,it[2],590,y,590,75,20,C.ink); box(s,'prio-line'+i,145,y+110,1035,1,C.line);});
 notes(s,['Présenter ces priorités comme une proposition de discussion.','Pour chaque priorité, demander qui porte l’action, avec quel calendrier et quel indicateur de suivi.'],['Synthèse analytique fondée sur la base brute EROF du 27/07/2026']);
}

// 12 close
{
 const s=deck.slides.add(); s.background.fill=C.navy; box(s,'gold-band',0,0,18,H,C.gold);
 txt(s,'close-kicker','MESSAGE CLÉ',62,62,350,30,18,C.gold,true);
 txt(s,'close-title','Passer du diagnostic à un accompagnement différencié',62,175,1050,120,54,C.white,true);
 txt(s,'close-copy','La collecte montre un socle institutionnel réel. Le prochain enjeu est de cibler les COGES et les dimensions les plus fragiles, puis de suivre la disponibilité effective des preuves.',62,335,1020,120,27,'#D6E3F0');
 box(s,'close-rule',62,530,1060,3,C.gold);
 txt(s,'close-question','Quelles actions pouvons-nous engager en priorité dès le prochain trimestre ?',62,565,1050,55,25,C.white,true);
 txt(s,'page','12',1175,674,48,22,13,'#B8C7D8',true,'right');
 notes(s,['Conclure en revenant à la finalité : utiliser les résultats pour décider, accompagner et suivre.','Ouvrir les échanges sur les trois priorités proposées.'],['Synthèse analytique fondée sur le formulaire et la base brute EROF fournis']);
}

await fs.mkdir(PREVIEW,{recursive:true});
for (const [i,s] of deck.slides.items.entries()) {
 const png=await deck.export({slide:s,format:'png',scale:1}); await fs.writeFile(`${PREVIEW}/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await png.arrayBuffer()));
}
const montage=await deck.export({format:'webp',montage:true,scale:1}); await fs.writeFile('C:/PROJETS/erof-coges/tmp/erof-ppt/deck-montage.webp',new Uint8Array(await montage.arrayBuffer()));
const pptx=await PresentationFile.exportPptx(deck); await pptx.save(OUT);
console.log(OUT);
