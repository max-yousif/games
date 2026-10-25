import type { Vraag, Vragenset } from '../lib/types';

type VraagInvoer =
  | [categorie: string, punten: number, tekst: string, antwoord: string, uitleg?: string, fouten?: string[]]
  | (Pick<Vraag, 'categorie' | 'punten' | 'type' | 'tekst'> & Partial<Vraag>);

/**
 * Korte notatie: zonder fouten = open vraag; met fouten = meerkeuze (juiste antwoord op een vaste
 * plaats). Andere types worden als object opgegeven.
 */
function vragen(setId: string, lijst: VraagInvoer[]): Vraag[] {
  return lijst.map((invoer, i) => {
    const id = `${setId}-${i + 1}`;
    if (!Array.isArray(invoer)) return { id, antwoord: '', opties: [], juisteOptie: 0, uitleg: '', ...invoer };
    const [categorie, punten, tekst, antwoord, uitleg = '', fouten] = invoer;
    if (!fouten) return { id, categorie, punten, type: 'open', tekst, antwoord, opties: ['', '', '', ''], juisteOptie: 0, uitleg };
    // Juiste antwoord op een "willekeurige" maar vaste plaats, zodat het niet altijd A is.
    const plaats = (i * 3 + 1) % (fouten.length + 1);
    const opties = [...fouten];
    opties.splice(plaats, 0, antwoord);
    return { id, categorie, punten, type: 'meerkeuze', tekst, antwoord: '', opties, juisteOptie: plaats, uitleg };
  });
}

function set(id: string, titel: string, vak: Vragenset['vak'], leerjaar: string, beschrijving: string, lijst: VraagInvoer[]): Vragenset {
  const datum = '2026-10-25T00:00:00.000Z';
  return { id: `voorbeeld-${id}`, voorbeeld: id, titel, vak, leerjaar, beschrijving, vragen: vragen(id, lijst), aangemaakt: datum, gewijzigd: datum };
}

const algebra3 = set(
  'algebra-3',
  'Algebra: merkwaardige producten en ontbinden',
  'wiskunde',
  '3e jaar (5 u)',
  'Herhaling rekenen met letters: merkwaardige producten, ontbinden in factoren, machten en vergelijkingen.',
  [
    ['Merkwaardige producten', 100, 'Werk uit: $(x+3)^2$', '$x^2+6x+9$', '$(a+b)^2 = a^2+2ab+b^2$', ['$x^2+9$', '$x^2+3x+9$', '$x^2+6x+6$']],
    ['Merkwaardige producten', 200, 'Werk uit: $(2a-5)^2$', '$4a^2-20a+25$', '$(2a)^2 - 2\\cdot 2a \\cdot 5 + 5^2$'],
    { categorie: 'Merkwaardige producten', punten: 300, type: 'invullen', tekst: 'Vul aan: $(3x+4)(3x-4) =$ [[9x^2-16|9x²-16]]', uitleg: '$(a+b)(a-b) = a^2-b^2$' },
    ['Merkwaardige producten', 400, 'Werk uit: $(x-2)^3$', '$x^3-6x^2+12x-8$', '$(a-b)^3 = a^3-3a^2b+3ab^2-b^3$'],
    ['Ontbinden', 100, 'Ontbind in factoren: $x^2-49$', '$(x-7)(x+7)$', 'Verschil van twee kwadraten.'],
    {
      categorie: 'Ontbinden',
      punten: 200,
      type: 'koppelen',
      tekst: 'Koppel elke veelterm aan haar ontbinding.',
      paren: [
        ['$x^2-9$', '$(x-3)(x+3)$'],
        ['$x^2+6x+9$', '$(x+3)^2$'],
        ['$x^2-6x+9$', '$(x-3)^2$'],
        ['$x^2+3x$', '$x(x+3)$'],
      ],
    },
    ['Ontbinden', 300, 'Ontbind in factoren: $x^2+10x+25$', '$(x+5)^2$', 'Volkomen kwadraat: $x^2 + 2\\cdot 5x + 5^2$.', ['$(x+25)(x+1)$', '$(x-5)^2$', '$(x+5)(x-5)$']],
    ['Ontbinden', 400, 'Ontbind volledig: $2x^3-18x$', '$2x(x-3)(x+3)$', 'Eerst $2x$ afzonderen: $2x(x^2-9)$, dan verschil van kwadraten.'],
    { categorie: 'Machten', punten: 100, type: 'waaronwaar', tekst: '$2^3 \\cdot 2^4 = 2^{12}$', juisteOptie: 1, uitleg: 'Zelfde grondtal: exponenten optellen, dus $2^7 = 128$.' },
    ['Machten', 200, 'Bereken: $(-3)^{-2}$', '$\\dfrac{1}{9}$', '$(-3)^{-2} = \\dfrac{1}{(-3)^2} = \\dfrac{1}{9}$', ['$-9$', '$-\\dfrac{1}{9}$', '$9$']],
    ['Machten', 300, 'Vereenvoudig: $\\dfrac{a^5 b^2}{a^2 b^4}$', '$\\dfrac{a^3}{b^2}$'],
    ['Machten', 400, 'Schrijf in wetenschappelijke notatie: $0{,}000\\,045\\,2$', '$4{,}52 \\cdot 10^{-5}$'],
    { categorie: 'Vergelijkingen', punten: 100, type: 'getal', tekst: 'Los op: $3x-7=11$. Hoeveel is $x$?', antwoord: '6' },
    ['Vergelijkingen', 200, 'Los op: $5(x-2)=2x+11$', '$x=7$', '$5x-10=2x+11 \\Rightarrow 3x=21$'],
    ['Vergelijkingen', 300, 'Los op: $\\dfrac{x}{3}+\\dfrac{x}{2}=10$', '$x=12$', 'Alles maal 6: $2x+3x=60$.'],
    ['Vergelijkingen', 400, 'Los op: $x^2=5x$', '$x=0$ of $x=5$', '$x^2-5x=0 \\Rightarrow x(x-5)=0$. Niet delen door $x$: dan verlies je een oplossing!'],
  ],
);

