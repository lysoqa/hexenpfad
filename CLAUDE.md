# Hexenpfad – Hinweise für Claude

Eigenständiges Action-Rogue-lite (Ansicht von oben, Pixel-Grafik): eine Hexenkriegerin kämpft sich durch zufällig erzeugte Kammern, sammelt Element-Segen und besiegt am Ende einen Boss. Eigene Welt, eigene Namen, **keine Story** (vom Nutzer so gewünscht, erst mal).
Der Nutzer vibecodet, spricht Deutsch und ist kein Profi. Kurz und verständlich erklären, Antworten auf Deutsch.
Hat nichts mit Soulgrind oder Aschenreich zu tun (kein Code von dort übernehmen).

## Starten
`index.html` im Browser öffnen (Doppelklick). Kein Build, keine Installation.

## Technik
- Reines JavaScript + Canvas, kein Build. `index.html` lädt `js/*.js` als klassische Scripts (gemeinsame globale Variablen, Reihenfolge beachten).
- Welt ist 480×270 Spielpixel, gezeichnet wird in voller Bildschirmauflösung (`S` = Bildschirmpixel pro Spielpixel). Dadurch weiche Bewegung, Sprites bleiben scharf (`snap()` rundet auf echte Pixel). Text ist normale Schrift (scharf), keine Pixelschrift.
- Sprites sind Zeichen-Raster (`makeSprite` in `sprites.js`, Farben in `PAL`). Figuren schauen nach rechts und werden gespiegelt.
- Alle Balance-Werte stehen in `js/data.js`.

| Datei | Inhalt |
|---|---|
| `js/core.js` | Bildschirm, Eingabe (`Input`), Text, Licht (`glow`), Hilfsfunktionen |
| `js/sound.js` | Töne (`SFX`) und Musik (`TRACKS`: hub, run, boss), alles im Code erzeugt |
| `js/data.js` | **Alle Werte**: Heldin, Waffen, Waffen-Upgrades, Elemente, Segen, Passive, Duos, Belohnungen, Händler, Gegner, Boss, Lauf-Ablauf |
| `js/sprites.js` | Pixel-Grafiken (Heldin, Waffen, Gegner, Boss) |
| `js/fx.js` | Partikel, Hieb-Bögen, Ringe, Blitze, Nachbilder, Schadenszahlen |
| `js/world.js` | Zufallsräume (`generateRoom`), Zuflucht (`buildHub`), Kollision, Türen, Fackeln, Stachelfallen |
| `js/combat.js` | Schaden (`damageEnemy`), Element-Zustände, Segen-Logik, Siegel-Zonen, Geschosse, Auswahl-Optionen |
| `js/player.js` | Heldin: Bewegung, Sprint, die 4 Waffen (`WEAPON_LOGIC`), Siegel (Q) |
| `js/enemies.js` | Gegner-KI (`AI`), Boss Grimmhorn, Wellen, Warnflächen |
| `js/ui.js` | HUD, Karten-Auswahl, Menüs, Symbole |
| `js/main.js` | Spielablauf (Zuflucht, Kammern, Türen, Belohnungen, Händler, Tod/Sieg), Kamera, Spielschleife, `GAME_VERSION` |

## Spielregeln (vom Nutzer festgelegt)
- Heldin ist weiblich. Steuerung: WASD laufen, Maus zielen, LMT Angriff, RMT Spezial, Q Siegel, **Leertaste = Sprint (Dash)**, E benutzen, Tab Segen ansehen, Esc Pause.
- Alles soll sich **flüssig** anfühlen: Eingaben werden kurz gepuffert, Sprint bricht Aktionen ab, Kombos gehen ineinander über, Treffer-Stopp und Bildschirmwackeln.
- Waffen: **Schwert** (Mondklinge), **Lanze** (Sturmlanze), **Bogen mit Schuss-Abklingzeit** (Sternbogen), **Stab mit Magie** (Aschestab). Auswahl in der Zuflucht an Waffenständern.
- Startgebiet = Zuflucht (Waffen, Übungspuppen, Tor zum Lauf).
- Ein Lauf: 12 Kammern, zufällig erzeugt. Hinter jeder Tür steht vorher sichtbar die Belohnung. Kammer 6: Händler zur Auswahl, Kammer 11: Wächterkammer, Kammer 12: Boss **Grimmhorn, Wächter des Tores** (Wut ab 50%).
- Element-Segen (Feuer, Frost, Blitz, Schatten) für Angriff, Spezial, Siegel, Sprint, dazu Passive und Duo-Segen. **Element-Stufe** = Summe der Segen-Stufen eines Elements; jede Stufe macht alle Effekte dieses Elements stärker. Gleichen Segen nochmal wählen = Stufe hoch.

## Releases
Repo `lysoqa/hexenpfad` (öffentlich). Der Soqa Launcher (`../Soulgrind`, Repo `lysoqa/spielhalle`) holt das Spiel ab Launcher 0.7.0 aus dem neuesten Release (beim Entwickeln mit `npm start` direkt aus diesem Ordner).
1. `GAME_VERSION` in `js/main.js` erhöhen, committen, pushen.
2. Zip mit `C:\Windows\System32\tar.exe -a -cf Hexenpfad-<version>.zip index.html js` (nicht `Compress-Archive`, wegen `\` als Pfadtrenner).
3. `gh release create v<version> Hexenpfad-<version>.zip --title "Hexenpfad <version>" --notes-file <datei.md>`. Patch Notes auf Deutsch, für Spieler.

## Testen
Electron aus `..\Soulgrind\node_modules\electron\dist\electron.exe <testskript.js>`, `index.html` laden, per `executeJavaScript` Szenarien bauen (`startRun()`, `setGameState('play')`, `game.player.invuln = 999`, `enterRoom({kind:'boss'})`), `capturePage()` für Screenshots. Code in `{ … }` einschließen. Prozess-Timeout setzen. Das Testfenster ist sichtbar, kurz Bescheid sagen.
Der Nutzer testet das Spielgefühl selbst. Balance-Werte immer in `data.js` bündeln und sagen, wo sie stehen.
