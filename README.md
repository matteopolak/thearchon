# Auto-Fisher for TheArchon 🎣
![Build Status](https://github.com/matteopolak/thearchon/actions/workflows/check.yml/badge.svg)
[![Discord Chat][discord-image]][discord-url]
[![License][license-image]][license-url]<br>

[discord-url]: https://discord.gg/VCC2UvcKuH
[discord-image]: https://img.shields.io/discord/958781045841485834.svg

[license-url]: https://opensource.org/licenses/MIT
[license-image]: https://img.shields.io/npm/l/make-coverage-badge.svg

A feature-packed auto-fishing bot for the Minecraft server [TheArchon](https://thearchon.net/).

## Disclaimer
Auto-fishing is against the rules, so using this tool will put you at risk of getting banned from TheArchon.

## Need support? [Join the Discord!](https://discord.gg/VCC2UvcKuH)

## Features
* Sells fish, replenishes bait, and upgrades fishing rods
* Solves anti-macro CAPTCHAs
* Keeps track of online (and vanished) staff members
* Support for SOCKS4/5 proxies
* Responds to direct messages with OpenAI (requires API key)
* Performs actions as response to direct messages with Wit.ai (requires API key)
* Reacts to external movement and rotation
* Discord integration
	* Receive notifications for direct messages and movement
	* Supports per-bot channel whitelisting for sending commands
* Reconnects on server restarts
* Automatically sends fishing money to your bank account
* Low memory footprint (~100MB per bot)
* Random movement
	* Easily create recordings

## Installation

* Install [Node.js version 16.0.0](https://nodejs.org/en/download/) or higher
* Ensure that yarn is installed (`npm install --global yarn`)
* Ensure that TypeScript is installed  (`yarn global add typescript`)
* Make appropriate changes to the configuration file
* Clone the repository then run the following commands in the folder:
```
> yarn install
> npm start
```

## Setup
Configuration is done in `src/config.ts`.
If you are setting this up for the first time, rename `src/config.example.ts` to `src/config.ts`.

All options are explained in the configuration file.

## Commands
These commands must be run in an McMMO party chat or Discord channel to which the bot(s) have access.

**WARNING: Commands that require a response from the bot will be sent to the party chat.**

| Command | Description |
| --- | --- |
| `accept` | Accepts a pending teleportation request |
| `bal` | Displays the bot's balance |
| `clear` | Goes to spawn and clears the bot's inventory of items that arent: <ul><li>Fish</li><li>Fishing Rods</li><li>Spawners</li><li>Bedrock</li></ul> |
| `entity` | Saves entities to `data/{username}/[entities+players].json` |
| `exec <command>` | Executes a command as the bot |
| `fish` | Starts fishing |
| `inventory` | Saves the contents of the bot's inventory to `data/{username}/inventory.json` |
| `look` | Looks at the player if they're in range |
| `mobcoins` | Displays the bot's MobCoin balance |
| `pay` | Sends the entirety of the bot's balance to the player (minus $150,000) |
| `stop` | Stops fishing |
| `sell <coins/mobcoins>` | Changes the exchange type for selling fish |
| `tp` | Sends a teleportation request to the player |
| `value` | Displays the current value in fish in the bot's inventory |

## Recordings

This section is only relevant if you are using the `random_movement` feature.

### Creating a new recording
1. Host a new Singleplayer world (open to LAN)
2. Run the command `npm run record -- <port>`
3. Type `start` in the chat to start recording
4. Type `stop` in the chat to stop recording; your recording will be saved to `recordings/{timestamp}.json`

### Using a recording

To use a recording as a random movement, add the name of the file to `config.random_movements.recordings`.