const statistiek6 = set(
  'statistiek-6hw',
  'Statistiek, kansen en groei',
  'wiskunde',
  '6e jaar Humane wetenschappen',
  'Beschrijvende statistiek, de normale verdeling, kansrekening en exponentiële groei.',
  [
    { categorie: 'Statistiek', punten: 100, type: 'getal', tekst: 'Wat is het gemiddelde van $4,\\ 7,\\ 7,\\ 10,\\ 12$?', antwoord: '8', uitleg: '$\\dfrac{40}{5} = 8$' },
    ['Statistiek', 200, 'Wat is de mediaan van $3,\\ 8,\\ 1,\\ 9,\\ 5,\\ 6$?', '$5{,}5$', 'Gerangschikt: $1, 3, 5, 6, 8, 9$. Mediaan $= \\dfrac{5+6}{2}$.'],
    ['Statistiek', 300, 'Welke centrummaat is het minst gevoelig voor uitschieters?', 'de mediaan', '', ['het gemiddelde', 'het bereik', 'de standaardafwijking']],
    {
      categorie: 'Statistiek',
      punten: 400,
      type: 'waaronwaar',
      tekst: 'Als je bij alle gegevens $5$ optelt, blijft de standaardafwijking gelijk.',
      juisteOptie: 0,
      uitleg: 'Alle gegevens schuiven op, de spreiding verandert niet. Het gemiddelde stijgt wel met $5$.',
    },
    ['Normale verdeling', 100, 'Hoeveel procent van de waarnemingen ligt tussen $\\mu-\\sigma$ en $\\mu+\\sigma$?', 'ongeveer 68 %', '', ['ongeveer 50 %', 'ongeveer 95 %', 'ongeveer 99,7 %']],
    ['Normale verdeling', 200, 'IQ is normaal verdeeld met $\\mu=100$ en $\\sigma=15$. Tussen welke waarden ligt ongeveer 95 % van de IQ-scores?', 'tussen 70 en 130', '$\\mu \\pm 2\\sigma$'],
    ['Normale verdeling', 300, 'De lengte van volwassenen is normaal verdeeld met $\\mu=170$ cm en $\\sigma=8$ cm. Hoeveel procent is groter dan $186$ cm?', 'ongeveer 2,5 %', '$186 = \\mu + 2\\sigma$. Buiten $\\mu\\pm2\\sigma$ ligt 5 %, de helft daarvan rechts.'],
    { categorie: 'Normale verdeling', punten: 400, type: 'getal', tekst: 'Bereken de $z$-score van $82$ als $\\mu=70$ en $\\sigma=8$.', antwoord: '1,5', uitleg: '$z = \\dfrac{82-70}{8}$' },
    ['Kansen', 100, 'Wat is de kans op een 6 bij één worp met een dobbelsteen?', '$\\dfrac{1}{6}$'],
    ['Kansen', 200, 'Je gooit twee keer met een muntstuk. Wat is de kans op twee keer kop?', '$\\dfrac{1}{4}$', '$\\dfrac12 \\cdot \\dfrac12$', ['$\\dfrac{1}{2}$', '$\\dfrac{1}{3}$', '$\\dfrac{3}{4}$']],
    ['Kansen', 300, 'Je trekt één kaart uit een spel van 52 kaarten. Wat is de kans op een harten of een aas?', '$\\dfrac{16}{52} = \\dfrac{4}{13}$', '$\\dfrac{13}{52}+\\dfrac{4}{52}-\\dfrac{1}{52}$: de hartenaas niet dubbel tellen.'],
    ['Kansen', 400, '$A$ en $B$ zijn onafhankelijk, $P(A)=0{,}3$ en $P(B)=0{,}5$. Bereken $P(A \\text{ en } B)$.', '$0{,}15$', 'Onafhankelijk: $P(A\\cap B) = P(A)\\cdot P(B)$.'],
    ['Groei', 100, 'Een bedrag stijgt elk jaar met 4 %. Wat is de groeifactor per jaar?', '$1{,}04$'],
    { categorie: 'Groei', punten: 200, type: 'getal', tekst: 'Een bevolking van 2000 dieren neemt elk jaar af met 10 %. Hoeveel dieren zijn er na 2 jaar?', antwoord: '1620', uitleg: '$2000 \\cdot 0{,}9^2$' },
    ['Groei', 300, 'Na hoeveel jaar is een kapitaal ongeveer verdubbeld bij 7 % rente per jaar?', 'ongeveer 10 jaar', '$1{,}07^t = 2 \\Rightarrow t = \\dfrac{\\log 2}{\\log 1{,}07} \\approx 10{,}2$', ['ongeveer 5 jaar', 'ongeveer 7 jaar', 'ongeveer 14 jaar']],
    {
      categorie: 'Groei',
      punten: 400,
      type: 'getal',
      tekst: 'Een bacteriecultuur verdubbelt elke 3 uur. Wat is de groeifactor per uur? (op 0,01 nauwkeurig)',
      antwoord: '1,26',
      tolerantie: 0.01,
      uitleg: 'Per 3 uur factor 2, dus per uur $\\sqrt[3]{2} \\approx 1{,}26$.',
    },
  ],
);

