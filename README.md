# Last Key Out

A first-person online co-op escape game for 1–8 players, with proximity voice chat.

Your crew wakes up locked in a haunted manor. Search the shelves, wardrobes, teapots and suits of armor for keys. One key sits in a safe, and only the player who finds the note can see its code. Then clear three more rooms before the clock runs out:

1. **The Locked Manor:** a big house split into wings, packed with up to 150 hiding spots. Watch out for fake keys and rats.
2. **The Pressure Hall:** light every pressure plate at the same time.
3. **The Grinder:** jump over low bars, duck under high ones, and dodge sliders, spikes and swinging blades.
4. **The Rune Vault:** a crystal flashes a pattern, and the crew steps on the runes in the same order.

| Difficulty | Time per room | What changes |
|---|---|---|
| Easy | 10:00 | Quick searches, bright rooms |
| Hard | 5:00 | Fake keys, rat traps, darker rooms, 4-digit safe, faster traps |
| Impossible | 2:00 | All of the above, plus slow searches and replaying the pattern costs time |

When the timer hits zero, a monster smashes through the wall and eats everyone. Eaten players become ghosts. Ghosts can watch and talk to each other, but the living can't hear them.

More players means bigger rooms, more keys and more plates. Every level after that adds keys, fakes, trap rows and pattern length.

## Proximity voice chat

- Voices come from each player's position in 3D, so you can hear which way a teammate is.
- Voices fade out around 22 m away.
- Walls muffle voices, so split up and you'll have to shout (or regroup).
- Turn your mic on in the lobby or from the Esc menu. Press **M** to mute.
- Press **T** for text chat. Only nearby players see it.

## Controls

| Key | Action |
|---|---|
| Mouse | Look (click the game first) |
| WASD | Move · **Shift** to sprint |
| Space | Jump |
| C / Ctrl | Crouch |
| E | Hold to search, press for doors, the safe and the lectern |
| F | Flashlight |
| M | Mute mic |
| T | Text chat |
| Esc | Menu (volume, brightness, mouse speed) |

## Run it

You need [Node.js](https://nodejs.org) 18 or newer. There is nothing to install.

```bash
node server.js
```

Open http://localhost:3000. Click **Create a room**, then share the invite link.

### Play with friends online (needed for voice)

Browsers only allow microphones on `https://` pages (or on `localhost`), so friends need an https address. Pick one of these:

**Option A: tunnel from your PC (fastest)**

1. Start the game with `node server.js`.
2. In a second terminal, run `npx cloudflared tunnel --url http://localhost:3000`. You can use [ngrok](https://ngrok.com) instead.
3. It prints an `https://….trycloudflare.com` address. Open it yourself and send it to your friends.

**Option B: free hosting (always on)**

On [Render](https://render.com), create a **Web Service** from this folder (push it to a GitHub repo first):

- Build command: none
- Start command: `node server.js`

Render sets `PORT` itself and gives you an https address. Railway, Fly.io and Glitch work the same way.

### If someone can't hear anyone

Voice connects players directly to each other. Some strict networks, like school, office and some mobile carriers, block that, and those players need a TURN relay server. Get free TURN credentials from a provider such as [Metered](https://www.metered.ca/tools/openrelay/), then start the server with:

```bash
TURN_URL=turn:your.turn.server:443 TURN_USER=username TURN_PASS=password node server.js
```

## How it works

- `server.js` is a dependency-free Node server. It serves the game, runs the rooms and relays messages. The first player in a room is the host. If the host leaves, the next player takes over without stopping the game.
- The host's browser runs the rules: what's hidden where, plates, runes, the timer and the monster. It sends the shared state to everyone 10 times a second.
- Each room is generated from a shared seed, so everyone builds the same manor.
- Voice uses WebRTC audio, one link per pair of players, played through Web Audio 3D panners.
- Every prop is built from simple shapes with cel shading and ink outlines (`public/js/props.js`). There are no model files to download, and you can add your own props there.
- Three.js loads from the jsDelivr CDN, so players need internet access.

## Files

```
server.js            game server (rooms, relay, voice signaling)
public/index.html    lobby, HUD and menus
public/js/main.js    first-person controls, host loop, avatars, chat
public/js/areas.js   the four rooms and their rules
public/js/props.js   the cartoon prop library
public/js/world.js   rooms, walls, lights, textures, collision
public/js/monster.js the monster
public/js/voice.js   proximity voice chat
public/js/net.js     connection and clock sync
```
