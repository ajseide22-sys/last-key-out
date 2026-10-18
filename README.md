# Last Key Out

A first-person online co-op horror game for 1–8 players, with proximity voice chat.

You wake up inside a pitch-black manor with only a flashlight. Things live in the dark. Solve puzzles to earn keys, use the keys to open safes full of cash, and find the four numbers that open the hidden way out. Escape with your money and spend it on outfits.

## How a round works

1. **Puzzles give keys.** Four puzzle stations are spread through the manor. Each one solved gives the crew one key. Their clues are written in red on the walls.
   - **Lever panel:** each lever flips its own lamp and the lamps next to it. Light all five.
   - **Grandfather clock:** a wall says *IT STRUCK 7* (or some other hour). Set the hour hand, then pull the chime chain. Ring the wrong hour and the boom draws every monster nearby.
   - **Piano:** a wall shows a row of colored dots. Play those colors in order.
   - **Symbol box:** a wall shows three symbols. Turn the three dials to match.
   - A few extra keys are hidden in furniture.
2. **Keys open safes.** Each safe takes one key and holds $150–$400. Two safes also hold a number for the way out. Drawers, wardrobes and teapots have loose cash too.
3. **The money you carry is at risk.** If a monster catches you, you lose **all** the money you're carrying, and it drags you to the jail. A teammate can hold E on the jail lock to free you.
4. **Escape through the hidden passage.** Two of the four numbers are written on walls and two are inside safes. Each player only sees the numbers they found themselves, shown at the top right, so talk to each other. Find the bookshelf with a red book sticking out, enter the four numbers, and it slides aside. Walk into the passage to escape and bank your money.

The round ends when everyone has escaped or is stuck in the jail. Anyone still jailed at the end keeps nothing. There's no timer and no difficulty setting. The manor grows with each player who joins, and later rounds add more monsters.

## The monsters

- **The Pale:** a tall, starved thing with ribs through its skin and a jaw that unhinges.
- **The Crawler:** a corpse that moves on all fours behind a curtain of black hair, with its head bent the wrong way.
- **The Hollow:** a gliding shroud with a cracked porcelain face and long grey fingers.

They patrol the dark and come after flashlights. They spot you if you're close with your light on, or if you shine it straight at them. Your flashlight flickers as one gets near, and you'll hear clicking, growls and a heartbeat. Turn your light off (F) to lose them.

Others hide in corners and inside furniture, and jump out screaming when you get close. You can hear them breathing when you're near one.

## Music and sound

The score is generated live: a low drone, slow dissonant chords, a broken music box and the occasional distant knock, scrape or whisper. Shrill strings swell in when a monster closes in. You can change the music and voice volume in the Esc menu.

## The shop

Money you escape with goes into your wallet. Spend it in the shop, from the title screen, the lobby or the results screen:

- **Hats:** beanie, traffic cone, top hat, chef hat, cowboy hat, devil horns, wizard hat, viking helmet, halo, pumpkin head, crown
- **Accessories:** bow tie, mustache, glasses, scarf, backpack, cape
- **Colors:** nine body colors, including Solid Gold
- **Flashlight colors:** cold white, ice blue, toxic green, violet, blood red

Hover an item to try it on in the 3D preview. Everyone in the room sees your outfit and your flashlight color. Your wallet and outfits are saved in your browser (localStorage), so clearing site data resets them.

## Proximity voice chat

- Voices come from each player's position, fade out around 22 m, and are muffled by walls.
- Turn your mic on in the lobby or the Esc menu. Press **M** to mute.
- Press **T** for text chat. Only players nearby see it.
- Escaped players can only hear each other.

## Controls

| Key | Action |
|---|---|
| Mouse | Look (click the game first) |
| WASD | Move · **Shift** to sprint |
| Space | Jump |
| C / Ctrl | Crouch |
| E | Use, read and turn things · hold to search furniture, open safes and pick the jail lock |
| F | Flashlight on and off |
| M | Mute mic |
| T | Text chat |
| Esc | Menu (music, voice, brightness, mouse speed) |

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. There's nothing to install.

```bash
node server.js
```

Open http://localhost:3000, create a room, and share the invite link.

### Play online (needed for voice)

Browsers only allow microphones on `https://` pages, so friends need an https address:

- **Quick:** run `npx cloudflared tunnel --url http://localhost:3000` in a second terminal and share the `https://…trycloudflare.com` address it prints.
- **Always on:** push this folder to GitHub and create a free **Web Service** on [Render](https://render.com). Set the build command to `npm install` and the start command to `node server.js`. To update, upload the changed files to GitHub and Render redeploys by itself.

If someone can't hear anyone, their network may block direct connections. Add a TURN server: `TURN_URL=turn:host:443 TURN_USER=… TURN_PASS=… node server.js`.

## Files

```
server.js             game server (rooms, relay, voice signaling, outfits)
public/index.html     title, lobby, HUD, shop, menus
public/js/main.js     first-person controls, host loop, events, jump scares, results
public/js/areas.js    the manor: wings, safes, money, clues, jail, secret passage, rules
public/js/puzzles.js  the four puzzle stations and the wall writing
public/js/creatures.js  the three monsters (models, skin, animation)
public/js/sentry.js   monster pathfinding and light hunting
public/js/music.js    the generative horror score
public/js/avatar.js   player avatars and every cosmetic item
public/js/shop.js     wallet, shop and 3D preview
public/js/props.js    furniture and hiding spots
public/js/world.js    rooms, walls, textures, collision
public/js/voice.js    proximity voice chat
public/js/net.js      connection and clock sync
```