const python4 = set(
  'python-4',
  'Python basis',
  'python',
  '4e jaar (basis programmeren)',
  'Voorbeeldset: print en variabelen, voorwaarden, lussen en fouten zoeken. Pas aan volgens de eigen cursus.',
  [
    ['Print & variabelen', 100, 'Wat print dit programma?\n```python\nx = 5\nx = x + 2\nprint(x)\n```', '`7`'],
    ['Print & variabelen', 200, 'Wat print dit programma?\n```python\nnaam = "Lisa"\nprint("Hallo " + naam + "!")\n```', '`Hallo Lisa!`'],
    ['Print & variabelen', 300, 'Wat print dit?\n```python\nprint(7 // 2, 7 % 2)\n```', '`3 1`', '`//` is de gehele deling, `%` de rest.'],
    ['Print & variabelen', 400, 'Wat print dit programma?\n```python\na = "3"\nb = 4\nprint(a * b)\n```', '`3333`', '`a` is tekst: tekst maal een getal herhaalt de tekst.', ['`12`', '`34`', 'een foutmelding']],
    ['Voorwaarden', 100, 'Wat print dit programma?\n```python\nx = 10\nif x > 5:\n    print("groot")\nelse:\n    print("klein")\n```', '`groot`'],
    ['Voorwaarden', 200, 'Met welke operator test je of twee waarden gelijk zijn?', '`==`', '`=` geeft een waarde aan een variabele.', ['`=`', '`!=`', '`<>`']],
    ['Voorwaarden', 300, 'Wat print dit programma?\n```python\npunten = 65\nif punten >= 80:\n    print("A")\nelif punten >= 60:\n    print("B")\nelse:\n    print("C")\n```', '`B`'],
    {
      categorie: 'Voorwaarden',
      punten: 400,
      type: 'waaronwaar',
      tekst: 'Dit programma print `True`.\n```python\nprint(3 > 2 and not 5 < 1)\n```',
      juisteOptie: 0,
      uitleg: '`3 > 2` is `True`, `5 < 1` is `False`, dus `not 5 < 1` is `True`.',
    },
    {
      categorie: 'Lussen',
      punten: 100,
      type: 'invullen',
      tekst: 'Vul aan zodat het programma 0, 1 en 2 print.\n```python\nfor i in [[range]](3):\n    [[print]](i)\n```',
      uitleg: '`range(3)` loopt van 0 tot en met 2.',
    },
    ['Lussen', 200, 'Hoeveel keer wordt "hoi" geprint?\n```python\nfor i in range(2, 10, 2):\n    print("hoi")\n```', '4 keer', '`i` wordt 2, 4, 6 en 8.', ['5 keer', '8 keer', '10 keer']],
    { categorie: 'Lussen', punten: 300, type: 'getal', tekst: 'Welk getal print dit programma?\n```python\nsom = 0\nfor i in range(1, 5):\n    som = som + i\nprint(som)\n```', antwoord: '10', uitleg: '$1+2+3+4$' },
    ['Lussen', 400, 'Wat print dit programma?\n```python\nn = 1\nwhile n < 50:\n    n = n * 3\nprint(n)\n```', '`81`', '`n` wordt 3, 9, 27, 81. Bij 81 stopt de lus.'],
    ['Fouten zoeken', 100, 'Wat is er fout?\n```python\nprint("Hallo)\n```', 'Het afsluitende aanhalingsteken ontbreekt: `print("Hallo")`'],
    ['Fouten zoeken', 200, 'Waarom geeft dit een fout?\n```python\nleeftijd = input("Leeftijd? ")\nprint(leeftijd + 1)\n```', '`input` geeft tekst terug. Zet om met `int(input(...))`.', 'Tekst + getal geeft een `TypeError`.'],
    {
      categorie: 'Fouten zoeken',
      punten: 300,
      type: 'ordenen',
      tekst: 'Zet de lijnen in de juiste volgorde: het programma zegt of een getal even of oneven is.',
      opties: ['getal = int(input("Getal? "))', 'if getal % 2 == 0:', '    print("even")', 'else:', '    print("oneven")'],
      alsCode: true,
    },
    ['Fouten zoeken', 400, 'Waarom geeft dit een fout?\n```python\ngetallen = [4, 8, 15]\nprint(getallen[3])\n```', 'De indexen zijn 0, 1 en 2: index 3 bestaat niet (`IndexError`).', 'Het laatste element is `getallen[2]` of `getallen[-1]`.'],
  ],
);

