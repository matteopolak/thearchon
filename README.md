# Auto-Fisher for TheArchon 🎣
![Build Status](https://github.com/matteopolak/thearchon/actions/workflows/check.yml/badge.svg)
[![License][license-image]][license-url]<br>

[license-url]: https://opensource.org/licenses/MIT
[license-image]: https://img.shields.io/npm/l/make-coverage-badge.svg

A feature-packed auto-fishing bot for the Minecraft server [TheArchon](https://thearchon.net/).

## Disclaimer
Auto-fishing is against the rules, so using this tool will put you at risk of getting banned from TheArchon.

## Features
* Sells fish, replenishes bait, and upgrades fishing rods
* Solves anti-macro CAPTCHAs
* Reconnects on server restarts
* Automatically send fishing money to your bank account

## Setup
Configuration is done in `src/config.ts`.
If you are setting this up for the first time, rename `src/config.example.ts` to `src/config.ts`.
| Key | Value |
| --- | --- |
| `accounts` | The account information of the bots |
| `autopay_to` | The username of the player to automatically pay when `MONEY_THRESHOLD` is met |
| `whitelist` | The usernames of players that are allowed to execute commands |

## Installation

```console
> yarn install
> npm start
```

## Commands
These commands must be run in an McMMO party chat to which the bot(s) have access.

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