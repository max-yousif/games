import type { Vraag, Vragenset } from '../lib/types';

type VraagInvoer = [categorie: string, punten: number, tekst: string, antwoord: string, uitleg?: string, fouten?: string[]];

/** Korte notatie: zonder fouten = open vraag; met fouten = meerkeuze (juiste antwoord op een vaste plaats). */
function vragen(setId: string, lijst: VraagInvoer[]): Vraag[] {
  return lijst.map(([categorie, punten, tekst, antwoord, uitleg = '', fouten], i) => {
    const id = `${setId}-${i + 1}`;
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
    ['Merkwaardige producten', 300, 'Werk uit: $(3x+4)(3x-4)$', '$9x^2-16$', '$(a+b)(a-b) = a^2-b^2$'],
    ['Merkwaardige producten', 400, 'Werk uit: $(x-2)^3$', '$x^3-6x^2+12x-8$', '$(a-b)^3 = a^3-3a^2b+3ab^2-b^3$'],
    ['Ontbinden', 100, 'Ontbind in factoren: $x^2-49$', '$(x-7)(x+7)$', 'Verschil van twee kwadraten.'],
    ['Ontbinden', 200, 'Ontbind in factoren: $6a^2b-9ab^2$', '$3ab(2a-3b)$', 'Gemeenschappelijke factor $3ab$ afzonderen.'],
    ['Ontbinden', 300, 'Ontbind in factoren: $x^2+10x+25$', '$(x+5)^2$', 'Volkomen kwadraat: $x^2 + 2\\cdot 5x + 5^2$.', ['$(x+25)(x+1)$', '$(x-5)^2$', '$(x+5)(x-5)$']],
    ['Ontbinden', 400, 'Ontbind volledig: $2x^3-18x$', '$2x(x-3)(x+3)$', 'Eerst $2x$ afzonderen: $2x(x^2-9)$, dan verschil van kwadraten.'],
    ['Machten', 100, 'Bereken: $2^3 \\cdot 2^4$', '$2^7 = 128$', 'Zelfde grondtal: exponenten optellen.'],
    ['Machten', 200, 'Bereken: $(-3)^{-2}$', '$\\dfrac{1}{9}$', '$(-3)^{-2} = \\dfrac{1}{(-3)^2} = \\dfrac{1}{9}$', ['$-9$', '$-\\dfrac{1}{9}$', '$9$']],
    ['Machten', 300, 'Vereenvoudig: $\\dfrac{a^5 b^2}{a^2 b^4}$', '$\\dfrac{a^3}{b^2}$'],
    ['Machten', 400, 'Schrijf in wetenschappelijke notatie: $0{,}000\\,045\\,2$', '$4{,}52 \\cdot 10^{-5}$'],
    ['Vergelijkingen', 100, 'Los op: $3x-7=11$', '$x=6$'],
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
    ['Statistiek', 100, 'Wat is het gemiddelde van $4,\\ 7,\\ 7,\\ 10,\\ 12$?', '$8$', '$\\dfrac{40}{5} = 8$'],
    ['Statistiek', 200, 'Wat is de mediaan van $3,\\ 8,\\ 1,\\ 9,\\ 5,\\ 6$?', '$5{,}5$', 'Gerangschikt: $1, 3, 5, 6, 8, 9$. Mediaan $= \\dfrac{5+6}{2}$.'],
    ['Statistiek', 300, 'Welke centrummaat is het minst gevoelig voor uitschieters?', 'de mediaan', '', ['het gemiddelde', 'het bereik', 'de standaardafwijking']],
    ['Statistiek', 400, 'Bij alle gegevens tel je $5$ op. Wat gebeurt er met de standaardafwijking?', 'Ze blijft gelijk.', 'Alle gegevens schuiven op, de spreiding verandert niet. Het gemiddelde stijgt wel met $5$.'],
    ['Normale verdeling', 100, 'Hoeveel procent van de waarnemingen ligt tussen $\\mu-\\sigma$ en $\\mu+\\sigma$?', 'ongeveer 68 %', '', ['ongeveer 50 %', 'ongeveer 95 %', 'ongeveer 99,7 %']],
    ['Normale verdeling', 200, 'IQ is normaal verdeeld met $\\mu=100$ en $\\sigma=15$. Tussen welke waarden ligt ongeveer 95 % van de IQ-scores?', 'tussen 70 en 130', '$\\mu \\pm 2\\sigma$'],
    ['Normale verdeling', 300, 'De lengte van volwassenen is normaal verdeeld met $\\mu=170$ cm en $\\sigma=8$ cm. Hoeveel procent is groter dan $186$ cm?', 'ongeveer 2,5 %', '$186 = \\mu + 2\\sigma$. Buiten $\\mu\\pm2\\sigma$ ligt 5 %, de helft daarvan rechts.'],
    ['Normale verdeling', 400, 'Bereken de $z$-score van $82$ als $\\mu=70$ en $\\sigma=8$.', '$z=1{,}5$', '$z = \\dfrac{82-70}{8}$'],
    ['Kansen', 100, 'Wat is de kans op een 6 bij één worp met een dobbelsteen?', '$\\dfrac{1}{6}$'],
    ['Kansen', 200, 'Je gooit twee keer met een muntstuk. Wat is de kans op twee keer kop?', '$\\dfrac{1}{4}$', '$\\dfrac12 \\cdot \\dfrac12$', ['$\\dfrac{1}{2}$', '$\\dfrac{1}{3}$', '$\\dfrac{3}{4}$']],
    ['Kansen', 300, 'Je trekt één kaart uit een spel van 52 kaarten. Wat is de kans op een harten of een aas?', '$\\dfrac{16}{52} = \\dfrac{4}{13}$', '$\\dfrac{13}{52}+\\dfrac{4}{52}-\\dfrac{1}{52}$: de hartenaas niet dubbel tellen.'],
    ['Kansen', 400, '$A$ en $B$ zijn onafhankelijk, $P(A)=0{,}3$ en $P(B)=0{,}5$. Bereken $P(A \\text{ en } B)$.', '$0{,}15$', 'Onafhankelijk: $P(A\\cap B) = P(A)\\cdot P(B)$.'],
    ['Groei', 100, 'Een bedrag stijgt elk jaar met 4 %. Wat is de groeifactor per jaar?', '$1{,}04$'],
    ['Groei', 200, 'Een bevolking van 2000 dieren neemt elk jaar af met 10 %. Hoeveel dieren zijn er na 2 jaar?', '$1620$', '$2000 \\cdot 0{,}9^2$'],
    ['Groei', 300, 'Na hoeveel jaar is een kapitaal ongeveer verdubbeld bij 7 % rente per jaar?', 'ongeveer 10 jaar', '$1{,}07^t = 2 \\Rightarrow t = \\dfrac{\\log 2}{\\log 1{,}07} \\approx 10{,}2$', ['ongeveer 5 jaar', 'ongeveer 7 jaar', 'ongeveer 14 jaar']],
    ['Groei', 400, 'Een bacteriecultuur verdubbelt elke 3 uur. Wat is de groeifactor per uur?', '$2^{1/3} \\approx 1{,}26$', 'Per 3 uur factor 2, dus per uur $\\sqrt[3]{2}$.'],
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
    ['Voorwaarden', 400, 'Wat print dit?\n```python\nprint(3 > 2 and not 5 < 1)\n```', '`True`', '`3 > 2` is `True`, `5 < 1` is `False`, dus `not 5 < 1` is `True`.'],
    ['Lussen', 100, 'Wat print dit programma?\n```python\nfor i in range(3):\n    print(i)\n```', '`0`, `1` en `2` (onder elkaar)', '`range(3)` loopt van 0 tot en met 2.'],
    ['Lussen', 200, 'Hoeveel keer wordt "hoi" geprint?\n```python\nfor i in range(2, 10, 2):\n    print("hoi")\n```', '4 keer', '`i` wordt 2, 4, 6 en 8.', ['5 keer', '8 keer', '10 keer']],
    ['Lussen', 300, 'Wat print dit programma?\n```python\nsom = 0\nfor i in range(1, 5):\n    som = som + i\nprint(som)\n```', '`10`', '$1+2+3+4$'],
    ['Lussen', 400, 'Wat print dit programma?\n```python\nn = 1\nwhile n < 50:\n    n = n * 3\nprint(n)\n```', '`81`', '`n` wordt 3, 9, 27, 81. Bij 81 stopt de lus.'],
    ['Fouten zoeken', 100, 'Wat is er fout?\n```python\nprint("Hallo)\n```', 'Het afsluitende aanhalingsteken ontbreekt: `print("Hallo")`'],
    ['Fouten zoeken', 200, 'Waarom geeft dit een fout?\n```python\nleeftijd = input("Leeftijd? ")\nprint(leeftijd + 1)\n```', '`input` geeft tekst terug. Zet om met `int(input(...))`.', 'Tekst + getal geeft een `TypeError`.'],
    ['Fouten zoeken', 300, 'Wat is er fout?\n```python\nif x > 3\n    print("ok")\n```', 'Het dubbelpunt na de voorwaarde ontbreekt: `if x > 3:`'],
    ['Fouten zoeken', 400, 'Waarom geeft dit een fout?\n```python\ngetallen = [4, 8, 15]\nprint(getallen[3])\n```', 'De indexen zijn 0, 1 en 2: index 3 bestaat niet (`IndexError`).', 'Het laatste element is `getallen[2]` of `getallen[-1]`.'],
  ],
);

export const VOORBEELDSETS: Vragenset[] = [algebra3, statistiek6, python4];