/** Whodunit: een logisch raadsel met oefeningen over rijen en goniometrie (namen verzonnen). */
const openVraag = (categorie: string, tekst: string, antwoord: string, alternatieven: string[] = [], uitleg = ''): VraagInvoer => ({
  categorie,
  punten: 100,
  type: 'open',
  tekst,
  antwoord,
  opties: ['', '', '', ''],
  ...(alternatieven.length ? { alternatieven } : {}),
  uitleg,
});

const whodunit50: Vragenset = {
  ...set('whodunit-50', 'Whodunit: de nacht van de 50 dagen', 'wiskunde', '5e–6e jaar', 'Rijen en goniometrie. Elke juiste oefening geeft een roddel; wie vindt als eerste wie wat uitgestoken heeft?', [
    openVraag('Reeks 1', 'Geef de vergelijking van de evenwichtsstand van $y = 2\\sin(5x-3)+\\frac{\\pi}{2}$.', '$y=\\frac{\\pi}{2}$', [], 'De evenwichtsstand is $y = d$.'),
    openVraag('Reeks 1', 'Geef de tiende term van $u_n = u_{n-1}+7$ met $u_1 = 67$.', '130', ['u_{10}=130'], '$u_{10} = 67 + 9 \\cdot 7$'),
    openVraag('Reeks 1', 'Bepaal de cotangens van $\\alpha = \\frac{3\\pi}{4}$.', '-1'),
    openVraag('Reeks 1', 'Zet om in radialen en vereenvoudig zo ver mogelijk: $21^\\circ$.', '$\\frac{7\\pi}{60}$', ['7π/60', '7/60 π'], '$21 \\cdot \\frac{\\pi}{180}$'),
    openVraag('Reeks 2', 'Geef het expliciet voorschrift van de rekenkundige rij met $u_5 = 10$ en $u_{25} = 90$.', '$u_n = 4n-10$', ['4n-10', 'u_n=-6+4(n-1)', '-6+4(n-1)', 'u_n=-6+(n-1)\\cdot 4', '-6+(n-1)\\cdot 4'], '$v = \\frac{90-10}{20} = 4$ en $u_1 = 10 - 4 \\cdot 4 = -6$'),
    openVraag('Reeks 2', 'Komt het getal 768 voor in de rij $u_n = 3 \\cdot 2^n$?', 'Ja, n = 8', ['ja', 'ja n=8', 'n=8', 'ja, u_8 = 768', 'ja, u_8'], '$3 \\cdot 2^8 = 768$'),
    openVraag('Reeks 2', 'Voor de hoek $\\alpha \\in II$ geldt dat $\\cos\\alpha = -\\frac{4}{5}$. Bepaal $\\sin\\alpha$.', '$\\frac{3}{5}$', ['0,6'], 'In het tweede kwadrant is de sinus positief.'),
    openVraag('Reeks 2', 'Bepaal de periode van $y = 3\\sin(\\pi x - 4)+2$.', '2', [], '$p = \\frac{2\\pi}{\\pi}$'),
    openVraag('Reeks 3', 'Bepaal de som van alle oneven getallen met 3 cijfers.', '247500', [], '$S_{450} = \\frac{450 \\cdot (101 + 999)}{2}$'),
    openVraag('Reeks 3', 'Wat is het bereik van de functie $f$ met voorschrift $f(x) = 4\\sin(2x+1)-5$?', '$[-9, -1]$', ['[-9;-1]']),
    openVraag('Reeks 3', 'Herleid naar de algemene sinusfunctie: $y = -\\sin(6x+2)-1$.', '$y = \\sin\\left(6\\left(x+\\frac{2+\\pi}{6}\\right)\\right)-1$', [
      '$y = \\sin\\left(6\\left(x+\\frac{2-\\pi}{6}\\right)\\right)-1$',
      'y = sin(6x+2+π)-1',
      'y = sin(6x+2-π)-1',
    ], '$-\\sin t = \\sin(t \\pm \\pi)$'),
    openVraag('Reeks 3', 'In de rij $\\ldots, w, x, y, z, 0, 1, 1, 2, 3, 5, 8, 13, \\ldots$ is elke term de som van de vorige twee termen. Bepaal $w$.', '-3', ['w=-3'], 'Terugrekenen: $z = 1$, $y = -1$, $x = 2$, $w = -3$.'),
  ]),
  raadsel: {
    titel: '50 dagen om nooit te vergeten!',
    verhaal:
      'De nacht van de 50 dagen was plezant! Iedereen heeft zich geamuseerd, er werd gedanst en gelachen, maar er waren 4 vrienden die toch weer speciaal moesten doen... Ze hebben alle 4 iets uitgestoken en zijn 1 voor 1 gecrasht. Gelukkig waren er ook enkele leerkrachten ter plaatse om een oogje in het zeil te houden.\n\nDe volgende dag werd de beruchte avond uitvoerig besproken. Alleen was het voor iedereen wel een vage avond, dus weten we niet meer precies hoe hij is afgelopen... We hebben rondgevraagd en een heleboel roddels verzameld. Apart zijn we er niet zo veel mee, maar samen leveren ze wat meer informatie op.\n\nKun jij achterhalen wie wat precies heeft uitgestoken?',
    kolomTitel: 'Deze leerling is gecrasht als...',
    kolommen: ['1e', '2e', '3e', '4e'],
    categorieen: [
      { naam: 'Naam', oplossing: ['Fien', 'Lars', 'Mats', 'Noor'] },
      { naam: 'Drankje', oplossing: ['Cava', 'Bier', 'Cocktails', 'Wijn'] },
      { naam: 'Outfit', oplossing: ['Dierenonesie', 'Overall', 'Bontjas', 'Geruit hemd'] },
      {
        naam: 'Stunt',
        oplossing: ['Gevochten met de turnleraar', 'Gepaaldanst met de leraar Frans', 'Midnightsnack met de directeur', 'In slaap gevallen in de lerarenkamer'],
      },
    ],
    hints: [
      'De bierdrinker hing heel de avond aan de paal.',
      'Het vechtersbaasje is ofwel als eerste gecrasht, ofwel als allerlaatste.',
      'De wijnliefhebber viel in slaap in de lerarenkamer.',
      'De wijndrinker is ofwel als eerste, ofwel als laatste gecrasht.',
      'De persoon in de dierenonesie is vlak voor of vlak na Lars gecrasht.',
      'Fien was een varkentje.',
      'De cavafanaat was er ofwel als eerste, ofwel als laatste helemaal aan.',
      'De dierenvriend dronk heel de avond cava.',
      'De persoon met de overall is gecrasht vlak voor of vlak na de snacker.',
      'De snacker crashte vlak voor of vlak na het geruite hemd.',
      'Het geruite hemdje was de last one standing.',
      'Mats is de voorlaatste die gecrasht is.',
    ],
  },
};

export const VOORBEELDSETS: Vragenset[] = [algebra3, statistiek6, python4, whodunit50];
